package incident

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/jackt/pset/internal/action"
	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/runner"
	"github.com/jackt/pset/internal/step"
	"github.com/jackt/pset/internal/store"
)

var bg = context.Background()

type env struct {
	t   *testing.T
	s   *store.Store
	c   *action.Catalog
	r   *runner.Runner
	svc *Service
}

func newEnv(t *testing.T, pipes ...runner.Pipeline) *env {
	t.Helper()
	s, err := store.Open(bg, filepath.Join(t.TempDir(), "store.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cleanup.Close(s.DB) })
	e := &env{t: t, s: s, c: action.New(s), r: runner.New(s, runner.Options{}, pipes...)}
	e.r.Backoff = []time.Duration{10 * time.Millisecond}
	e.svc = New(s, e.c, e.r)
	e.write(`INSERT INTO courses (id, name, created_at) VALUES ('c1', 'ECE 210', ?)`, db.Now())
	e.write(`INSERT INTO sets (id, course_id, title, created_at) VALUES ('s1', 'c1', 'Problem set 4', ?)`, db.Now())
	return e
}

func (e *env) write(q string, args ...any) {
	e.t.Helper()
	if err := e.s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		_, err := tx.Exec(q, args...)
		return err
	}); err != nil {
		e.t.Fatal(err)
	}
}

func (e *env) incident(id, state, resolved, last string) {
	e.write(`INSERT INTO incidents (id, error, kind, subject_kind, subject_id, born, state, first_at, last_at, resolved_at)
		VALUES (?, '{"id":"internal.unexpected","what":"x"}', 'ours', 'set', 's1', 'step', ?, ?, ?, ?)`, id, state, last, last, resolved)
}

// Settings lists the open incidents, then those resolved in the last week,
// newest first; older ones are not listed.
func TestTheListIsOpenThenTheWeek(t *testing.T) {
	e := newEnv(t)
	now := time.Now()
	at := func(d time.Duration) string { return db.At(now.Add(-d)) }
	e.incident("OLDOPN", "open", "", at(48*time.Hour))
	e.incident("NEWOPN", "open", "", at(time.Hour))
	e.incident("HEALED", "healed", at(24*time.Hour), at(24*time.Hour))
	e.incident("ANCIENT", "healed", at(8*24*time.Hour), at(8*24*time.Hour))
	got, err := e.svc.List(bg)
	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, i := range got.Incidents {
		ids = append(ids, i.ID)
	}
	if want := []string{"NEWOPN", "OLDOPN", "HEALED"}; len(ids) != 3 || ids[0] != want[0] || ids[1] != want[1] || ids[2] != want[2] {
		t.Fatalf("the list is %v, want %v", ids, want)
	}
	if got.Incidents[0].Error.Incident != "NEWOPN" {
		t.Fatal("an incident's error does not name it")
	}
}

// A page's own failure is kept as an incident in its words, and the same
// failure again counts on the open one.
func TestThePagesReportsAreIncidents(t *testing.T) {
	e := newEnv(t)
	p := PageReport{Chain: []string{"request.unreachable"}, Links: []map[string]string{{}}, Detail: "TypeError: failed to fetch", Route: "/c/c1"}
	first, err := e.svc.Report(bg, p)
	if err != nil {
		t.Fatal(err)
	}
	if first.Born != BornPage || first.Error.ID != "request.unreachable" || first.Error.What == "" || first.State != StateOpen {
		t.Fatalf("the report kept %+v", first)
	}
	again, err := e.svc.Report(bg, p)
	if err != nil {
		t.Fatal(err)
	}
	if again.ID != first.ID || again.Count != 2 {
		t.Fatalf("the same failure again: %+v", again)
	}
}

// A failed request is recorded once, as an incident about what it named.
func TestAFailedRequestIsAnIncident(t *testing.T) {
	e := newEnv(t)
	errs.SetRecorder(e.svc)
	t.Cleanup(func() { errs.SetRecorder(nil) })
	v := errs.Report(bg, errors.New("boom"), errs.Where{Route: "POST /api/actions/{id}", Set: "s1"})
	i, err := e.svc.Get(bg, v.Incident)
	if err != nil {
		t.Fatal(err)
	}
	if i.Born != BornRequest || i.SubjectKind != change.ResourceSet || i.SubjectID != "s1" || i.Route != "POST /api/actions/{id}" || i.Detail == "" {
		t.Fatalf("the request's incident %+v", i)
	}
}

// Try again reruns the step an incident is about, through the catalog; the
// trace shows the step, its calls and the changes to its subject.
func TestTryAgainAndTheTrace(t *testing.T) {
	var fail = true
	pipe := runner.Pipeline{Kind: change.ResourceSet, Steps: []runner.Handler{{Name: step.NameRank, Run: func(context.Context, *runner.Run) error {
		if fail {
			return errs.Unexpected.Wrap(errors.New("rank broke"))
		}
		return nil
	}}}}
	e := newEnv(t, pipe)
	ctx, cancel := context.WithCancel(bg)
	done := make(chan struct{})
	go func() {
		if err := e.r.Run(ctx); err != nil {
			t.Error(err)
		}
		close(done)
	}()
	t.Cleanup(func() { cancel(); <-done })
	if err := e.s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		return e.r.Start(bg, tx, change.ResourceSet, "s1")
	}); err != nil {
		t.Fatal(err)
	}
	e.r.Wake()
	var id string
	deadline := time.Now().Add(5 * time.Second)
	for id == "" {
		if time.Now().After(deadline) {
			t.Fatal("the step never failed")
		}
		time.Sleep(10 * time.Millisecond)
		if err := e.s.DB.QueryRow(`SELECT incident_id FROM steps WHERE state = 'failed'`).Scan(&id); err != nil && !errors.Is(err, sql.ErrNoRows) {
			t.Fatal(err)
		}
	}
	tr, err := e.svc.Trace(bg, id)
	if err != nil {
		t.Fatal(err)
	}
	if tr.Step == nil || tr.Step.Name != step.NameRank || tr.Step.State != step.StateFailed || tr.Calls == nil || len(tr.Changes) == 0 || tr.Changes[0].Op != change.OpCreated {
		t.Fatalf("the trace %+v", tr)
	}
	fail = false
	in, err := json.Marshal(TryAgain{ID: id})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := e.c.Run(bg, "incident.try_again", in); err != nil {
		t.Fatal(err)
	}
	deadline = time.Now().Add(5 * time.Second)
	for {
		i, err := e.svc.Get(bg, id)
		if err != nil {
			t.Fatal(err)
		}
		if i.State == StateTriedAgain {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("after Try again the incident is %s", i.State)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// Dismissing an open incident resolves it; one already resolved is gone.
func TestDismiss(t *testing.T) {
	e := newEnv(t)
	e.incident("OPEN01", "open", "", db.Now())
	in, err := json.Marshal(Dismiss{ID: "OPEN01"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := e.c.Run(bg, "incident.dismiss", in); err != nil {
		t.Fatal(err)
	}
	if i, err := e.svc.Get(bg, "OPEN01"); err != nil || i.State != StateDismissed || i.ResolvedAt == "" {
		t.Fatalf("dismissed %+v (%v)", i, err)
	}
	if _, err := e.c.Run(bg, "incident.dismiss", in); !errors.Is(err, errs.Gone) {
		t.Fatalf("dismissing it again: %v", err)
	}
}
