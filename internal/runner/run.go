package runner

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"

	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/step"
)

// Run is one run of one step, as its handler sees it.
type Run struct {
	r         *Runner
	StepID    string
	Kind      change.Resource
	SubjectID string
	Name      step.Name
	// Attempt is which run this is, from 1.
	Attempt int
	hash    string
	// healed is the runner's count of each condition's Holds as this run
	// started.
	healed map[string]int
}

// Client is the model client, built once for the whole run. Without a
// saved key it fails as KeyMissing, so the step waits on the key and runs
// again once one is saved.
func (run *Run) Client(ctx context.Context) (*llm.Client, error) {
	key, err := run.r.key(ctx)
	if err != nil {
		return nil, err
	}
	if key == "" {
		return nil, llm.KeyMissing.New()
	}
	return run.r.client, nil
}

// Write writes what the step makes, as PSet.
func (run *Run) Write(ctx context.Context, fn func(*sql.Tx) error) error {
	return run.r.store.Write(ctx, change.ActorPSet, "", fn)
}

// Activity says what the step is doing right now ("Reading page 142"). It
// is not logged: a page that connects later sees the step's state, and the
// next line.
func (run *Run) Activity(label string) {
	run.r.store.Publish(change.EventStepActivity, change.StepActivity{StepID: run.StepID, Label: label})
}

// Request keys a model call to this step: its tokens, cost and time are
// kept on the step (and go with it), and a call that works shows the key,
// credit and provider hold. Pass every request through it.
func (run *Run) Request(req llm.ChatRequest) llm.ChatRequest {
	prev := req.OnDone
	req.OnDone = func(c llm.Call) {
		if prev != nil {
			prev(c)
		}
		run.record(c)
	}
	return req
}

func (run *Run) record(c llm.Call) {
	var prompt, completion, cached, writes, reasoning int
	var cost float64
	counted := c.Usage != nil
	if counted {
		u := c.Usage
		prompt, completion, cost = u.PromptTokens, u.CompletionTokens, u.Cost
		cached, writes, reasoning = u.PromptDetails.CachedTokens, u.PromptDetails.CacheWriteTokens, u.CompletionDetails.ReasoningTokens
	}
	// Calls are not logged, so they need no store.Write.
	_, err := run.r.store.DB.ExecContext(context.Background(), `INSERT INTO calls
		(step_id, attempt, at, model, answered, host, ms, prompt_tokens, completion_tokens, cached_tokens, cache_write_tokens, reasoning_tokens, cost, counted, error_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		run.StepID, run.Attempt, c.At, c.Model, c.Answered, c.Host, c.Ms, prompt, completion, cached, writes, reasoning, cost, counted, c.ErrorID)
	if err != nil {
		slog.Warn("runner: record a call", "step", run.StepID, "err", err)
	}
	if c.Error == "" {
		run.r.callWorked()
	}
}

func jsonText(v any) (string, error) {
	b, err := json.Marshal(v)
	return string(b), errs.Data.Of(err)
}
