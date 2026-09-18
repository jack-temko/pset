package engine

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"net"
	"net/http"
	"net/url"
	"time"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/store"
)

// PhaseSpec declares one phase of a task's plan: an identity, a unit count
// for progress, and the work. Plans are flat and ordered — a phase has no
// children, so what the engine runs is exactly what a student sees.
type PhaseSpec struct {
	Key  string
	Name string
	// Total is the unit count for progress display; 0 means uncounted.
	Total int
	Run   func(ctx context.Context, h PhaseHandle) error
}

// PhaseHandle is a running phase's view of the pipeline: progress, a live
// note, and the stop checkpoint.
type PhaseHandle interface {
	Progress(done, total int)
	Note(text string)
	// Checkpoint returns a taskStopped error when a stop or a shutdown was
	// requested; Run should return it unwrapped.
	Checkpoint() error
}

// Transient failures inside a phase retry in place, invisibly: a rate limit
// or a dropped connection is not something to show a student. A phase that
// runs out of attempts fails the task, and there is only that one outcome.
const (
	phaseAttempts = 3
	phaseBackoff  = 2 * time.Second
)

// phaseCoalesceInterval bounds progress and note churn on the event stream.
const phaseCoalesceInterval = 250 * time.Millisecond

// isRetryable classifies failures for the in-phase retry loop: LLM transport
// failures, 429s and 5xxs come back; refusals, bad input, and bad model
// output do not.
func isRetryable(err error) bool {
	var perm *PermanentError
	if errors.As(err, &perm) {
		return false
	}
	var llmErr *llm.LLMError
	if errors.As(err, &llmErr) {
		return llmErr.Status == http.StatusTooManyRequests || llmErr.Status >= 500
	}
	var urlErr *url.Error
	if errors.As(err, &urlErr) {
		var netErr net.Error
		return errors.As(urlErr.Err, &netErr) || urlErr.Err != nil && errors.Is(urlErr.Err, context.DeadlineExceeded)
	}
	return false
}

// pipeline carries one running task through its phases and persists every
// row change as it goes.
type pipeline struct {
	eng    *Engine
	s      *store.Store
	task   *store.Task
	runner *Runner
	ctx    context.Context // the worker's context, for handle methods

	libCreated string
	book       *store.Book
	hw         *store.Homework
	question   *store.HomeworkQuestion
	embed      *embedRun
}

// execute runs the task kind's registered plan.
func (p *pipeline) execute(ctx context.Context) error {
	reg, ok := taskKinds[p.task.Kind]
	if !ok {
		return permanentf(nil, "unknown task kind %q", p.task.Kind)
	}
	specs, err := reg.plan(ctx, p)
	if err != nil {
		return err
	}
	err = p.runPhases(ctx, specs)
	if reg.settle != nil {
		return reg.settle(ctx, p, err)
	}
	return err
}

// runPhases declares the whole plan up front — so the shape is stable in the
// UI from the first frame — then runs each phase in order, skipping the ones
// an earlier run already finished.
func (p *pipeline) runPhases(ctx context.Context, specs []PhaseSpec) error {
	rows := make([]*store.Phase, 0, len(specs))
	for seq, spec := range specs {
		row, err := p.declare(ctx, seq, spec)
		if err != nil {
			return err
		}
		rows = append(rows, row)
	}
	for i, spec := range specs {
		row := rows[i]
		if row.Status == store.PhaseDone {
			continue
		}
		if err := p.runPhase(ctx, row, spec); err != nil {
			return err
		}
	}
	return nil
}

// declare upserts one phase row, preserving what an earlier run achieved.
func (p *pipeline) declare(ctx context.Context, seq int, spec PhaseSpec) (*store.Phase, error) {
	row := &store.Phase{
		TaskID: p.task.ID,
		Seq:    seq,
		Key:    spec.Key,
		Name:   spec.Name,
		Total:  spec.Total,
	}
	if err := p.s.UpsertPhase(ctx, row); err != nil {
		return nil, userf(err, "could not record the plan of this task")
	}
	p.publishPhase(row)
	return row, nil
}

// runPhase runs one phase, retrying transient failures in place.
func (p *pipeline) runPhase(ctx context.Context, row *store.Phase, spec PhaseSpec) error {
	row.Status = store.PhaseRunning
	row.Error = ""
	row.StartedAt = time.Now().UTC()
	row.FinishedAt = time.Time{}
	if err := p.savePhase(ctx, row); err != nil {
		return err
	}

	for attempt := 1; ; attempt++ {
		if st, stop := p.checkpoint(ctx); stop {
			return &taskStopped{status: st}
		}

		err := spec.Run(ctx, p.handleFor(row))
		if err == nil {
			return p.finishPhase(ctx, row, store.PhaseDone, "")
		}

		var needed *notNeeded
		if errors.As(err, &needed) {
			// Nothing to do here — that is a finished phase, not an outcome
			// of its own.
			return p.finishPhase(ctx, row, store.PhaseDone, needed.reason)
		}

		if st, stop := p.checkpoint(ctx); stop {
			return &taskStopped{status: st}
		}
		if ctx.Err() != nil {
			return &taskStopped{status: store.TaskQueued}
		}

		if !isRetryable(err) || attempt >= phaseAttempts {
			row.Status = store.PhaseFailed
			row.Error = userSentence(err)
			row.Note = ""
			row.FinishedAt = time.Now().UTC()
			if serr := p.savePhase(ctx, row); serr != nil {
				return serr
			}
			return err
		}

		shift := attempt - 1
		if shift > 6 {
			shift = 6
		}
		delay := phaseBackoff<<shift + time.Duration(rand.Int64N(int64(500*time.Millisecond)))
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return &taskStopped{status: store.TaskQueued}
		case <-timer.C:
		}
	}
}

// finishPhase stamps a terminal status, replacing the live note with the
// reason a phase had nothing to do.
func (p *pipeline) finishPhase(ctx context.Context, row *store.Phase, status, note string) error {
	row.Status = status
	row.Note = note
	row.Error = ""
	row.FinishedAt = time.Now().UTC()
	return p.savePhase(ctx, row)
}

func (p *pipeline) handleFor(row *store.Phase) PhaseHandle {
	return &phaseHandle{p: p, row: row}
}

type phaseHandle struct {
	p   *pipeline
	row *store.Phase
	// marks is the rolling window feeding the persisted rate.
	marks []time.Time
}

// etaWindowSize bounds the rolling window the remaining-time estimate uses.
const etaWindowSize = 20

func (h *phaseHandle) Progress(done, total int) {
	if done > h.row.Done {
		h.mark(done - h.row.Done)
	}
	h.row.Done, h.row.Total = done, total
	_ = h.p.savePhase(h.p.ctx, h.row)
}

// mark feeds the rate window and persists the result on the row, so "about
// 2 min left" survives a pause, a resume, and a restart.
func (h *phaseHandle) mark(units int) {
	now := time.Now().UTC()
	for i := 0; i < units; i++ {
		h.marks = append(h.marks, now)
	}
	if len(h.marks) > etaWindowSize {
		h.marks = h.marks[len(h.marks)-etaWindowSize:]
	}
	if len(h.marks) < 2 {
		return
	}
	span := h.marks[len(h.marks)-1].Sub(h.marks[0]).Seconds()
	if span <= 0 {
		return
	}
	h.row.Rate = float64(len(h.marks)-1) / span
}

func (h *phaseHandle) Note(text string) {
	h.row.Note = text
	_ = h.p.savePhase(h.p.ctx, h.row)
}

func (h *phaseHandle) Checkpoint() error {
	if st, stop := h.p.checkpoint(h.p.ctx); stop {
		return &taskStopped{status: st}
	}
	return nil
}

// savePhase persists a row and streams the change to subscribers. A phase
// that cannot record its own state fails the task rather than running on
// with the database disagreeing about what happened.
func (p *pipeline) savePhase(ctx context.Context, row *store.Phase) error {
	if err := p.s.SavePhase(context.WithoutCancel(ctx), row); err != nil {
		p.eng.logger.Error("persist phase", "task", p.task.ID, "phase", row.Key, "err", err)
		return userf(err, "could not record progress of %q", row.Name)
	}
	p.publishPhase(row)
	return nil
}

func (p *pipeline) publishPhase(row *store.Phase) {
	p.eng.publishPhase(phaseFromRow(row))
}

// checkpoint reports a stop requested by StopTask or by process shutdown,
// with the status the runner should persist. A student's stop rests the task
// as paused; a shutdown returns it to the queue so it resumes on next boot.
func (p *pipeline) checkpoint(ctx context.Context) (string, bool) {
	if p.runner != nil && p.runner.stopRequested(p.task.ID) {
		return store.TaskPaused, true
	}
	if ctx.Err() != nil {
		return store.TaskQueued, true
	}
	return "", false
}

// userSentence renders an error as the one line a student reads.
func userSentence(err error) string {
	var user *UserError
	if errors.As(err, &user) {
		return user.Message
	}
	var perm *PermanentError
	if errors.As(err, &perm) {
		return perm.Message
	}
	var env *EnvironmentError
	if errors.As(err, &env) {
		return env.Message
	}
	return firstSentence(err.Error())
}

func firstSentence(s string) string {
	for i, r := range s {
		if r == '\n' {
			return s[:i]
		}
	}
	if len(s) > 200 {
		return s[:200] + "…"
	}
	return s
}

var _ = fmt.Sprintf
