package work

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackt/pset/internal/action"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/library"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/llm/llmtest"
	"github.com/jackt/pset/internal/material"
	"github.com/jackt/pset/internal/probnum"
	"github.com/jackt/pset/internal/runner"
	"github.com/jackt/pset/internal/step"
	"github.com/jackt/pset/internal/store"
)

// sheetReply is the model's reading of a sheet: two dates, a textbook line
// with notes, a problem written out, and something that isn't homework.
const sheetReply = `{"title": "Assignment #3", "groups": [
 {"due": "2026-12-01", "title": "", "rows": [
  {"kind": "textbook", "text": "2.1: 1, 4 (do c, 6 pts each)"},
  {"kind": "own", "text": "Sketch the circuit."},
  {"kind": "other", "text": "Reading: Sections 2.1 to 2.4"}]},
 {"due": "2026-12-08", "title": "", "rows": [
  {"kind": "textbook", "text": "2.2.3"},
  {"kind": "lecture", "text": "Bring a calculator"}]}]}`

type readEnv struct {
	*env
	r     *runner.Runner
	mats  *material.Service
	model *llmtest.Server
	mu    sync.Mutex
	asked int
	dir   string
}

// newReadEnv is newEnv with the materials, a runner and a model that reads
// any sheet as sheetReply.
func newReadEnv(t *testing.T) *readEnv {
	t.Helper()
	e := newIdleReadEnv(t)
	e.start()
	return e
}

// newIdleReadEnv is newReadEnv with its runner not yet running.
func newIdleReadEnv(t *testing.T) *readEnv {
	t.Helper()
	if _, err := os.Stat("/usr/bin/pdftotext"); err != nil {
		t.Skip("needs poppler")
	}
	dir := t.TempDir()
	s, err := store.Open(bg, filepath.Join(dir, "store.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cleanup.Close(s.DB) })
	e := &readEnv{env: &env{t: t, s: s, c: action.New(s)}, model: llmtest.New(t), dir: dir}
	e.model.Fallback(func(req llm.ChatRequest) llmtest.Reply {
		if len(req.Messages) > 0 && strings.Contains(req.Messages[0].Content.Text(), "homework assignment") {
			e.mu.Lock()
			e.asked++
			e.mu.Unlock()
			return llmtest.Reply{Text: sheetReply}
		}
		return llmtest.Reply{Text: "{}"}
	})
	e.r = runner.New(s, runner.Options{Key: func(context.Context) (string, error) { return "test", nil }, BaseURL: e.model.URL, DataDir: dir})
	e.mats = material.New(material.Config{Store: s, Actions: e.c, Runner: e.r, DataDir: dir, Tools: library.LiveTools(), ChatModel: "fake-chat"})
	e.svc = New(Config{Store: s, Actions: e.c, Runner: e.r, Materials: e.mats})
	style := `{"form":"section","where":"chapter"}`
	e.write(`INSERT INTO courses (id, name, created_at) VALUES ('c1', 'MATH 285', ?)`, db.Now())
	e.write(`INSERT INTO materials (id, course_id, title, textbook, problems, added_at) VALUES ('m1', 'c1', 'Boyce', 1, ?, ?)`, style, db.Now())
	return e
}

// start runs the runner until the test ends.
func (e *readEnv) start() {
	ctx, cancel := context.WithCancel(bg)
	done := make(chan struct{})
	go func() {
		if err := e.r.Run(ctx); err != nil {
			e.t.Error(err)
		}
		close(done)
	}()
	e.t.Cleanup(func() { cancel(); <-done })
}

// calls is how many times the model was asked to read a sheet.
func (e *readEnv) calls() int {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.asked
}

// upload stages the sample sheet.
func (e *readEnv) upload() string {
	e.t.Helper()
	f, err := os.Open(filepath.Join("..", "..", "testdata", "sample-digital.pdf"))
	if err != nil {
		e.t.Fatal(err)
	}
	defer cleanup.Close(f)
	up, err := e.mats.Stage(f, "assignment-3.pdf")
	if err != nil {
		e.t.Fatal(err)
	}
	return up.ID
}

// waitRead waits for a read's step to be done and returns the course's
// reads.
func (e *readEnv) waitRead(id string) Read {
	e.t.Helper()
	deadline := time.Now().Add(20 * time.Second)
	for {
		reads, err := e.svc.Reads(bg, "c1")
		if err != nil {
			e.t.Fatal(err)
		}
		for _, r := range reads.Reads {
			if r.ID == id && len(r.Steps) == 1 && r.Steps[0].State == step.StateDone {
				return r
			}
			if r.ID == id && len(r.Steps) == 1 && r.Steps[0].State == step.StateFailed {
				e.t.Fatalf("the read failed: %+v", r.Steps[0])
			}
		}
		if time.Now().After(deadline) {
			e.t.Fatal("the read never finished")
		}
		time.Sleep(20 * time.Millisecond)
	}
}

// An uploaded sheet is kept as a material and read out into dates and lines:
// a textbook line as the questions it becomes, with its notes; a kind the
// model made up is "other"; untitled dates are named by when they're due.
func TestASheetIsKeptAndReadOut(t *testing.T) {
	e := newReadEnv(t)
	done := e.must("read.start", StartRead{CourseID: "c1", UploadID: e.upload()})
	if done.Action != "" {
		t.Fatal("starting a read can be undone; it is dismissed instead")
	}
	r := e.waitRead(done.ID)
	if r.SheetID == "" || r.Source != "assignment-3.pdf" || r.Assignment == nil {
		t.Fatalf("the read %+v", r)
	}
	a := r.Assignment
	if a.Title != "Assignment #3" || len(a.Groups) != 2 || a.Groups[0].Title != "Homework due Dec 1" {
		t.Fatalf("the assignment %+v", a)
	}
	first := a.Groups[0].Rows[0]
	if strings.Join(first.Labels, ",") != "2.1.1,2.1.4" || strings.Join(first.Notes, ",") != "do c" || first.Unread {
		t.Fatalf("the textbook line %+v", first)
	}
	if a.Groups[1].Rows[1].Kind != RowKindOther {
		t.Fatalf("a made-up kind %q", a.Groups[1].Rows[1].Kind)
	}
	if m, err := e.mats.Get(bg, r.SheetID); err != nil || m.ID != r.SheetID {
		t.Fatalf("the sheet is no material (%v)", err)
	}
	// It is listed with its set, not under the course's materials.
	list, err := e.mats.List(bg, "c1")
	if err != nil {
		t.Fatal(err)
	}
	for _, m := range list.Materials {
		if m.ID == r.SheetID {
			t.Fatal("the sheet is listed under the course's materials")
		}
	}

	// The same sheet uploaded again is the same material, not a duplicate.
	again := e.must("read.start", StartRead{CourseID: "c1", UploadID: e.upload()})
	if r2 := e.waitRead(again.ID); r2.SheetID != r.SheetID {
		t.Fatalf("the same sheet again is material %s, not %s", r2.SheetID, r.SheetID)
	}
}

// Adding the homework makes a set a date, pointing at the sheet, and is done
// with the read; checked again, the same sheet's dates are marked against
// those sets: what each has, what changed, what's gone.
func TestAddingFromASheetThenCheckingAgain(t *testing.T) {
	e := newReadEnv(t)
	first := e.waitRead(e.must("read.start", StartRead{CourseID: "c1", UploadID: e.upload()}).ID)
	g := first.Assignment.Groups[0]
	added := e.must("read.import", ImportRead{ReadID: first.ID, Groups: []ImportGroup{{
		Title: g.Title, Due: g.Due, Rows: []Draft{{Text: "2.1: 1, 4 (6 pts each)", Find: true}, {Text: "Sketch the circuit."}},
	}}})
	sets, err := e.svc.Sets(bg, "c1")
	if err != nil {
		t.Fatal(err)
	}
	if len(sets.Sets) != 1 || sets.Sets[0].SheetID != first.SheetID || sets.Sets[0].Total != 3 || sets.Sets[0].Due != "2026-12-01" {
		t.Fatalf("the sets made %+v", sets.Sets)
	}
	if reads, _ := e.svc.Reads(bg, "c1"); len(reads.Reads) != 0 {
		t.Fatal("the read was not done with")
	}

	// Checked again: the date it made is marked against its set.
	second := e.waitRead(e.must("read.start", StartRead{CourseID: "c1", UploadID: e.upload()}).ID)
	mg := second.Assignment.Groups[0]
	if !mg.Imported || mg.SetID != sets.Sets[0].ID {
		t.Fatalf("the date it was made from is not marked: %+v", mg)
	}
	if row := mg.Rows[0]; !row.Added || len(row.Changed) != 2 {
		t.Fatalf("the textbook line: added %v, changed %+v (its notes are now \"do c\")", row.Added, row.Changed)
	}
	if !mg.Rows[1].Added {
		t.Fatal("the written-out problem is not marked as added")
	}
	if second.Assignment.Groups[1].Imported {
		t.Fatal("a date never added is marked as imported")
	}

	// Applying the change rewrites the notes and adds nothing twice.
	q := mg.Rows[0].Changed[0].QuestionID
	e.must("read.import", ImportRead{ReadID: second.ID, Groups: []ImportGroup{{
		SetID: mg.SetID, Rows: []Draft{{Text: "2.1: 1, 4 (do c, 6 pts each)", Find: true}},
		Notes: []NotesUpdate{{QuestionID: q, Notes: []string{"do c"}}},
	}}})
	d := e.detail(mg.SetID)
	if len(d.Questions) != 3 || strings.Join(noteText(d.Questions[0].Notes), "|") != "do c" {
		t.Fatalf("after the update: %d questions, notes %q", len(d.Questions), noteText(d.Questions[0].Notes))
	}

	// Undo takes the first import back whole: its set goes, and its read is
	// back for review (D6: each action undoes what it did).
	if _, err := e.c.Undo(bg, added.Action, false); err != nil {
		t.Fatal(err)
	}
	if sets, _ := e.svc.Sets(bg, "c1"); len(sets.Sets) != 0 {
		t.Fatalf("after undoing the import, sets %+v", sets.Sets)
	}
	reads, err := e.svc.Reads(bg, "c1")
	if err != nil {
		t.Fatal(err)
	}
	if len(reads.Reads) != 1 || reads.Reads[0].ID != first.ID {
		t.Fatalf("after undoing the import, reads %+v", reads.Reads)
	}
}

// A read with nothing kept adds nothing; a read gone is gone.
func TestImportRefusals(t *testing.T) {
	e := newReadEnv(t)
	r := e.waitRead(e.must("read.start", StartRead{CourseID: "c1", UploadID: e.upload()}).ID)
	if _, err := e.run("read.import", ImportRead{ReadID: r.ID}); field(err) != "groups" {
		t.Fatalf("no groups: %v", err)
	}
	if _, err := e.run("read.import", ImportRead{ReadID: r.ID, Groups: []ImportGroup{{Title: "x", Rows: []Draft{{Text: " "}}}}}); field(err) != "groups" {
		t.Fatalf("only blank rows: %v", err)
	}
	e.must("read.dismiss", DismissRead{ID: r.ID})
	if _, err := e.run("read.import", ImportRead{ReadID: r.ID, Groups: []ImportGroup{{Title: "x", Rows: []Draft{{Text: "y"}}}}}); !errors.Is(err, errs.Gone) {
		t.Fatalf("a dismissed read: %v", err)
	}
	if e.calls() == 0 {
		t.Fatal("the model was never asked")
	}
}

// The reply's caps and fallbacks, without a model.
func TestReadOut(t *testing.T) {
	if _, err := readOut("not json", perSection); !errors.Is(err, replyUnreadable) {
		t.Fatalf("not JSON: %v", err)
	}
	if _, err := readOut(`{"title":"x","groups":[{"rows":[{"kind":"other","text":" "}]}]}`, perSection); !errors.Is(err, noHomeworkFound) {
		t.Fatalf("no lines: %v", err)
	}
	a, err := readOut("```json\n"+`{"title":"Week 3","groups":[{"due":"soon","rows":[{"kind":"textbook","text":"read the chapter"}]}]}`+"\n```", perSection)
	if err != nil {
		t.Fatal(err)
	}
	if g := a.Groups[0]; g.Due != "" || g.Title != "Week 3" || !g.Rows[0].Unread {
		t.Fatalf("a fenced reply with a bad date and a line that isn't a reference: %+v", g)
	}
	if got := defaultTitle("", "", true); got != "Homework" {
		t.Fatalf("no name, no date: %q", got)
	}
}

// A read dismissed before its step runs is never read: no call is spent.
func TestADismissedReadSpendsNothing(t *testing.T) {
	e := newIdleReadEnv(t)
	id := e.must("read.start", StartRead{CourseID: "c1", UploadID: e.upload()}).ID
	e.must("read.dismiss", DismissRead{ID: id})
	e.start()
	time.Sleep(300 * time.Millisecond)
	if n := e.calls(); n != 0 {
		t.Fatalf("a dismissed read asked the model %d times", n)
	}
}

// A read never names, nor updates, another course's set; a refused start
// puts the upload back, to start again.
func TestAReadStaysInItsCourse(t *testing.T) {
	e := newReadEnv(t)
	e.write(`INSERT INTO courses (id, name, created_at) VALUES ('c2', 'ECE 210', ?)`, db.Now())
	other := e.must("set.add", AddSet{CourseID: "c2", Title: "Elsewhere"}).ID
	up := e.upload()
	if _, err := e.run("read.start", StartRead{CourseID: "c1", UploadID: up, SetID: other}); !errors.Is(err, errs.Gone) {
		t.Fatalf("a read naming another course's set: %v", err)
	}
	r := e.waitRead(e.must("read.start", StartRead{CourseID: "c1", UploadID: up}).ID)
	if _, err := e.run("read.import", ImportRead{ReadID: r.ID, Groups: []ImportGroup{{SetID: other, Rows: []Draft{{Text: "x"}}}}}); !errors.Is(err, errs.Gone) {
		t.Fatalf("an import into another course's set: %v", err)
	}
}

// An import that changes nothing is refused, and a question outside the set
// it updates is neither rewritten nor removed.
func TestAnImportOnlyTouchesItsSet(t *testing.T) {
	e := newReadEnv(t)
	set := e.must("set.add", AddSet{CourseID: "c1", Title: "PS 4"}).ID
	e.must("question.add", AddQuestions{SetID: set, Drafts: []Draft{{Text: "Sketch the circuit."}}})
	other := e.must("set.add", AddSet{CourseID: "c1", Title: "PS 5"}).ID
	e.must("question.add", AddQuestions{SetID: other, Drafts: []Draft{{Text: "2.1.1", Find: true}}})
	stranger := e.detail(other).Questions[0].ID
	r := e.waitRead(e.must("read.start", StartRead{CourseID: "c1", UploadID: e.upload(), SetID: set}).ID)
	_, err := e.run("read.import", ImportRead{ReadID: r.ID, Groups: []ImportGroup{{
		SetID: set, Rows: []Draft{{Text: "sketch the  circuit."}},
		Notes: []NotesUpdate{{QuestionID: stranger, Notes: []string{"no"}}}, Remove: []string{stranger},
	}}})
	if errs.Resolve(err).ID != nothingToAdd.ID {
		t.Fatalf("an import that changes nothing of its set: %v", err)
	}
	if q := e.detail(other).Questions; len(q) != 1 || len(q[0].Notes) != 0 {
		t.Fatalf("the other set's question was touched: %+v", q)
	}
}

// A sheet is listed with its set while a set or read names it, and under
// Materials again once none does; a textbook named as a sheet stays listed.
func TestASheetIsListedWithItsSet(t *testing.T) {
	e := newReadEnv(t)
	r := e.waitRead(e.must("read.start", StartRead{CourseID: "c1", UploadID: e.upload()}).ID)
	listed := func() bool {
		t.Helper()
		got, err := e.mats.List(bg, "c1")
		if err != nil {
			t.Fatal(err)
		}
		for _, m := range got.Materials {
			if m.ID == r.SheetID {
				return true
			}
		}
		return false
	}
	if listed() {
		t.Fatal("a read's sheet is listed under the course's materials")
	}
	dismissed := e.must("read.dismiss", DismissRead{ID: r.ID})
	if !listed() {
		t.Fatal("a sheet no read or set names is not listed again")
	}
	if _, err := e.c.Undo(bg, dismissed.Action, false); err != nil {
		t.Fatal(err)
	}
	if listed() {
		t.Fatal("bringing the read back left its sheet listed")
	}
	e.write(`UPDATE materials SET textbook = 1 WHERE id = ?`, r.SheetID)
	if !listed() {
		t.Fatal("a textbook named as a sheet is not listed")
	}
}

// The purge keeps a removed sheet while a read names it, and takes the
// read's step with the read.
func TestThePurgeKeepsASheetARead(t *testing.T) {
	e := newReadEnv(t)
	r := e.waitRead(e.must("read.start", StartRead{CourseID: "c1", UploadID: e.upload()}).ID)
	old := db.At(time.Now().Add(-2 * store.Keep))
	e.write(`UPDATE materials SET removed_at = ? WHERE id = ?`, old, r.SheetID)
	if err := e.s.Purge(bg, time.Now()); err != nil {
		t.Fatal(err)
	}
	count := func(q string, args ...any) int {
		t.Helper()
		var n int
		if err := e.s.DB.QueryRow(q, args...).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	if count(`SELECT count(*) FROM materials WHERE id = ?`, r.SheetID) != 1 {
		t.Fatal("a sheet a read names was purged")
	}
	e.write(`UPDATE reads SET removed_at = ? WHERE id = ?`, old, r.ID)
	if err := e.s.Purge(bg, time.Now()); err != nil {
		t.Fatal(err)
	}
	if count(`SELECT count(*) FROM materials WHERE id = ?`, r.SheetID) != 0 || count(`SELECT count(*) FROM steps WHERE subject_id = ?`, r.ID) != 0 {
		t.Fatal("the read's sheet or its step outlived the read")
	}
}

// With no textbook whose numbering is known, the prompt says so and a
// textbook line is read as typed, not placed by a guessed numbering.
func TestReadingWithNoTextbook(t *testing.T) {
	if b := assignmentBrief("", probnum.Style{}, time.Now()); !strings.Contains(b, "The course has no textbook yet.") || strings.Contains(b, `textbook is ""`) {
		t.Fatalf("the prompt with no textbook: %q", b)
	}
	a, err := readOut(`{"title":"x","groups":[{"rows":[{"kind":"textbook","text":"2.1: 1, 4"}]}]}`, probnum.Style{})
	if err != nil {
		t.Fatal(err)
	}
	if row := a.Groups[0].Rows[0]; !row.Unread || len(row.Labels) != 0 {
		t.Fatalf("a textbook line with no numbering known: %+v", row)
	}
}
