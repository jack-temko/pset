package agent

import (
	"context"
	"errors"
	"slices"
	"strings"
	"sync"
	"testing"

	"github.com/jackt/pset/internal/pagenum"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/llm/llmtest"
)

type book struct{}

func (book) Search(context.Context, string, string, int) ([]int, error) { return nil, nil }
func (book) PageText(context.Context, string, int) (string, error)      { return "", nil }
func (book) PageJPEG(context.Context, string, int, int) ([]byte, error) { return nil, nil }

// notes is a memory in a slice. Another loop can save into it mid-run.
type notes struct {
	mu   sync.Mutex
	list []Note
}

func (n *notes) Notes(context.Context, string) ([]Note, error) {
	n.mu.Lock()
	defer n.mu.Unlock()
	return append([]Note(nil), n.list...), nil
}

func (n *notes) Remember(_ context.Context, _ string, in NewNote) (Note, string, error) {
	n.mu.Lock()
	defer n.mu.Unlock()
	if in.Text == "refuse" {
		return Note{}, "", errors.New("that memory is the student's own")
	}
	note := Note{ID: "abcdef123", Text: in.Text, Source: "you"}
	n.list = append(n.list, note)
	return note, Saved, nil
}

func (n *notes) Forget(context.Context, string, string) (Note, error) { return Note{}, nil }

func call(id, name, args string) llm.ToolCall {
	return llm.ToolCall{ID: id, Type: "function", Function: llm.ToolCallFunc{Name: name, Arguments: args}}
}

func TestRememberReachesTheNextRound(t *testing.T) {
	fake := llmtest.New(t)
	fake.Script(
		llmtest.Reply{ToolCalls: []llm.ToolCall{call("1", "remember", `{"text":"Use V_0, V_1 for nodal voltages."}`)}},
		llmtest.Reply{ToolCalls: []llm.ToolCall{call("2", "remember", `{"text":"refuse"}`)}},
		llmtest.Reply{Text: "Done."},
	)
	mem := &notes{}
	var steps []string
	var saved []Note
	l := &Loop{
		Client: llm.Open(fake.Config()), Model: "fake-chat", Library: book{},
		Book:   Book{ID: "b1", PageCount: 100, Pages: pagenum.Single(10)},
		System: "You are a tutor.", Memory: mem, Student: true,
		Step:       func(label string, running bool) { steps = append(steps, label) },
		Remembered: func(n Note, _ string) { saved = append(saved, n) },
	}
	if err := l.Run(context.Background(), []llm.Message{llm.TextMessage("user", "hi")}); err != nil {
		t.Fatal(err)
	}
	reqs := fake.Requests()
	system := func(i int) string { return reqs[i].Chat.Messages[0].Content.Text() }
	if !strings.Contains(system(0), "don't know the student's preferences") {
		t.Errorf("round 1 system: %s", system(0))
	}
	// Saved in round 1, in the prompt for round 2.
	if !strings.Contains(system(1), "[abcdef] Use V_0, V_1 for nodal voltages.") {
		t.Errorf("round 2 system: %s", system(1))
	}
	if len(saved) != 1 || saved[0].Source != "you" {
		t.Fatalf("saved %+v", saved)
	}
	var tools []string
	for _, tool := range reqs[0].Chat.Tools {
		tools = append(tools, tool.Function.Name)
	}
	if !slices.Contains(tools, "remember") || !slices.Contains(tools, "forget") {
		t.Errorf("Ask's tools: %v", tools)
	}
	want := []string{"Remembering…", "Remembered · Use V_0, V_1 for nodal voltages.", "Remembering…", "Didn't remember · that memory is the student's own"}
	if strings.Join(steps, "|") != strings.Join(want, "|") {
		t.Errorf("steps\n got %q\nwant %q", steps, want)
	}
}

// Outside Ask the model reads the preferences and cannot save or remove
// one, even if it calls remember anyway.
func TestOnlyAskSaves(t *testing.T) {
	fake := llmtest.New(t)
	fake.Script(
		llmtest.Reply{ToolCalls: []llm.ToolCall{call("1", "remember", `{"text":"Use SI."}`)}},
		llmtest.Reply{Text: "Done."},
	)
	mem := &notes{list: []Note{{ID: "abcdef123", Text: "Show every step.", Source: "you"}}}
	l := &Loop{
		Client: llm.Open(fake.Config()), Model: "fake-chat", Library: book{},
		Book: Book{ID: "b1"}, System: "Write the guide.", Memory: mem,
	}
	if err := l.Run(context.Background(), []llm.Message{llm.TextMessage("user", "hi")}); err != nil {
		t.Fatal(err)
	}
	reqs := fake.Requests()
	if system := reqs[0].Chat.Messages[0].Content.Text(); !strings.Contains(system, "Show every step.") || strings.Contains(system, "remember") {
		t.Errorf("system: %s", system)
	}
	for _, tool := range reqs[0].Chat.Tools {
		if tool.Function.Name == "remember" || tool.Function.Name == "forget" {
			t.Errorf("%s offered without a student", tool.Function.Name)
		}
	}
	if len(mem.list) != 1 {
		t.Errorf("a save got through: %+v", mem.list)
	}
}

func TestNoMemoryNoTool(t *testing.T) {
	fake := llmtest.New(t)
	fake.Script(llmtest.Reply{Text: "Hi."})
	l := &Loop{Client: llm.Open(fake.Config()), Model: "fake-chat", Library: book{}, Book: Book{ID: "b1"}, System: "Tutor."}
	if err := l.Run(context.Background(), []llm.Message{llm.TextMessage("user", "hi")}); err != nil {
		t.Fatal(err)
	}
	r := fake.Requests()[0].Chat
	if r.Messages[0].Content.Text() != "Tutor." {
		t.Errorf("system %q", r.Messages[0].Content.Text())
	}
	for _, tool := range r.Tools {
		if tool.Function.Name == "remember" {
			t.Error("remember offered with no memory")
		}
	}
}

func TestACutRoundIsAskedAgain(t *testing.T) {
	fake := llmtest.New(t)
	fake.Script(
		llmtest.Reply{Reasoning: "Thinking for a long time.", Cut: true},
		llmtest.Reply{Text: "Done.", Split: true},
	)
	var steps []string
	var text strings.Builder
	l := &Loop{
		Client: llm.Open(fake.Config()), Model: "fake-chat", Library: book{}, Book: Book{ID: "b1"},
		Step:  func(label string, running bool) { steps = append(steps, label) },
		Delta: func(s string) { text.WriteString(s) },
	}
	if err := l.Run(context.Background(), []llm.Message{llm.TextMessage("user", "hi")}); err != nil {
		t.Fatal(err)
	}
	if text.String() != "Done." {
		t.Fatalf("answer %q", text.String())
	}
	if !strings.Contains(strings.Join(steps, "|"), "Connection dropped · asking again") {
		t.Fatalf("steps %q", steps)
	}
	// It gives up after a couple.
	fake.Script(llmtest.Reply{Cut: true}, llmtest.Reply{Cut: true}, llmtest.Reply{Cut: true})
	if err := l.Run(context.Background(), []llm.Message{llm.TextMessage("user", "hi")}); !errors.Is(err, llm.ErrStreamCut) {
		t.Fatalf("err %v", err)
	}
}

// TestAnEmptyRoundIsAskedAgain: a round that only thinks, with no answer
// and no tool call, is asked once more rather than ending the run with
// nothing written.
func TestAnEmptyRoundIsAskedAgain(t *testing.T) {
	fake := llmtest.New(t)
	fake.Script(llmtest.Reply{Reasoning: "I'll save a note, then answer."}, llmtest.Reply{Text: "The tail is (1-p)^30."})
	var got strings.Builder
	l := &Loop{Client: llm.Open(fake.Config()), Model: "fake-chat", Library: book{}, Book: Book{ID: "b1"}, System: "Tutor.",
		Delta: func(s string) { got.WriteString(s) }}
	if err := l.Run(context.Background(), []llm.Message{llm.TextMessage("user", "Why?")}); err != nil {
		t.Fatal(err)
	}
	if got.String() != "The tail is (1-p)^30." {
		t.Fatalf("answer = %q", got.String())
	}
	reqs := fake.Requests()
	if len(reqs) != 2 {
		t.Fatalf("%d requests, want 2", len(reqs))
	}
	if m := reqs[1].Chat.Messages; !strings.Contains(m[len(m)-1].Content.Text(), "You stopped without writing your answer") {
		t.Fatalf("%d requests; the second should ask for the answer", len(reqs))
	}
}

// TestStillEmptyIsNoAnswer: a model that stays silent when asked again
// ends the run with ErrNoAnswer, not an empty answer taken as done.
func TestStillEmptyIsNoAnswer(t *testing.T) {
	fake := llmtest.New(t)
	fake.Script(llmtest.Reply{Reasoning: "Hmm."}, llmtest.Reply{Reasoning: "Hmm again."})
	l := &Loop{Client: llm.Open(fake.Config()), Model: "fake-chat", Library: book{}, Book: Book{ID: "b1"}, System: "Tutor."}
	if err := l.Run(context.Background(), []llm.Message{llm.TextMessage("user", "Why?")}); !errors.Is(err, ErrNoAnswer) {
		t.Fatalf("err = %v, want ErrNoAnswer", err)
	}
}
