package agent

import (
	"context"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/llm/llmtest"
)

// TestTheLastRoundKeepsTheToolsButCallsNone: past its rounds the model is
// told to answer with the tools still declared and tool_choice "none". A
// model whose history holds tool calls may call one anyway when the tools
// are gone (Gemini did, every time).
func TestTheLastRoundKeepsTheToolsButCallsNone(t *testing.T) {
	fake := llmtest.New(t)
	fake.Script(
		llmtest.Reply{ToolCalls: []llm.ToolCall{call("1", "compute", `{"expression":"2+2"}`)}},
		llmtest.Reply{Text: "It is 4."},
	)
	l := &Loop{Client: llm.Open(fake.Config()), Model: "fake-chat", Library: book{}, Book: Book{ID: "b1"}, System: "Tutor.", Rounds: 1}
	if err := l.Run(context.Background(), []llm.Message{llm.TextMessage("user", "2+2?")}); err != nil {
		t.Fatal(err)
	}
	reqs := fake.Requests()
	if len(reqs) != 2 {
		t.Fatalf("%d requests, want 2", len(reqs))
	}
	if r := reqs[0].Chat; r.ToolChoice != "" {
		t.Errorf("a working round sent tool_choice %q", r.ToolChoice)
	}
	if r := reqs[1].Chat; len(r.Tools) == 0 || r.ToolChoice != "none" {
		t.Errorf("last round: %d tools, tool_choice %q; want the tools and \"none\"", len(r.Tools), r.ToolChoice)
	}
}

// TestACallOnTheLastRoundIsAskedAgainFlat: a model that calls a tool when
// told to answer is asked once more with its work as plain text and no
// tools, and what it writes then is the answer.
func TestACallOnTheLastRoundIsAskedAgainFlat(t *testing.T) {
	fake := llmtest.New(t)
	fake.Script(
		llmtest.Reply{ToolCalls: []llm.ToolCall{call("1", "compute", `{"expression":"6*7"}`)}},
		llmtest.Reply{ToolCalls: []llm.ToolCall{call("2", "compute", `{"expression":"42/6"}`)}},
		llmtest.Reply{Text: "It is 42."},
	)
	var got strings.Builder
	l := &Loop{Client: llm.Open(fake.Config()), Model: "fake-chat", Library: book{}, Book: Book{ID: "b1"}, System: "Tutor.", Rounds: 1,
		Delta: func(s string) { got.WriteString(s) }}
	if err := l.Run(context.Background(), []llm.Message{llm.TextMessage("user", "6 times 7?")}); err != nil {
		t.Fatal(err)
	}
	if got.String() != "It is 42." {
		t.Fatalf("answer = %q", got.String())
	}
	reqs := fake.Requests()
	if len(reqs) != 3 {
		t.Fatalf("%d requests, want 3", len(reqs))
	}
	flat := reqs[2].Chat
	if len(flat.Tools) != 0 || flat.ToolChoice != "" {
		t.Errorf("flat round: %d tools, tool_choice %q; want none at all", len(flat.Tools), flat.ToolChoice)
	}
	var text strings.Builder
	for _, m := range flat.Messages {
		if len(m.ToolCalls) > 0 || m.Role == "tool" {
			t.Errorf("flat round still has a tool turn: %+v", m)
		}
		text.WriteString(m.Content.Text())
		for _, p := range m.Content.Parts() {
			text.WriteString(p.Text)
		}
	}
	for _, want := range []string{"6 times 7?", `compute({"expression":"6*7"})`, "42"} {
		if !strings.Contains(text.String(), want) {
			t.Errorf("flat round lacks %q:\n%s", want, text.String())
		}
	}
}

// TestComputeTakesSeveralExpressions: one compute call evaluates every
// expression it's given, each on its own numbered line, an error only
// where one is wrong.
func TestComputeTakesSeveralExpressions(t *testing.T) {
	fake := llmtest.New(t)
	fake.Script(
		llmtest.Reply{ToolCalls: []llm.ToolCall{call("1", "compute", `{"expressions":["1/3 + 1/6","2^10","1/0"]}`)}},
		llmtest.Reply{Text: "Done."},
	)
	l := &Loop{Client: llm.Open(fake.Config()), Model: "fake-chat", Library: book{}, Book: Book{ID: "b1"}, System: "Tutor."}
	if err := l.Run(context.Background(), []llm.Message{llm.TextMessage("user", "Sums?")}); err != nil {
		t.Fatal(err)
	}
	msgs := fake.Requests()[1].Chat.Messages
	var result string
	for _, m := range msgs {
		if m.Role == "tool" {
			result = m.Content.Text()
		}
	}
	lines := strings.Split(strings.TrimSpace(result), "\n")
	if len(lines) != 3 || !strings.HasPrefix(lines[0], "1. 1/3 + 1/6 = 1/2") || lines[1] != "2. 2^10 = 1024" || !strings.HasPrefix(lines[2], "3. 1/0 = Error:") {
		t.Fatalf("result:\n%s", result)
	}
}
