package engine

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackt/pset/internal/store"
)

// One question is one task.
//
// Questions are independent: the eleventh failing says nothing about the
// twelfth, and wanting the third written again is no reason to touch the
// others. Giving each its own task buys the things the task system already
// does well — it resumes after a restart, it retries, it stops, and its
// phases say what is happening right now — for the part of the product where
// a single step can take minutes.
//
// The assignment's own task is now only the read: extract the questions,
// enqueue one task each, done. It must not wait for them. The runner is a
// single worker, so a parent that waited would hold the only lane and its
// children would never start.

// QuestionMode names which phases a question task runs.
type QuestionMode string

const (
	// QuestionFull locates the question in the book, then writes it up. The
	// generation path, and what relocating re-runs.
	QuestionFull QuestionMode = "full"
	// QuestionGuide writes the walkthrough again from the location the
	// question already has. What Rewrite runs.
	QuestionGuide QuestionMode = "guide"
)

// questionParams is a question task's stored spec: which phases to run, plus
// whatever the student supplied when they asked for it.
type questionParams struct {
	Mode QuestionMode `json:"mode"`
	// Page is a page the student named; it turns locating from searching the
	// whole book into finding a region on one page.
	Page *int `json:"page,omitempty"`
	// Note is what they said was wrong, carried into the search.
	Note string `json:"note,omitempty"`
	// Instruction steers a rewrite.
	Instruction string `json:"instruction,omitempty"`
}

func (p questionParams) encode() (string, error) {
	if p.Mode == "" {
		p.Mode = QuestionFull
	}
	raw, err := json.Marshal(p)
	if err != nil {
		return "", fmt.Errorf("encode question params: %w", err)
	}
	return string(raw), nil
}

// decodeQuestionParams reads a task's spec, defaulting an empty one to the
// full pass so a task written by an older build still does the right thing.
func decodeQuestionParams(raw string) questionParams {
	out := questionParams{Mode: QuestionFull}
	if raw == "" || raw == "{}" {
		return out
	}
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return questionParams{Mode: QuestionFull}
	}
	if out.Mode != QuestionGuide {
		out.Mode = QuestionFull
	}
	return out
}

// taskQuestion loads the question a task works.
func (p *pipeline) taskQuestion(ctx context.Context) (*store.HomeworkQuestion, error) {
	if p.task.QuestionID == nil {
		return nil, &PermanentError{Message: "this task lost track of its question"}
	}
	q, err := p.s.QuestionByID(ctx, *p.task.QuestionID)
	if errors.Is(err, store.ErrNotFound) {
		return nil, &PermanentError{Message: "this task's question no longer exists"}
	}
	if err != nil {
		return nil, userf(err, "could not read the question of task %s", p.task.ID)
	}
	return q, nil
}

// questionPlan declares the phases of working one question. A rewrite skips
// the search: the question is already in the right place, only what was
// written about it was wrong.
func (p *pipeline) questionPlan(ctx context.Context) ([]PhaseSpec, error) {
	q, err := p.taskQuestion(ctx)
	if err != nil {
		return nil, err
	}
	hw, err := p.s.HomeworkByID(ctx, q.HomeworkID)
	if err != nil {
		return nil, userf(err, "could not read the assignment of task %s", p.task.ID)
	}
	p.hw = hw
	p.question = q

	params := decodeQuestionParams(p.task.Params)
	var phases []PhaseSpec
	if params.Mode == QuestionFull && !q.Standalone {
		phases = append(phases, PhaseSpec{
			Key: "locate", Name: "Find it in the book", Total: 1, Run: p.phaseLocate,
		})
	}
	phases = append(phases, PhaseSpec{
		Key: "guide", Name: "Write the walkthrough", Total: 1, Run: p.phaseGuide,
	})
	return phases, nil
}

// questionSettle records the outcome on the question's own row, whatever it
// was. The row is what the workspace renders, so it must agree with the task
// even when the task died in a way the task system alone would remember.
func (p *pipeline) questionSettle(ctx context.Context, err error) error {
	ctx = context.WithoutCancel(ctx)
	q, qErr := p.taskQuestion(ctx)
	if qErr != nil {
		return err
	}
	var stopped *taskStopped
	if errors.As(err, &stopped) {
		// A stop keeps the work; the question waits where it is rather than
		// claiming a failure that never happened.
		return err
	}
	if err != nil {
		p.failQuestionRow(ctx, q, err)
		return err
	}
	return nil
}

// phaseLocate finds the question in the book. Its stage notes are the
// locate ladder's own: reading candidates, checking a page, sweeping a
// chapter when the cheap rounds came up empty.
func (p *pipeline) phaseLocate(ctx context.Context, h PhaseHandle) error {
	if err := h.Checkpoint(); err != nil {
		return err
	}
	run, err := p.questionRunFor(ctx, h)
	if err != nil {
		return err
	}
	h.Progress(0, 1)
	params := decodeQuestionParams(p.task.Params)
	run.pinnedPage = params.Page
	run.hint = params.Note
	// Relocating starts from nothing: whatever was found before is exactly
	// what was wrong.
	if params.Mode == QuestionFull && p.question.Page != nil && (params.Page != nil || params.Note != "") {
		p.question.Standalone = false
		p.question.Page = nil
		p.question.QuestionRect = nil
	}
	if err := run.locateStage(ctx, p.question); err != nil {
		return err
	}
	h.Progress(1, 1)
	return nil
}

// phaseGuide writes the walkthrough, understanding notes and all.
func (p *pipeline) phaseGuide(ctx context.Context, h PhaseHandle) error {
	if err := h.Checkpoint(); err != nil {
		return err
	}
	run, err := p.questionRunFor(ctx, h)
	if err != nil {
		return err
	}
	h.Progress(0, 1)
	params := decodeQuestionParams(p.task.Params)
	run.instruction = params.Instruction
	if !p.question.Standalone && p.question.Page == nil {
		return &PermanentError{
			Message: "this question has no place in the book yet — find it first",
		}
	}
	if err := run.guideStage(ctx, p.question); err != nil {
		return err
	}
	h.Progress(1, 1)
	return nil
}

// questionRunFor builds the run context for a phase, wiring the stage notes
// the engine already emits into the phase's live note. That is the whole
// trick: the progress a student watches is the same stream the tutor chat
// used to show, put where it belongs.
func (p *pipeline) questionRunFor(ctx context.Context, h PhaseHandle) (*hwRunContext, error) {
	book, err := p.phaseBook(ctx)
	if err != nil {
		return nil, err
	}
	p.book = book
	settings, err := p.eng.Config(ctx)
	if err != nil {
		return nil, err
	}
	if !settings.ChatConfigured() {
		return nil, &LLMUnconfiguredError{}
	}
	run := p.questionRun(settings)
	run.emit = func(ev HomeworkEvent) error {
		if ev.Type == HwStage && ev.Note != "" {
			h.Note(ev.Note)
		}
		return nil
	}
	return run, nil
}

// EnqueueQuestion queues the work for one question, or returns the task
// already doing it. Clicking Rewrite twice does not write it twice.
func (e *Engine) EnqueueQuestion(ctx context.Context, questionID string, params questionParams) (*store.Task, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()
	return e.enqueueQuestion(ctx, s, questionID, params)
}

// enqueueQuestion is EnqueueQuestion on an open store, so the generation
// pass can fan out without reopening one per question.
func (e *Engine) enqueueQuestion(ctx context.Context, s *store.Store, questionID string, params questionParams) (*store.Task, error) {
	q, err := s.QuestionByID(ctx, questionID)
	if err != nil {
		return nil, err
	}
	if existing, err := s.TaskForQuestion(ctx, q.ID); err == nil {
		return existing, nil
	} else if !errors.Is(err, store.ErrNotFound) {
		return nil, err
	}

	hw, err := s.HomeworkByID(ctx, q.HomeworkID)
	if err != nil {
		return nil, err
	}
	settings, err := e.Config(ctx)
	if err != nil {
		return nil, err
	}
	// Configuration is checked before a task exists, never mid-queue: a task
	// must never sit waiting on a setting.
	if !settings.ChatConfigured() {
		return nil, &LLMUnconfiguredError{}
	}

	encoded, err := params.encode()
	if err != nil {
		return nil, err
	}
	hwID, qID := hw.ID, q.ID
	task := &store.Task{
		Kind:       store.TaskQuestion,
		BookID:     &hw.BookID,
		HomeworkID: &hwID,
		QuestionID: &qID,
		Params:     encoded,
	}
	if err := s.CreateTask(ctx, task); err != nil {
		return nil, userf(err, "could not queue question %d", q.Position)
	}
	// The row says so immediately: the outline should not look idle between
	// the click and the runner picking it up.
	q.Status = store.QuestionPending
	q.Error = ""
	if err := s.UpdateQuestionContent(ctx, q); err != nil {
		e.logger.Debug("mark question queued", "question", q.ID, "err", err)
	}
	e.publishTaskView(ctx, s, task)
	e.nudgeRunner()
	return task, nil
}

// Question reads one question's row — what the workspace re-renders after a
// repair is queued, and what a settled task leaves behind.
func (e *Engine) Question(ctx context.Context, questionID string) (*store.HomeworkQuestion, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()
	return s.QuestionByID(ctx, questionID)
}
