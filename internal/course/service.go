package course

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/jackt/pset/internal/action"
	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/store"
)

// maxName is the longest a course's name may be.
const maxName = 80

// What a course's name is refused for, said under the field.
var (
	nameEmpty = errs.Define(errs.Entry{
		ID:    "course.name_empty",
		Kind:  errs.KindYourInput,
		What:  "Give the course a name.",
		Scope: errs.ScopeField,
	})
	nameTooLong = errs.Define(errs.Entry{
		ID:    "course.name_too_long",
		Kind:  errs.KindYourInput,
		What:  "Keep it under {max} characters.",
		Scope: errs.ScopeField,
	})
)

// Service keeps the student's courses, on the store.
type Service struct {
	store *store.Store
}

// New is the courses on s, with their actions declared in c.
func New(s *store.Store, c *action.Catalog) *Service {
	svc := &Service{store: s}
	action.Add(c, action.Def[Add]{
		ID: "course.add", Name: "Add course", Undoable: true,
		Undone: "Took back adding {name}.", Redone: "Added {name} again.",
		Run: svc.add,
		Try: func(action.Seed) Add { return Add{Name: "MATH 241"} },
	})
	action.Add(c, action.Def[Rename]{
		ID: "course.rename", Name: "Rename course", Undoable: true,
		Undone: "Renamed back to {name}.", Redone: "Renamed to {name} again.",
		Run: svc.rename,
		Try: func(s action.Seed) Rename { return Rename{ID: s.CourseID, Name: "ECE 210 (spring)"} },
	})
	action.Add(c, action.Def[Remove]{
		ID: "course.remove", Name: "Remove course", Undoable: true,
		Undone: "Brought back {name}.", Redone: "Removed {name} again.",
		Run: svc.remove,
		Try: func(s action.Seed) Remove { return Remove{ID: s.CourseID} },
	})
	return svc
}

// name is a name as typed, tidied and checked.
func name(s string) (string, error) {
	s = strings.Join(strings.Fields(s), " ")
	switch {
	case s == "":
		return "", nameEmpty.New().OnField("name")
	case utf8.RuneCountInString(s) > maxName:
		return "", nameTooLong.New("max", strconv.Itoa(maxName)).OnField("name")
	}
	return s, nil
}

func (s *Service) add(ctx context.Context, do *action.Do, in Add) error {
	n, err := name(in.Name)
	if err != nil {
		return err
	}
	id := uuid.NewString()
	return do.Write(ctx, change.ResourceCourse, id, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, `INSERT INTO courses (id, name, created_at) VALUES (?, ?, ?)`, id, n, db.Now())
		return errs.Database.Of(err)
	})
}

// rename and remove check the course inside their write, guarded by its
// state: a course another tab removed a moment ago is gone, and nothing is
// written or recorded.
func (s *Service) rename(ctx context.Context, do *action.Do, in Rename) error {
	n, err := name(in.Name)
	if err != nil {
		return err
	}
	return do.Write(ctx, change.ResourceCourse, in.ID, func(tx *sql.Tx) error {
		var cur string
		err := tx.QueryRowContext(ctx, `SELECT name FROM courses WHERE id = ? AND removed_at = ''`, in.ID).Scan(&cur)
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return errs.Gone.New("thing", "course")
		case err != nil:
			return errs.Database.Wrap(err)
		case cur == n:
			return action.Unchanged
		}
		res, err := tx.ExecContext(ctx, `UPDATE courses SET name = ? WHERE id = ? AND removed_at = ''`, n, in.ID)
		return action.One(res, err, "course")
	})
}

func (s *Service) remove(ctx context.Context, do *action.Do, in Remove) error {
	return do.Write(ctx, change.ResourceCourse, in.ID, func(tx *sql.Tx) error {
		res, err := tx.ExecContext(ctx, `UPDATE courses SET removed_at = ? WHERE id = ? AND removed_at = ''`, db.Now(), in.ID)
		return action.One(res, err, "course")
	})
}

// List is the courses not removed, in the order they were added.
func (s *Service) List(ctx context.Context) (Courses, error) {
	rows, err := s.store.DB.QueryContext(ctx, `SELECT id, seq, name, created_at, removed_at FROM courses
		WHERE removed_at = '' ORDER BY created_at, id`)
	if err != nil {
		return Courses{}, errs.Database.Wrap(err)
	}
	defer cleanup.Close(rows)
	out := Courses{Courses: []Course{}}
	for rows.Next() {
		var c Course
		if err := rows.Scan(&c.ID, &c.Seq, &c.Name, &c.CreatedAt, &c.RemovedAt); err != nil {
			return Courses{}, errs.Database.Wrap(err)
		}
		out.Courses = append(out.Courses, c)
	}
	return out, errs.Database.Of(rows.Err())
}

// Get is one course not removed.
func (s *Service) Get(ctx context.Context, id string) (Course, error) {
	var c Course
	err := s.store.DB.QueryRowContext(ctx, `SELECT id, seq, name, created_at, removed_at FROM courses
		WHERE id = ? AND removed_at = ''`, id).Scan(&c.ID, &c.Seq, &c.Name, &c.CreatedAt, &c.RemovedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Course{}, errs.Gone.New("thing", "course")
	}
	return c, errs.Database.Of(err)
}

// Routes mounts the reads; the writes are actions.
func (s *Service) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/courses", httpx.Reply(func(r *http.Request) (Courses, error) {
		return s.List(r.Context())
	}))
	mux.HandleFunc("GET /api/courses/{id}", httpx.Reply(func(r *http.Request) (Course, error) {
		return s.Get(r.Context(), r.PathValue("id"))
	}))
}
