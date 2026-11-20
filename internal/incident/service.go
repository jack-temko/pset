package incident

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"
	"unicode/utf8"

	"github.com/jackt/pset/internal/action"
	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/runner"
	"github.com/jackt/pset/internal/store"
)

// Keep is how long a resolved incident stays on Settings' list (E4).
const Keep = 7 * 24 * time.Hour

// Service keeps incidents on the store: Settings' list, an incident's
// trace, Try again and Dismiss, and the failures the page and requests
// report.
type Service struct {
	store  *store.Store
	runner *runner.Runner
}

// New is the incidents on s, with their actions declared in c. r reruns
// what Try again asks for; nil when only declaring.
func New(s *store.Store, c *action.Catalog, r *runner.Runner) *Service {
	svc := &Service{store: s, runner: r}
	action.Add(c, action.Def[TryAgain]{
		ID: "incident.try_again", Name: "Try again", Costs: true,
		Run: svc.tryAgain,
	})
	action.Add(c, action.Def[Dismiss]{
		ID: "incident.dismiss", Name: "Dismiss", Undoable: true,
		Undone: "Brought the error back.", Redone: "Dismissed it again.",
		Run: svc.dismiss,
		Try: func(s action.Seed) Dismiss { return Dismiss{ID: s.IncidentID} },
	})
	return svc
}

// tryAgain is the runner's: a step's own failure reruns that step; one
// waiting on a condition says it holds again. It changes nothing Undo could
// take back, so it writes nothing as the student.
func (s *Service) tryAgain(ctx context.Context, _ *action.Do, in TryAgain) error {
	if s.runner == nil {
		return errs.Gone.New("thing", "error")
	}
	return s.runner.TryAgain(ctx, in.ID)
}

// dismiss puts an open incident away: resolved, by the student.
func (s *Service) dismiss(ctx context.Context, do *action.Do, in Dismiss) error {
	return do.Write(ctx, change.ResourceIncident, in.ID, func(tx *sql.Tx) error {
		res, err := tx.ExecContext(ctx, `UPDATE incidents SET state = 'dismissed', resolved_at = ? WHERE id = ? AND state = 'open'`, db.Now(), in.ID)
		return action.One(res, err, "incident")
	})
}

const columns = `id, seq, error, kind, subject_kind, subject_id, course_id, set_id, step_id, action, born, route, state, count, first_at, last_at, resolved_at, detail`

func scan(sc interface{ Scan(...any) error }) (Incident, error) {
	var i Incident
	var raw string
	err := sc.Scan(&i.ID, &i.Seq, &raw, &i.Kind, &i.SubjectKind, &i.SubjectID, &i.CourseID, &i.SetID, &i.StepID, &i.Action,
		&i.Born, &i.Route, &i.State, &i.Count, &i.FirstAt, &i.LastAt, &i.ResolvedAt, &i.Detail)
	if err != nil {
		return Incident{}, err
	}
	if err := json.Unmarshal([]byte(raw), &i.Error); err != nil {
		return Incident{}, errs.Data.Wrap(err)
	}
	i.Error.Incident = i.ID
	return i, nil
}

// List is Settings' list: the open incidents, then those resolved in the
// last week, newest first (E4).
func (s *Service) List(ctx context.Context) (Incidents, error) {
	rows, err := s.store.DB.QueryContext(ctx, `SELECT `+columns+` FROM incidents
		WHERE state = 'open' OR resolved_at >= ?
		ORDER BY state != 'open', last_at DESC, id`, db.At(time.Now().Add(-Keep)))
	if err != nil {
		return Incidents{}, errs.Database.Wrap(err)
	}
	defer cleanup.Close(rows)
	out := Incidents{Incidents: []Incident{}}
	for rows.Next() {
		i, err := scan(rows)
		if err != nil {
			return Incidents{}, errs.Database.Of(err)
		}
		// The list leaves out the detail (up to 16 KB of Go text and stack
		// each); the trace carries it.
		i.Detail = ""
		out.Incidents = append(out.Incidents, i)
	}
	return out, errs.Database.Of(rows.Err())
}

// Get is one incident.
func (s *Service) Get(ctx context.Context, id string) (Incident, error) {
	i, err := scan(s.store.DB.QueryRowContext(ctx, `SELECT `+columns+` FROM incidents WHERE id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return Incident{}, errs.Gone.New("thing", "error")
	}
	return i, errs.Database.Of(err)
}

// maxChanges is how many changes a trace shows.
const maxChanges = 50

// Trace opens an incident onto its step, the step's model calls and the
// changes to its subject from an hour before it first happened.
func (s *Service) Trace(ctx context.Context, id string) (Trace, error) {
	i, err := s.Get(ctx, id)
	if err != nil {
		return Trace{}, err
	}
	t := Trace{Incident: i, Calls: []Call{}, Changes: []change.Change{}}
	if i.StepID != "" && s.runner != nil {
		var kind, subject string
		err := s.store.DB.QueryRowContext(ctx, `SELECT subject_kind, subject_id FROM steps WHERE id = ?`, i.StepID).Scan(&kind, &subject)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return Trace{}, errs.Database.Wrap(err)
		}
		if err == nil {
			steps, err := s.runner.Steps(ctx, change.Resource(kind), subject)
			if err != nil {
				return Trace{}, err
			}
			for k := range steps {
				if steps[k].ID == i.StepID {
					t.Step = &steps[k]
				}
			}
		}
		if t.Calls, err = s.calls(ctx, i.StepID); err != nil {
			return Trace{}, err
		}
	}
	if i.SubjectID != "" {
		if t.Changes, err = s.changes(ctx, i); err != nil {
			return Trace{}, err
		}
	}
	return t, nil
}

func (s *Service) calls(ctx context.Context, stepID string) ([]Call, error) {
	rows, err := s.store.DB.QueryContext(ctx, `SELECT at, attempt, model, answered, ms,
		CASE WHEN counted THEN prompt_tokens + completion_tokens END, CASE WHEN counted THEN cost END, error_id
		FROM calls WHERE step_id = ? ORDER BY at, id`, stepID)
	if err != nil {
		return nil, errs.Database.Wrap(err)
	}
	defer cleanup.Close(rows)
	out := []Call{}
	for rows.Next() {
		var c Call
		if err := rows.Scan(&c.At, &c.Attempt, &c.Model, &c.Answered, &c.Ms, &c.Tokens, &c.Cost, &c.ErrorID); err != nil {
			return nil, errs.Database.Wrap(err)
		}
		out = append(out, c)
	}
	return out, errs.Database.Of(rows.Err())
}

// changes is the log of the incident's subject around it, as recorded:
// what changed, who did it and in which action, without its values.
func (s *Service) changes(ctx context.Context, i Incident) ([]change.Change, error) {
	from := i.FirstAt
	if at, err := time.Parse(time.RFC3339Nano, i.FirstAt); err == nil {
		from = db.At(at.Add(-time.Hour))
	}
	rows, err := s.store.DB.QueryContext(ctx, `SELECT seq, kind, res_id, ifnull(course_id, ''), ifnull(set_id, ''), op, actor, action_id
		FROM changes WHERE kind = ? AND res_id = ? AND at >= ? AND echo = 0 ORDER BY seq LIMIT ?`,
		string(i.SubjectKind), i.SubjectID, from, maxChanges)
	if err != nil {
		return nil, errs.Database.Wrap(err)
	}
	defer cleanup.Close(rows)
	out := []change.Change{}
	for rows.Next() {
		var c change.Change
		if err := rows.Scan(&c.Seq, &c.Kind, &c.ID, &c.CourseID, &c.SetID, &c.Op, &c.Actor, &c.Action); err != nil {
			return nil, errs.Database.Wrap(err)
		}
		out = append(out, c)
	}
	return out, errs.Database.Of(rows.Err())
}

// Report keeps a failure the page had on its own (a crash, a rejected
// promise, a dead stream) as an incident, born on the page.
func (s *Service) Report(ctx context.Context, p PageReport) (Incident, error) {
	// A chain is a handful of links; more is not a failure the catalog made.
	if len(p.Chain) > maxChain {
		p.Chain = p.Chain[:maxChain]
	}
	if len(p.Links) > maxChain {
		p.Links = p.Links[:maxChain]
	}
	view := errs.Stored{Chain: p.Chain, Links: p.Links}.View()
	kind, clears := kindOf(view)
	id, err := s.keep(ctx, record{
		view: view, kind: kind, clears: clears, born: BornPage, route: clip(p.Route, maxName), detail: p.Detail,
		subjectKind: change.Resource(clip(string(p.SubjectKind), maxName)), subjectID: clip(p.SubjectID, maxName),
		action: clip(p.Action, maxName),
	})
	if err != nil {
		return Incident{}, err
	}
	return s.Get(ctx, id)
}

// kindOf is the kind of a failure from its view, and the condition whose
// return clears it, as errs.KindOf has them for an error: the innermost entry
// of the chain that has a kind, or else what its status says.
func kindOf(v errs.View) (Kind, string) {
	for i := len(v.Chain) - 1; i >= 0; i-- {
		if e, ok := errs.Lookup(v.Chain[i]); ok && e.Kind != "" {
			return Kind(e.Kind), e.Clears
		}
	}
	switch {
	case v.Scope == errs.ScopeField:
		return Kind(errs.KindYourInput), ""
	case v.Status >= 500 || v.Status == 0:
		return Kind(errs.KindOurs), ""
	}
	return Kind(errs.KindCant), ""
}

// clip cuts s to at most n bytes, on a rune boundary.
func clip(s string, n int) string {
	if len(s) <= n {
		return s
	}
	for n > 0 && !utf8.RuneStart(s[n]) {
		n--
	}
	return s[:n]
}

// maxName bounds the route, action and subject the page reports, and
// maxChain its chain.
const (
	maxName  = 256
	maxChain = 16
)

// record is one failure to keep.
type record struct {
	view                      errs.View
	kind                      Kind
	born                      Born
	route, detail, action, id string
	clears                    string
	subjectKind               change.Resource
	subjectID                 string
	// alone keeps it as a new incident even when one is open for the same
	// cause, subject, route and action: an old job's failure names a book, which no
	// subject here can, so two books' failures must not count as one.
	alone bool
}

// keep writes a failure as an incident, or counts it again on the open one
// for the same cause on the same subject and route.
func (s *Service) keep(ctx context.Context, r record) (string, error) {
	raw, err := json.Marshal(r.view)
	if err != nil {
		return "", errs.Data.Wrap(err)
	}
	r.detail = clip(r.detail, maxDetail)
	id := r.id
	if id == "" {
		id = errs.NewIncident()
	}
	now := db.Now()
	err = s.store.Write(ctx, change.ActorPSet, "", func(tx *sql.Tx) error {
		var open string
		err := sql.ErrNoRows
		if !r.alone {
			err = tx.QueryRowContext(ctx, `SELECT id FROM incidents WHERE state = 'open' AND born = ? AND route = ?
			AND json_extract(error, '$.id') = ? AND subject_kind = ? AND subject_id = ? AND action = ?`,
				string(r.born), r.route, r.view.ID, string(r.subjectKind), r.subjectID, r.action).Scan(&open)
		}
		switch {
		case err == nil:
			id = open
			_, err := tx.ExecContext(ctx, `UPDATE incidents SET count = count + 1, last_at = ?, detail = ? WHERE id = ?`, now, r.detail, open)
			return errs.Database.Of(err)
		case !errors.Is(err, sql.ErrNoRows):
			return errs.Database.Wrap(err)
		}
		// The course and set are its subject's, as the subject's last change
		// names them (as the runner does for a step's incident).
		_, err = tx.ExecContext(ctx, `INSERT INTO incidents (id, error, kind, subject_kind, subject_id, course_id, set_id, action, born, route, state, first_at, last_at, detail, clears)
			SELECT ?, ?, ?, ?, ?,
				ifnull((SELECT course_id FROM changes WHERE kind = ? AND res_id = ? ORDER BY seq DESC LIMIT 1), ''),
				ifnull((SELECT set_id FROM changes WHERE kind = ? AND res_id = ? ORDER BY seq DESC LIMIT 1), ''),
				?, ?, ?, 'open', ?, ?, ?, ?`,
			id, string(raw), string(r.kind), string(r.subjectKind), r.subjectID,
			string(r.subjectKind), r.subjectID, string(r.subjectKind), r.subjectID,
			r.action, string(r.born), r.route, now, now, r.detail, r.clears)
		return errs.Database.Of(err)
	})
	return id, err
}

// maxDetail bounds what a report keeps of its error's text and stack.
const maxDetail = 16 << 10

// Record keeps a failed request as an incident (errs.Recorder): the request
// handler reports it once, and the student reads it in Settings.
// It returns the id the failure is kept under, which is the open incident's
// when the same failure was already open, so the student is told an id
// Settings can find.
func (s *Service) Record(ctx context.Context, r errs.Record) (string, error) {
	kind, clears := kindOf(r.View)
	rec := record{
		view: r.View, kind: kind, clears: clears, born: BornRequest, route: r.Where.Route, action: r.Where.Action,
		detail: r.Detail, id: r.Incident, alone: r.Where.Book != "",
	}
	// An old job's set and question are the old store's ids, which nothing
	// here can place, so a failure naming a book has no subject.
	switch {
	case r.Where.Book != "":
	case r.Where.Question != "":
		rec.subjectKind, rec.subjectID = change.ResourceQuestion, r.Where.Question
	case r.Where.Set != "":
		rec.subjectKind, rec.subjectID = change.ResourceSet, r.Where.Set
	}
	return s.keep(context.WithoutCancel(ctx), rec)
}

// Routes mounts Settings' list, an incident's trace, and the page's own
// reports. Try again and Dismiss are actions.
func (s *Service) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/incidents", httpx.Reply(func(r *http.Request) (Incidents, error) {
		return s.List(r.Context())
	}))
	mux.HandleFunc("GET /api/incidents/{id}", httpx.Reply(func(r *http.Request) (Trace, error) {
		return s.Trace(r.Context(), r.PathValue("id"))
	}))
	mux.HandleFunc("POST /api/incidents", httpx.Send(http.StatusCreated, func(r *http.Request, p PageReport) (Incident, error) {
		return s.Report(r.Context(), p)
	}))
}
