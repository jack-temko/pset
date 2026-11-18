package spend

import (
	"context"
	"database/sql"
	"math"
	"net/http"
	"net/http/httptest"
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

// Since adds up every call from a time, in all and by course, the most
// first; with no time it is all the calls kept.
func TestSpendSince(t *testing.T) {
	svc := New(newStore(t))
	all, err := svc.Since(bg, "")
	if err != nil {
		t.Fatal(err)
	}
	if all.Total.Calls != 6 || len(all.ByCourse) != 2 || all.ByCourse[0].CourseID != "c2" || all.ByCourse[1].Total.Calls != 5 {
		t.Fatalf("all time %+v", all)
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
	for path, code := range map[string]int{"/api/spend": 200, "/api/spend?since=2026-11-01T00:00:00Z": 200, "/api/spend?since=monday": 422} {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != code {
			t.Fatalf("%s: %d", path, rec.Code)
		}
	}
}
