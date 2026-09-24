package homework

import (
	"strings"
	"testing"

	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/llm/llmtest"
)

func openingText(req llm.ChatRequest) string { return req.Messages[1].Content.Parts()[0].Text }

func requestsTo(e *env, system string) int {
	n := 0
	for _, r := range e.llm.Requests() {
		if strings.Contains(r.Chat.Messages[0].Content.Text(), system) {
			n++
		}
	}
	return n
}

// A found problem's figure is read, the reading checked against it, and
// the guide written from the checked reading.
func TestAFigureIsReadCheckedAndTheGuideWrittenFromIt(t *testing.T) {
	e := newEnv(t)
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID, StateReady)

	want := []string{"Node A: top of $R_1$.", "2 A current source from A to B (its arrow points to B)."}
	if strings.Join(q.Reading, "|") != strings.Join(want, "|") || q.ReadingEdited {
		t.Fatalf("reading %q (edited %v), want the checked one", q.Reading, q.ReadingEdited)
	}
	for _, r := range e.llm.Requests() {
		if strings.Contains(r.Chat.Messages[0].Content.Text(), "You check a reading") {
			parts := r.Chat.Messages[1].Content.Parts()
			last := parts[len(parts)-1].Text
			if parts[2].ImageURL == nil || !strings.Contains(last, "from B to A") {
				t.Fatalf("the check didn't get the figure and the first reading: %+v", parts)
			}
		}
	}
	text := openingText(guideRequests(e)[0])
	if !strings.Contains(text, "- 2 A current source from A to B") || !strings.Contains(text, "the reading is right") {
		t.Fatalf("the guide wasn't written from the reading:\n%s", text)
	}
}

// A problem without a figure has nothing to read: its guide comes next.
func TestNoFigureNoReading(t *testing.T) {
	e := newEnv(t)
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "Find the voltage across a 2 Ω resistor carrying 3 A."})[0].ID, StateReady)
	if len(q.Reading) != 0 || requestsTo(e, "You read the figures") != 0 {
		t.Fatalf("read a question with no figure: %q", q.Reading)
	}
}

// A reading the model can't give leaves the guide to read the figure
// itself: the question never fails over it.
func TestAFailedReadingStillGetsAGuide(t *testing.T) {
	e := newEnv(t)
	e.llm.Fallback(func(req llm.ChatRequest) llmtest.Reply {
		if strings.Contains(req.Messages[0].Content.Text(), "You read the figures") {
			return llmtest.Reply{Status: 400, Text: `{"error":"no"}`}
		}
		return fakeModel(req)
	})
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID, StateReady)
	if len(q.Reading) != 0 || strings.Contains(openingText(guideRequests(e)[0]), "How the figures read") {
		t.Fatalf("reading %q after a failed read", q.Reading)
	}
}

// Correcting the reading writes the guide again from the correction,
// which the writer is told is the student's.
func TestACorrectedReadingWritesTheGuideAgain(t *testing.T) {
	e := newEnv(t)
	h := e.newSet(t)
	id := e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID
	e.wait(t, id, StateReady)

	var er httpx.Error
	if code := e.do(t, "PATCH", "/api/questions/"+id, QuestionPatch{Reading: &[]string{" ", ""}}, &er); code != 422 || er.Field != "reading" {
		t.Fatalf("blank reading: %d %+v", code, er)
	}
	fixed := []string{"- Node A: top of $R_1$.", "", "2 A current source from B to A (its arrow points to A)."}
	var q Question
	if code := e.do(t, "PATCH", "/api/questions/"+id, QuestionPatch{Reading: &fixed}, &q); code != 200 {
		t.Fatalf("correct: %d", code)
	}
	if len(q.Reading) != 2 || q.Reading[0] != "Node A: top of $R_1$." || !q.ReadingEdited || len(q.Hint) != 0 {
		t.Fatalf("after correcting: %+v", q)
	}
	q = e.wait(t, id, StateReady)
	reqs := guideRequests(e)
	text := openingText(reqs[len(reqs)-1])
	if len(reqs) != 2 || !strings.Contains(text, "as the student corrected it") || !strings.Contains(text, "from B to A") {
		t.Fatalf("%d guides; the last opened:\n%s", len(reqs), text)
	}
	if !q.ReadingEdited || requestsTo(e, "You read the figures") != 1 {
		t.Fatalf("the correction was read over: %+v", q)
	}

	// The same lines again change nothing.
	e.do(t, "PATCH", "/api/questions/"+id, QuestionPatch{Reading: &fixed}, &q)
	if q.State != StateReady || len(guideRequests(e)) != 2 {
		t.Fatalf("an unchanged reading rewrote the guide: %s", q.State)
	}
}

// Reading again throws the old reading and guide away, then reads and
// writes both afresh: how a guide from before readings gets one.
func TestReadingAgainRedoesTheReadingAndTheGuide(t *testing.T) {
	e := newEnv(t)
	h := e.newSet(t)
	id := e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID
	e.wait(t, id, StateReady)
	fixed := []string{"Something else."}
	e.do(t, "PATCH", "/api/questions/"+id, QuestionPatch{Reading: &fixed}, nil)
	e.wait(t, id, StateReady)

	if code := e.do(t, "PATCH", "/api/questions/"+id, QuestionPatch{Reread: true}, nil); code != 200 {
		t.Fatalf("reread: %d", code)
	}
	q := e.wait(t, id, StateReady)
	if q.ReadingEdited || len(q.Reading) != 2 || requestsTo(e, "You read the figures") != 2 || len(guideRequests(e)) != 3 {
		t.Fatalf("after reading again: %+v, %d guides", q, len(guideRequests(e)))
	}

	var er httpx.Error
	typed := e.wait(t, e.add(t, h.ID, Draft{Text: "Find the voltage across a 2 Ω resistor carrying 3 A."})[0].ID, StateReady)
	if code := e.do(t, "PATCH", "/api/questions/"+typed.ID, QuestionPatch{Reread: true}, &er); code != 422 {
		t.Fatalf("reread a question with no figure: %d", code)
	}
}

func TestReadingLines(t *testing.T) {
	got := readingLines("Here it is:\n\n- Node A: left.\n* 2 A from A to B.\n\n```\n")
	if strings.Join(got, "|") != "Node A: left.|2 A from A to B." {
		t.Fatalf("marked lines %q", got)
	}
	if got := readingLines("Node A: left.\nNode B: right.\n"); len(got) != 2 {
		t.Fatalf("unmarked lines %q", got)
	}
}
