// Package spend is what the model calls cost, read from the store's calls:
// by course, material or set, through the steps that made them (track 7d of
// ideas/backend-courses.md). The old usage package keeps the old screens'
// views on the old database, which takes no new calls.
//
//	GET /api/courses/{id}/spend    a course: its materials', sets', problems' and Ask's
//	GET /api/materials/{id}/spend  a material's import
//	GET /api/sets/{id}/spend       a set's: its own steps and its problems'
package spend

import (
	"context"
	"net/http"
	"time"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/store"
)

// Service reads what calls cost.
type Service struct{ s *store.Store }

// New is the reads on s.
func New(s *store.Store) *Service { return &Service{s} }

// The steps whose calls each kind of thing counts, ?1 its id.
const (
	materialSteps = `s.subject_kind = 'material' AND s.subject_id = ?1`
	setSteps      = `(s.subject_kind = 'set' AND s.subject_id = ?1)
		OR (s.subject_kind = 'question' AND s.subject_id IN (SELECT id FROM questions WHERE set_id = ?1))`
	courseSteps = `(s.subject_kind = 'material' AND s.subject_id IN (SELECT id FROM materials WHERE course_id = ?1))
		OR (s.subject_kind = 'set' AND s.subject_id IN (SELECT id FROM sets WHERE course_id = ?1))
		OR (s.subject_kind = 'question' AND s.subject_id IN
			(SELECT q.id FROM questions q JOIN sets x ON x.id = q.set_id WHERE x.course_id = ?1))
		OR (s.subject_kind = 'turn' AND s.subject_id IN (SELECT id FROM turns WHERE course_id = ?1))`
)

// Material is what a material's import cost.
func (s *Service) Material(ctx context.Context, id string) (Spend, error) {
	return s.read(ctx, materialSteps, id)
}

// Set is what a set cost: its own steps (the ranking) and its problems'.
func (s *Service) Set(ctx context.Context, id string) (Spend, error) {
	return s.read(ctx, setSteps, id)
}

// Course is what a course cost: its materials', sets', problems' and Ask
// turns' steps.
func (s *Service) Course(ctx context.Context, id string) (Spend, error) {
	return s.read(ctx, courseSteps, id)
}

// read groups the calls of the steps `which` picks by the model that
// answered. An uncounted call has no tokens or cost to add: the provider
// reported none. The alias is not called model, the column's name: GROUP BY
// model would group by the model asked for.
func (s *Service) read(ctx context.Context, which, id string) (Spend, error) {
	rows, err := s.s.DB.QueryContext(ctx, `SELECT coalesce(nullif(c.answered, ''), c.model) AS who,
			count(*), count(nullif(c.error_id, '')), count(*) - sum(c.counted),
			sum(c.prompt_tokens + c.completion_tokens), sum(c.cost), sum(c.ms)
		FROM calls c JOIN steps s ON s.id = c.step_id
		WHERE `+which+`
		GROUP BY who
		ORDER BY 5 DESC, 1`, id)
	if err != nil {
		return Spend{}, errs.Database.Wrap(err)
	}
	defer cleanup.Close(rows)
	out := Spend{Models: []Model{}}
	for rows.Next() {
		var m Model
		if err := rows.Scan(&m.Model, &m.Calls, &m.Failed, &m.Uncounted, &m.Tokens, &m.Cost, &m.Ms); err != nil {
			return Spend{}, errs.Database.Wrap(err)
		}
		out.Models = append(out.Models, m)
		out.Total.Calls += m.Calls
		out.Total.Failed += m.Failed
		out.Total.Uncounted += m.Uncounted
		out.Total.Tokens += m.Tokens
		out.Total.Cost += m.Cost
		out.Total.Ms += m.Ms
	}
	return out, errs.Database.Of(rows.Err())
}

// courseOf is SQL for the course of step s's subject.
const courseOf = `CASE s.subject_kind
	WHEN 'material' THEN (SELECT course_id FROM materials WHERE id = s.subject_id)
	WHEN 'set' THEN (SELECT course_id FROM sets WHERE id = s.subject_id)
	WHEN 'question' THEN (SELECT x.course_id FROM questions q JOIN sets x ON x.id = q.set_id WHERE q.id = s.subject_id)
	WHEN 'turn' THEN (SELECT course_id FROM turns WHERE id = s.subject_id)
	END`

// Since is what every call since a time cost, in all and by course, the
// most cost first. The zero time is all the calls kept. Every call counts,
// as it was paid for: a removed course's under its id, and one whose subject
// is gone under no course ("").
func (s *Service) Since(ctx context.Context, since string) (Totals, error) {
	rows, err := s.s.DB.QueryContext(ctx, `SELECT ifnull(`+courseOf+`, ''), count(*), count(nullif(c.error_id, '')),
			count(*) - sum(c.counted), sum(c.prompt_tokens + c.completion_tokens), sum(c.cost), sum(c.ms)
		FROM calls c JOIN steps s ON s.id = c.step_id
		WHERE c.at >= ?
		GROUP BY 1
		ORDER BY 6 DESC, 1`, since)
	if err != nil {
		return Totals{}, errs.Database.Wrap(err)
	}
	defer cleanup.Close(rows)
	out := Totals{ByCourse: []CourseSpend{}}
	for rows.Next() {
		var c CourseSpend
		m := &c.Total
		if err := rows.Scan(&c.CourseID, &m.Calls, &m.Failed, &m.Uncounted, &m.Tokens, &m.Cost, &m.Ms); err != nil {
			return Totals{}, errs.Database.Wrap(err)
		}
		out.ByCourse = append(out.ByCourse, c)
		out.Total.Calls += m.Calls
		out.Total.Failed += m.Failed
		out.Total.Uncounted += m.Uncounted
		out.Total.Tokens += m.Tokens
		out.Total.Cost += m.Cost
		out.Total.Ms += m.Ms
	}
	return out, errs.Database.Of(rows.Err())
}

// Routes mounts the three reads.
func (s *Service) Routes(mux *http.ServeMux) {
	// ?since= (RFC 3339) or nothing for all the calls kept.
	mux.HandleFunc("GET /api/spend", httpx.Reply(func(r *http.Request) (Totals, error) {
		raw := r.URL.Query().Get("since")
		if raw == "" {
			return s.Since(r.Context(), "")
		}
		since, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return Totals{}, badSince.New().OnField("since")
		}
		return s.Since(r.Context(), db.At(since))
	}))
	mux.HandleFunc("GET /api/courses/{id}/spend", httpx.Reply(func(r *http.Request) (Spend, error) {
		return s.Course(r.Context(), r.PathValue("id"))
	}))
	mux.HandleFunc("GET /api/materials/{id}/spend", httpx.Reply(func(r *http.Request) (Spend, error) {
		return s.Material(r.Context(), r.PathValue("id"))
	}))
	mux.HandleFunc("GET /api/sets/{id}/spend", httpx.Reply(func(r *http.Request) (Spend, error) {
		return s.Set(r.Context(), r.PathValue("id"))
	}))
}

var badSince = errs.Define(errs.Entry{
	ID:    "spend.bad_since",
	Kind:  errs.KindYourInput,
	What:  "Say when to count from, as an RFC 3339 time.",
	Scope: errs.ScopeField,
})
