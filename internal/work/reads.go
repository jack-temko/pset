package work

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/doc"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/step"
	"github.com/jackt/pset/internal/store"
)

const setColumns = `t.id, t.seq, t.course_id, t.title, t.due, t.turned_in_at, t.sheet_id, t.opened_at, t.created_at, t.removed_at`

// setsWhere is the visible sets matching where, due soonest first, sets
// with no date last.
func (s *Service) setsWhere(ctx context.Context, where string, args ...any) (Sets, error) {
	rows, err := s.c.Store.DB.QueryContext(ctx, `SELECT `+setColumns+` FROM sets t WHERE `+where+` AND `+
		store.Visible(change.ResourceSet, "t.id")+` ORDER BY t.due = '', t.due, t.created_at, t.id`, args...)
	if err != nil {
		return Sets{}, errs.Database.Wrap(err)
	}
	out := Sets{Sets: []Set{}}
	for rows.Next() {
		var t Set
		if err := rows.Scan(&t.ID, &t.Seq, &t.CourseID, &t.Title, &t.Due, &t.TurnedInAt, &t.SheetID, &t.OpenedAt, &t.CreatedAt, &t.RemovedAt); err != nil {
			return Sets{}, errs.Database.Of(errors.Join(err, rows.Close()))
		}
		out.Sets = append(out.Sets, t)
	}
	if err := errors.Join(rows.Err(), rows.Close()); err != nil {
		return Sets{}, errs.Database.Wrap(err)
	}
	for i := range out.Sets {
		if err := s.fill(ctx, &out.Sets[i]); err != nil {
			return Sets{}, err
		}
	}
	return out, nil
}

// fill gives a set what it carries about its questions and its steps.
func (s *Service) fill(ctx context.Context, t *Set) error {
	t.Bar, t.Steps = []BarEntry{}, []step.Step{}
	rows, err := s.c.Store.DB.QueryContext(ctx, `SELECT done_at != '', difficulty FROM questions
		WHERE set_id = ? AND removed_at = '' ORDER BY position, created_at, id`, t.ID)
	if err != nil {
		return errs.Database.Wrap(err)
	}
	for rows.Next() {
		var b BarEntry
		if err := rows.Scan(&b.Done, &b.Weight); err != nil {
			return errs.Database.Of(errors.Join(err, rows.Close()))
		}
		t.Total++
		if b.Done {
			t.Done++
		}
		t.Bar = append(t.Bar, b)
	}
	if err := errors.Join(rows.Err(), rows.Close()); err != nil {
		return errs.Database.Wrap(err)
	}
	if s.c.Runner != nil {
		steps, err := s.c.Runner.Steps(ctx, change.ResourceSet, t.ID)
		if err != nil {
			return err
		}
		t.Steps = steps
	}
	return nil
}

// Sets is a course's sets, due soonest first.
func (s *Service) Sets(ctx context.Context, courseID string) (Sets, error) {
	return s.setsWhere(ctx, `t.course_id = ?`, courseID)
}

// Due is every course's sets not turned in, for Home, due soonest first.
func (s *Service) Due(ctx context.Context) (Sets, error) {
	return s.setsWhere(ctx, `t.turned_in_at = ''`)
}

// Detail is one set with its questions in order, and what PSet found and
// read for them (track 5b fills Finds and Readings). It asks for each
// question's guide and steps on its own: at most 40 small lookups on a local
// database, simpler than a join while 5b and 5c change what a question has.
func (s *Service) Detail(ctx context.Context, id string) (Detail, error) {
	got, err := s.setsWhere(ctx, `t.id = ?`, id)
	if err != nil {
		return Detail{}, err
	}
	if len(got.Sets) == 0 {
		return Detail{}, errs.Gone.New("thing", "assignment")
	}
	out := Detail{Set: got.Sets[0], Questions: []Question{}, Finds: []Find{}, Readings: []Reading{}}
	rows, err := s.c.Store.DB.QueryContext(ctx, `SELECT id, seq, set_id, position, text, label, notes, done_at != '', revealed,
		difficulty, find, pin_page, removed_at FROM questions WHERE set_id = ? AND removed_at = '' ORDER BY position, created_at, id`, id)
	if err != nil {
		return Detail{}, errs.Database.Wrap(err)
	}
	var ids []string
	for rows.Next() {
		var q Question
		var notes, revealed string
		if err := rows.Scan(&q.ID, &q.Seq, &q.SetID, &q.Position, &q.Text, &q.Label, &notes, &q.Done, &revealed,
			&q.Difficulty, &q.Find, &q.PinPage, &q.RemovedAt); err != nil {
			return Detail{}, errs.Database.Of(errors.Join(err, rows.Close()))
		}
		q.Notes, q.Revealed, q.Images, q.Steps = [][]doc.Run{}, []Reveal{}, []Image{}, []step.Step{}
		if err := errors.Join(json.Unmarshal([]byte(notes), &q.Notes), json.Unmarshal([]byte(revealed), &q.Revealed)); err != nil {
			return Detail{}, errs.Data.Of(errors.Join(err, rows.Close()))
		}
		out.Questions = append(out.Questions, q)
		ids = append(ids, q.ID)
	}
	if err := errors.Join(rows.Err(), rows.Close()); err != nil {
		return Detail{}, errs.Database.Wrap(err)
	}
	var seconds map[string]int
	if s.c.Seconds != nil {
		if seconds, err = s.c.Seconds(ctx, ids); err != nil {
			return Detail{}, err
		}
	}
	for i := range out.Questions {
		q := &out.Questions[i]
		q.Seconds = seconds[q.ID]
		if err := s.c.Store.DB.QueryRowContext(ctx, `SELECT id FROM documents WHERE owner_kind = 'question' AND owner_id = ?`, q.ID).
			Scan(&q.GuideID); err != nil && !errors.Is(err, sql.ErrNoRows) {
			return Detail{}, errs.Database.Wrap(err)
		}
		if s.c.Runner != nil {
			if q.Steps, err = s.c.Runner.Steps(ctx, change.ResourceQuestion, q.ID); err != nil {
				return Detail{}, err
			}
		}
	}
	return out, nil
}

// Routes mounts the reads; every change to sets and questions is an action.
func (s *Service) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/courses/{id}/sets", httpx.Reply(func(r *http.Request) (Sets, error) {
		return s.Sets(r.Context(), r.PathValue("id"))
	}))
	mux.HandleFunc("GET /api/sets", httpx.Reply(func(r *http.Request) (Sets, error) {
		return s.Due(r.Context())
	}))
	mux.HandleFunc("GET /api/sets/{id}", httpx.Reply(func(r *http.Request) (Detail, error) {
		return s.Detail(r.Context(), r.PathValue("id"))
	}))
	s.readRoutes(mux)
}
