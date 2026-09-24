package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/jackt/pset/internal/llm"
)

// Book is what the tools need to know about the book: page numbers the
// model sees are printed ones, the library's are PDF pages.
type Book struct {
	ID         string
	Title      string
	PageCount  int
	PageOffset int
}

// Library is the book, as the tools read it. Pages are PDF pages.
type Library interface {
	Search(ctx context.Context, bookID, query string, k int) ([]int, error)
	PageText(ctx context.Context, bookID string, page int) (string, error)
	PageJPEG(ctx context.Context, bookID string, page, width int) ([]byte, error)
}

// Loop runs a model over the book with the tools until it answers.
type Loop struct {
	Client  *llm.Client
	Model   string
	Library Library
	Book    Book
	// System is the system prompt. Run sends it ahead of the messages,
	// with memory's rules and notes after it, fresh every round.
	System string
	// Memory, when set, gives the model remember, and the notes go in the
	// prompt.
	Memory Memory
	// Student says the student is in the conversation (Ask): remember can
	// save as theirs, and forget exists.
	Student bool
	// Remembered fires after remember saves (Saved) or replaces
	// (Replaced) a note, once its step is finished.
	Remembered func(n Note, outcome string)
	// Rounds bounds the tool rounds; past it the model answers with what
	// it has.
	Rounds int
	// Step puts a line on the feed: running with a present-tense label,
	// then replaced by its past-tense one. A thinking model's reasoning is
	// a step too ("Thinking…", then "Thought for 12s").
	Step func(label string, running bool)
	// Delta is the answer as it streams.
	Delta func(text string)
	// Writing fires when a round's answer text starts: the thinking and
	// the tools are done, and the words are coming.
	Writing func()
	// Shown is the PDF pages the messages already show as images:
	// view_page on one points back at it instead of sending it again.
	Shown []int
	// Round fires after each tool round with the whole conversation so
	// far, for a caller that saves it to carry on after a restart: Run
	// takes those messages back and goes on from the next round.
	Round func(msgs []llm.Message)
	// Complete reports whether the answer written so far is whole. A
	// round that completes it and calls only remember ends the run once
	// the saves are done: asked again, a model only adds a sign-off to
	// an answer that was finished.
	Complete func() bool

	// seen is the pages in view this run: Shown, and every view_page.
	seen map[int]bool
}

// Run loops until the model answers without calling a tool.
func (l *Loop) Run(ctx context.Context, msgs []llm.Message) error {
	rounds := l.Rounds
	if rounds == 0 {
		rounds = 8
	}
	tools := Tools
	if l.Memory != nil {
		tools = append(append([]llm.Tool{}, Tools...), rememberTool(l.Student))
		if l.Student {
			tools = append(tools, forgetTool)
		}
	}
	l.seen = map[int]bool{}
	for _, p := range l.Shown {
		l.seen[p] = true
	}
	// Rounds already in msgs (a run carried on after a restart) count
	// toward the bound, and their pages are in view.
	done := 0
	for _, m := range msgs {
		for _, c := range m.ToolCalls {
			if c.Function.Name == "view_page" {
				var a struct{ Page int }
				if json.Unmarshal([]byte(c.Function.Arguments), &a) == nil {
					l.seen[a.Page+l.Book.PageOffset] = true
				}
			}
		}
		if m.Role == "assistant" && len(m.ToolCalls) > 0 {
			done++
		}
	}
	retries := cutRetries
	for round := done; ; round++ {
		sent := msgs
		if sys := l.system(ctx); sys != "" {
			sent = append([]llm.Message{llm.TextMessage("system", sys)}, msgs...)
		}
		req := llm.ChatRequest{Model: l.Model, Messages: sent, Tools: tools}
		if round >= rounds {
			req.Tools = nil
			req.Messages = append(sent, llm.TextMessage("user", "Answer now, with what you've found."))
		}
		var thinkingSince time.Time
		wrote := false
		endThinking := func() {
			if !thinkingSince.IsZero() {
				s := int(math.Ceil(time.Since(thinkingSince).Seconds()))
				l.step(fmt.Sprintf("Thought for %ds", s), false)
				thinkingSince = time.Time{}
			}
		}
		req.OnReasoning = func(string) {
			if thinkingSince.IsZero() && !wrote {
				thinkingSince = time.Now()
				l.step("Thinking…", true)
			}
		}
		reply, err := l.Client.ChatStreamFull(ctx, req, func(delta string) error {
			if !wrote {
				endThinking()
				wrote = true
				if l.Writing != nil {
					l.Writing()
				}
			}
			if l.Delta != nil {
				l.Delta(delta)
			}
			return nil
		})
		endThinking()
		if err != nil && errors.Is(err, llm.ErrStreamCut) && !wrote && retries > 0 && ctx.Err() == nil {
			// The endpoint dropped a long round before any answer text:
			// nothing reached the student, so ask again.
			retries--
			round--
			l.step("Connection dropped · asking again", false)
			continue
		}
		if err != nil {
			return err
		}
		if len(reply.ToolCalls) == 0 || req.Tools == nil {
			return nil
		}
		if wrote && l.Delta != nil {
			// Whatever it said before reaching for a tool ends its line.
			l.Delta("\n")
		}
		msgs = append(msgs, llm.AssistantToolMessage(reply))
		var images []llm.Part
		for _, call := range reply.ToolCalls {
			result, img := l.tool(ctx, call)
			if ctx.Err() != nil {
				return ctx.Err()
			}
			msgs = append(msgs, llm.ToolMessage(call.ID, result))
			images = append(images, img...)
		}
		if len(images) > 0 {
			// Tool results are text; pages to look at come as the next
			// user message.
			content := llm.PartsContent(llm.TextPart("The pages you asked to look at:"))
			for _, p := range images {
				content.AppendPart(p)
			}
			msgs = append(msgs, llm.Message{Role: "user", Content: content})
		}
		if wrote && l.Complete != nil && onlyRemembers(reply.ToolCalls) && l.Complete() {
			return nil
		}
		if l.Round != nil {
			l.Round(msgs)
		}
	}
}

// onlyRemembers is a round whose calls all save to memory.
func onlyRemembers(calls []llm.ToolCall) bool {
	for _, c := range calls {
		if c.Function.Name != "remember" {
			return false
		}
	}
	return len(calls) > 0
}

// cutRetries is how many cut-off rounds one run asks again.
const cutRetries = 2

func (l *Loop) step(label string, running bool) {
	if l.Step != nil {
		l.Step(label, running)
	}
}

// Prompt is how to use the tools, for a system prompt.
const Prompt = `Tools. Use the book: search_pages to find where it covers something, read_page to read it,
view_page when a figure, a table or the layout matters. Do every calculation with compute, and
every system of linear equations with solve_linear, rather than in your head: they are exact, and
a guide with a wrong number in it is worse than none. Pages you give or get are printed page
numbers.`
