package ask

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/jackt/pset/internal/agent"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/doc"
	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/pagenum"
)

type turnPayload struct {
	TurnID string `json:"turnId"`
}

// maxRounds bounds the loop: a question that needs more than this many
// rounds of tools gets answered with what it has.
const maxRounds = 8

// historyTurns is how much of the conversation the model sees.
const historyTurns = 6

// failure is a turn failure in words for the student, and its kind.
type failure struct {
	kind Failure
	msg  string
	err  error
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
	parser *doc.Parser
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
	// A book's conversation is one session, turn after turn.
	err = r.loop(llm.WithSession(ctx, "ask-"+t.BookID))
	settle := context.WithoutCancel(ctx)
	switch {
	case err == nil:
		r.finish(settle, TurnDone, "", "")
		return nil
	case jobs.Stopped(ctx):
		r.finish(settle, TurnStopped, "", "")
		return err
	case ctx.Err() != nil:
		// Shutting down: the job runs again on the next start, from the
		// question, so what it had written goes.
		s.c.DB.ExecContext(settle, `UPDATE turns SET steps = '[]', answer = '[]', updated_at = ? WHERE id = ?`, db.Now(), t.ID)
		s.publish(settle, t.ID)
		return err
	}
	reason, kind := "Something went wrong answering this. The details are in the log.", FailureGeneration
	var f *failure
	if errors.As(err, &f) {
		reason, kind = f.msg, f.kind
	}
	slog.Warn("turn failed", "turn", t.ID, "err", err)
	r.finish(settle, TurnFailed, reason, kind)
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
		return &failure{kind: FailureSetup, msg: llm.NoKey}
	}
	r.llm, r.model = llm.Open(cfg), cfg.ChatModel
	r.parser = doc.NewParser(ctx, doc.Options{
		Mode: doc.Ask, Pages: r.book.Pages, PageCount: r.book.PageCount, Model: r.llm.Mechanical(r.model),
	}, doc.Handler{
		BlockStart: func(typ string) {
			s.c.Events.Publish(EventTurnBlockStart, TurnBlockStart{TurnID: r.t.ID, Type: typ})
		},
		Text: func(runs []doc.Run) {
			s.c.Events.Publish(EventTurnBlockText, TurnBlockText{TurnID: r.t.ID, Runs: runs})
		},
		Repairing: func(typ string) {
			s.c.Events.Publish(EventTurnBlockRepairing, TurnBlockRepairing{TurnID: r.t.ID, Type: typ})
		},
		Block: func(b doc.Block, failed bool) {
			event := EventTurnBlock
			if failed {
				event = EventTurnBlockFailed
			}
			s.c.Events.Publish(event, TurnBlock{TurnID: r.t.ID, Block: b})
			r.save(ctx, true)
		},
	})

	msgs, err := r.messages(ctx)
	if err != nil {
		return err
	}
	loop := &agent.Loop{
		Client: r.llm, Model: r.model, Library: s.c.Library, Book: r.book, Rounds: maxRounds,
		System: systemPrompt(r.book.Title, s.c.Settings.Name(ctx)),
		Memory: s.c.Memory, Student: true,
		Step:       func(label string, running bool) { r.step(ctx, label, running) },
		Remembered: func(n agent.Note, _ string) { r.remembered(ctx, n.ID) },
		Delta: func(chunk string) {
			r.parser.Feed(chunk)
			r.save(ctx, false)
		},
	}
	err = loop.Run(ctx, msgs)
	r.parser.Finish()
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if errors.Is(err, agent.ErrNoAnswer) {
			return &failure{kind: FailureGeneration, msg: "The model stopped without answering. Asking again usually works.", err: err}
		}
		switch trouble, status := llm.Classify(err); trouble {
		case llm.TroubleCut:
			return &failure{kind: FailureGeneration, msg: "The answer stopped partway: the connection to the model dropped. Asking again usually works.", err: err}
		case llm.TroubleRejected:
			return &failure{kind: FailureSetup, msg: llm.Refusal(status) + " Check the key in Settings, then ask again.", err: err}
		case llm.TroubleCredit:
			return &failure{kind: FailureSetup, msg: llm.NoCredit, err: err}
		}
		return &failure{kind: FailureUnavailable, msg: "OpenRouter didn't answer, or is busy right now. Ask again in a minute.", err: err}
	}
	return nil
}

// messages is the conversation so far, and the question.
func (r *run) messages(ctx context.Context) ([]llm.Message, error) {
	var msgs []llm.Message
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
		msgs = append(msgs, llm.TextMessage("user", questionText(t)), llm.TextMessage("assistant", flatten(t.Answer, r.book.Pages)))
	}
	return append(msgs, llm.TextMessage("user", questionText(r.t))), nil
}

func questionText(t row) string {
	if t.AboutText == "" {
		return t.Question
	}
	return fmt.Sprintf("%s\n\n(This is about the homework problem %s: %s)", t.Question, t.About, t.AboutText)
}

// flatten turns a stored answer back into what the model wrote: the
// blocks as JSON lines, math in \(..\), citations on printed pages again.
func flatten(blocks []doc.Block, pages pagenum.Map) string {
	return doc.ModelLines(blocks, pages)
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
		mustJSON(r.parser.Blocks()), mustJSON(r.steps), db.Now(), r.t.ID)
}

// step puts a call on the feed, or finishes the last one.
func (r *run) step(ctx context.Context, label string, running bool) {
	r.mu.Lock()
	if !running && len(r.steps) > 0 && r.steps[len(r.steps)-1].Running {
		last := r.steps[len(r.steps)-1]
		r.steps[len(r.steps)-1] = Step{Label: label, After: last.After}
	} else {
		// The blocks so far end here: the step goes after them.
		r.steps = append(r.steps, Step{Label: label, Running: running, After: len(r.parser.Blocks())})
	}
	answer := r.parser.Blocks()
	r.mu.Unlock()
	r.s.c.DB.ExecContext(ctx, `UPDATE turns SET steps = ?, answer = ?, updated_at = ? WHERE id = ?`,
		mustJSON(r.steps), mustJSON(answer), db.Now(), r.t.ID)
	r.s.publish(ctx, r.t.ID)
}

// remembered ties the step that just saved a memory to it, for Undo.
func (r *run) remembered(ctx context.Context, id string) {
	r.mu.Lock()
	if len(r.steps) > 0 {
		r.steps[len(r.steps)-1].MemoryID = id
	}
	r.mu.Unlock()
	r.save(ctx, true)
	r.s.publish(ctx, r.t.ID)
}

func (r *run) finish(ctx context.Context, st TurnState, reason string, kind Failure) {
	var answer []doc.Block
	steps := []Step{}
	if r.parser != nil {
		answer = r.parser.Blocks()
	}
	r.mu.Lock()
	for _, s := range r.steps {
		if !s.Running {
			steps = append(steps, s)
		}
	}
	r.mu.Unlock()
	if answer == nil {
		answer = []doc.Block{}
	}
	r.s.c.DB.ExecContext(ctx, `UPDATE turns SET state = ?, reason = ?, failure = ?, answer = ?, steps = ?, updated_at = ? WHERE id = ?`,
		st, reason, kind, mustJSON(answer), mustJSON(steps), db.Now(), r.t.ID)
	r.s.publish(ctx, r.t.ID)
}

// systemPrompt puts what never changes first (the tools, the document
// format, the rules), and the book and the student last: the endpoint
// caches a long shared prefix, so every turn on every book reuses it.
func systemPrompt(title, name string) string {
	who := "Be warm and encouraging, like a good tutor sitting beside the student."
	if name != "" {
		who = fmt.Sprintf("You're talking with %s. Be warm and encouraging, like a good tutor sitting beside them, and use their name now and then where it's natural, never in every reply.", name)
	}
	return fmt.Sprintf(`You are a tutor answering a student's questions about a textbook. Answer focused, in short paragraphs, the way the book would put it, and no longer than the question needs.

%s

- Cite the book as [p. N], N the printed page number the tools give, right where a page supports
  what you say. Cite only pages you read or searched.
- If the book doesn't cover something, say so, then answer from general knowledge and say that's
  what you did.

%s

The textbook is %q. %s`, agent.Prompt, doc.AskWriting, title, who)
}
