package agent

import (
	"context"
	"errors"
	"github.com/jackt/pset/internal/pagenum"
	"strings"
	"sync"
	"testing"

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
	source := "tutor"
	if in.FromStudent {
		source = "you"
	}
	note := Note{ID: "abcdef123", Kind: in.Kind, Text: in.Text, Page: in.Page, Source: source}
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
		llmtest.Reply{ToolCalls: []llm.ToolCall{call("1", "remember", `{"kind":"book","text":"Theorem 1.5 is Cauchy-Schwarz.","page":22,"from_student":true}`)}},
		llmtest.Reply{ToolCalls: []llm.ToolCall{call("2", "remember", `{"kind":"book","text":"refuse"}`)}},
		// No kind: it's about the book.
		llmtest.Reply{ToolCalls: []llm.ToolCall{call("3", "remember", `{"text":"Problems close each section."}`)}},
		llmtest.Reply{Text: "Done."},
	)
	mem := &notes{}
	var steps []string
	var saved []Note
	l := &Loop{
		Client: llm.Open(fake.Config()), Model: "fake-chat", Library: book{},
		Book:   Book{ID: "b1", PageCount: 100, Pages: pagenum.Single(10)},
		System: "You are a tutor.", Memory: mem,
		Step:       func(label string, running bool) { steps = append(steps, label) },
		Remembered: func(n Note, _ string) { saved = append(saved, n) },
	}
	if err := l.Run(context.Background(), []llm.Message{llm.TextMessage("user", "hi")}); err != nil {
		t.Fatal(err)
	}
	reqs := fake.Requests()
	system := func(i int) string { return reqs[i].Chat.Messages[0].Content.Text() }
	if !strings.Contains(system(0), "You don't remember anything") {
		t.Errorf("round 1 system: %s", system(0))
	}
	// Saved in round 1, in the prompt for round 2, on its printed page.
	if !strings.Contains(system(1), "[abcdef] Book: Theorem 1.5 is Cauchy-Schwarz. (p. 22)") {
		t.Errorf("round 2 system: %s", system(1))
	}
	// Outside Ask there is no student to save for: it's the tutor's.
	if len(saved) != 2 || saved[0].Page != 32 || saved[0].Source != "tutor" || saved[1].Kind != "book" {
		t.Fatalf("saved %+v", saved)
	}
	if strings.Contains(system(0), "from_student") {
		t.Error("walkthrough rules mention from_student")
	}
	for _, tool := range reqs[0].Chat.Tools {
		if tool.Function.Name == "forget" {
			t.Error("forget offered without a student")
		}
	}
	want := []string{"Remembering…", "Remembered · Theorem 1.5 is Cauchy-Schwarz · p. 22", "Remembering…", "Didn't remember · that memory is the student's own", "Remembering…", "Remembered · Problems close each section."}
	if strings.Join(steps, "|") != strings.Join(want, "|") {
		t.Errorf("steps\n got %q\nwant %q", steps, want)
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
