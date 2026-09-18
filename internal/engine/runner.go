package engine

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/jackt/pset/internal/store"
)

// Runner executes queued tasks one at a time. A single worker is the whole
// scheduler: with nothing running concurrently, nothing can run out of order
// on a book, there are no slots to wait for, and a queued task's only
// possible reason for waiting is that something else is ahead of it.
type Runner struct {
	eng   *Engine
	owner string
	wake  chan struct{}
	done  chan struct{}
	err   error

	mu      sync.Mutex
	running string // task id, empty when idle
	cancel  context.CancelFunc
	abort   bool // stop requested for the running task
}

// newOwner identifies this process's lease on the tasks it claims. Only a
// task whose owner differs from the live one may be reclaimed at boot, so a
// second pset on the same database cannot yank the first one's work.
func newOwner() string {
	return fmt.Sprintf("%d-%d", os.Getpid(), time.Now().UTC().UnixNano())
}

func NewRunner(e *Engine) *Runner {
	r := &Runner{
		eng:   e,
		owner: newOwner(),
		wake:  make(chan struct{}, 1),
		done:  make(chan struct{}),
	}
	e.setRunner(r)
	return r
}

// Run reclaims tasks orphaned by a dead process, then runs the queue in FIFO
// order until ctx is cancelled. A student's stop rests the task as paused
// with its finished work intact; process shutdown returns it to the queue so
// it resumes on the next boot.
func (r *Runner) Run(ctx context.Context) error {
	defer close(r.done)

	s, err := r.eng.openStore(ctx)
	if err != nil {
		r.err = err
		return err
	}
	defer s.Close()

	if _, err := s.ReclaimOrphanedTasks(ctx, r.owner); err != nil {
		r.err = userf(err, "the task runner could not resume interrupted work")
		return r.err
	}

	for ctx.Err() == nil {
		ran, err := r.step(ctx, s)
		if err != nil {
			r.err = err
			return err
		}
		if ran {
			continue
		}
		select {
		case <-ctx.Done():
		case <-r.wake:
		}
	}
	r.stopWorker()
	return nil
}

// Done closes when Run returns.
func (r *Runner) Done() <-chan struct{} { return r.done }

// Err reports why Run returned; nil after a graceful shutdown.
func (r *Runner) Err() error { return r.err }

// Drain runs the whole queue and returns — for tests and one-shot work.
func (r *Runner) Drain(ctx context.Context) error {
	s, err := r.eng.openStore(ctx)
	if err != nil {
		return err
	}
	defer s.Close()

	for ctx.Err() == nil {
		ran, err := r.step(ctx, s)
		if err != nil {
			return err
		}
		if !ran {
			return nil
		}
	}
	return nil
}

// step claims and runs the next queued task, reporting whether it ran one.
func (r *Runner) step(ctx context.Context, s *store.Store) (bool, error) {
	task, err := s.QueuedTask(ctx)
	if errors.Is(err, store.ErrNotFound) {
		return false, nil
	}
	if err != nil {
		if ctx.Err() != nil {
			return false, nil
		}
		return false, userf(err, "the task runner could not read the queue")
	}
	claimed, err := s.ClaimTask(ctx, task.ID, r.owner)
	if err != nil {
		if ctx.Err() != nil {
			return false, nil
		}
		return false, userf(err, "the task runner could not start task %s", task.ID)
	}
	if !claimed {
		return true, nil
	}
	if task, err = s.TaskByID(ctx, task.ID); err != nil {
		return false, userf(err, "the task runner could not reload task %s", task.ID)
	}

	wctx, cancel := context.WithCancel(ctx)
	r.register(task.ID, cancel)
	r.eng.publishTaskView(ctx, s, task)
	r.runTask(wctx, s, task)
	r.release()
	return true, nil
}

func (r *Runner) nudge() {
	select {
	case r.wake <- struct{}{}:
	default:
	}
}

func (r *Runner) register(id string, cancel context.CancelFunc) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.running, r.cancel, r.abort = id, cancel, false
}

func (r *Runner) release() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.running, r.cancel, r.abort = "", nil, false
}

func (r *Runner) stopWorker() {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.cancel != nil {
		r.cancel()
	}
}

// requestStop flags the running task to rest at its next checkpoint,
// reporting whether the task was in fact the one running here.
func (r *Runner) requestStop(id string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.running != id {
		return false
	}
	r.abort = true
	return true
}

func (r *Runner) stopRequested(id string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.running == id && r.abort
}

// runTask executes one claimed task and settles its outcome.
func (r *Runner) runTask(ctx context.Context, s *store.Store, task *store.Task) {
	p := &pipeline{eng: r.eng, s: s, task: task, runner: r, ctx: ctx}
	err := p.execute(ctx)

	ctx = context.WithoutCancel(ctx)
	now := time.Now().UTC()
	var stopped *taskStopped
	switch {
	case err == nil:
		task.Status = store.TaskDone
		task.Error = ""
		task.FailKind = ""
		task.FinishedAt = now
	case errors.As(err, &stopped) && stopped.status == store.TaskPaused:
		// A student's stop. The work stays; a retry resumes from here.
		task.Status = store.TaskPaused
		task.Error = ""
		task.FailKind = ""
		task.FinishedAt = now
		r.resetInterrupted(ctx, s, task)
	case errors.As(err, &stopped):
		// Process shutdown: back to the queue, finished phases intact.
		task.Status = store.TaskQueued
		task.FinishedAt = time.Time{}
		r.resetInterrupted(ctx, s, task)
	default:
		task.Status = store.TaskFailed
		task.Error = userSentence(err)
		task.FailKind = failureKind(err)
		task.FinishedAt = now
		if p.libCreated != "" && task.BookID == nil {
			r.eng.logger.Debug("removing library copy of a failed import", "path", p.libCreated)
			os.Remove(p.libCreated)
		}
	}
	task.Owner = ""
	if err := s.SaveTask(ctx, task); err != nil {
		r.eng.logger.Error("persist task result", "task", task.ID, "err", err)
	}
	r.refreshBook(ctx, s, task)
	r.eng.notify(EventPhase, "Task %s %s", task.ID, task.Status)
	r.eng.publishTaskView(ctx, s, task)
	r.pruneHistory(ctx, s)
	r.cleanupSpool(task)
}

// resetInterrupted returns the phase that was mid-flight to waiting, so a
// resume picks it up from its own checkpoints. Finished phases stay done.
func (r *Runner) resetInterrupted(ctx context.Context, s *store.Store, task *store.Task) {
	if err := s.ResumePhases(ctx, task.ID); err != nil {
		r.eng.logger.Error("reset interrupted phases", "task", task.ID, "err", err)
	}
}

// refreshBook recomputes the book's readiness after any task that touched
// it. Readiness is derived, so this only refreshes the cache — but it keeps
// the library honest the moment a task settles.
func (r *Runner) refreshBook(ctx context.Context, s *store.Store, task *store.Task) {
	if task.BookID == nil {
		return
	}
	settings, err := r.eng.Config(ctx)
	if err != nil {
		return
	}
	if _, err := s.RefreshReady(ctx, *task.BookID, settings.EmbedModel); err != nil {
		r.eng.logger.Error("refresh readiness", "book", *task.BookID, "err", err)
	}
}

// pruneHistory keeps the finished list bounded so nothing has to be cleared
// by hand.
func (r *Runner) pruneHistory(ctx context.Context, s *store.Store) {
	ids, err := s.PruneFinishedTasks(ctx)
	if err != nil {
		r.eng.logger.Error("prune task history", "err", err)
		return
	}
	for _, id := range ids {
		r.eng.publishRemoved(id)
	}
}

// cleanupSpool drops the staged source of a task that will not resume. A
// queued or paused task keeps its file so the import can pick up again.
func (r *Runner) cleanupSpool(task *store.Task) {
	if task.Status == store.TaskQueued || task.Status == store.TaskPaused {
		return
	}
	matches, err := filepath.Glob(filepath.Join(r.eng.spoolDir(), spoolPrefix(task.ID)+"*"))
	if err != nil {
		return
	}
	for _, m := range matches {
		if err := os.Remove(m); err != nil {
			r.eng.logger.Debug("remove spool file", "path", m, "err", err)
		}
	}
}
