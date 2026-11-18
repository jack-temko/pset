package study

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jackt/pset/internal/action"
	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/store"
)

var bg = context.Background()

// noon is the clock the tests run at.
var noon = time.Date(2026, 11, 18, 12, 0, 0, 0, time.UTC)

type env struct {
	t   *testing.T
	s   *store.Store
	c   *action.Catalog
	svc *Service
}

func newEnv(t *testing.T) *env {
	t.Helper()
	s, err := store.Open(bg, filepath.Join(t.TempDir(), "store.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cleanup.Close(s.DB) })
	e := &env{t: t, s: s, c: action.New(s)}
	e.svc = New(s, e.c)
	e.svc.now = func() time.Time { return noon }
	for _, id := range []string{"c1", "c2"} {
		e.write(`INSERT INTO courses (id, name, created_at) VALUES (?, ?, ?)`, id, "Course "+id, db.Now())
	}
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

// save saves a stretch from..to minutes after noon (negative is before).
func (e *env) save(id, course string, k Kind, from, to int) error {
	at := func(m int) string { return noon.Add(time.Duration(m) * time.Minute).Format(time.RFC3339) }
	return e.svc.Save(bg, Stretch{ID: id, CourseID: course, Kind: k, Started: at(from), Ended: at(to)})
}

func (e *env) week(since time.Time) Week {
	e.t.Helper()
	w, err := e.svc.Week(bg, since)
	if err != nil {
		e.t.Fatal(err)
	}
	return w
}

// The week sums by kind and by course, the most first; two tabs' stretches
// that overlap count once, and time before the week starts is cut off.
func TestTheWeek(t *testing.T) {
	e := newEnv(t)
	for _, s := range []struct {
		id, course string
		k          Kind
		from, to   int
	}{
		{"a", "c1", KindHomework, -60, -30}, // 30 min
		{"b", "c1", KindHomework, -45, -20}, // overlaps a: 10 more
		{"c", "c2", KindReading, -10, 0},    // 10 min
		{"d", "c2", KindAsking, -200, -150}, // before the week: none
	} {
		if err := e.save(s.id, s.course, s.k, s.from, s.to); err != nil {
			t.Fatal(err)
		}
	}
	w := e.week(noon.Add(-120 * time.Minute))
	if w.Homework != 40 || w.Reading != 10 || w.Asking != 0 {
		t.Fatalf("by kind %+v", w)
	}
	if len(w.ByCourse) != 2 || w.ByCourse[0] != (CourseMinutes{"c1", 40}) || w.ByCourse[1] != (CourseMinutes{"c2", 10}) {
		t.Fatalf("by course %+v", w.ByCourse)
	}

	// A removed course's time is left out.
	e.write(`UPDATE courses SET removed_at = ? WHERE id = 'c2'`, db.Now())
	if w := e.week(noon.Add(-120 * time.Minute)); len(w.ByCourse) != 1 || w.Reading != 0 {
		t.Fatalf("with c2 removed %+v", w)
	}
}

// Saving a stretch again moves its end on, never back; an end in the future
// is clamped to now, and a stretch to six hours.
func TestAStretchOnlyGrows(t *testing.T) {
	e := newEnv(t)
	for _, to := range []int{-30, -10, -20} {
		if err := e.save("s", "c1", KindReading, -60, to); err != nil {
			t.Fatal(err)
		}
	}
	if w := e.week(noon.Add(-24 * time.Hour)); w.Reading != 50 {
		t.Fatalf("after ends -30, -10, -20: %d minutes", w.Reading)
	}
	if err := e.save("future", "c1", KindAsking, -10, 600); err != nil {
		t.Fatal(err)
	}
	if err := e.save("long", "c1", KindHomework, -24*60, 0); err != nil {
		t.Fatal(err)
	}
	if w := e.week(noon.Add(-48 * time.Hour)); w.Asking != 10 || w.Homework != 360 {
		t.Fatalf("clamped: asking %d (want 10), homework %d (want 360)", w.Asking, w.Homework)
	}
}

// Time for a course that is gone is refused, as is a stretch the page named
// wrong.
func TestRefusals(t *testing.T) {
	e := newEnv(t)
	e.write(`UPDATE courses SET removed_at = ? WHERE id = 'c2'`, db.Now())
	for _, course := range []string{"c2", "nope"} {
		if err := e.save("x", course, KindReading, -5, 0); !errors.Is(err, errs.Gone) {
			t.Fatalf("time for %s: %v", course, err)
		}
	}
	at := noon.Format(time.RFC3339)
	for _, st := range []Stretch{
		{ID: "x", CourseID: "c1", Kind: "napping", Started: at, Ended: at},
		{ID: "", CourseID: "c1", Kind: KindReading, Started: at, Ended: at},
		{ID: strings.Repeat("x", 65), CourseID: "c1", Kind: KindReading, Started: at, Ended: at},
		{ID: "x", CourseID: "c1", Kind: KindReading, Started: at, Ended: at, QuestionID: "q1"},
		{ID: "x", CourseID: "c1", Kind: KindReading, Started: "yesterday", Ended: at},
	} {
		if v := errs.Resolve(e.svc.Save(bg, st)); v.Scope != errs.ScopeField {
			t.Fatalf("%+v: %+v", st, v)
		}
	}
}

// A problem's time is its homework stretches', an overlap once.
func TestQuestionSeconds(t *testing.T) {
	e := newEnv(t)
	at := func(m int) string { return noon.Add(time.Duration(m) * time.Minute).Format(time.RFC3339) }
	for _, st := range []Stretch{
		{ID: "a", CourseID: "c1", Kind: KindHomework, Started: at(-10), Ended: at(-5), QuestionID: "q1"},
		{ID: "b", CourseID: "c1", Kind: KindHomework, Started: at(-7), Ended: at(-2), QuestionID: "q1"},
		{ID: "c", CourseID: "c1", Kind: KindHomework, Started: at(-3), Ended: at(-2), QuestionID: "q2"},
	} {
		if err := e.svc.Save(bg, st); err != nil {
			t.Fatal(err)
		}
	}
	got, err := e.svc.QuestionSeconds(bg, []string{"q1", "q2", "q3"})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got["q1"] != 480 || got["q2"] != 60 {
		t.Fatalf("seconds %v", got)
	}
}

// Forgetting time spent is an action that can't be undone; a course purged
// takes its time with it.
func TestTimeGoes(t *testing.T) {
	e := newEnv(t)
	if err := e.save("a", "c1", KindReading, -10, 0); err != nil {
		t.Fatal(err)
	}
	if err := e.save("b", "c2", KindReading, -10, 0); err != nil {
		t.Fatal(err)
	}
	e.write(`UPDATE courses SET removed_at = ? WHERE id = 'c2'`, db.At(noon.Add(-30*24*time.Hour)))
	if err := e.s.Purge(bg, time.Now()); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := e.s.DB.QueryRow(`SELECT count(*) FROM study`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("after the purge %d stretches (%v)", n, err)
	}
	done, err := e.c.Run(bg, "time.clear", nil)
	if err != nil || done.Action != "" {
		t.Fatalf("clear: %+v %v", done, err)
	}
	if err := e.s.DB.QueryRow(`SELECT count(*) FROM study`).Scan(&n); err != nil || n != 0 {
		t.Fatalf("after clearing %d stretches (%v)", n, err)
	}
}

// The routes: a stretch saved, the week read, a bad week start refused.
func TestTheRoutes(t *testing.T) {
	e := newEnv(t)
	mux := http.NewServeMux()
	e.svc.Routes(mux)
	body := `{"id":"r","courseId":"c1","kind":"reading","started":"` + noon.Add(-5*time.Minute).Format(time.RFC3339) +
		`","ended":"` + noon.Format(time.RFC3339) + `"}`
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/time", strings.NewReader(body)))
	if rec.Code != http.StatusNoContent {
		t.Fatalf("save answered %d %s", rec.Code, rec.Body)
	}
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/time?since="+noon.Add(-time.Hour).Format(time.RFC3339), nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"reading":5`) {
		t.Fatalf("week answered %d %s", rec.Code, rec.Body)
	}
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/time?since=monday", nil))
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("a bad since answered %d", rec.Code)
	}
}
