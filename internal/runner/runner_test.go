package runner

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"sync"
	"sync/atomic"
	"syscall"
	"testing"
	"time"

	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/llm/llmtest"
	"github.com/jackt/pset/internal/step"
	"github.com/jackt/pset/internal/store"
	"github.com/jackt/pset/internal/testx"
)

var bg = context.Background()

// The fake pipeline's steps, on a set.
const (
	stepA step.Name = "a"
	stepB step.Name = "b"
	stepC step.Name = "c"
)

// errBusy may pass by itself and names no condition.
var errBusy = errs.Define(errs.Entry{
	ID:     "runnertest.busy",
	Kind:   errs.KindPassing,
	What:   "Busy.",
	Status: http.StatusServiceUnavailable,
})

// env is a store with one course and its sets, a fake model endpoint and a
// key the test sets.
type env struct {
	t     *testing.T
	s     *store.Store
	model *llmtest.Server
	key   atomic.Value // string
}

func newEnv(t *testing.T, sets ...string) *env {
	t.Helper()
	s, err := store.Open(bg, filepath.Join(t.TempDir(), "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cleanup.Close(s.DB) })
	e := &env{t: t, s: s, model: llmtest.New(t)}
	e.key.Store("test")
	if len(sets) == 0 {
		sets = []string{"s1"}
	}
	e.write(func(tx *sql.Tx) error {
		now := db.Now()
		if _, err := tx.Exec(`INSERT INTO courses (id, name, created_at) VALUES ('c1', 'Signals', ?)`, now); err != nil {
			return err
		}
		for _, id := range sets {
			if _, err := tx.Exec(`INSERT INTO sets (id, course_id, title, due, created_at) VALUES (?, 'c1', ?, '', ?)`, id, id, now); err != nil {
				return err
			}
		}
		return nil
	})
	return e
}

func (e *env) write(fn func(*sql.Tx) error) {
	e.t.Helper()
	if err := e.s.Write(bg, change.ActorPSet, "", fn); err != nil {
		e.t.Fatal(err)
	}
}

// runner is a runner over the pipeline, with short waits.
func (e *env) runner(limits map[string]int, steps ...Handler) *Runner {
	r := New(e.s, Options{
		Limits:  limits,
		Key:     func(context.Context) (string, error) { return e.key.Load().(string), nil },
		BaseURL: e.model.URL,
	}, Pipeline{Kind: change.ResourceSet, Steps: steps})
	r.Backoff = []time.Duration{10 * time.Millisecond}
	return r
}

// start runs r until the returned stop is called, which waits for it.
func start(t *testing.T, r *Runner) (stop func()) {
	t.Helper()
	ctx, cancel := context.WithCancel(bg)
	done := make(chan error, 1)
	go func() { done <- r.Run(ctx) }()
	var once sync.Once
	stop = func() {
		once.Do(func() {
			cancel()
			select {
			case err := <-done:
				if err != nil {
					t.Errorf("run: %v", err)
				}
			case <-time.After(5 * time.Second):
				t.Error("the runner did not stop")
			}
		})
	}
	t.Cleanup(stop)
	return stop
}

// begin makes a set's steps, as the feature that adds the set would.
func (e *env) begin(r *Runner, set string) {
	e.t.Helper()
	e.write(func(tx *sql.Tx) error { return r.Start(bg, tx, change.ResourceSet, set) })
	r.Wake()
}

type row struct {
	state    step.State
	attempts int
	incident string
}

func (e *env) step(set string, name step.Name) row {
	e.t.Helper()
	var r row
	err := e.s.DB.QueryRow(`SELECT state, attempts, incident_id FROM steps WHERE subject_kind = 'set' AND subject_id = ? AND name = ?`,
		set, name).Scan(&r.state, &r.attempts, &r.incident)
	if err != nil {
		e.t.Fatalf("step %s of %s: %v", name, set, err)
	}
	return r
}

// wait polls until the step is in state.
func (e *env) wait(set string, name step.Name, state step.State) row {
	e.t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for {
		r := e.step(set, name)
		if r.state == state {
			return r
		}
		if time.Now().After(deadline) {
			e.t.Fatalf("step %s of %s is %s, want %s", name, set, r.state, state)
		}
		time.Sleep(5 * time.Millisecond)
	}
}

func (e *env) count(q string, args ...any) int {
	e.t.Helper()
	var n int
	if err := e.s.DB.QueryRow(q, args...).Scan(&n); err != nil {
		e.t.Fatalf("%s: %v", q, err)
	}
	return n
}

func ok(name step.Name, ran *atomic.Int32) Handler {
	return Handler{Name: name, Run: func(context.Context, *Run) error {
		ran.Add(1)
		return nil
	}}
}

// A three-step pipeline runs in order; killed partway (shut down, or
// crashed with a step left running) it resumes on the next start, without
// running again what was done or counting the cut-short run as a try.
func TestAPipelineSurvivesAKillAndARestart(t *testing.T) {
	e := newEnv(t)
	var ranA, ranC atomic.Int32
	entered := make(chan struct{}, 1)
	block := Handler{Name: stepB, Run: func(ctx context.Context, _ *Run) error {
		entered <- struct{}{}
		<-ctx.Done()
		return ctx.Err()
	}}
	r := e.runner(nil, ok(stepA, &ranA), block, ok(stepC, &ranC))
	stop := start(t, r)
	e.begin(r, "s1")
	<-entered
	if got := e.step("s1", stepC).state; got != step.StateWaiting {
		t.Fatalf("c ran before b was done: %s", got)
	}
	stop()
	if got := e.step("s1", stepB); got.state != step.StateWaiting || got.attempts != 0 {
		t.Fatalf("after a shutdown b is %+v, want waiting with no tries spent", got)
	}

	// A crash: b left running, as a killed process leaves it.
	e.write(func(tx *sql.Tx) error {
		_, err := tx.Exec(`UPDATE steps SET state = 'running', attempts = 1 WHERE name = 'b'`)
		return err
	})
	var ranB atomic.Int32
	r = e.runner(nil, ok(stepA, &ranA), ok(stepB, &ranB), ok(stepC, &ranC))
	start(t, r)
	e.wait("s1", stepC, step.StateDone)
	if ranA.Load() != 1 || ranB.Load() != 1 || ranC.Load() != 1 {
		t.Fatalf("runs a=%d b=%d c=%d, want one each", ranA.Load(), ranB.Load(), ranC.Load())
	}
	if got := e.step("s1", stepB).attempts; got != 1 {
		t.Fatalf("b took %d tries after the crash, want 1", got)
	}
}

// A failure that may pass is tried again after a wait, up to Tries; then it
// is said, and Try again gives it its tries afresh.
func TestAPassingFailureRetriesThenFailsAndTryAgainStartsOver(t *testing.T) {
	e := newEnv(t)
	var calls atomic.Int32
	failFor := atomic.Int32{}
	failFor.Store(1 << 20)
	flaky := Handler{Name: stepA, Run: func(context.Context, *Run) error {
		if calls.Add(1) <= failFor.Load() {
			return errBusy.New()
		}
		return nil
	}}
	r := e.runner(nil, flaky)
	start(t, r)
	e.begin(r, "s1")
	failed := e.wait("s1", stepA, step.StateFailed)
	if failed.attempts != Tries || calls.Load() != Tries {
		t.Fatalf("failed after %d tries (%d runs), want %d", failed.attempts, calls.Load(), Tries)
	}
	var kind, state string
	if err := e.s.DB.QueryRow(`SELECT kind, state FROM incidents WHERE id = ?`, failed.incident).Scan(&kind, &state); err != nil {
		t.Fatal(err)
	}
	if kind != string(errs.KindOurs) || state != "open" {
		t.Fatalf("the incident is %s, %s; want ours, open", kind, state)
	}

	// Try again: it passes on the second try of its new run.
	failFor.Store(calls.Load() + 1)
	if err := r.TryAgain(bg, failed.incident); err != nil {
		t.Fatal(err)
	}
	done := e.wait("s1", stepA, step.StateDone)
	if done.attempts != 2 {
		t.Fatalf("Try again's run took %d tries, want 2: its tries start over", done.attempts)
	}
	if err := e.s.DB.QueryRow(`SELECT state FROM incidents WHERE id = ?`, failed.incident).Scan(&state); err != nil || state != "tried_again" {
		t.Fatalf("the old incident is %q (%v), want tried_again", state, err)
	}
}

// A step that needs a key nobody saved waits; every step waiting on the key
// shares one incident, and saving a key runs them all by itself.
func TestAStepWaitingOnTheKeyRunsOnceAKeyIsSaved(t *testing.T) {
	e := newEnv(t, "s1", "s2")
	e.key.Store("")
	e.model.Fallback(func(llm.ChatRequest) llmtest.Reply { return llmtest.Reply{Text: "ok"} })
	call := Handler{Name: stepA, Run: func(ctx context.Context, run *Run) error {
		c, err := run.Client(ctx)
		if err != nil {
			return err
		}
		_, err = c.ChatOnce(ctx, run.Request(llm.ChatRequest{Model: "fake-chat", Messages: []llm.Message{llm.TextMessage("user", "hi")}}))
		return err
	}}
	r := e.runner(nil, call)
	start(t, r)
	e.begin(r, "s1")
	e.begin(r, "s2")
	for _, set := range []string{"s1", "s2"} {
		deadline := time.Now().Add(5 * time.Second)
		for e.step(set, stepA).incident == "" {
			if time.Now().After(deadline) {
				t.Fatalf("%s never waited on the key", set)
			}
			time.Sleep(5 * time.Millisecond)
		}
	}
	one, two := e.step("s1", stepA), e.step("s2", stepA)
	if one.state != step.StateWaiting || one.incident != two.incident {
		t.Fatalf("waiting on the key: %+v and %+v, want both waiting on one incident", one, two)
	}
	if n := e.count(`SELECT count(*) FROM conditions WHERE id = 'key' AND holds = 0`); n != 1 {
		t.Fatal("the key condition does not say it is missing")
	}

	e.key.Store("sk-new")
	if err := r.Holds(bg, "key"); err != nil {
		t.Fatal(err)
	}
	e.wait("s1", stepA, step.StateDone)
	e.wait("s2", stepA, step.StateDone)
	var state string
	if err := e.s.DB.QueryRow(`SELECT state FROM incidents WHERE id = ?`, one.incident).Scan(&state); err != nil || state != "healed" {
		t.Fatalf("the key's incident is %q (%v), want healed", state, err)
	}
	if n := e.count(`SELECT count(*) FROM conditions WHERE id = 'key' AND holds = 1`); n != 1 {
		t.Fatal("the key condition does not hold again")
	}
}

// The provider still not answering after every try waits on the provider,
// rather than failing for good.
func TestTheProviderDownWaitsOnTheProvider(t *testing.T) {
	e := newEnv(t)
	var down atomic.Bool
	down.Store(true)
	h := Handler{Name: stepA, Run: func(context.Context, *Run) error {
		if down.Load() {
			return llm.ModelUnreachable.New()
		}
		return nil
	}}
	r := e.runner(nil, h)
	start(t, r)
	e.begin(r, "s1")
	deadline := time.Now().Add(5 * time.Second)
	for e.step("s1", stepA).incident == "" {
		if time.Now().After(deadline) {
			t.Fatal("never waited on the provider")
		}
		time.Sleep(5 * time.Millisecond)
	}
	if got := e.step("s1", stepA); got.state != step.StateWaiting || got.attempts != Tries {
		t.Fatalf("after the provider failed every try: %+v, want waiting after %d", got, Tries)
	}
	if e.count(`SELECT count(*) FROM incidents WHERE clears = 'provider' AND state = 'open' AND kind = 'waiting_on_you'`) != 1 {
		t.Fatal("no open incident waiting on the provider")
	}
	down.Store(false)
	if err := r.Holds(bg, "provider"); err != nil {
		t.Fatal(err)
	}
	e.wait("s1", stepA, step.StateDone)
}

// A cause the computer shows names its condition, whatever it came
// wrapped in.
func TestAFullDiskWaitsOnDiskSpace(t *testing.T) {
	e := newEnv(t)
	h := Handler{Name: stepA, Run: func(context.Context, *Run) error {
		return errs.Disk.Wrap(fmt.Errorf("write page: %w", syscall.ENOSPC))
	}}
	r := e.runner(nil, h)
	start(t, r)
	e.begin(r, "s1")
	deadline := time.Now().Add(5 * time.Second)
	for e.count(`SELECT count(*) FROM incidents WHERE clears = 'disk_space' AND state = 'open'`) == 0 {
		if time.Now().After(deadline) {
			t.Fatalf("a full disk is %+v, with no incident waiting on disk space", e.step("s1", stepA))
		}
		time.Sleep(5 * time.Millisecond)
	}
}

// When a step's input changes after it ran, an eager step runs again and a
// lazy one goes out of date until asked.
func TestAChangedInputRerunsEagerAndStalesLazy(t *testing.T) {
	e := newEnv(t)
	input := func(_ context.Context, d *sql.DB, id string) (string, error) {
		var title string
		err := d.QueryRow(`SELECT title FROM sets WHERE id = ?`, id).Scan(&title)
		return title, err
	}
	var ranA, ranB atomic.Int32
	eager := ok(stepA, &ranA)
	eager.Input = input
	lazy := ok(stepB, &ranB)
	lazy.Input, lazy.Lazy, lazy.After = input, true, []step.Name{}
	r := e.runner(nil, eager, lazy)
	start(t, r)
	e.begin(r, "s1")
	e.wait("s1", stepA, step.StateDone)
	if got := e.step("s1", stepB).state; got != step.StateNotAsked {
		t.Fatalf("a lazy step is %s before it is asked", got)
	}
	e.write(func(tx *sql.Tx) error { return r.Ask(bg, tx, change.ResourceSet, "s1", stepB, PriorityOpened) })
	r.Wake()
	e.wait("s1", stepB, step.StateDone)

	e.write(func(tx *sql.Tx) error {
		_, err := tx.Exec(`UPDATE sets SET title = 'Problem set 5' WHERE id = 's1'`)
		return err
	})
	if err := r.Changed(bg, change.ResourceSet, "s1"); err != nil {
		t.Fatal(err)
	}
	e.wait("s1", stepB, step.StateOutOfDate)
	deadline := time.Now().Add(5 * time.Second)
	for ranA.Load() < 2 {
		if time.Now().After(deadline) {
			t.Fatal("the eager step did not run again")
		}
		time.Sleep(5 * time.Millisecond)
	}
	e.wait("s1", stepA, step.StateDone)
	if ranB.Load() != 1 {
		t.Fatal("the lazy step ran again unasked")
	}

	// Nothing changed: nothing goes out of date.
	if err := r.Changed(bg, change.ResourceSet, "s1"); err != nil {
		t.Fatal(err)
	}
	if got := e.step("s1", stepA).state; got != step.StateDone {
		t.Fatalf("an unchanged input left a %s step", got)
	}
}

// A step's model calls are kept on it, add up to its usage, and go with
// their subject.
func TestCallsAreKeyedToTheirStepAndGoWithTheirSubject(t *testing.T) {
	e := newEnv(t)
	e.model.Script(llmtest.Reply{Text: "one"}, llmtest.Reply{Text: "two"})
	h := Handler{Name: stepA, Run: func(ctx context.Context, run *Run) error {
		c, err := run.Client(ctx)
		if err != nil {
			return err
		}
		for range 2 {
			if _, err := c.ChatOnce(ctx, run.Request(llm.ChatRequest{Model: "fake-chat", Messages: []llm.Message{llm.TextMessage("user", "hi")}})); err != nil {
				return err
			}
		}
		return nil
	}}
	r := e.runner(nil, h)
	start(t, r)
	e.begin(r, "s1")
	e.wait("s1", stepA, step.StateDone)
	steps, err := r.Steps(bg, change.ResourceSet, "s1")
	if err != nil {
		t.Fatal(err)
	}
	if len(steps) != 1 || steps[0].Usage == nil || steps[0].Usage.Total.Calls != 2 {
		t.Fatalf("the step's usage is %+v, want its two calls", steps)
	}

	e.write(func(tx *sql.Tx) error {
		_, err := tx.Exec(`UPDATE sets SET removed_at = ? WHERE id = 's1'`, db.Now())
		return err
	})
	if err := e.s.Purge(bg, time.Now().Add(8*24*time.Hour)); err != nil {
		t.Fatal(err)
	}
	if n := e.count(`SELECT count(*) FROM steps`) + e.count(`SELECT count(*) FROM calls`); n != 0 {
		t.Fatalf("%d steps and calls outlived their purged set", n)
	}
}

// Removing a subject pauses its running step; undoing the removal lets it
// carry on, the paused run not counted as a try.
func TestRemovingASubjectPausesItsRunningStep(t *testing.T) {
	e := newEnv(t)
	var runs atomic.Int32
	entered := make(chan struct{}, 2)
	h := Handler{Name: stepA, Run: func(ctx context.Context, _ *Run) error {
		if runs.Add(1) == 1 {
			entered <- struct{}{}
			<-ctx.Done()
			return ctx.Err()
		}
		return nil
	}}
	r := e.runner(nil, h)
	start(t, r)
	e.begin(r, "s1")
	<-entered
	e.write(func(tx *sql.Tx) error {
		_, err := tx.Exec(`UPDATE sets SET removed_at = ? WHERE id = 's1'`, db.Now())
		return err
	})
	r.Wake()
	paused := e.wait("s1", stepA, step.StateWaiting)
	if paused.attempts != 0 {
		t.Fatalf("a paused run counted as %d tries", paused.attempts)
	}
	time.Sleep(50 * time.Millisecond)
	if got := e.step("s1", stepA).state; got != step.StateWaiting {
		t.Fatalf("a removed set's step started again: %s", got)
	}
	e.write(func(tx *sql.Tx) error {
		_, err := tx.Exec(`UPDATE sets SET removed_at = '' WHERE id = 's1'`)
		return err
	})
	r.Wake()
	e.wait("s1", stepA, step.StateDone)
}

// Steps against one model run no more at once than its limit.
func TestAModelsLimitIsKept(t *testing.T) {
	e := newEnv(t, "s1", "s2", "s3")
	var now, most atomic.Int32
	h := Handler{Name: stepA, Model: "slow", Run: func(context.Context, *Run) error {
		n := now.Add(1)
		for {
			m := most.Load()
			if n <= m || most.CompareAndSwap(m, n) {
				break
			}
		}
		time.Sleep(30 * time.Millisecond)
		now.Add(-1)
		return nil
	}}
	r := e.runner(map[string]int{"slow": 1}, h)
	start(t, r)
	for _, s := range []string{"s1", "s2", "s3"} {
		e.begin(r, s)
	}
	for _, s := range []string{"s1", "s2", "s3"} {
		e.wait(s, stepA, step.StateDone)
	}
	if most.Load() != 1 {
		t.Fatalf("%d ran at once against a limit of 1", most.Load())
	}
}

// A handler's panic is a failure, not a dead server.
func TestAPanicFailsTheStep(t *testing.T) {
	e := newEnv(t)
	h := Handler{Name: stepA, Run: func(context.Context, *Run) error { panic("boom") }}
	r := e.runner(nil, h)
	start(t, r)
	e.begin(r, "s1")
	e.wait("s1", stepA, step.StateFailed)
}

func TestTryAgainOnNothing(t *testing.T) {
	e := newEnv(t)
	r := e.runner(nil)
	if err := r.TryAgain(bg, "INC404"); !errors.Is(err, IncidentGone) {
		t.Fatalf("Try again on no incident: %v", err)
	}
}

// A run whose ending can't be written (a full disk, a locked database) is
// written once it can: the step never shows as running for good, and is not
// started twice meanwhile.
func TestAnEndingThatCantBeWrittenIsWrittenLater(t *testing.T) {
	e := newEnv(t)
	var runs atomic.Int32
	r := e.runner(nil, ok(stepA, &runs))
	r.SettleRetry = 20 * time.Millisecond
	// The store refuses to write the step done, as a full disk would.
	testx.Check(t, testx.Err(e.s.DB.Exec(`CREATE TRIGGER refuse_done BEFORE UPDATE OF state ON steps
		WHEN NEW.state = 'done' BEGIN SELECT RAISE(ABORT, 'disk full'); END`)))
	start(t, r)
	e.begin(r, "s1")
	deadline := time.Now().Add(5 * time.Second)
	for runs.Load() == 0 {
		if time.Now().After(deadline) {
			t.Fatal("the step never ran")
		}
		time.Sleep(5 * time.Millisecond)
	}
	time.Sleep(100 * time.Millisecond)
	if got := e.step("s1", stepA).state; got != step.StateRunning {
		t.Fatalf("while its ending can't be written the step is %s, want still running", got)
	}
	testx.Check(t, testx.Err(e.s.DB.Exec(`DROP TRIGGER refuse_done`)))
	e.wait("s1", stepA, step.StateDone)
	if runs.Load() != 1 {
		t.Fatalf("the step ran %d times, want once", runs.Load())
	}
}

// A step whose inputs can't be read fails on its own; the steps behind it
// still run.
func TestAnInputThatCantBeReadFailsOnlyItsStep(t *testing.T) {
	e := newEnv(t, "s1", "s2")
	var ranB atomic.Int32
	broken := Handler{Name: stepA, After: []step.Name{}, Run: func(context.Context, *Run) error { return nil },
		Input: func(_ context.Context, _ *sql.DB, id string) (string, error) {
			if id == "s1" {
				return "", errs.Data.Wrap(errors.New("unreadable"))
			}
			return id, nil
		}}
	r := e.runner(nil, broken, Handler{Name: stepB, After: []step.Name{}, Run: func(context.Context, *Run) error {
		ranB.Add(1)
		return nil
	}})
	start(t, r)
	e.write(func(tx *sql.Tx) error {
		if err := r.Start(bg, tx, change.ResourceSet, "s1"); err != nil {
			return err
		}
		// s1's broken step goes first.
		_, err := tx.Exec(`UPDATE steps SET priority = 99 WHERE subject_id = 's1' AND name = 'a'`)
		return err
	})
	e.begin(r, "s2")
	e.wait("s1", stepA, step.StateFailed)
	e.wait("s2", stepA, step.StateDone)
	e.wait("s2", stepB, step.StateDone)
}

// A key saved while a step's call is failing for want of one: the step runs
// again, rather than wait on a key that is already there.
func TestAKeySavedAsTheCallFailsDoesNotStrandTheStep(t *testing.T) {
	e := newEnv(t)
	inCall, release := make(chan struct{}), make(chan struct{})
	var runs atomic.Int32
	h := Handler{Name: stepA, Run: func(context.Context, *Run) error {
		if runs.Add(1) == 1 {
			close(inCall)
			<-release
			return llm.KeyMissing.New()
		}
		return nil
	}}
	r := e.runner(nil, h)
	start(t, r)
	e.begin(r, "s1")
	<-inCall
	if err := r.Holds(bg, "key"); err != nil {
		t.Fatal(err)
	}
	close(release)
	got := e.wait("s1", stepA, step.StateDone)
	if got.incident != "" || e.count(`SELECT count(*) FROM incidents WHERE state = 'open'`) != 0 {
		t.Fatalf("the step is %+v with an open incident, though the key came back as it failed", got)
	}
}

// A model call that works shows the provider is back: what waited on it
// runs again by itself.
func TestACallThatWorksHealsTheProvider(t *testing.T) {
	e := newEnv(t, "s1", "s2")
	e.model.Fallback(func(llm.ChatRequest) llmtest.Reply { return llmtest.Reply{Text: "ok"} })
	var down atomic.Bool
	down.Store(true)
	h := Handler{Name: stepA, Run: func(ctx context.Context, run *Run) error {
		if run.SubjectID == "s1" && down.Load() {
			return llm.ModelUnreachable.New()
		}
		c, err := run.Client(ctx)
		if err != nil {
			return err
		}
		_, err = c.ChatOnce(ctx, run.Request(llm.ChatRequest{Model: "fake-chat", Messages: []llm.Message{llm.TextMessage("user", "hi")}}))
		return err
	}}
	r := e.runner(nil, h)
	start(t, r)
	e.begin(r, "s1")
	deadline := time.Now().Add(5 * time.Second)
	for e.step("s1", stepA).incident == "" {
		if time.Now().After(deadline) {
			t.Fatal("s1 never waited on the provider")
		}
		time.Sleep(5 * time.Millisecond)
	}
	down.Store(false)
	e.begin(r, "s2") // its call works
	e.wait("s2", stepA, step.StateDone)
	e.wait("s1", stepA, step.StateDone)
	if n := e.count(`SELECT count(*) FROM conditions WHERE id = 'provider' AND holds = 1`); n != 1 {
		t.Fatal("the provider does not hold again")
	}
}

// Shut down while a step waits to be tried again: it keeps its place and
// its tries, and runs when due after the next start.
func TestAStepRetryingAcrossARestartRunsWhenDue(t *testing.T) {
	e := newEnv(t)
	var runs atomic.Int32
	h := Handler{Name: stepA, Run: func(context.Context, *Run) error {
		if runs.Add(1) == 1 {
			return errBusy.New()
		}
		return nil
	}}
	r := e.runner(nil, h)
	r.Backoff = []time.Duration{200 * time.Millisecond}
	stop := start(t, r)
	e.begin(r, "s1")
	e.wait("s1", stepA, step.StateRetrying)
	stop()
	r = e.runner(nil, h)
	start(t, r)
	got := e.wait("s1", stepA, step.StateDone)
	if got.attempts != 2 {
		t.Fatalf("done after %d tries, want 2", got.attempts)
	}
}

// Settings asks each condition to hold every time it opens: with nothing
// broken, that writes nothing.
func TestHoldingWithNothingBrokenWritesNothing(t *testing.T) {
	e := newEnv(t)
	r := e.runner(nil)
	before := e.count(`SELECT count(*) FROM changes`)
	for _, c := range []string{"key", "data_folder", "disk_space"} {
		if err := r.Holds(bg, c); err != nil {
			t.Fatal(err)
		}
	}
	if after := e.count(`SELECT count(*) FROM changes`); after != before {
		t.Fatalf("holding what already held logged %d changes", after-before)
	}
}

// A key saved while the failure's write is still going (decided to wait,
// not yet committed): Holds waits for that write and heals what it wrote,
// so the step runs.
func TestAKeySavedAsTheWaitIsWrittenDoesNotStrandTheStep(t *testing.T) {
	e := newEnv(t)
	var runs atomic.Int32
	h := Handler{Name: stepA, Run: func(context.Context, *Run) error {
		if runs.Add(1) == 1 {
			return llm.KeyMissing.New()
		}
		return nil
	}}
	r := e.runner(nil, h)
	inWrite, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	r.failing = func() {
		once.Do(func() {
			close(inWrite)
			<-release
		})
	}
	start(t, r)
	e.begin(r, "s1")
	<-inWrite
	held := make(chan error, 1)
	go func() { held <- r.Holds(bg, "key") }()
	time.Sleep(50 * time.Millisecond) // Holds reaches its write and waits
	close(release)
	if err := <-held; err != nil {
		t.Fatal(err)
	}
	got := e.wait("s1", stepA, step.StateDone)
	if got.incident != "" || e.count(`SELECT count(*) FROM incidents WHERE state = 'open'`) != 0 {
		t.Fatalf("the step is %+v with an open incident, though the key came back as its wait was written", got)
	}
}

// A done step whose inputs can no longer be read does not hold up the
// steps after it from finishing.
func TestASiblingsUnreadableInputDoesNotHoldAFinishedStep(t *testing.T) {
	e := newEnv(t)
	var bad atomic.Bool
	var ranA, ranB atomic.Int32
	a := ok(stepA, &ranA)
	a.Input = func(context.Context, *sql.DB, string) (string, error) {
		if bad.Load() {
			return "", errs.Data.Wrap(errors.New("its row is gone"))
		}
		return "x", nil
	}
	entered, release := make(chan struct{}), make(chan struct{})
	b := Handler{Name: stepB, Run: func(context.Context, *Run) error {
		ranB.Add(1)
		close(entered)
		<-release
		return nil
	}}
	r := e.runner(nil, a, b)
	r.SettleRetry = 10 * time.Millisecond
	start(t, r)
	e.begin(r, "s1")
	<-entered
	bad.Store(true)
	close(release)
	e.wait("s1", stepB, step.StateDone)
	deadline := time.Now().Add(2 * time.Second)
	for len(r.Running()) != 0 {
		if time.Now().After(deadline) {
			t.Fatal("the finished step still holds its slot")
		}
		time.Sleep(5 * time.Millisecond)
	}
}

// The development switch: the next run of a step fails with the error
// asked for, and the one after runs as it would.
func TestForceFailsTheNextRunOnly(t *testing.T) {
	e := newEnv(t)
	var runs atomic.Int32
	r := e.runner(nil, ok(stepA, &runs))
	if err := r.Force(stepA, errs.Unexpected, 1); err != nil {
		t.Fatal(err)
	}
	start(t, r)
	e.begin(r, "s1")
	failed := e.wait("s1", stepA, step.StateFailed)
	if runs.Load() != 0 {
		t.Fatal("a forced failure ran the handler")
	}
	if err := r.TryAgain(bg, failed.incident); err != nil {
		t.Fatal(err)
	}
	e.wait("s1", stepA, step.StateDone)
	if runs.Load() != 1 {
		t.Fatalf("after the forced failure the step ran %d times", runs.Load())
	}
}

// Forced twice, a step fails twice and then runs; forcing it 0 times stops
// what was forced; a step no pipeline has is refused.
func TestForceCountsAndStops(t *testing.T) {
	e := newEnv(t)
	var runs atomic.Int32
	r := e.runner(nil, ok(stepA, &runs))
	if err := r.Force("no_such_step", errs.Unexpected, 1); !errors.Is(err, errs.Gone) {
		t.Fatalf("forcing a step no pipeline has: %v", err)
	}
	if err := r.Force(stepA, errs.Unexpected, 2); err != nil {
		t.Fatal(err)
	}
	start(t, r)
	e.begin(r, "s1")
	for i := range 2 {
		failed := e.wait("s1", stepA, step.StateFailed)
		if runs.Load() != 0 {
			t.Fatalf("forced failure %d ran the handler", i+1)
		}
		if err := r.TryAgain(bg, failed.incident); err != nil {
			t.Fatal(err)
		}
	}
	e.wait("s1", stepA, step.StateDone)
	if runs.Load() != 1 {
		t.Fatalf("after two forced failures the step ran %d times", runs.Load())
	}

	if err := r.Force(stepA, errs.Unexpected, 5); err != nil {
		t.Fatal(err)
	}
	if err := r.Force(stepA, errs.Unexpected, 0); err != nil {
		t.Fatal(err)
	}
	if err := r.forcedFor(stepA); err != nil {
		t.Fatalf("after forcing 0 times the step still fails: %v", err)
	}
}
