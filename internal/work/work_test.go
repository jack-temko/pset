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
	e.write(`INSERT INTO courses (id, name, created_at, removed_at) VALUES ('c2', 'Old', ?, ?)`, db.Now(), db.Now())
	if _, err := e.run("set.add", AddSet{CourseID: "c2", Title: "Set"}); !errors.Is(err, errs.Gone) {
		t.Fatalf("a removed course: %v", err)
	}
	if _, err := e.run("set.add", AddSet{CourseID: "c1", Title: strings.Repeat("x", 200)}); err != nil {
		t.Fatalf("a title of 200: %v", err)
	}
	late := e.must("set.add", AddSet{CourseID: "c1", Title: "Problem  set   5", Due: "2026-12-08"}).ID
	undated := e.must("set.add", AddSet{CourseID: "c1", Title: "Reading"}).ID
	soon := e.must("set.add", AddSet{CourseID: "c1", Title: "Problem set 4", Due: "2026-12-01"}).ID
	got, err := e.svc.Sets(bg, "c1")
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Sets) != 4 || got.Sets[0].ID != soon || got.Sets[1].ID != late || got.Sets[3].ID != undated || got.Sets[1].Title != "Problem set 5" {
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
	if len(due.Sets) != 3 || due.Sets[0].ID != late {
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
	// One reference listing more than 40 problems is refused whole.
	if _, err := e.run("question.add", AddQuestions{SetID: set, Drafts: []Draft{{Text: "2.1: 1-30, 2.2: 1-15", Find: true}}}); errs.Resolve(err).ID != tooManyDrafts.ID {
		t.Fatalf("one reference to 45 problems: %v", err)
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

// positions is each question's stored number, removed ones too.
func positions(e *env, set string) map[string]int {
	e.t.Helper()
	rows, err := e.s.DB.Query(`SELECT id, position FROM questions WHERE set_id = ?`, set)
	if err != nil {
		e.t.Fatal(err)
	}
	defer cleanup.Close(rows)
	out := map[string]int{}
	for rows.Next() {
		var id string
		var p int
		if err := rows.Scan(&id, &p); err != nil {
			e.t.Fatal(err)
		}
		out[id] = p
	}
	return out
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

	// Move the last first; the removed one in the middle keeps its number,
	// and undoing its removal puts it back between them.
	removedB := e.must("question.remove", RemoveQuestion{ID: b})
	e.must("question.move", QuestionMove{ID: c, Position: 0})
	if got := positions(e, set); got[c] != 0 || got[b] != 1 || got[a] != 2 {
		t.Fatalf("the numbers after the move %v, want c 0, b 1, a 2", got)
	}
	if _, err := e.c.Undo(bg, removedB.Action, false); err != nil {
		t.Fatal(err)
	}
	if qs = e.detail(set).Questions; len(qs) != 3 || qs[0].ID != c || qs[1].ID != b || qs[2].ID != a {
		t.Fatalf("after bringing b back: %v", []string{qs[0].Label, qs[1].Label, qs[2].Label})
	}
	// Moving down, past the end, is the end.
	e.must("question.move", QuestionMove{ID: c, Position: 9})
	if qs = e.detail(set).Questions; qs[2].ID != c {
		t.Fatalf("moving down past the end: %v", []string{qs[0].Label, qs[1].Label, qs[2].Label})
	}
	if again := e.must("question.move", QuestionMove{ID: c, Position: 99}); again.Action != "" {
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

// Notes read from a reference fit the caps the student's own are held to.
func TestNotesFromAReferenceFitTheCaps(t *testing.T) {
	long := strings.Repeat("y", maxNote+20)
	many := make([]string, maxNotes+3)
	for i := range many {
		many[i] = "note"
	}
	if got := fitNotes(append([]string{long}, many...)); len(got) != maxNotes || len([]rune(got[0])) != maxNote {
		t.Fatalf("fitted to %d notes, the first %d long", len(got), len([]rune(got[0])))
	}
	if _, err := cleanNotes(fitNotes([]string{long})); err != nil {
		t.Fatalf("a fitted note does not save back: %v", err)
	}
}

// On the stream a question says find as a yes or no, and an unpinned page as
// null, as the reads leave it out.
func TestAQuestionOnTheStream(t *testing.T) {
	e := newEnv(t)
	set := e.must("set.add", AddSet{CourseID: "c1", Title: "Problem set 4"}).ID
	e.must("question.add", AddQuestions{SetID: set, Drafts: []Draft{{Text: "2.1.4", Find: true}}})
	q := e.detail(set).Questions[0].ID
	after := func(action, q string, cols string, args ...any) map[string]any {
		t.Helper()
		mark, err := e.s.Latest(bg)
		if err != nil {
			t.Fatal(err)
		}
		if err := e.s.Write(bg, change.ActorStudent, action, func(tx *sql.Tx) error {
			_, err := tx.Exec(`UPDATE questions SET `+cols+` WHERE id = ?`, append(args, q)...)
			return err
		}); err != nil {
			t.Fatal(err)
		}
		cs, err := e.s.Since(bg, mark, 10)
		if err != nil || len(cs) == 0 {
			t.Fatalf("no change (%v)", err)
		}
		var out map[string]any
		if err := json.Unmarshal(cs[0].After, &out); err != nil {
			t.Fatal(err)
		}
		return out
	}
	if got := after("pin", q, "pin_page = ?, find = ?", 95, 0); got["pinPage"] != float64(95) || got["find"] != false {
		t.Fatalf("pinned: %v", got)
	}
	got := after("unpin", q, "pin_page = ?", 0)
	if v, ok := got["pinPage"]; !ok || v != nil {
		t.Fatalf("unpinned, pinPage is %v (sent %v), want null", v, ok)
	}
}

// Undo says a problem brought back is still hidden by its assignment, in the
// screens' words.
func TestUndoNamesTheAssignment(t *testing.T) {
	e := newEnv(t)
	set := e.must("set.add", AddSet{CourseID: "c1", Title: "PS 4"}).ID
	e.must("question.add", AddQuestions{SetID: set, Drafts: []Draft{{Text: "Sketch the circuit."}}})
	removed := e.must("question.remove", RemoveQuestion{ID: e.detail(set).Questions[0].ID})
	e.must("set.remove", RemoveSet{ID: set})
	u, err := e.c.Undo(bg, removed.Action, false)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(u.Said, ". Its assignment is still removed.") {
		t.Fatalf("undo said %q", u.Said)
	}
}
