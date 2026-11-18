// Package runner runs every piece of PSet's background work as steps
// (ideas/backend-courses-grill.md, D3 and D4): a material's import, a
// question's find, figures, guide and check, a set's ranking, an Ask
// turn's answer. A step's state is a row in the store's steps table, logged
// like any change, so the page sees each step as it moves. What a step
// makes lives in its own table.
//
// The runner owns, once, what each feature used to write for itself: order,
// limits per model, retry, resume after a restart, failure as an incident,
// healing when a cause is gone, going out of date when an input changes, and
// keying model calls to the step that made them.
package runner

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"net/http"
	"slices"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/condition"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/step"
	"github.com/jackt/pset/internal/store"
)

// Handler is one kind of step.
type Handler struct {
	Name step.Name
	// After names the steps of the same subject that must be done first.
	// Nil is every step before this one in its pipeline.
	After []step.Name
	// Lazy steps are made not_asked and run only once asked for (Ask): a
	// guide is written three ahead, or when its problem is opened (D9).
	// When their inputs change after they ran, they go out_of_date and
	// wait to be asked again (D6); an eager step just runs again.
	Lazy bool
	// Model is the limit the step counts against (DefaultLimit when not in
	// the runner's limits). Steps calling one model share its limit.
	Model string
	// Input hashes what the step reads, from committed data. A done step
	// whose inputs hash the same is never run again. Nil: no inputs to
	// watch.
	Input func(ctx context.Context, d *sql.DB, subjectID string) (string, error)
	// Run does the work. It gets the model client from run.Client, writes
	// what it makes through run.Write, keys its model calls with
	// run.Request, and says what it is doing with run.Activity. A failure's
	// catalog kind decides what happens next.
	Run func(ctx context.Context, run *Run) error
}

// Pipeline is the steps of one kind of subject, in order.
type Pipeline struct {
	Kind  change.Resource
	Steps []Handler
}

// DefaultLimit is how many steps of one model run at once when the runner
// is given no limit for it.
const DefaultLimit = 2

// Tries is how many times a passing failure is tried before it is said.
const Tries = 3

// Options are what main gives the runner, once.
type Options struct {
	// Limits are steps at once per model.
	Limits map[string]int
	// Key is the OpenRouter key saved now, blank when none is. The model
	// client is built once from it and reads it for every call.
	Key func(context.Context) (string, error)
	// BaseURL is where the client sends chat requests: OpenRouter, or a
	// test's server.
	BaseURL string
	// DataDir is the data folder: a permission refused under it means the
	// folder is the trouble (condition data_folder).
	DataDir string
}

// Runner schedules and runs steps.
type Runner struct {
	store  *store.Store
	pipes  map[change.Resource]Pipeline
	limits map[string]int
	key    func(context.Context) (string, error)
	client *llm.Client
	// Now is the clock and Backoff the waits before a passing failure is
	// tried again, after the first, second, ... failure. Tests set both.
	Now     func() time.Time
	Backoff []time.Duration
	// SettleRetry is the wait before writing how a run ended is tried again,
	// after that write failed.
	SettleRetry time.Duration

	dataDir string
	wake    chan struct{}

	mu      sync.Mutex
	running map[string]*running // by step id
	busy    map[string]int      // running steps per model
	broken  map[string]bool     // conditions known not to hold
	// healed counts each condition's Holds, so a run that fails for want
	// of a condition can tell it came back while the run was going.
	healed map[string]int
	// failing, in tests, runs inside a failure's write, after it has
	// decided to wait on a condition and before it commits.
	failing func()
	wg      sync.WaitGroup
}

type running struct {
	cancel  context.CancelCauseFunc
	handler *Handler
}

// New is a runner for the given pipelines.
func New(s *store.Store, o Options, pipes ...Pipeline) *Runner {
	if o.BaseURL == "" {
		o.BaseURL = llm.OpenRouter
	}
	if o.Key == nil {
		o.Key = func(context.Context) (string, error) { return "", nil }
	}
	r := &Runner{
		store: s, pipes: map[change.Resource]Pipeline{}, limits: o.Limits,
		key: o.Key, client: llm.NewKeyed(o.BaseURL, o.Key),
		Now:         time.Now,
		Backoff:     []time.Duration{8 * time.Second, 30 * time.Second, 2 * time.Minute},
		SettleRetry: time.Second,
		dataDir:     o.DataDir,
		wake:        make(chan struct{}, 1),
		running:     map[string]*running{}, busy: map[string]int{}, broken: map[string]bool{}, healed: map[string]int{},
	}
	for _, p := range pipes {
		r.pipes[p.Kind] = p
	}
	return r
}

// Add puts a pipeline on the runner, before Run: a feature that starts its
// subjects' steps through the runner is built with it, then hands it its
// pipeline.
func (r *Runner) Add(p Pipeline) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.pipes[p.Kind] = p
}

func (r *Runner) handler(kind change.Resource, name step.Name) (*Handler, int, bool) {
	p, ok := r.pipes[kind]
	if !ok {
		return nil, 0, false
	}
	for i := range p.Steps {
		if p.Steps[i].Name == name {
			return &p.Steps[i], i, true
		}
	}
	return nil, 0, false
}

// after is the names h waits for.
func (r *Runner) after(kind change.Resource, h *Handler, pos int) []step.Name {
	if h.After != nil {
		return h.After
	}
	var out []step.Name
	for _, prev := range r.pipes[kind].Steps[:pos] {
		out = append(out, prev.Name)
	}
	return out
}

// Wake tells the runner there may be work: call it after the commit that
// made some (the store's write, which Start and Ask run inside of).
func (r *Runner) Wake() {
	select {
	case r.wake <- struct{}{}:
	default:
	}
}

// Start makes the steps of a new subject, inside the caller's store.Write:
// eager ones waiting, lazy ones not asked. Call Wake after the commit.
func (r *Runner) Start(ctx context.Context, tx *sql.Tx, kind change.Resource, id string) error {
	p, ok := r.pipes[kind]
	if !ok {
		return errs.Data.Wrap(fmt.Errorf("runner: no pipeline for %s", kind))
	}
	now := db.Now()
	for i, h := range p.Steps {
		state := step.StateWaiting
		if h.Lazy {
			state = step.StateNotAsked
		}
		_, err := tx.ExecContext(ctx, `INSERT INTO steps (id, subject_kind, subject_id, name, position, state, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (subject_kind, subject_id, name) DO NOTHING`,
			uuid.NewString(), kind, id, h.Name, i, state, now)
		if err != nil {
			return errs.Database.Wrap(err)
		}
	}
	return nil
}

// Priorities. A step asked for by the student opening its subject goes
// ahead of what PSet does on its own (D10).
const (
	PriorityOwn    = 0
	PriorityOpened = 10
)

// Ask asks for a step, inside the caller's store.Write: a lazy step not yet
// asked, a step out of date (Rewrite), or a failed one (Try again). A done
// step, or one already on its way, only takes the higher priority. Call
// Wake after the commit.
func (r *Runner) Ask(ctx context.Context, tx *sql.Tx, kind change.Resource, id string, name step.Name, priority int) error {
	var stepID, state, incident string
	err := tx.QueryRowContext(ctx, `SELECT id, state, incident_id FROM steps WHERE subject_kind = ? AND subject_id = ? AND name = ?`,
		kind, id, name).Scan(&stepID, &state, &incident)
	if err != nil {
		return errs.Database.Wrap(err)
	}
	if _, err := tx.ExecContext(ctx, `UPDATE steps SET priority = max(priority, ?) WHERE id = ?`, priority, stepID); err != nil {
		return errs.Database.Wrap(err)
	}
	switch step.State(state) {
	case step.StateNotAsked, step.StateOutOfDate, step.StateFailed:
	default:
		return nil
	}
	// Asked again is a new run: its tries start over.
	if _, err := tx.ExecContext(ctx, `UPDATE steps SET state = 'waiting', incident_id = '', retry_at = '', attempts = 0 WHERE id = ?`, stepID); err != nil {
		return errs.Database.Wrap(err)
	}
	if incident != "" {
		// Trying again resolves what it failed on; failing again opens a
		// new one, so a cause that is still there is said again.
		_, err := tx.ExecContext(ctx, `UPDATE incidents SET state = 'tried_again', resolved_at = ?
			WHERE id = ? AND state = 'open' AND kind != 'waiting_on_you'`, db.Now(), incident)
		return errs.Database.Of(err)
	}
	return nil
}

// Changed is called after a subject's inputs changed and committed (a note
// edited, a reading corrected): every done step whose inputs no longer hash
// the same goes out of date, or runs again if it is eager.
func (r *Runner) Changed(ctx context.Context, kind change.Resource, id string) error {
	type done struct {
		id, hash string
		h        *Handler
	}
	rows, err := r.store.DB.QueryContext(ctx, `SELECT id, name, input_hash FROM steps
		WHERE subject_kind = ? AND subject_id = ? AND state = 'done' ORDER BY position`, kind, id)
	if err != nil {
		return errs.Database.Wrap(err)
	}
	var ds []done
	for rows.Next() {
		var d done
		var name string
		if err := rows.Scan(&d.id, &name, &d.hash); err != nil {
			cleanup.Close(rows)
			return errs.Database.Wrap(err)
		}
		if h, _, ok := r.handler(kind, step.Name(name)); ok && h.Input != nil {
			d.h = h
			ds = append(ds, d)
		}
	}
	cleanup.Close(rows)
	if err := rows.Err(); err != nil {
		return errs.Database.Wrap(err)
	}
	var stale []done
	for _, d := range ds {
		hash, err := d.h.Input(ctx, r.store.DB, id)
		if err != nil {
			return err
		}
		if hash != d.hash {
			stale = append(stale, d)
		}
	}
	if len(stale) == 0 {
		return nil
	}
	err = r.store.Write(ctx, change.ActorPSet, "", func(tx *sql.Tx) error {
		for _, d := range stale {
			state := step.StateWaiting
			if d.h.Lazy {
				state = step.StateOutOfDate
			}
			if _, err := tx.ExecContext(ctx, `UPDATE steps SET state = ?, attempts = 0 WHERE id = ? AND state = 'done'`, state, d.id); err != nil {
				return errs.Database.Wrap(err)
			}
		}
		return nil
	})
	r.Wake()
	return err
}

// poll is the backstop for a Wake missed, and how often a retrying step's
// time is looked at.
const poll = time.Second

// Run schedules steps until ctx ends, then waits for the running ones to
// stop; they go back to waiting and resume on the next start. Steps left
// running by a crash go back to waiting first, the run cut short not
// counted as a try.
func (r *Runner) Run(ctx context.Context) error {
	err := r.store.Write(ctx, change.ActorPSet, "", func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, `UPDATE steps SET state = 'waiting', attempts = max(attempts - 1, 0) WHERE state = 'running'`)
		return errs.Database.Of(err)
	})
	if err != nil {
		return err
	}
	if err := r.loadBroken(ctx); err != nil {
		return err
	}
	t := time.NewTicker(poll)
	defer t.Stop()
	for {
		if err := r.schedule(ctx); err != nil && ctx.Err() == nil {
			slog.Warn("runner: schedule", "err", err)
		}
		select {
		case <-ctx.Done():
			r.wg.Wait()
			return nil
		case <-r.wake:
		case <-t.C:
		}
	}
}

// visible is SQL true when step s's subject is not hidden: a step of a
// removed thing waits where it is, and carries on if the removal is undone.
const visible = `CASE s.subject_kind
	WHEN 'question' THEN EXISTS (SELECT 1 FROM questions q JOIN sets t ON t.id = q.set_id JOIN courses c ON c.id = t.course_id
		WHERE q.id = s.subject_id AND q.removed_at = '' AND t.removed_at = '' AND c.removed_at = '')
	WHEN 'set' THEN EXISTS (SELECT 1 FROM sets t JOIN courses c ON c.id = t.course_id
		WHERE t.id = s.subject_id AND t.removed_at = '' AND c.removed_at = '')
	WHEN 'material' THEN EXISTS (SELECT 1 FROM materials m JOIN courses c ON c.id = m.course_id
		WHERE m.id = s.subject_id AND m.removed_at = '' AND c.removed_at = '')
	WHEN 'turn' THEN EXISTS (SELECT 1 FROM turns u JOIN courses c ON c.id = u.course_id
		WHERE u.id = s.subject_id AND u.removed_at = '' AND c.removed_at = '')
	ELSE 1 END`

type candidate struct {
	id, kind, subject, name string
	attempts                int
}

// schedule starts every runnable step its model has room for: waiting and
// not held by an incident, or retrying and due; its subject visible; the
// steps it waits for done. Highest priority first, then oldest (D8: finds,
// then readings, then guides, by the pipeline's order of creation).
func (r *Runner) schedule(ctx context.Context) error {
	if err := r.pauseHidden(ctx); err != nil {
		return err
	}
	rows, err := r.store.DB.QueryContext(ctx, `
SELECT s.id, s.subject_kind, s.subject_id, s.name, s.attempts FROM steps s
WHERE ((s.state = 'waiting' AND s.incident_id = '') OR (s.state = 'retrying' AND s.retry_at <= ?))
  AND `+visible+`
ORDER BY s.priority DESC, s.created_at, s.position`, db.At(r.Now()))
	if err != nil {
		return errs.Database.Wrap(err)
	}
	var cs []candidate
	for rows.Next() {
		var c candidate
		if err := rows.Scan(&c.id, &c.kind, &c.subject, &c.name, &c.attempts); err != nil {
			cleanup.Close(rows)
			return errs.Database.Wrap(err)
		}
		cs = append(cs, c)
	}
	cleanup.Close(rows)
	if err := rows.Err(); err != nil {
		return errs.Database.Wrap(err)
	}
	for _, c := range cs {
		h, pos, ok := r.handler(change.Resource(c.kind), step.Name(c.name))
		if !ok {
			continue // a step of a pipeline this build no longer has
		}
		r.mu.Lock()
		_, already := r.running[c.id]
		full := r.busy[h.Model] >= r.limit(h.Model)
		r.mu.Unlock()
		if already || full {
			continue
		}
		ready, err := r.ready(ctx, c, r.after(change.Resource(c.kind), h, pos))
		if err != nil {
			return err
		}
		if ready {
			if err := r.start(ctx, c, h); err != nil {
				return err
			}
		}
	}
	return nil
}

func (r *Runner) limit(model string) int {
	if n, ok := r.limits[model]; ok {
		return n
	}
	return DefaultLimit
}

// ready is whether every step c waits for is done.
func (r *Runner) ready(ctx context.Context, c candidate, after []step.Name) (bool, error) {
	if len(after) == 0 {
		return true, nil
	}
	var notDone int
	args := []any{c.kind, c.subject}
	marks := ""
	for i, n := range after {
		if i > 0 {
			marks += ", "
		}
		marks += "?"
		args = append(args, string(n))
	}
	err := r.store.DB.QueryRowContext(ctx, `SELECT count(*) FROM steps WHERE subject_kind = ? AND subject_id = ?
		AND name IN (`+marks+`) AND state != 'done'`, args...).Scan(&notDone)
	return notDone == 0, errs.Database.Of(err)
}

// start claims a step and runs it in its own goroutine.
func (r *Runner) start(ctx context.Context, c candidate, h *Handler) error {
	attempt := c.attempts + 1
	claimed := false
	err := r.store.Write(ctx, change.ActorPSet, "", func(tx *sql.Tx) error {
		res, err := tx.ExecContext(ctx, `UPDATE steps SET state = 'running', attempts = ?, started_at = ?, ended_at = '', retry_at = ''
			WHERE id = ? AND state IN ('waiting', 'retrying')`, attempt, db.At(r.Now()), c.id)
		if err != nil {
			return errs.Database.Wrap(err)
		}
		n, err := res.RowsAffected()
		claimed = n == 1
		return errs.Database.Of(err)
	})
	if err != nil || !claimed {
		return err
	}
	stepCtx, cancel := context.WithCancelCause(context.WithoutCancel(ctx))
	run := &Run{r: r, StepID: c.id, Kind: change.Resource(c.kind), SubjectID: c.subject, Name: step.Name(c.name), Attempt: attempt}
	r.mu.Lock()
	r.running[c.id] = &running{cancel: cancel, handler: h}
	r.busy[h.Model]++
	run.healed = maps.Clone(r.healed)
	r.mu.Unlock()
	r.wg.Add(1)
	go func() {
		defer r.wg.Done()
		// Shutdown stops the step; it goes back to waiting.
		stop := context.AfterFunc(ctx, func() { cancel(errShutdown) })
		defer stop()
		// What the inputs are as it starts: a failure to read them is this
		// step's own, not the scheduler's.
		var err error
		if h.Input != nil {
			run.hash, err = h.Input(stepCtx, r.store.DB, c.subject)
		}
		if err == nil {
			err = safely(stepCtx, h, run)
		}
		cause := context.Cause(stepCtx)
		cancel(nil)
		// The step stays in running, so nothing starts it again, until how
		// it ended is written: a full disk or a locked database can refuse
		// that write too, and a step left running in the table would show
		// as running for good.
		for {
			werr := r.settle(run, err, cause)
			if werr == nil {
				break
			}
			slog.Error("runner: settle a step", "step", run.StepID, "err", werr)
			select {
			case <-ctx.Done():
				// Left running in the table: the next start puts it back.
			case <-time.After(r.SettleRetry):
				continue
			}
			break
		}
		r.mu.Lock()
		delete(r.running, c.id)
		r.busy[h.Model]--
		r.mu.Unlock()
		r.Wake()
	}()
	return nil
}

// Why a running step was cancelled by the runner itself: either way it
// goes back to waiting, the run not counted as a try.
var (
	errShutdown = fmt.Errorf("runner: shutting down")
	errPaused   = fmt.Errorf("runner: its subject was removed")
)

// pauseHidden stops the running steps whose subject was removed since they
// started, so nothing is spent on it: they wait, and carry on if the
// removal is undone.
func (r *Runner) pauseHidden(ctx context.Context) error {
	r.mu.Lock()
	n := len(r.running)
	r.mu.Unlock()
	if n == 0 {
		return nil
	}
	rows, err := r.store.DB.QueryContext(ctx, `SELECT s.id FROM steps s WHERE s.state = 'running' AND NOT (`+visible+`)`)
	if err != nil {
		return errs.Database.Wrap(err)
	}
	defer cleanup.Close(rows)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return errs.Database.Wrap(err)
		}
		r.mu.Lock()
		if run, ok := r.running[id]; ok {
			run.cancel(errPaused)
		}
		r.mu.Unlock()
	}
	return errs.Database.Of(rows.Err())
}

// safely runs a handler, a panic being a failure rather than a dead server.
func safely(ctx context.Context, h *Handler, run *Run) (err error) {
	defer func() {
		if p := recover(); p != nil {
			err = errs.Unexpected.Wrap(fmt.Errorf("runner: %s panicked: %v", h.Name, p))
		}
	}()
	return h.Run(ctx, run)
}

// settle writes how a run ended.
func (r *Runner) settle(run *Run, err, cause error) error {
	ctx := context.Background()
	now := db.At(r.Now())
	var werr error
	switch {
	case err == nil:
		werr = r.store.Write(ctx, change.ActorPSet, "", func(tx *sql.Tx) error {
			if _, err := tx.ExecContext(ctx, `UPDATE steps SET state = 'done', ended_at = ?, input_hash = ?, incident_id = '' WHERE id = ?`,
				now, run.hash, run.StepID); err != nil {
				return errs.Database.Wrap(err)
			}
			// A failure this step had, now that it worked.
			_, err := tx.ExecContext(ctx, `UPDATE incidents SET state = 'healed', resolved_at = ?
				WHERE step_id = ? AND state = 'open'`, now, run.StepID)
			return errs.Database.Of(err)
		})
		if werr == nil {
			// What came after it may have read its output. Not part of the
			// ending: a sibling whose inputs can't be read is logged, not
			// retried, or this finished step would hold its slot for good.
			if err := r.Changed(ctx, run.Kind, run.SubjectID); err != nil {
				slog.Warn("runner: check what read a finished step", "step", run.StepID, "err", err)
			}
		}
	case cause == errShutdown || cause == errPaused: //nolint:errorlint // the runner's own sentinels, never wrapped
		werr = r.store.Write(ctx, change.ActorPSet, "", func(tx *sql.Tx) error {
			_, err := tx.ExecContext(ctx, `UPDATE steps SET state = 'waiting', ended_at = ?, attempts = max(attempts - 1, 0) WHERE id = ?`,
				now, run.StepID)
			return errs.Database.Of(err)
		})
	default:
		werr = r.fail(ctx, run, err)
	}
	return werr
}

// fail writes a failure by its kind (ideas/errors-grill.md):
//   - passing: tried again after a growing wait, Tries times, then said;
//     one that names a condition (the provider) then waits on it;
//   - waiting on you: the step waits on one incident per cause, shared with
//     every step waiting on it (E1), and its condition stops holding;
//   - anything else: the step fails, with an incident on its subject.
//
// A cause the computer shows (a full disk, Poppler missing) is named first,
// whatever entry the step wrapped it in.
func (r *Runner) fail(ctx context.Context, run *Run, err error) error {
	if c := condition.Cause(err, r.dataDir); c != nil {
		err = c
	}
	kind, clears := errs.KindOf(err)
	now := db.At(r.Now())
	if kind == errs.KindPassing && run.Attempt < Tries {
		wait := r.Backoff[min(run.Attempt-1, len(r.Backoff)-1)]
		return r.store.Write(ctx, change.ActorPSet, "", func(tx *sql.Tx) error {
			_, err := tx.ExecContext(ctx, `UPDATE steps SET state = 'retrying', ended_at = ?, retry_at = ? WHERE id = ?`,
				now, db.At(r.Now().Add(wait)), run.StepID)
			return errs.Database.Of(err)
		})
	}
	switch {
	case kind == errs.KindPassing && clears != "":
		// Still failing after every try: what it needs is gone for now.
		kind = errs.KindWaitingOnYou
	case kind == errs.KindPassing || kind == errs.KindYourInput:
		// Tried enough: it is not passing. A step has no field to show a
		// "your input" under.
		kind = errs.KindOurs
	case kind == errs.KindWaitingOnYou && clears == "":
		// Waiting on nothing that can come back would wait for good.
		kind = errs.KindCant
	}
	view := errs.Resolve(err)
	if kind == errs.KindWaitingOnYou {
		return r.store.Write(ctx, change.ActorPSet, "", func(tx *sql.Tx) error {
			// The condition came back while this run went (a key saved as
			// the call failed for want of one): run again, rather than wait
			// on something that already holds. Otherwise it is marked broken,
			// under the same lock Holds counts under: a Holds from here on
			// sees the mark, takes its write path, waits for this write and
			// heals what it wrote. The mark is set before the write, so a
			// call that works heals it even if the write fails.
			r.mu.Lock()
			healed := r.healed[clears] != run.healed[clears]
			if !healed {
				r.broken[clears] = true
			}
			r.mu.Unlock()
			if r.failing != nil && !healed {
				r.failing()
			}
			if healed {
				_, err := tx.ExecContext(ctx, `UPDATE steps SET state = 'waiting', ended_at = ?, attempts = 0 WHERE id = ?`, now, run.StepID)
				return errs.Database.Of(err)
			}
			id, err := r.incident(ctx, tx, view, kind, clears, run, true, err)
			if err != nil {
				return err
			}
			if err := setCondition(ctx, tx, clears, false, view); err != nil {
				return err
			}
			_, err = tx.ExecContext(ctx, `UPDATE steps SET state = 'waiting', ended_at = ?, incident_id = ? WHERE id = ?`,
				now, id, run.StepID)
			return errs.Database.Of(err)
		})
	}
	return r.store.Write(ctx, change.ActorPSet, "", func(tx *sql.Tx) error {
		id, err := r.incident(ctx, tx, view, kind, "", run, false, err)
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, `UPDATE steps SET state = 'failed', ended_at = ?, incident_id = ? WHERE id = ?`,
			now, id, run.StepID)
		return errs.Database.Of(err)
	})
}

// incident opens an incident, or counts again on the open one for the same
// cause: on the same subject, or for a general one (waiting on a key) on
// anything.
func (r *Runner) incident(ctx context.Context, tx *sql.Tx, view errs.View, kind errs.Kind, clears string, run *Run, general bool, cause error) (string, error) {
	now := db.At(r.Now())
	subjectKind, subjectID := string(run.Kind), run.SubjectID
	if general {
		subjectKind, subjectID = "", ""
	}
	// One per cause (E1): a general one is its condition, whatever step
	// error it came wrapped in; a step's own is its error, on that step, so
	// Try again on it and its healing are the step's alone.
	q, args := `SELECT id FROM incidents WHERE state = 'open' AND born = 'step'
		AND json_extract(error, '$.id') = ? AND step_id = ?`, []any{view.ID, run.StepID}
	if general {
		q, args = `SELECT id FROM incidents WHERE state = 'open' AND born = 'step' AND clears = ?`, []any{clears}
	}
	var id string
	err := tx.QueryRowContext(ctx, q, args...).Scan(&id)
	switch {
	case err == nil:
		_, err = tx.ExecContext(ctx, `UPDATE incidents SET count = count + 1, last_at = ? WHERE id = ?`, now, id)
		return id, errs.Database.Of(err)
	case err != sql.ErrNoRows: //nolint:errorlint // QueryRow's Scan returns the sentinel itself
		return "", errs.Database.Wrap(err)
	}
	id = errs.NewIncident()
	view.Incident = id
	raw, err := jsonText(view)
	if err != nil {
		return "", err
	}
	// The step's own log row already says its set and course.
	_, err = tx.ExecContext(ctx, `INSERT INTO incidents (id, error, kind, subject_kind, subject_id, course_id, set_id, step_id, born, state, first_at, last_at, detail, clears)
		SELECT ?, ?, ?, ?, ?,
			ifnull((SELECT course_id FROM changes WHERE kind = 'step' AND res_id = ? ORDER BY seq DESC LIMIT 1), ''),
			ifnull((SELECT set_id FROM changes WHERE kind = 'step' AND res_id = ? ORDER BY seq DESC LIMIT 1), ''),
			?, 'step', 'open', ?, ?, ?, ?`,
		id, raw, string(kind), subjectKind, subjectID, run.StepID, run.StepID, stepIDUnlessGeneral(run, general), now, now, cause.Error(), clears)
	return id, errs.Database.Of(err)
}

// A general incident belongs to no one step: Try again on it is healing.
func stepIDUnlessGeneral(run *Run, general bool) string {
	if general {
		return ""
	}
	return run.StepID
}

// loadBroken reads which conditions do not hold, so a call that works can
// heal them without a write per call.
func (r *Runner) loadBroken(ctx context.Context) error {
	rows, err := r.store.DB.QueryContext(ctx, `SELECT id FROM conditions WHERE holds = 0`)
	if err != nil {
		return errs.Database.Wrap(err)
	}
	defer cleanup.Close(rows)
	r.mu.Lock()
	defer r.mu.Unlock()
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return errs.Database.Wrap(err)
		}
		r.broken[id] = true
	}
	return errs.Database.Of(rows.Err())
}

// Holds says a condition is the case again: a key was saved, a call worked,
// Settings fixed it, or the student pressed Try again. Its waiting
// incidents heal and the steps waiting on them run again from their first
// try (E2). A step that fails again for the same cause opens a new
// incident, so nothing loops.
func (r *Runner) Holds(ctx context.Context, condition string) error {
	// Counted first: a run failing for want of it from now on runs again
	// instead of waiting (see fail).
	r.mu.Lock()
	r.healed[condition]++
	marked := r.broken[condition]
	r.mu.Unlock()
	var open int
	err := r.store.DB.QueryRowContext(ctx, `SELECT (SELECT count(*) FROM conditions WHERE id = ?1 AND holds = 0) +
		(SELECT count(*) FROM incidents WHERE state = 'open' AND clears = ?1)`, condition).Scan(&open)
	if err != nil {
		return errs.Database.Wrap(err)
	}
	if open == 0 && !marked {
		// Nothing is broken or waiting: no write (Settings checks every
		// condition each time it opens). A failure still writing its wait
		// has marked it (see fail), so it never gets here.
		return nil
	}
	err = r.store.Write(ctx, change.ActorPSet, "", func(tx *sql.Tx) error {
		var broken int
		if err := tx.QueryRowContext(ctx, `SELECT count(*) FROM conditions WHERE id = ? AND holds = 0`, condition).Scan(&broken); err != nil {
			return errs.Database.Wrap(err)
		}
		if broken > 0 {
			if err := setCondition(ctx, tx, condition, true, errs.View{}); err != nil {
				return err
			}
		}
		if _, err := tx.ExecContext(ctx, `UPDATE steps SET incident_id = '', attempts = 0 WHERE incident_id IN
			(SELECT id FROM incidents WHERE state = 'open' AND clears = ?)`, condition); err != nil {
			return errs.Database.Wrap(err)
		}
		_, err := tx.ExecContext(ctx, `UPDATE incidents SET state = 'healed', resolved_at = ? WHERE state = 'open' AND clears = ?`,
			db.At(r.Now()), condition)
		return errs.Database.Of(err)
	})
	if err != nil {
		return err
	}
	r.mu.Lock()
	delete(r.broken, condition)
	r.mu.Unlock()
	r.Wake()
	return nil
}

// IncidentGone is Try again on an incident that is not there.
var IncidentGone = errs.Define(errs.Entry{
	ID:     "runner.incident_gone",
	Kind:   errs.KindCant,
	What:   "That problem is no longer there.",
	Why:    "It was resolved, or what it was about was removed.",
	Status: http.StatusNotFound,
})

// TryAgain is the student's Try again on an incident a step opened. On one
// that waits on a condition (no key, no credit, a full disk) it says the
// condition holds again, so every step waiting on it runs; on a step's own
// failure it asks that step again, ahead of PSet's own work. An incident
// already resolved needs nothing.
func (r *Runner) TryAgain(ctx context.Context, incidentID string) error {
	var stepID, clears, state string
	err := r.store.DB.QueryRowContext(ctx, `SELECT step_id, clears, state FROM incidents WHERE id = ? AND born = 'step'`,
		incidentID).Scan(&stepID, &clears, &state)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return IncidentGone.New()
	case err != nil:
		return errs.Database.Wrap(err)
	case state != "open":
		return nil
	case clears != "":
		return r.Holds(ctx, clears)
	}
	var kind, subject, name string
	err = r.store.DB.QueryRowContext(ctx, `SELECT subject_kind, subject_id, name FROM steps WHERE id = ?`, stepID).Scan(&kind, &subject, &name)
	if errors.Is(err, sql.ErrNoRows) {
		return IncidentGone.New()
	}
	if err != nil {
		return errs.Database.Wrap(err)
	}
	err = r.store.Write(ctx, change.ActorPSet, "", func(tx *sql.Tx) error {
		return r.Ask(ctx, tx, change.Resource(kind), subject, step.Name(name), PriorityOpened)
	})
	r.Wake()
	return err
}

// healers are the conditions a model call that worked shows to hold.
var healers = []string{"key", "credit", "provider"}

func (r *Runner) callWorked() {
	r.mu.Lock()
	var heal []string
	for _, c := range healers {
		if r.broken[c] {
			heal = append(heal, c)
		}
	}
	r.mu.Unlock()
	for _, c := range heal {
		if err := r.Holds(context.Background(), c); err != nil {
			slog.Warn("runner: heal", "condition", c, "err", err)
		}
	}
}

// setCondition writes whether a condition holds, with what is wrong while
// it does not.
func setCondition(ctx context.Context, tx *sql.Tx, id string, holds bool, why errs.View) error {
	raw := "null"
	if !holds {
		var err error
		if raw, err = jsonText(why); err != nil {
			return err
		}
	}
	_, err := tx.ExecContext(ctx, `INSERT INTO conditions (id, holds, since, error) VALUES (?, ?, ?, ?)
		ON CONFLICT (id) DO UPDATE SET holds = excluded.holds, error = excluded.error,
			since = CASE WHEN conditions.holds = excluded.holds THEN conditions.since ELSE excluded.since END`,
		id, holds, db.Now(), raw)
	return errs.Database.Of(err)
}

// Running is the ids of the steps running now.
func (r *Runner) Running() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]string, 0, len(r.running))
	for id := range r.running {
		out = append(out, id)
	}
	slices.Sort(out)
	return out
}
