package homework

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackt/pset/internal/agent"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/llm/llmtest"
)

func isGuide(req llm.ChatRequest) bool {
	return strings.Contains(req.Messages[0].Content.Text(), "You write the guide")
}

func guideRequests(e *env) []llm.ChatRequest {
	var out []llm.ChatRequest
	for _, r := range e.llm.Requests() {
		if isGuide(r.Chat) {
			out = append(out, r.Chat)
		}
	}
	return out
}

func call(id, name, args string) llm.ToolCall {
	return llm.ToolCall{ID: id, Type: "function", Function: llm.ToolCallFunc{Name: name, Arguments: args}}
}

// A problem with a figure is written from the figure, cut from the page,
// not from the page of problems around it.
func TestGuideSeesTheFiguresNotThePage(t *testing.T) {
	e := newEnv(t)
	h := e.newSet(t)
	e.wait(t, e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID, StateReady)

	user := guideRequests(e)[0].Messages[1]
	parts := user.Content.Parts()
	if len(parts) != 3 || parts[1].Text != "Figure 3.7:" || parts[2].ImageURL == nil {
		t.Fatalf("parts %+v, want the text then Figure 3.7", parts)
	}
	text := parts[0].Text
	if strings.Contains(text, "3.35 Find the current") {
		t.Fatalf("the page's text came along with its figure:\n%s", text)
	}
	if !strings.Contains(text, "Its figures follow") || !strings.Contains(text, "view_page") {
		t.Fatalf("no word on where the figure came from:\n%s", text)
	}
}

// The pages memory names, where a search for the problem lands, open the
// guide, so the writer doesn't spend a round reading them.
func TestMemorysPagesOpenTheGuide(t *testing.T) {
	mem := &memory{seen: map[int][]Seen{}, notes: []agent.Note{
		{ID: "n1", Kind: "book", Text: "Ohm's law is on p. 0.", Page: 2},
		{ID: "n2", Kind: "book", Text: "Answers are at the back.", Page: 4},
	}}
	e := newEnvWith(t, mem)
	e.llm.Fallback(func(req llm.ChatRequest) llmtest.Reply {
		if strings.Contains(req.Messages[0].Content.Text(), "You find one homework problem") {
			return llmtest.Reply{Text: `{"image": 1, "label": "3.36", "statement": "Use Ohm's law to find the voltage across $R_2$."}`}
		}
		return fakeModel(req)
	})
	h := e.newSet(t)
	e.wait(t, e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID, StateReady)

	text := guideRequests(e)[0].Messages[1].Content.Parts()[0].Text
	if !strings.Contains(text, "Your memory points to these pages") || !strings.Contains(text, "Ohm's law says V = IR.") {
		t.Fatalf("memory's page didn't open the guide:\n%s", text)
	}
	if strings.Contains(text, "Answers to selected problems") {
		t.Fatalf("a remembered page the search didn't find came too:\n%s", text)
	}
}

// Looking at a page already in view gets a pointer back to it, not the
// same image again.
func TestViewingAPageTwiceSendsItOnce(t *testing.T) {
	e := newEnv(t)
	var mu sync.Mutex
	round := 0
	e.llm.Fallback(func(req llm.ChatRequest) llmtest.Reply {
		if !isGuide(req) {
			return fakeModel(req)
		}
		mu.Lock()
		defer mu.Unlock()
		if round++; round <= 2 {
			return llmtest.Reply{ToolCalls: []llm.ToolCall{call("v", "view_page", `{"page":1}`)}}
		}
		return llmtest.Reply{Text: guide}
	})
	h := e.newSet(t)
	e.wait(t, e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID, StateReady)

	reqs := guideRequests(e)
	var results []string
	images := 0
	for _, m := range reqs[len(reqs)-1].Messages {
		if m.Role == "tool" {
			results = append(results, m.Content.Text())
		}
		if m.Role == "user" && len(m.Content.Parts()) > 0 && m.Content.Parts()[0].Text == "The pages you asked to look at:" {
			images++
		}
	}
	if len(results) != 2 || !strings.Contains(results[0], "follows") || !strings.Contains(results[1], "You already have p. 1") || images != 1 {
		t.Fatalf("tool results %q, %d image messages", results, images)
	}
}

// A guide the app stopped partway carries on from its last saved round
// when it starts again: the rounds before aren't asked for again.
func TestAGuideCarriesOnAfterARestart(t *testing.T) {
	e := newEnv(t)
	var mu sync.Mutex
	stopping := true
	inRound2 := make(chan struct{})
	e.llm.Fallback(func(req llm.ChatRequest) llmtest.Reply {
		if !isGuide(req) {
			return fakeModel(req)
		}
		mu.Lock()
		defer mu.Unlock()
		if len(req.Messages) == 2 {
			return llmtest.Reply{Reasoning: "Ohm's law, then arithmetic.", ToolCalls: []llm.ToolCall{call("c1", "compute", `{"expression":"2*3"}`)}}
		}
		if stopping {
			stopping = false
			close(inRound2)
			// Long enough that the stop lands mid-answer.
			return llmtest.Reply{Text: guide, Pause: time.Second}
		}
		return llmtest.Reply{Text: guide}
	})
	h := e.newSet(t)
	id := e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID
	<-inRound2
	e.queue.Pause() // what shutting down does to a running job
	if q := e.wait(t, id, StatePending); len(q.Hint) != 0 {
		t.Fatalf("stopped question kept a hint %v", q.Hint)
	}
	saved, err := savedRounds(context.Background(), e.svc.c.DB, id)
	if err != nil || len(saved) != 2 || saved[0].ReasoningContent != "Ohm's law, then arithmetic." {
		t.Fatalf("saved rounds %+v, %v", saved, err)
	}

	e.queue.Resume()
	e.wait(t, id, StateReady)
	opening := 0
	for _, r := range guideRequests(e) {
		if len(r.Messages) == 2 {
			opening++
		}
	}
	last := guideRequests(e)
	final := last[len(last)-1].Messages
	if opening != 1 || len(final) != 4 || final[3].Role != "tool" || final[3].Content.Text() != "6" {
		t.Fatalf("%d opening requests; the resumed one had %d messages", opening, len(final))
	}
	if saved, _ := savedRounds(context.Background(), e.svc.c.DB, id); len(saved) != 0 {
		t.Fatalf("a finished guide kept its rounds: %d", len(saved))
	}
}
