package work

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/action"
	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/doc"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/pagenum"
	"github.com/jackt/pset/internal/store"
)

var bg = context.Background()

type env struct {
	t   *testing.T
	s   *store.Store
	c   *action.Catalog
	svc *Service
}

// newEnv is a course c1 whose textbook prints the section with each problem
// ("2.1.4").
func newEnv(t *testing.T) *env {
	t.Helper()
	s, err := store.Open(bg, filepath.Join(t.TempDir(), "store.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cleanup.Close(s.DB) })
	e := &env{t: t, s: s, c: action.New(s)}
	e.svc = New(Config{Store: s, Actions: e.c, Seconds: func(_ context.Context, ids []string) (map[string]int, error) {
		out := map[string]int{}
		for _, id := range ids {
			out[id] = 60
		}
		return out, nil
	}})
	style, err := json.Marshal(bySection)
	if err != nil {
		t.Fatal(err)
	}
	e.write(`INSERT INTO courses (id, name, created_at) VALUES ('c1', 'MATH 285', ?)`, db.Now())
	e.write(`INSERT INTO materials (id, course_id, title, textbook, problems, added_at) VALUES ('m1', 'c1', 'Boyce', 1, ?, ?)`, string(style), db.Now())
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

func (e *env) run(id string, in any) (action.Done, error) {
	e.t.Helper()
	raw, err := json.Marshal(in)
	if err != nil {
		e.t.Fatal(err)
	}
	return e.c.Run(bg, id, raw)
}

func (e *env) must(id string, in any) action.Done {
	e.t.Helper()
	done, err := e.run(id, in)
	if err != nil {
		e.t.Fatalf("%s: %v", id, err)
	}
	return done
}

func (e *env) detail(id string) Detail {
	e.t.Helper()
	d, err := e.svc.Detail(bg, id)
	if err != nil {
		e.t.Fatal(err)
	}
	return d
}

func field(err error) string { return errs.Resolve(err).Field }

// A set's title and date are tidied and checked; the course's sets list
// due soonest first, the undated last; Home's leaves out what was turned in.
func TestSets(t *testing.T) {
	e := newEnv(t)
	if _, err := e.run("set.add", AddSet{CourseID: "c1", Title: "  "}); field(err) != "title" {
		t.Fatalf("an empty title: %v", err)
	}
	if _, err := e.run("set.add", AddSet{CourseID: "c1", Title: strings.Repeat("x", 201)}); field(err) != "title" {
		t.Fatalf("a long title: %v", err)
	}
	if _, err := e.run("set.add", AddSet{CourseID: "c1", Title: "Set", Due: "next week"}); field(err) != "due" {
		t.Fatalf("a bad date: %v", err)
	}
	if _, err := e.run("set.add", AddSet{CourseID: "nope", Title: "Set"}); !errors.Is(err, errs.Gone) {
		t.Fatalf("a course that isn't there: %v", err)
	}
	late := e.must("set.add", AddSet{CourseID: "c1", Title: "Problem  set   5", Due: "2026-12-08"}).ID
	undated := e.must("set.add", AddSet{CourseID: "c1", Title: "Reading"}).ID
	soon := e.must("set.add", AddSet{CourseID: "c1", Title: "Problem set 4", Due: "2026-12-01"}).ID
	got, err := e.svc.Sets(bg, "c1")
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Sets) != 3 || got.Sets[0].ID != soon || got.Sets[1].ID != late || got.Sets[2].ID != undated || got.Sets[1].Title != "Problem set 5" {
		t.Fatalf("the course's sets %+v", got.Sets)
	}

	e.must("set.turn_in", TurnIn{ID: soon, TurnedIn: true})
	first := e.detail(soon).Set.TurnedInAt
	if again := e.must("set.turn_in", TurnIn{ID: soon, TurnedIn: true}); again.Action != "" || e.detail(soon).Set.TurnedInAt != first {
		t.Fatal("turning in again changed when it was turned in")
	}
	due, err := e.svc.Due(bg)
	if err != nil {
		t.Fatal(err)
	}
	if len(due.Sets) != 2 || due.Sets[0].ID != late {
		t.Fatalf("Home's sets %+v", due.Sets)
	}
	e.must("set.turn_in", TurnIn{ID: soon, TurnedIn: false})
	if e.detail(soon).Set.TurnedInAt != "" {
		t.Fatal("unmarking left it turned in")
	}
	e.must("set.due", SetDue{ID: soon, Due: ""})
	if e.detail(soon).Set.Due != "" {
		t.Fatal("an empty date did not clear it")
	}
}

// Drafts become questions at the end of the set: a reference listing several
// problems one each, in the textbook's numbering, with the professor's notes
// it carries; a typed problem one, labelled by its first line.
func TestAddingQuestions(t *testing.T) {
	e := newEnv(t)
	set := e.must("set.add", AddSet{CourseID: "c1", Title: "Problem set 4"}).ID
	if _, err := e.run("question.add", AddQuestions{SetID: set, Drafts: []Draft{{Text: " "}}}); field(err) != "drafts" {
		t.Fatalf("only blank drafts: %v", err)
	}
	many := make([]Draft, 41)
	for i := range many {
		many[i] = Draft{Text: "x"}
	}
	if _, err := e.run("question.add", AddQuestions{SetID: set, Drafts: many}); errs.Resolve(err).ID != tooManyDrafts.ID {
		t.Fatalf("41 drafts at once: %v", err)
	}
	e.must("question.add", AddQuestions{SetID: set, Drafts: []Draft{
		{Text: "2.1: 1, 4 (do c, 6 pts each)", Find: true},
		{Text: "Sketch the circuit and find i(t).\nUse KVL.", Find: false},
		{Text: "", Find: true},
	}})
	qs := e.detail(set).Questions
	if len(qs) != 3 {
		t.Fatalf("%d questions, want 3", len(qs))
	}
	if qs[0].Label != "2.1.1" || qs[1].Label != "2.1.4" || !qs[0].Find || qs[0].Position != 0 || qs[1].Position != 1 {
		t.Fatalf("the reference became %+v and %+v", qs[0], qs[1])
	}
	if got := noteText(qs[0].Notes); len(got) != 1 || got[0] != "do c" {
		t.Fatalf("its notes %q", got)
	}
	if qs[2].Label != "Sketch the circuit and find i(t)." || qs[2].Find || qs[2].Position != 2 || qs[2].Seconds != 60 {
		t.Fatalf("the typed problem %+v", qs[2])
	}
	// Removed, a question keeps its number: one added after lands after it.
	e.must("question.remove", RemoveQuestion{ID: qs[2].ID})
	e.must("question.add", AddQuestions{SetID: set, Drafts: []Draft{{Text: "2.2 #3", Find: true}}})
	qs = e.detail(set).Questions
	if len(qs) != 3 || qs[2].Label != "2.2.3" || qs[2].Position != 3 {
		t.Fatalf("after a removal, the new question is %+v", qs[len(qs)-1])
	}
	if d := e.detail(set).Set; d.Total != 3 || len(d.Bar) != 3 {
		t.Fatalf("the set counts %d, bar %d", d.Total, len(d.Bar))
	}
}

func noteText(notes [][]doc.Run) []string {
	out := make([]string, len(notes))
	for i, l := range notes {
		out[i] = doc.Source(l, pagenum.Map{})
	}
	return out
}

// Done, reveal, notes and moves change one question; each says nothing
// changed when nothing would.
func TestAQuestionsOwnChanges(t *testing.T) {
	e := newEnv(t)
	set := e.must("set.add", AddSet{CourseID: "c1", Title: "Problem set 4"}).ID
	e.must("question.add", AddQuestions{SetID: set, Drafts: []Draft{{Text: "1.1: 1, 2, 3", Find: true}}})
	qs := e.detail(set).Questions
	a, b, c := qs[0].ID, qs[1].ID, qs[2].ID

	e.must("question.done", QuestionMark{ID: a, Done: true})
	if again := e.must("question.done", QuestionMark{ID: a, Done: true}); again.Action != "" {
		t.Fatal("marking done twice changed something")
	}
	e.must("question.reveal", QuestionReveal{ID: a, Reveal: RevealHint})
	e.must("question.reveal", QuestionReveal{ID: a, Reveal: RevealHint})
	if _, err := e.run("question.reveal", QuestionReveal{ID: a, Reveal: "everything"}); field(err) != "reveal" {
		t.Fatalf("a stage that isn't one: %v", err)
	}
	if _, err := e.run("question.notes", QuestionNotes{ID: a, Notes: []string{strings.Repeat("x", 301)}}); field(err) != "notes" {
		t.Fatalf("a long note: %v", err)
	}
	e.must("question.notes", QuestionNotes{ID: a, Notes: []string{"- Only part (c).", " ", "No PSpice."}})
	got := e.detail(set)
	if q := got.Questions[0]; !q.Done || len(q.Revealed) != 1 || strings.Join(noteText(q.Notes), "|") != "Only part (c).|No PSpice." {
		t.Fatalf("the question after its changes %+v", q)
	}
	if got.Set.Done != 1 || !got.Set.Bar[0].Done {
		t.Fatalf("the set counts %d done", got.Set.Done)
	}

	// Move the last first; a removed one in the middle keeps its number.
	e.must("question.remove", RemoveQuestion{ID: b})
	e.must("question.move", QuestionMove{ID: c, Position: 0})
	qs = e.detail(set).Questions
	if len(qs) != 2 || qs[0].ID != c || qs[1].ID != a {
		t.Fatalf("after the move %v", []string{qs[0].Label, qs[1].Label})
	}
	if again := e.must("question.move", QuestionMove{ID: c, Position: -5}); again.Action != "" {
		t.Fatal("moving to where it is changed something")
	}
}

// A set removed takes its questions with it: its detail and every action on
// them say they are gone, and Undo brings them all back.
func TestARemovedSetHidesItsQuestions(t *testing.T) {
	e := newEnv(t)
	set := e.must("set.add", AddSet{CourseID: "c1", Title: "Problem set 4"}).ID
	e.must("question.add", AddQuestions{SetID: set, Drafts: []Draft{{Text: "1.1 #1", Find: true}}})
	q := e.detail(set).Questions[0].ID
	removed := e.must("set.remove", RemoveSet{ID: set})
	if len(removed.Took) != 1 || removed.Took[0].Kind != change.ResourceQuestion || removed.Took[0].N != 1 {
		t.Fatalf("the removal took %+v", removed.Took)
	}
	if _, err := e.svc.Detail(bg, set); !errors.Is(err, errs.Gone) {
		t.Fatalf("a removed set's detail: %v", err)
	}
	if _, err := e.run("question.done", QuestionMark{ID: q, Done: true}); !errors.Is(err, errs.Gone) {
		t.Fatalf("marking a question of a removed set: %v", err)
	}
	if _, err := e.c.Undo(bg, removed.Action, false); err != nil {
		t.Fatal(err)
	}
	if len(e.detail(set).Questions) != 1 {
		t.Fatal("undoing the removal did not bring its question back")
	}
}

// The routes: a course's sets, Home's, and a set's detail.
func TestTheRoutes(t *testing.T) {
	e := newEnv(t)
	set := e.must("set.add", AddSet{CourseID: "c1", Title: "Problem set 4", Due: "2026-12-01"}).ID
	mux := http.NewServeMux()
	e.svc.Routes(mux)
	for path, want := range map[string]string{
		"/api/courses/c1/sets": `"title":"Problem set 4"`,
		"/api/sets":            `"due":"2026-12-01"`,
		"/api/sets/" + set:     `"questions":[]`,
	} {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), want) {
			t.Fatalf("%s: %d %s", path, rec.Code, rec.Body)
		}
	}
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/sets/nope", nil))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("a set that isn't there: %d", rec.Code)
	}
}
