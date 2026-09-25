package homework

import (
	"strings"
	"testing"

	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/llm/llmtest"
)

// A problem boxed on the scan is read from its boxes, over two pages, its
// figure from a third, and written like any other.
func TestABoxedProblemIsReadFromItsBoxes(t *testing.T) {
	e := newEnv(t)
	h := e.newSet(t)
	boxes := []Box{
		{Page: 2, X: 0.1, Y: 0.8, W: 0.8, H: 0.15, Kind: BoxKindText},
		{Page: 3, X: 0.1, Y: 0.05, W: 0.8, H: 0.1, Kind: BoxKindText},
		{Page: 4, X: 0.2, Y: 0.3, W: 0.4, H: 0.3, Kind: BoxKindFigure},
	}
	var q Question
	if code := e.do(t, "POST", "/api/homework/"+h.ID+"/boxed", Boxes{Boxes: boxes}, &q); code != 201 {
		t.Fatalf("boxed %d", code)
	}
	if !strings.HasPrefix(q.Label, "Boxed on") {
		t.Fatalf("label before reading %q", q.Label)
	}
	q = e.wait(t, q.ID, StateReady)
	if q.Page == nil || *q.Page != 2 || !strings.Contains(q.Statement, "y'' + 5y'") || q.Label != "7" {
		t.Fatalf("read %+v", q)
	}
	stored, _ := getQuestion(t.Context(), e.svc.c.DB, q.ID)
	if len(stored.FigRect) != 1 || stored.FigRect[0].on(stored) != 4 || len(stored.Boxes) != 3 {
		t.Fatalf("figures %+v, boxes %+v", stored.FigRect, stored.Boxes)
	}
	// The boxes went to the model in order, the figure's apart.
	for _, r := range e.llm.Requests() {
		if strings.Contains(r.Chat.Messages[0].Content.Text(), "You read one homework problem from pictures") {
			parts := r.Chat.Messages[1].Content.Parts()
			// The words' two crops, each under its page; the figure isn't
			// read here.
			if len(parts) != 5 || parts[2].ImageURL == nil || parts[3].Text != "p. 1:" || parts[4].ImageURL == nil {
				t.Fatalf("parts %+v", parts)
			}
		}
	}
}

// A find that failed is shown where the problem is, and carries on from
// there, keeping the reference the student typed as its label.
func TestShowingWhereAFailedFindIs(t *testing.T) {
	e := newEnv(t)
	h := e.newSet(t)
	failed := e.wait(t, e.add(t, h.ID, Draft{Text: "3.99", InBook: true})[0].ID, StateFailed)
	var er httpx.Error
	if code := e.do(t, "POST", "/api/questions/"+failed.ID+"/boxes", Boxes{Boxes: []Box{{Page: 3, X: 0.1, Y: 0.1, W: 0.5, H: 0.2, Kind: BoxKindFigure}}}, &er); code != 422 || er.Field != "boxes" {
		t.Fatalf("a figure alone: %d %+v", code, er)
	}
	if code := e.do(t, "POST", "/api/questions/"+failed.ID+"/boxes", Boxes{Boxes: []Box{{Page: 99, X: 0.1, Y: 0.1, W: 0.5, H: 0.2, Kind: BoxKindText}}}, &er); code != 422 {
		t.Fatalf("a page the book lacks: %d", code)
	}
	var q Question
	if code := e.do(t, "POST", "/api/questions/"+failed.ID+"/boxes", Boxes{Boxes: []Box{{Page: 3, X: 0.1, Y: 0.1, W: 0.8, H: 0.2, Kind: BoxKindText}}}, &q); code != 200 {
		t.Fatalf("point out %d", code)
	}
	q = e.wait(t, q.ID, StateReady)
	if q.Page == nil || *q.Page != 3 || q.Label != "3.99" || q.Failure != "" {
		t.Fatalf("pointed out %+v", q)
	}
}

// A box that can't be read fails the question readably.
func TestUnreadableBoxes(t *testing.T) {
	e := newEnv(t)
	e.llm.Fallback(func(req llm.ChatRequest) llmtest.Reply {
		if strings.Contains(req.Messages[0].Content.Text(), "You read one homework problem from pictures") {
			return llmtest.Reply{Text: "I can't make that out."}
		}
		return fakeModel(req)
	})
	h := e.newSet(t)
	var q Question
	e.do(t, "POST", "/api/homework/"+h.ID+"/boxed", Boxes{Boxes: []Box{{Page: 2, X: 0.1, Y: 0.1, W: 0.8, H: 0.2, Kind: BoxKindText}}}, &q)
	q = e.wait(t, q.ID, StateFailed)
	if !strings.Contains(q.Reason, "Box the problem's text again") {
		t.Fatalf("reason %q", q.Reason)
	}
}
