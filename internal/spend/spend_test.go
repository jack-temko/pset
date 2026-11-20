package spend

import (
	"context"
	"database/sql"
	"math"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/store"
)

var bg = context.Background()

// newStore is a course c1 with a material, a set with one problem and an Ask
// turn, each with a step; and a second course c2 with a material.
func newStore(t *testing.T) *store.Store {
	t.Helper()
	s, err := store.Open(bg, filepath.Join(t.TempDir(), "store.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cleanup.Close(s.DB) })
	now := db.Now()
	stmts := []string{
		`INSERT INTO courses (id, name, created_at) VALUES ('c1', 'ECE 210', ?1), ('c2', 'MATH 285', ?1)`,
		`INSERT INTO materials (id, course_id, title, added_at) VALUES ('m1', 'c1', 'Book', ?1), ('m2', 'c2', 'Other', ?1)`,
		`INSERT INTO sets (id, course_id, title, created_at) VALUES ('s1', 'c1', 'Set 4', ?1)`,
		`INSERT INTO questions (id, set_id, position, text, created_at) VALUES ('q1', 's1', 0, '2.1', ?1)`,
		`INSERT INTO turns (id, course_id, question, created_at) VALUES ('t1', 'c1', 'why?', ?1)`,
		`INSERT INTO steps (id, subject_kind, subject_id, name, position, state, created_at) VALUES
			('st-m1', 'material', 'm1', 'contents', 0, 'done', ?1),
			('st-s1', 'set', 's1', 'rank', 0, 'done', ?1),
			('st-q1', 'question', 'q1', 'find', 0, 'done', ?1),
			('st-t1', 'turn', 't1', 'answer', 0, 'done', ?1),
			('st-m2', 'material', 'm2', 'contents', 0, 'done', ?1)`,
		// Each step's calls: one counted call of 100 tokens and $0.01 for the
		// material's, a fallback's answer on the question, a failed call nobody
		// reported usage for on the set, and the other course's call.
		`INSERT INTO calls (step_id, attempt, at, model, answered, prompt_tokens, completion_tokens, cost, ms, counted, error_id) VALUES
			('st-m1', 1, ?1, 'a/writer', 'a/writer', 80, 20, 0.01, 1000, 1, ''),
			('st-q1', 1, ?1, 'a/reader', 'b/fallback', 50, 50, 0.02, 2000, 1, ''),
			('st-q1', 2, ?1, 'a/reader', '', 0, 0, 0, 500, 0, 'model.busy'),
			('st-s1', 1, ?1, 'a/writer', '', 0, 0, 0, 300, 0, 'model.timeout'),
			('st-t1', 1, ?1, 'a/writer', 'a/writer', 300, 100, 0.04, 4000, 1, ''),
			('st-m2', 1, ?1, 'a/writer', 'a/writer', 999, 1, 0.5, 9000, 1, '')`,
	}
	if err := s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		for _, q := range stmts {
			if _, err := tx.Exec(q, now); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	return s
}

func near(a, b float64) bool { return math.Abs(a-b) < 1e-9 }

// A set's spend is its own steps' and its problems', by the model that
// answered: a fallback's answer is the fallback's, and a call nothing
// answered is the model asked for, failed and uncounted.
func TestASetsSpend(t *testing.T) {
	svc := New(newStore(t))
	got, err := svc.Set(bg, "s1")
	if err != nil {
		t.Fatal(err)
	}
	by := map[string]Model{}
	for _, m := range got.Models {
		by[m.Model] = m
	}
	if len(got.Models) != 3 || got.Models[0].Model != "b/fallback" {
		t.Fatalf("models %+v, want the fallback first (most tokens)", got.Models)
	}
	if f := by["b/fallback"]; f.Calls != 1 || f.Tokens != 100 || !near(f.Cost, 0.02) {
		t.Fatalf("the fallback %+v", f)
	}
	if r := by["a/reader"]; r.Calls != 1 || r.Failed != 1 || r.Uncounted != 1 || r.Tokens != 0 {
		t.Fatalf("the reader's failed call %+v", r)
	}
	if w := by["a/writer"]; w.Calls != 1 || w.Failed != 1 || w.Uncounted != 1 {
		t.Fatalf("the ranking's failed call %+v", w)
	}
	if got.Total.Calls != 3 || got.Total.Failed != 2 || got.Total.Uncounted != 2 || got.Total.Tokens != 100 || got.Total.Ms != 2800 {
		t.Fatalf("total %+v", got.Total)
	}
}

// A course's spend is all of its things' and nothing of another course's; a
// material's is its import alone.
func TestACoursesAndAMaterialsSpend(t *testing.T) {
	svc := New(newStore(t))
	c, err := svc.Course(bg, "c1")
	if err != nil {
		t.Fatal(err)
	}
	if c.Total.Calls != 5 || c.Total.Tokens != 600 || !near(c.Total.Cost, 0.07) {
		t.Fatalf("the course %+v", c.Total)
	}
	m, err := svc.Material(bg, "m1")
	if err != nil {
		t.Fatal(err)
	}
	if m.Total.Calls != 1 || m.Total.Tokens != 100 || len(m.Models) != 1 {
		t.Fatalf("the material %+v", m)
	}
	none, err := svc.Material(bg, "nothing")
	if err != nil || none.Models == nil || len(none.Models) != 0 || none.Total.Calls != 0 {
		t.Fatalf("nothing called: %+v %v", none, err)
	}
}

// The routes answer each read.
func TestTheRoutes(t *testing.T) {
	svc := New(newStore(t))
	mux := http.NewServeMux()
	svc.Routes(mux)
	for path, want := range map[string]string{
		"/api/courses/c1/spend":   `"calls":5`,
		"/api/materials/m2/spend": `"tokens":1000`,
		"/api/sets/s1/spend":      `"failed":2`,
	} {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), want) {
			t.Fatalf("%s: %d %s", path, rec.Code, rec.Body)
		}
	}
}

// Since adds up every call from a time, in all and by course, the most cost
// first; with no time it is all the calls kept. A call whose subject is gone
// still counts, under no course.
func TestSpendSince(t *testing.T) {
	s := newStore(t)
	svc := New(s)
	week := time.Now().Add(-7 * 24 * time.Hour)
	if err := s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		if _, err := tx.Exec(`INSERT INTO steps (id, subject_kind, subject_id, name, position, state, created_at) VALUES
			('st-gone', 'material', 'm-gone', 'contents', 0, 'done', ?)`, db.Now()); err != nil {
			return err
		}
		_, err := tx.Exec(`INSERT INTO calls (step_id, attempt, at, model, answered, prompt_tokens, completion_tokens, cost, ms, counted, error_id) VALUES
			('st-m1', 2, ?1, 'a/writer', 'a/writer', 10, 0, 1, 10, 1, ''),
			('st-gone', 1, ?1, 'a/writer', 'a/writer', 5, 0, 0.001, 10, 1, '')`, db.At(week.Add(-time.Hour)))
		return err
	}); err != nil {
		t.Fatal(err)
	}

	all, err := svc.Since(bg, "")
	if err != nil {
		t.Fatal(err)
	}
	if all.Total.Calls != 8 || all.Total.Tokens != 1000+100+100+400+15 || !near(all.Total.Cost, 0.57+1.001) || len(all.ByCourse) != 3 ||
		all.ByCourse[0].CourseID != "c1" || all.ByCourse[2].CourseID != "" || all.ByCourse[2].Total.Calls != 1 {
		t.Fatalf("all time %+v", all)
	}
	// A removed course's calls still count, under its id, marked removed.
	if err := s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		_, err := tx.Exec(`UPDATE courses SET removed_at = ? WHERE id = 'c2'`, db.Now())
		return err
	}); err != nil {
		t.Fatal(err)
	}
	removed, err := svc.Since(bg, "")
	if err != nil {
		t.Fatal(err)
	}
	if removed.Total.Calls != 8 || removed.ByCourse[1].CourseID != "c2" || !removed.ByCourse[1].Removed || removed.ByCourse[0].Removed || removed.ByCourse[2].Removed {
		t.Fatalf("with c2 removed %+v", removed)
	}
	recent, err := svc.Since(bg, db.At(week))
	if err != nil {
		t.Fatal(err)
	}
	if recent.Total.Calls != 6 || !near(recent.Total.Cost, 0.57) || len(recent.ByCourse) != 2 ||
		recent.ByCourse[0].CourseID != "c2" || recent.ByCourse[1].Total.Calls != 5 || recent.ByCourse[1].Total.Failed != 2 {
		t.Fatalf("this week %+v", recent)
	}
	later, err := svc.Since(bg, db.At(time.Now().Add(time.Hour)))
	if err != nil {
		t.Fatal(err)
	}
	if later.Total.Calls != 0 || later.ByCourse == nil || len(later.ByCourse) != 0 {
		t.Fatalf("from an hour ahead %+v", later)
	}

	mux := http.NewServeMux()
	svc.Routes(mux)
	for path, want := range map[string]string{
		"/api/spend": `"calls":8`,
		"/api/spend?since=" + url.QueryEscape(week.Format(time.RFC3339)): `"calls":6`,
		"/api/spend?since=monday": `"field":"since"`,
	} {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if !strings.Contains(rec.Body.String(), want) {
			t.Fatalf("%s: %d %s", path, rec.Code, rec.Body)
		}
	}
}

// A sheet's read counts toward its course, in the course's spend and since.
func TestAReadsSpend(t *testing.T) {
	s := newStore(t)
	svc := New(s)
	if err := s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		for _, q := range []string{
			`INSERT INTO reads (id, course_id, source, created_at) VALUES ('r1', 'c2', 'sheet.pdf', ?1)`,
			`INSERT INTO steps (id, subject_kind, subject_id, name, position, state, created_at) VALUES ('st-r1', 'read', 'r1', 'read', 0, 'done', ?1)`,
			`INSERT INTO calls (step_id, attempt, at, model, answered, prompt_tokens, completion_tokens, cost, ms, counted, error_id) VALUES
				('st-r1', 1, ?1, 'a/reader', 'a/reader', 10, 0, 0.003, 10, 1, '')`,
		} {
			if _, err := tx.Exec(q, db.Now()); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	course, err := svc.Course(bg, "c2")
	if err != nil || course.Total.Calls != 2 {
		t.Fatalf("c2's spend with its read: %+v %v", course.Total, err)
	}
	all, err := svc.Since(bg, "")
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range all.ByCourse {
		if c.CourseID == "" || (c.CourseID == "c2" && c.Total.Calls != 2) {
			t.Fatalf("since, with a read %+v", all.ByCourse)
		}
	}
}
