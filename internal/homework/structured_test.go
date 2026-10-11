package homework

import (
	"context"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/doc"
	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/llm/llmtest"
	"github.com/jackt/pset/internal/testx"
	"github.com/jackt/pset/internal/usage"
)

// Text a writer says on its way to a tool call is narration, not the
// guide, even when it is written as blocks.
func TestNarrationBetweenToolCallsIsNotTheGuide(t *testing.T) {
	e := newEnv(t)
	var mu sync.Mutex
	round := 0
	e.llm.Fallback(func(req llm.ChatRequest) llmtest.Reply {
		if !isGuide(req) {
			return fakeModel(req)
		}
		mu.Lock()
		defer mu.Unlock()
		if round++; round == 1 {
			return llmtest.Reply{
				Text:      "The setup is done. Now the arithmetic:\n{\"type\":\"para\",\"text\":\"Computing now.\"}\n",
				ToolCalls: []llm.ToolCall{call("c1", "compute", `{"expression":"2*3"}`)},
			}
		}
		return llmtest.Reply{Text: guide}
	})
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID, StateReady)
	for _, b := range append(q.Hint, q.Walkthrough...) {
		if strings.Contains(string(b), "Computing now") {
			t.Fatalf("narration in the guide: %s", b)
		}
	}
	if len(q.Walkthrough) != 5 {
		t.Fatalf("walkthrough %s", q.Walkthrough)
	}
}

// A guide whose writer forgot its hint and a part's answer gets each
// from one more call, and a slip in its math is repaired as a span.
func TestAGuideMissingItsHintAndAnAnswerIsCompleted(t *testing.T) {
	e := newEnv(t)
	var mu sync.Mutex
	var repairs []string
	e.llm.Fallback(func(req llm.ChatRequest) llmtest.Reply {
		sys := req.Messages[0].Content.Text()
		switch {
		case isGuide(req):
			return llmtest.Reply{Text: `{"type":"part","label":"(a)","title":"The voltage"}
{"type":"para","text":"So \\(V = \\frac{6\\) volts."}
{"type":"part","label":"(b)","title":"The current"}
{"type":"para","text":"Then \\(I = 2\\) amps."}
{"type":"answer","label":"(b)","text":"\\(I = 2\\) A."}
`}
		case strings.Contains(sys, "You fix one piece of TeX"):
			mu.Lock()
			repairs = append(repairs, "tex")
			mu.Unlock()
			return llmtest.Reply{Text: `V = 6`}
		case strings.Contains(sys, "write the hint for a homework guide"):
			mu.Lock()
			repairs = append(repairs, "hint")
			mu.Unlock()
			return llmtest.Reply{Text: `{"type":"hint","text":"Start from Ohm's law."}`}
		case strings.Contains(sys, "write the answer for one part"):
			mu.Lock()
			repairs = append(repairs, "answer")
			mu.Unlock()
			return llmtest.Reply{Text: `{"type":"answer","label":"(a)","text":"\\(V = 6\\) V."}`}
		}
		return fakeModel(req)
	})
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID, StateReady)
	if strings.Join(repairs, ",") != "tex,hint,answer" {
		t.Fatalf("repair calls %v", repairs)
	}
	if len(q.Hint) != 1 || len(doc.Answers(q.Walkthrough)) != 2 || !strings.Contains(string(q.Walkthrough[1]), `"m":"V = 6"`) {
		t.Fatalf("hint %s\nwalkthrough %s", q.Hint, q.Walkthrough)
	}
}

// The wipe: old guides and their veils go, their questions stay and offer
// "Write the guide"; a statement, a note and a reading become runs.
func TestGuidesAreWipedAndTextBecomesRuns(t *testing.T) {
	ctx := context.Background()
	d, err := db.Open(filepath.Join(t.TempDir(), "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup.Close(d)
	migs := append(jobs.Migrations(), db.Migration{Name: "test/books", SQL: `CREATE TABLE books (id TEXT PRIMARY KEY)`})
	all := usage.Migrations()
	all = append(all, Migrations()...)
	// Everything before the wipe, whatever comes after it.
	wipe := slices.IndexFunc(all, func(m db.Migration) bool { return m.Name == "homework/12" })
	if err := db.Migrate(ctx, d, append(migs, all[:wipe]...)); err != nil {
		t.Fatal(err)
	}
	testx.Check(t, testx.Err(d.Exec(`INSERT INTO books VALUES ('b1')`)))
	testx.Check(t, testx.Err(d.Exec(`INSERT INTO homework (id, book_id, title, created_at, updated_at) VALUES ('h1', 'b1', 'Set', 'x', 'x')`)))
	ins := `INSERT INTO questions (id, homework_id, position, text, in_book, label, statement, hint, walkthrough, revealed, state, notes, reading, created_at, updated_at)
		VALUES (?, 'h1', ?, '3.36', 1, '3.36', ?, ?, ?, '["hint"]', ?, ?, ?, 'x', 'x')`
	old := `[{"type":"prose","text":"## Hint\nold"}]`
	testx.Check(t, testx.Err(d.Exec(ins, "ready", 1, `Find $v_o$ across the \$25 part.`, old, old, "ready", `["no PSpice","use $R_1$"]`, `["Node A: $R_1$ up top"]`)))
	testx.Check(t, testx.Err(d.Exec(ins, "waiting", 2, "Find it.", "[]", "[]", "located", "[]", "[]")))
	testx.Check(t, testx.Err(d.Exec(ins, "failed", 3, "", "[]", "[]", "failed", "[]", "[]")))
	if err := db.Migrate(ctx, d, append(migs, all...)); err != nil {
		t.Fatal(err)
	}

	got := func(id string) Question {
		q, err := getQuestion(ctx, d, id)
		if err != nil {
			t.Fatal(err)
		}
		return q.Question
	}
	r := got("ready")
	if r.State != StateUnwritten || len(r.Hint) != 0 || len(r.Walkthrough) != 0 || len(r.Revealed) != 0 {
		t.Fatalf("the guide stayed: %+v", r)
	}
	if source(r.Statement) != `Find \(v_o\) across the $25 part.` || len(r.Statement) != 3 || r.Statement[1].M != "v_o" {
		t.Fatalf("statement %+v", r.Statement)
	}
	if strings.Join(sources(r.Notes), "|") != `no PSpice|use \(R_1\)` || len(r.Notes[1]) != 2 {
		t.Fatalf("notes %+v", r.Notes)
	}
	if len(r.Reading) != 1 || r.Reading[0][0].M != "R_1" && r.Reading[0][1].M != "R_1" {
		t.Fatalf("reading %+v", r.Reading)
	}
	// A question still waiting for its guide waits for it, and writes the new kind.
	if w := got("waiting"); w.State != StateLocated {
		t.Fatalf("waiting question is %s", w.State)
	}
	if f := got("failed"); f.State != StateFailed || len(f.Statement) != 0 {
		t.Fatalf("failed question is %s, statement %v", f.State, f.Statement)
	}
}

func TestWriteTheGuideOfAQuestionThatHasNone(t *testing.T) {
	e := newEnv(t)
	h := e.newSet(t)
	id := e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID
	e.wait(t, id, StateReady)
	// What the wipe leaves.
	testx.Check(t, testx.Err(e.svc.c.DB.Exec(`UPDATE questions SET state = 'unwritten', hint = '[]', walkthrough = '[]' WHERE id = ?`, id)))

	var er struct{ Code string }
	if code := e.do(t, "POST", "/api/questions/"+id+"/guide", nil, nil); code != 200 {
		t.Fatalf("write the guide: %d", code)
	}
	q := e.wait(t, id, StateReady)
	if len(q.Hint) != 1 || len(q.Walkthrough) != 5 {
		t.Fatalf("hint %s walkthrough %s", q.Hint, q.Walkthrough)
	}
	// A question that has one can't be written again this way.
	if code := e.do(t, "POST", "/api/questions/"+id+"/guide", nil, &er); code != 422 {
		t.Fatalf("again: %d", code)
	}
	// Nothing was written for it before it was asked.
}

func TestNothingWritesAGuideUnasked(t *testing.T) {
	e := newEnv(t)
	h := e.newSet(t)
	id := e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID
	e.wait(t, id, StateReady)
	testx.Check(t, testx.Err(e.svc.c.DB.Exec(`UPDATE questions SET state = 'unwritten', hint = '[]', walkthrough = '[]' WHERE id = ?`, id)))
	before := len(guideRequests(e))
	// Notes and a corrected reading are kept, and write nothing.
	notes := []string{"do part a"}
	e.do(t, "PATCH", "/api/questions/"+id, QuestionPatch{Notes: &notes}, nil)
	q, _ := getQuestion(context.Background(), e.svc.c.DB, id)
	if q.State != StateUnwritten || len(q.Notes) != 1 || len(guideRequests(e)) != before {
		t.Fatalf("state %s, %d guide requests after %d", q.State, len(guideRequests(e)), before)
	}
}
