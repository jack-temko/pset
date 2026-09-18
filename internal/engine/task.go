package engine

import (
	"context"
	"errors"
	"time"

	"github.com/jackt/pset/internal/store"
)

// Phase is the engine's view of one phase row, in plan order.
type Phase struct {
	ID         string
	TaskID     string
	Key        string
	Name       string
	Status     string
	Done       int
	Total      int
	Note       string
	Error      string
	CreatedAt  time.Time
	StartedAt  time.Time
	FinishedAt time.Time
	// EtaSeconds is the remaining time of a running, counted phase. It is
	// computed from the rate persisted on the row, so it survives a pause,
	// a resume, and a restart.
	EtaSeconds *float64
}

func phaseFromRow(row *store.Phase) *Phase {
	p := &Phase{
		ID:         row.ID,
		TaskID:     row.TaskID,
		Key:        row.Key,
		Name:       row.Name,
		Status:     row.Status,
		Done:       row.Done,
		Total:      row.Total,
		Note:       row.Note,
		Error:      row.Error,
		CreatedAt:  row.CreatedAt,
		StartedAt:  row.StartedAt,
		FinishedAt: row.FinishedAt,
	}
	if row.Status == store.PhaseRunning && row.Total > row.Done && row.Rate > 0 {
		secs := float64(row.Total-row.Done) / row.Rate
		p.EtaSeconds = &secs
	}
	return p
}

// TaskView is a task row enriched for display: the title of what it is
// working on, and its phases in plan order.
type TaskView struct {
	ID         string
	Kind       string
	Status     string
	BookID     *string
	HomeworkID *string
	// QuestionID is set on a question task: the one question it works.
	QuestionID string
	Title      string
	Phases     []*Phase
	// FailKind is transient, environment, or permanent; empty unless the
	// task failed. Only permanent suppresses a retry.
	FailKind string
	Error    string
	// BookIncomplete is set when this task's book is not ready despite the
	// task having finished — data went missing after the fact. It is what
	// makes a done task offer a repair instead of dead-ending.
	BookIncomplete bool
	CreatedAt      time.Time
	StartedAt      time.Time
	FinishedAt     time.Time
}

// Retryable reports whether offering a retry would be honest. A permanent
// failure would fail identically, so the adapter offers no door for it.
func (v *TaskView) Retryable() bool {
	switch v.Status {
	case store.TaskPaused:
		return true
	case store.TaskFailed:
		return v.FailKind != store.FailPermanent
	case store.TaskDone:
		// A finished task is worth retrying only when the book it built is
		// no longer complete — the adapter sets this from the book's derived
		// readiness, which is the only thing that can tell.
		return v.BookIncomplete
	}
	return false
}

// StopTask rests a task where it stands, keeping every finished phase. A
// queued task rests immediately; a running one stops at its next checkpoint.
// A task that is already resting refuses.
func (e *Engine) StopTask(ctx context.Context, id string) (*store.Task, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	task, err := s.TaskByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if task.Settled() {
		return nil, &TaskSettledError{ID: task.ID, Status: task.Status}
	}

	if r := e.getRunner(); r != nil && r.requestStop(id) {
		// Running here: it will rest at its next checkpoint, with whatever
		// it has already written intact.
		return task, nil
	}

	task.Status = store.TaskPaused
	task.FinishedAt = time.Now().UTC()
	task.Owner = ""
	if err := s.SaveTask(ctx, task); err != nil {
		return nil, userf(err, "could not stop task %s", id)
	}
	if err := s.ResumePhases(ctx, task.ID); err != nil {
		return nil, userf(err, "could not stop task %s", id)
	}
	e.publishTaskView(ctx, s, task)
	e.cleanupAfterStop(task)
	return task, nil
}

// RetryTask resumes a resting task: the phase that failed and any phase
// interrupted mid-flight go back to waiting, finished phases stay done and
// are never re-run. A task still queued or running refuses.
//
// A task that finished is retried against the data rather than against its
// own record: readiness is derived, so if a book lost pages or vectors after
// its preparation completed, the phases from the missing one onward are
// reopened. Trusting the row would leave a book permanently unusable with no
// door out of it.
func (e *Engine) RetryTask(ctx context.Context, id string) (*store.Task, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	task, err := s.TaskByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if task.Status == store.TaskQueued || task.Status == store.TaskRunning {
		return nil, &TaskActiveError{ID: task.ID, Status: task.Status}
	}
	if err := s.ResumePhases(ctx, id); err != nil {
		return nil, userf(err, "could not resume task %s", id)
	}
	if task.Status == store.TaskDone {
		if err := e.reopenMissingPhases(ctx, s, task); err != nil {
			return nil, err
		}
	}
	task.Status = store.TaskQueued
	task.Error = ""
	task.FailKind = ""
	task.Owner = ""
	task.FinishedAt = time.Time{}
	if err := s.SaveTask(ctx, task); err != nil {
		return nil, userf(err, "could not requeue task %s", id)
	}
	e.logger.Debug("task requeued", "task", task.ID)
	e.publishTaskView(ctx, s, task)
	e.nudgeRunner()
	return task, nil
}

// reopenMissingPhases reopens the phases a finished task did not actually
// leave complete, starting from the one readiness names. A task with nothing
// missing refuses: there is genuinely nothing to redo.
func (e *Engine) reopenMissingPhases(ctx context.Context, s *store.Store, task *store.Task) error {
	if task.BookID == nil {
		return &TaskSettledError{ID: task.ID, Status: task.Status}
	}
	settings, err := e.Config(ctx)
	if err != nil {
		return err
	}
	ready, err := s.Readiness(ctx, *task.BookID, settings.EmbedModel)
	if err != nil {
		return err
	}
	missing := ready.Missing()
	if missing == "" {
		return &TaskSettledError{ID: task.ID, Status: task.Status}
	}
	phases, err := s.PhasesByTask(ctx, task.ID)
	if err != nil {
		return err
	}
	reopen := false
	for _, phase := range phases {
		if phase.Key == missing {
			reopen = true
		}
		if !reopen {
			continue
		}
		phase.Status = store.PhaseWaiting
		phase.Error = ""
		phase.Note = ""
		phase.FinishedAt = time.Time{}
		if err := s.SavePhase(ctx, phase); err != nil {
			return userf(err, "could not reopen %q", phase.Name)
		}
	}
	return nil
}

// TaskView loads one task; ErrTaskNotFound when the id is unknown.
func (e *Engine) TaskView(ctx context.Context, id string) (*TaskView, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	task, err := s.TaskByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return e.buildTaskView(ctx, s, task)
}

// TaskViews lists tasks for display: active first in FIFO order, then the
// ones still waiting on a decision, then finished newest-first. History is
// pruned as tasks settle, so there is nothing to clear by hand.
func (e *Engine) TaskViews(ctx context.Context) ([]*TaskView, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	active, err := s.ActiveTasks(ctx)
	if err != nil {
		return nil, userf(err, "could not list tasks")
	}
	attention, err := s.AttentionTasks(ctx)
	if err != nil {
		return nil, userf(err, "could not list tasks")
	}
	finished, err := s.FinishedTasks(ctx, 0)
	if err != nil {
		return nil, userf(err, "could not list tasks")
	}

	out := make([]*TaskView, 0, len(active)+len(attention)+len(finished))
	for _, group := range [][]*store.Task{active, attention, finished} {
		for _, task := range group {
			view, err := e.buildTaskView(ctx, s, task)
			if err != nil {
				return nil, err
			}
			out = append(out, view)
		}
	}
	return out, nil
}

// buildTaskView assembles the display form of one task row.
func (e *Engine) buildTaskView(ctx context.Context, s *store.Store, task *store.Task) (*TaskView, error) {
	v := &TaskView{
		ID:         task.ID,
		Kind:       task.Kind,
		Status:     task.Status,
		BookID:     task.BookID,
		HomeworkID: task.HomeworkID,
		QuestionID: derefString(task.QuestionID),
		FailKind:   task.FailKind,
		Error:      task.Error,
		CreatedAt:  task.CreatedAt,
		StartedAt:  task.StartedAt,
		FinishedAt: task.FinishedAt,
	}
	v.Title = e.taskTitle(ctx, s, task)
	if task.Status == store.TaskDone && task.BookID != nil {
		// Readiness is derived, so a finished task can still be looking at an
		// incomplete book. Saying so here is what keeps the retry honest.
		if settings, err := e.Config(ctx); err == nil {
			if ready, err := s.Readiness(ctx, *task.BookID, settings.EmbedModel); err == nil {
				v.BookIncomplete = !ready.Ready()
			}
		}
	}
	rows, err := s.PhasesByTask(ctx, task.ID)
	if err != nil {
		return nil, userf(err, "could not read the plan of task %s", task.ID)
	}
	v.Phases = make([]*Phase, 0, len(rows))
	for _, row := range rows {
		v.Phases = append(v.Phases, phaseFromRow(row))
	}
	return v, nil
}

// taskTitle names what the task is working on, in the words a student uses.
func (e *Engine) taskTitle(ctx context.Context, s *store.Store, task *store.Task) string {
	if task.HomeworkID != nil {
		if hw, err := s.HomeworkByID(ctx, *task.HomeworkID); err == nil && hw.Title != "" {
			return hw.Title
		}
	}
	if task.BookID != nil {
		if book, err := s.BookByID(ctx, *task.BookID); err == nil {
			return book.Title
		}
	}
	if label := e.origin(task.ID); label != "" {
		return label
	}
	return "a new book"
}

// publishTaskView streams one task's full display row to subscribers.
func (e *Engine) publishTaskView(ctx context.Context, s *store.Store, task *store.Task) {
	view, err := e.buildTaskView(ctx, s, task)
	if err != nil {
		e.logger.Error("build task view for stream", "task", task.ID, "err", err)
		return
	}
	e.publishTask(view)
}

func (e *Engine) publishTask(view *TaskView) { e.events.publishTask(view) }
func (e *Engine) publishPhase(phase *Phase)  { e.events.publishPhase(phase) }
func (e *Engine) publishRemoved(id string)   { e.events.publishRemoved(id) }

// cleanupAfterStop is a no-op for a paused task: its staged source stays so
// a resume can pick the import back up.
func (e *Engine) cleanupAfterStop(task *store.Task) {}

// SubscribeEvents streams every task and phase change, picking up after
// event number `after` (0 for a fresh start). The snapshot event is the api
// adapter's to build, and only when the subscription could not be resumed;
// subscribe first, then read, so nothing in between is lost — folds are
// last-write-wins by id.
func (e *Engine) SubscribeEvents(after uint64) *Subscription {
	return e.events.subscribe(after)
}

var _ = errors.Is

// derefString reads an optional column as a plain string.
func derefString(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}
