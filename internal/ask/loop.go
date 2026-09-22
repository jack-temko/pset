package ask

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/jackt/pset/internal/cards"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/llm"
)

type turnPayload struct {
	TurnID string `json:"turnId"`
}

// maxRounds bounds the loop: a question that needs more than this many
// rounds of tools gets answered with what it has.
const maxRounds = 8

// historyTurns is how much of the conversation the model sees.
const historyTurns = 6

// failure is a turn failure in words for the student.
type failure struct {
	msg string
	err error
}

func (f *failure) Error() string {
	if f.err != nil {
		return f.msg + ": " + f.err.Error()
	}
	return f.msg
}

func (f *failure) Unwrap() error { return f.err }

// run is one turn in flight.
type run struct {
	s     *Service
	t     row
	book  Book
	model string
	llm   *llm.Client

	mu     sync.Mutex
	steps  []Step
	parser *cards.Parser
	saved  time.Time
}

func (s *Service) runTurn(ctx context.Context, j jobs.Job) error {
	var p turnPayload
	if err := j.Decode(&p); err != nil {
		return err
	}
	t, err := getTurn(ctx, s.c.DB, p.TurnID)
	if errors.Is(err, errNotFound) || (err == nil && t.State != TurnRunning) {
		return nil // cleared, or stopped before it started
	}
	if err != nil {
		return err
	}
	r := &run{s: s, t: t}
	err = r.loop(ctx)
	settle := context.WithoutCancel(ctx)
	switch {
	case err == nil:
		r.finish(settle, TurnDone, "")
		return nil
	case jobs.Stopped(ctx):
		r.finish(settle, TurnStopped, "")
		return err
	case ctx.Err() != nil:
		// Shutting down: the job runs again on the next start, from the
		// question, so what it had written goes.
		s.c.DB.ExecContext(settle, `UPDATE turns SET steps = '[]', answer = '[]' WHERE id = ?`, t.ID)
		s.publish(settle, t.ID)
		return err
	}
	reason := "Something went wrong answering this. The details are in the log."
	var f *failure
	if errors.As(err, &f) {
		reason = f.msg
	}
	slog.Warn("turn failed", "turn", t.ID, "err", err)
	r.finish(settle, TurnFailed, reason)
	return err
}

func (r *run) loop(ctx context.Context) error {
	s := r.s
	var err error
	if r.book, err = s.c.Library.Book(ctx, r.t.BookID); err != nil {
		return err
	}
	cfg, err := s.c.Settings.LLM(ctx)
	if err != nil {
		return err
	}
	if !cfg.ChatReady() {
		return &failure{msg: "Set up a chat model in Settings, then ask again."}
	}
	r.llm, r.model = llm.Open(cfg), cfg.ChatModel
	r.parser = cards.NewParser(ctx, cards.Options{Offset: r.book.PageOffset, Repair: r.repair}, cards.Handler{
		Delta: func(text string) {
			s.c.Events.Publish(EventTurnDelta, TurnDelta{TurnID: r.t.ID, Text: text})
			r.save(ctx, false)
		},
		CardStart: func(k cards.Kind) {
			s.c.Events.Publish(EventTurnCardStart, TurnCardStart{TurnID: r.t.ID, Kind: k})
		},
		Repairing: func(k cards.Kind) {
			s.c.Events.Publish(EventTurnRepairing, TurnCardStart{TurnID: r.t.ID, Kind: k})
		},
		Card: func(seg cards.Segment) {
			s.c.Events.Publish(EventTurnCard, TurnCard{TurnID: r.t.ID, Segment: seg})
			r.save(ctx, true)
		},
	})

	msgs, err := r.messages(ctx, s.c.Settings.Name(ctx))
	if err != nil {
		return err
	}
	for round := 0; ; round++ {
		req := llm.ChatRequest{Model: r.model, Messages: msgs, Tools: tools}
		if round == maxRounds {
			// Enough looking: answer with what's been found.
			req.Tools = nil
			req.Messages = append(msgs, llm.TextMessage("user", "Answer now, with what you've found."))
		}
		reply, err := r.llm.ChatStreamFull(ctx, req, func(delta string) error {
			r.parser.Feed(delta)
			return nil
		})
		if err != nil {
			r.parser.Finish()
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return &failure{msg: "The chat model stopped answering. Check it in Settings, then try again.", err: err}
		}
		if len(reply.ToolCalls) == 0 || req.Tools == nil {
			r.parser.Finish()
			return nil
		}
		// Whatever it said before reaching for a tool ends its line.
		r.parser.Feed("\n")
		msgs = append(msgs, llm.AssistantToolMessage(reply.Content, reply.ToolCalls))
		var images []llm.Part
		for _, call := range reply.ToolCalls {
			result, img := r.tool(ctx, call)
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
	}
}

// messages is the system prompt, the conversation so far, and the
// question.
func (r *run) messages(ctx context.Context, name string) ([]llm.Message, error) {
	msgs := []llm.Message{llm.TextMessage("system", systemPrompt(r.book.Title, name))}
	prior, err := listTurns(ctx, r.s.c.DB, r.book.ID)
	if err != nil {
		return nil, err
	}
	var done []row
	for _, t := range prior {
		if t.ID != r.t.ID && (t.State == TurnDone || t.State == TurnStopped) && len(t.Answer) > 0 {
			done = append(done, t)
		}
	}
	if len(done) > historyTurns {
		done = done[len(done)-historyTurns:]
	}
	for _, t := range done {
		msgs = append(msgs, llm.TextMessage("user", questionText(t)), llm.TextMessage("assistant", flatten(t.Answer, r.book.PageOffset)))
	}
	return append(msgs, llm.TextMessage("user", questionText(r.t))), nil
}

func questionText(t row) string {
	if t.AboutText == "" {
		return t.Question
	}
	return fmt.Sprintf("%s\n\n(This is about the homework problem %s: %s)", t.Question, t.About, t.AboutText)
}

// flatten turns a stored answer back into what the model wrote, with
// citations on printed pages again.
func flatten(segs []cards.Segment, offset int) string {
	var b strings.Builder
	for _, s := range segs {
		switch s.Type {
		case cards.SegmentProse:
			b.WriteString(cards.Cite(s.Text, -offset))
		case cards.SegmentCard:
			if s.Kind == cards.KindPlot {
				var p cards.PlotCard
				json.Unmarshal(s.Card, &p)
				fmt.Fprintf(&b, "[a plot: %s]", p.Title)
			} else {
				fmt.Fprintf(&b, "```%s\n%s\n```", s.Kind, s.Card)
			}
		default:
			b.WriteString(s.Text)
		}
		b.WriteString("\n\n")
	}
	return strings.TrimSpace(b.String())
}

func (r *run) repair(ctx context.Context, k cards.Kind, raw string, problems []string, schema string) (string, error) {
	return r.llm.ChatOnce(ctx, llm.ChatRequest{Model: r.model, Messages: []llm.Message{
		llm.TextMessage("system", repairPrompt),
		llm.TextMessage("user", fmt.Sprintf("Kind: %s\n\nThe card:\n%s\n\nWhat's wrong:\n- %s\n\nIts schema:\n%s",
			k, raw, strings.Join(problems, "\n- "), schema)),
	}})
}

// ---------------------------------------------------------------- state

// saveEvery keeps the stored answer close behind the stream, so a reload
// mid-answer picks up nearly where it was.
const saveEvery = 400 * time.Millisecond

func (r *run) save(ctx context.Context, force bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if !force && time.Since(r.saved) < saveEvery {
		return
	}
	r.saved = time.Now()
	r.s.c.DB.ExecContext(ctx, `UPDATE turns SET answer = ?, steps = ?, updated_at = ? WHERE id = ?`,
		mustJSON(r.parser.Segments()), mustJSON(r.steps), db.Now(), r.t.ID)
}

// step puts a call on the feed, or finishes the last one.
func (r *run) step(ctx context.Context, label string, running bool) {
	r.mu.Lock()
	if !running && len(r.steps) > 0 && r.steps[len(r.steps)-1].Running {
		r.steps[len(r.steps)-1] = Step{Label: label}
	} else {
		r.steps = append(r.steps, Step{Label: label, Running: running})
	}
	answer := r.parser.Segments()
	r.mu.Unlock()
	r.s.c.DB.ExecContext(ctx, `UPDATE turns SET steps = ?, answer = ?, updated_at = ? WHERE id = ?`,
		mustJSON(r.steps), mustJSON(answer), db.Now(), r.t.ID)
	r.s.publish(ctx, r.t.ID)
}

func (r *run) finish(ctx context.Context, st TurnState, reason string) {
	var answer []cards.Segment
	steps := []Step{}
	if r.parser != nil {
		answer = r.parser.Segments()
	}
	r.mu.Lock()
	for _, s := range r.steps {
		if !s.Running {
			steps = append(steps, s)
		}
	}
	r.mu.Unlock()
	if answer == nil {
		answer = []cards.Segment{}
	}
	r.s.c.DB.ExecContext(ctx, `UPDATE turns SET state = ?, reason = ?, answer = ?, steps = ?, updated_at = ? WHERE id = ?`,
		st, reason, mustJSON(answer), mustJSON(steps), db.Now(), r.t.ID)
	r.s.publish(ctx, r.t.ID)
}
