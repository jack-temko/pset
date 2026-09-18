package engine

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/pdf"
	"github.com/jackt/pset/internal/store"
	"github.com/santhosh-tekuri/jsonschema/v6"
)

// Homework caps: one assignment stays one affordable job.
const (
	hwMaxQuestions    = 30
	hwMaxSourceBytes  = 20 << 10
	hwImageDPI        = 150
	hwGuideCandidates = 3
	// Bare exercise numbers embed close to noise, so fusion can crowd the
	// best exact-text matches out of the candidate top-k. That many FTS
	// leaders always stay in the pool; the vision call remains the
	// precision filter.
	hwFtsInsurance = 2
	// hwLocateAttempts is the locate rounds the candidate ladder gets
	// before the chapter sweep takes over. A round that widens (fresh or
	// deeper candidates after a rejection) is worth one retry; a same-set
	// reroll never was.
	hwLocateAttempts = 2
	// hwScanMaxHits caps the label-scan tier: the assigned statement is one
	// hit; the extras (answer keys, "rework Prob." cross-references) stay
	// in the pool for the vision call to judge.
	hwScanMaxHits = 5
	// The sweep reads a chapter's pages as images in batches of this size,
	// at most hwSweepBatches of them — a bounded last resort, not a crawl.
	hwSweepBatch   = 8
	hwSweepBatches = 2
	// A rejected pin widens the next round's candidate pool to this many.
	hwWidenCandidates = 8
	// standalone guides get no vision call, so a wider text-only net is cheap
	// and gives the model more pages worth citing.
	hwStandaloneGuideCandidates = 6
)

//go:embed schemas/homework-guide.schema.json
var homeworkGuideSchemaData []byte

var homeworkGuideSchema = sync.OnceValues(func() (*jsonschema.Schema, error) {
	doc, err := jsonschema.UnmarshalJSON(strings.NewReader(string(homeworkGuideSchemaData)))
	if err != nil {
		return nil, err
	}
	compiler := jsonschema.NewCompiler()
	if err := compiler.AddResource("homework-guide.schema.json", doc); err != nil {
		return nil, err
	}
	return compiler.Compile("homework-guide.schema.json")
})

// checkGuide validates a raw guide payload and returns it compacted.
func checkGuide(raw string) (json.RawMessage, error) {
	var value any
	if err := json.Unmarshal([]byte(raw), &value); err != nil {
		return nil, fmt.Errorf("not valid JSON: %w", err)
	}
	schema, err := homeworkGuideSchema()
	if err != nil {
		return nil, err
	}
	if err := schema.Validate(value); err != nil {
		return nil, fmt.Errorf("schema: %w", err)
	}
	var compacted bytes.Buffer
	if err := json.Compact(&compacted, []byte(raw)); err != nil {
		return nil, err
	}
	return json.RawMessage(compacted.Bytes()), nil
}

// guideFromRaw decodes a validated payload into the stored shape.
func guideFromRaw(payload json.RawMessage) (*store.HomeworkGuide, error) {
	g := &store.HomeworkGuide{}
	if err := json.Unmarshal(payload, g); err != nil {
		return nil, err
	}
	return g, nil
}

// --- events ---------------------------------------------------------------------

// HomeworkEventType names one typed unit of a homework command's streamed
// progress. These strings are the SSE wire names; the api layer maps them
// one to one. Generation progress itself flows through the job step stream.
type HomeworkEventType string

const (
	HwStage           HomeworkEventType = "stage"
	HwQuestion        HomeworkEventType = "question"
	HwQuestionRemoved HomeworkEventType = "question-removed"
	HwGuide           HomeworkEventType = "guide"
	HwDone            HomeworkEventType = "done"
	HwError           HomeworkEventType = "error"
)

// HomeworkEvent is one typed unit of a tutor command's streamed progress: a
// stage note, a question row added or changed, a guide landing, a question
// leaving the outline, or the run's end.
type HomeworkEvent struct {
	Type       HomeworkEventType
	Stage      string
	Note       string
	Question   *store.HomeworkQuestion
	QuestionID string
	Guide      *store.HomeworkGuide
	Message    string
}

// --- creation --------------------------------------------------------------------

// HomeworkCreate is a POST /api/homework body.
type HomeworkCreate struct {
	BookSHA256 string
	Title      string
	DueDate    *string
	SourceText string
}

// SubmitHomework validates the input, stores a generating assignment, and
// enqueues its generation task. Generation needs a chat model, so a missing
// connection is refused here rather than parked mid-run — nothing can ever
// sit waiting on configuration.
func (e *Engine) SubmitHomework(ctx context.Context, in HomeworkCreate) (*store.Homework, *store.Task, error) {
	settings, err := e.Config(ctx)
	if err != nil {
		return nil, nil, err
	}
	if !settings.ChatConfigured() {
		return nil, nil, &LLMUnconfiguredError{}
	}
	in.SourceText = strings.TrimSpace(in.SourceText)
	if in.SourceText == "" {
		return nil, nil, &UserError{Message: "the assignment text is empty"}
	}
	if len(in.SourceText) > hwMaxSourceBytes {
		return nil, nil, &UserError{Message: fmt.Sprintf(
			"the assignment text is over %d KB — split it into two assignments", hwMaxSourceBytes/1024)}
	}
	in.Title = strings.TrimSpace(in.Title)
	if len(in.Title) > titleMaxChars {
		in.Title = truncateTitle(in.Title, titleMaxChars)
	}
	if in.DueDate != nil && *in.DueDate == "" {
		in.DueDate = nil
	}

	s, err := e.openStore(ctx)
	if err != nil {
		return nil, nil, err
	}
	defer s.Close()

	book, err := e.resolveBook(ctx, s, in.BookSHA256)
	if err != nil {
		return nil, nil, err
	}
	// A book that is not ready cannot be a homework source: locating a
	// question needs its pages, its sections, and its search index.
	ready, err := s.Readiness(ctx, book.ID, settings.EmbedModel)
	if err != nil {
		return nil, nil, err
	}
	if !ready.Ready() {
		return nil, nil, &UserError{Message: fmt.Sprintf(
			"%q is still being prepared — wait for it to finish", book.Title)}
	}

	hw := &store.Homework{
		BookID:     book.ID,
		Title:      in.Title,
		DueDate:    in.DueDate,
		SourceText: in.SourceText,
	}
	if err := s.CreateHomework(ctx, hw); err != nil {
		return nil, nil, userf(err, "could not create the homework")
	}
	task := &store.Task{Kind: store.TaskHomework, BookID: &book.ID, HomeworkID: &hw.ID}
	if err := s.CreateTask(ctx, task); err != nil {
		return nil, nil, userf(err, "could not enqueue the homework task")
	}
	e.logger.Debug("homework enqueued", "task", task.ID, "homework", hw.ID, "book", book.Title)
	e.publishTaskView(ctx, s, task)
	e.nudgeRunner()
	return hw, task, nil
}

// Homeworks lists every assignment with book identity for the dashboard.
func (e *Engine) Homeworks(ctx context.Context) ([]store.HomeworkRef, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()
	return s.Homeworks(ctx)
}

// Homework returns one assignment with its book identity and ordered
// outline. Partials are visible mid-generation.
func (e *Engine) Homework(ctx context.Context, id string) (*store.HomeworkRef, []store.HomeworkQuestion, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, nil, err
	}
	defer s.Close()

	ref, err := s.HomeworkRefByID(ctx, id)
	if err != nil {
		return nil, nil, err
	}
	questions, err := s.Questions(ctx, id)
	if err != nil {
		return nil, nil, userf(err, "could not read the questions")
	}
	return ref, questions, nil
}

// HomeworkUpdate patches the mutable assignment fields; nil pointers keep
// theirs, an empty due-date string clears it. The print scales clamp to
// their ranges here so the stored row always reads as it renders.
func (e *Engine) UpdateHomework(ctx context.Context, id string, title, dueDate *string, turnedIn *bool, questionScale, figureScale *int) (*store.HomeworkRef, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	if title != nil {
		*title = strings.TrimSpace(*title)
		if *title == "" {
			return nil, &UserError{Message: "the title must not be empty"}
		}
	}
	if questionScale != nil {
		*questionScale = clampScalePercent(*questionScale, 40, 100)
	}
	if figureScale != nil {
		*figureScale = clampScalePercent(*figureScale, 50, 200)
	}
	if _, err := s.UpdateHomework(ctx, id, title, dueDate, turnedIn, questionScale, figureScale); err != nil {
		return nil, err
	}
	return s.HomeworkRefByID(ctx, id)
}

// DeleteHomework removes an assignment; its questions go with it.
func (e *Engine) DeleteHomework(ctx context.Context, id string) error {
	s, err := e.openStore(ctx)
	if err != nil {
		return err
	}
	defer s.Close()
	if err := s.DeleteHomework(ctx, id); err != nil {
		return err
	}
	return nil
}

// --- direct question mutations (no LLM) -------------------------------------------

// RemoveQuestion deletes one outline question, returning the removed row so
// a client's undo can re-create it verbatim.
func (e *Engine) RemoveQuestion(ctx context.Context, homeworkID, questionID string) (*store.HomeworkQuestion, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	if _, err := s.HomeworkByID(ctx, homeworkID); err != nil {
		return nil, err
	}
	q, err := s.QuestionByID(ctx, questionID)
	if err != nil {
		return nil, err
	}
	if q.HomeworkID != homeworkID {
		return nil, store.ErrNotFound
	}
	removed, err := s.DeleteQuestion(ctx, questionID)
	if err != nil {
		return nil, userf(err, "could not remove the question")
	}
	return removed, nil
}

// AddQuestion inserts a fully-formed question at the end of the outline —
// the undo target for RemoveQuestion.
func (e *Engine) AddQuestion(ctx context.Context, homeworkID string, q *store.HomeworkQuestion) (*store.HomeworkQuestion, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	hw, err := s.HomeworkByID(ctx, homeworkID)
	if err != nil {
		return nil, err
	}
	if hw.Status == store.HomeworkGenerating {
		return nil, &UserError{Message: "this homework is still generating"}
	}
	if q.Status == "" {
		q.Status = store.QuestionReady
	}
	q.HomeworkID = homeworkID
	q.ID = ""
	q.Position = 0
	if err := s.InsertQuestion(ctx, q); err != nil {
		return nil, userf(err, "could not add the question")
	}
	return q, nil
}

// MoveQuestion reorders one question to a 1-based position.
func (e *Engine) MoveQuestion(ctx context.Context, homeworkID, questionID string, position int) error {
	s, err := e.openStore(ctx)
	if err != nil {
		return err
	}
	defer s.Close()
	return s.MoveQuestion(ctx, homeworkID, questionID, position)
}

// --- generation pipeline ------------------------------------------------------------

// hwRunContext bundles what one homework question's model calls need.
type hwRunContext struct {
	eng            *Engine
	s              *store.Store
	book           *store.Book
	hwID           string
	client         *llm.Client
	embedModelName string
	emit           func(HomeworkEvent) error

	// Repair inputs. pinnedPage is a page the student named, which reduces
	// locating to finding the region on one page; hint is what they said was
	// wrong with the last attempt; instruction steers a rewrite.
	pinnedPage  *int
	hint        string
	instruction string
}

// emitEvent forwards to a direct sink (the tutor command stream) when one
// is subscribed; generation progress flows through the job steps instead.
func (r *hwRunContext) emitEvent(ev HomeworkEvent) {
	if r.emit != nil {
		_ = r.emit(ev)
	}
}

// taskHomework loads the assignment a task is generating.
func (p *pipeline) taskHomework(ctx context.Context) (*store.Homework, error) {
	if p.task.HomeworkID == nil {
		return nil, &PermanentError{Message: "this task lost track of its assignment"}
	}
	hw, err := p.s.HomeworkByID(ctx, *p.task.HomeworkID)
	if errors.Is(err, store.ErrNotFound) {
		return nil, &PermanentError{Message: "this task's assignment no longer exists"}
	}
	if err != nil {
		return nil, userf(err, "could not read the assignment of task %s", p.task.ID)
	}
	return hw, nil
}

// homeworkPlan declares the assignment's own work: read the pasted text into
// an outline, then queue one task per question. It deliberately stops there.
// The questions are independent, so each is its own task — and the runner is
// a single worker, so a parent that waited for its children would hold the
// only lane and they would never start.
func (p *pipeline) homeworkPlan(ctx context.Context) ([]PhaseSpec, error) {
	hw, err := p.taskHomework(ctx)
	if err != nil {
		return nil, err
	}
	p.hw = hw
	return []PhaseSpec{
		{Key: "extract", Name: "Read the assignment", Run: p.phaseExtract},
		{Key: "queue", Name: "Queue the questions", Run: p.phaseQueueQuestions},
	}, nil
}

// homeworkSettle applies the domain rule: an assignment stops saying
// "generating" the moment its task stops running, with whatever it has. A
// shutdown pause is the exception — that task is coming straight back.
func (p *pipeline) homeworkSettle(ctx context.Context, err error) error {
	hw, hwErr := p.taskHomework(context.WithoutCancel(ctx))
	if hwErr != nil {
		return err
	}
	var stopped *taskStopped
	resuming := errors.As(err, &stopped) && stopped.status == store.TaskQueued
	if !resuming {
		if serr := p.s.SetHomeworkStatus(context.WithoutCancel(ctx), hw.ID, store.HomeworkReady); serr != nil {
			p.eng.logger.Error("settle homework", "homework", hw.ID, "err", serr)
		}
	}
	return err
}

// phaseExtract runs the cheap text-only pass over the pasted assignment
// and stores one pending question per extracted entry. Re-runs after a
// crash see the stored questions and never extract twice.
func (p *pipeline) phaseExtract(ctx context.Context, h PhaseHandle) error {
	h.Progress(0, 1)
	h.Note("reading the assignment…")

	settings, err := p.eng.Config(ctx)
	if err != nil {
		return err
	}
	if !settings.ChatConfigured() {
		return &LLMUnconfiguredError{}
	}

	hw, err := p.s.HomeworkByID(ctx, p.hw.ID)
	if err != nil {
		return err
	}
	existing, err := p.s.Questions(ctx, hw.ID)
	if err != nil {
		return userf(err, "could not read the outline")
	}
	if len(existing) == 0 {
		run := p.questionRun(settings)
		reply, err := run.callJSON(ctx, extractSystemPrompt, hw.SourceText, nil, nil)
		if err != nil {
			return err
		}
		var parsed struct {
			Questions []struct {
				Text   string `json:"text"`
				Hint   string `json:"hint"`
				Source string `json:"source"`
			} `json:"questions"`
		}
		if err := json.Unmarshal([]byte(reply), &parsed); err != nil {
			return userf(err, "the model's question list was not valid JSON")
		}
		if len(parsed.Questions) == 0 {
			return &UserError{Message: "no questions were found in the pasted assignment text"}
		}
		if len(parsed.Questions) > hwMaxQuestions {
			parsed.Questions = parsed.Questions[:hwMaxQuestions]
		}
		for _, entry := range parsed.Questions {
			text := strings.TrimSpace(entry.Text)
			if text == "" {
				continue
			}
			q := &store.HomeworkQuestion{
				HomeworkID:    hw.ID,
				Status:        store.QuestionPending,
				Transcription: text,
				Standalone:    strings.EqualFold(strings.TrimSpace(entry.Source), "standalone"),
			}
			if hint := strings.TrimSpace(entry.Hint); hint != "" && !q.Standalone {
				q.Transcription = text + "\n(hint: " + hint + ")"
			}
			if err := p.s.InsertQuestion(ctx, q); err != nil {
				return userf(err, "could not store an extracted question")
			}
		}
	}
	h.Progress(1, 1)
	return nil
}

// phaseQueueQuestions gives every unwritten question its own task. It is
// idempotent by construction — enqueueQuestion returns the task a question
// already has — so a resumed assignment re-queues nothing it queued before.
//
// A question that cannot be queued does not sink the assignment: seventeen
// of eighteen is genuinely useful, so the refusal lands on that question's
// own row, where the repair doors are, and the rest go out.
func (p *pipeline) phaseQueueQuestions(ctx context.Context, h PhaseHandle) error {
	questions, err := p.s.Questions(ctx, p.hw.ID)
	if err != nil {
		return userf(err, "could not read the outline")
	}
	h.Progress(0, len(questions))
	for i := range questions {
		q := questions[i]
		if err := h.Checkpoint(); err != nil {
			return err
		}
		if q.Status == store.QuestionReady {
			h.Progress(i+1, len(questions))
			continue
		}
		h.Note(fmt.Sprintf("queueing question %d of %d…", q.Position, len(questions)))
		if _, err := p.eng.enqueueQuestion(ctx, p.s, q.ID, questionParams{Mode: QuestionFull}); err != nil {
			// An unconfigured connection is the assignment's problem, not one
			// question's: nothing would run, so say so once and stop.
			var unconfigured *LLMUnconfiguredError
			if errors.As(err, &unconfigured) {
				return err
			}
			p.failQuestionRow(ctx, &q, err)
			p.eng.logger.Debug("could not queue question", "question", q.ID, "err", err)
		}
		h.Progress(i+1, len(questions))
	}
	return nil
}

// questionRun builds the model-call context for one homework run.
func (p *pipeline) questionRun(settings Settings) *hwRunContext {
	return &hwRunContext{
		eng:            p.eng,
		s:              p.s,
		book:           p.book,
		hwID:           p.hw.ID,
		client:         p.eng.llmClient(settings),
		embedModelName: settings.EmbedModel,
	}
}

// failQuestionRow records a per-question failure on the outline row; the
// step loop owns the warning and the skipped status.
func (p *pipeline) failQuestionRow(ctx context.Context, q *store.HomeworkQuestion, err error) {
	q.Error = userMessage(err)
	q.Status = store.QuestionFailed
	if uerr := p.s.UpdateQuestionContent(ctx, q); uerr != nil {
		p.eng.logger.Error("persist failed question", "question", q.ID, "err", uerr)
	}
}

// locateStage pins one question to a book page and region. Candidates come
// down the ladder — the book's confirmed label fact, the label scan, then
// fused retrieval — one vision call per round with a self-check on every
// pin; a rejected pin forbids its page and widens the next round instead
// of rerolling the same handful. When the text tiers run out, the chapter
// sweep reads the section's pages as images, the one pass that still works
// when the text layer is noise.
func (r *hwRunContext) locateStage(ctx context.Context, q *store.HomeworkQuestion) error {
	if q.Standalone {
		// Self-contained: nothing to find in the book.
		q.Status = store.QuestionWriting
		return r.s.UpdateQuestionContent(ctx, q)
	}
	r.emitEvent(HomeworkEvent{Type: HwStage, Stage: "locate",
		Note: fmt.Sprintf("Locating question %d…", q.Position)})
	q.Status = store.QuestionLocating
	if err := r.s.UpdateQuestionContent(ctx, q); err != nil {
		return err
	}

	for attempt := 1; attempt <= hwLocateAttempts; attempt++ {
		cands, hint := r.attemptCandidates(ctx, q, attempt > 1)
		if len(cands) == 0 {
			break // no candidate anywhere in the text tiers
		}
		page, rect, diagrams, err := r.locateOnce(ctx, q, cands, hint)
		if err != nil {
			if !failedPin(err) {
				return err
			}
			continue // the round produced no usable pin; widen and go again
		}
		return r.acceptPin(ctx, q, page, rect, diagrams)
	}

	// The sweep is the last resort and never overrides a pinned page: the
	// student already said where to look.
	if r.pinnedPage == nil {
		if chapter, start, end, ok := r.sweepSpan(ctx, q); ok {
			_, hint := questionQuery(q.Transcription)
			for _, batch := range sweepBatches(start, end) {
				r.emitEvent(HomeworkEvent{Type: HwStage, Stage: "sweep",
					Note: fmt.Sprintf("Sweeping chapter %d, pages %d–%d…",
						chapter, batch[0], batch[len(batch)-1])})
				page, rect, diagrams, err := r.locateOnce(ctx, q, batch, hint)
				if err != nil {
					if !failedPin(err) {
						return err
					}
					continue // this batch shows nothing usable; try the next
				}
				return r.acceptPin(ctx, q, page, rect, diagrams)
			}
		}
	}
	return &UserError{Message: fmt.Sprintf(
		"couldn't find question %d in %q — tell it where to look, or set the page yourself",
		q.Position, r.book.Title)}
}

func (r *hwRunContext) attemptCandidates(ctx context.Context, q *store.HomeworkQuestion, widen bool) ([]int, string) {
	if r.pinnedPage != nil {
		return []int{*r.pinnedPage}, ""
	}
	return r.candidates(ctx, q, hwGuideCandidates, widen)
}

// failedPin reports whether an error from locateOnce means "this round
// produced no usable pin" — the model refused, went off the book, or drew
// no usable region — as opposed to a call failure, which keeps its own
// retry semantics.
func failedPin(err error) bool {
	var uerr *UserError
	return errors.As(err, &uerr)
}

// acceptPin persists a verified location and records what it taught.
func (r *hwRunContext) acceptPin(ctx context.Context, q *store.HomeworkQuestion, page int, rect *store.HomeworkRect, diagrams []store.HomeworkDiagram) error {
	q.Page = &page
	q.QuestionRect = rect
	q.Diagrams = diagrams
	q.Status = store.QuestionWriting
	if err := r.s.UpdateQuestionContent(ctx, q); err != nil {
		return err
	}
	r.eng.learnFromLocation(ctx, r.s, r.book, q)
	return nil
}

// locateOnce runs one locate round over the given candidate pages and
// returns the pin it produced. Errors split two ways: a UserError means no
// usable pin came out of what the model saw — it refused, named a page the
// book does not have, or drew no usable region — and the caller treats it
// as "this round found nothing"; anything else is a call failure and keeps
// its retry semantics.
func (r *hwRunContext) locateOnce(ctx context.Context, q *store.HomeworkQuestion, cands []int, hint string) (int, *store.HomeworkRect, []store.HomeworkDiagram, error) {
	var zero *store.HomeworkRect
	if len(cands) == 0 {
		return 0, zero, nil, &UserError{Message: fmt.Sprintf(
			"no page of %q matched question %d — the book may not contain it", r.book.Title, q.Position)}
	}
	if r.hint != "" {
		hint = strings.TrimSpace(hint + " " + r.hint)
	}

	pages, err := r.loadPages(ctx, cands)
	if err != nil {
		return 0, zero, nil, err
	}
	images, err := r.attachImages(ctx, pages)
	if err != nil {
		return 0, zero, nil, err
	}

	user := locateUserText(q, pages, hint)
	if preamble := r.eng.factsPreamble(ctx, r.s, r.book); preamble != "" {
		user = preamble + "\n" + user
	}
	if r.hint != "" {
		user = user + "\n\nThe student says: " + r.hint
	}
	reply, err := r.callJSON(ctx, locateSystemPrompt, user, pages, images)
	if err != nil {
		return 0, zero, nil, err
	}
	var pin struct {
		Page         int          `json:"page"`
		QuestionRect *pdfRectJSON `json:"question_rect"`
		Diagrams     []struct {
			Label string       `json:"label"`
			Rect  *pdfRectJSON `json:"rect"`
		} `json:"diagrams"`
	}
	if err := json.Unmarshal([]byte(reply), &pin); err != nil {
		return 0, zero, nil, userf(err, "the model's page location was not valid JSON")
	}
	if pin.Page == 0 {
		return 0, zero, nil, &UserError{Message: fmt.Sprintf(
			"no candidate page showed question %d — the book may not contain it", q.Position)}
	}
	if pin.Page < 0 || pin.Page > r.book.PageCount {
		return 0, zero, nil, &UserError{Message: fmt.Sprintf(
			"question %d was placed on page %d, which %q does not have", q.Position, pin.Page, r.book.Title)}
	}
	if pin.QuestionRect == nil || !pin.QuestionRect.rect().Valid() {
		return 0, zero, nil, &UserError{Message: fmt.Sprintf(
			"the model returned no usable region for question %d", q.Position)}
	}

	diagrams := []store.HomeworkDiagram{}
	for _, d := range pin.Diagrams {
		if d.Rect == nil || !d.Rect.rect().Valid() {
			continue
		}
		diagrams = append(diagrams, store.HomeworkDiagram{Label: strings.TrimSpace(d.Label), Rect: *d.Rect.rect()})
	}
	return pin.Page, pin.QuestionRect.rect(), diagrams, nil
}

// guideStage writes one question's walkthrough with the schema'd repair
// round, then marks it ready.
func (r *hwRunContext) guideStage(ctx context.Context, q *store.HomeworkQuestion) error {
	r.emitEvent(HomeworkEvent{Type: HwStage, Stage: "guide",
		Note: fmt.Sprintf("Writing the walkthrough for question %d…", q.Position)})

	var payload json.RawMessage
	var err error
	if q.Standalone {
		// No locating, but the guide should still cite the pages that teach
		// the material: retrieval picks them, and the writer may cite only
		// the pages it was given.
		cands, _ := r.candidates(ctx, q, hwStandaloneGuideCandidates, false)
		pages, pageErr := r.loadPages(ctx, cands)
		if pageErr != nil {
			return pageErr
		}
		payload, err = r.callJSONValidated(ctx, standaloneGuideSystemPrompt,
			r.withInstruction(standaloneGuideUserText(q, pages)), nil, nil, checkGuide)
		if err != nil {
			return err
		}
	} else {
		if q.Page == nil {
			return &UserError{Message: fmt.Sprintf("question %d has no page to write from", q.Position)}
		}
		page, pageErr := r.s.Page(ctx, r.book.ID, *q.Page)
		if errors.Is(pageErr, store.ErrNotFound) {
			return &UserError{Message: fmt.Sprintf("page %d has no stored text", *q.Page)}
		}
		if pageErr != nil {
			return userf(pageErr, "could not read page %d", *q.Page)
		}
		var images map[int]string
		images, err = r.attachImages(ctx, []store.Page{page})
		if err != nil {
			return err
		}
		payload, err = r.callJSONValidated(ctx, guideSystemPrompt,
			r.withInstruction(guideUserText(q, page)), []store.Page{page}, images, checkGuide)
		if err != nil {
			return err
		}
	}
	guide, err := guideFromRaw(payload)
	if err != nil {
		return err
	}
	q.Guide = guide
	q.Status = store.QuestionReady
	q.Error = ""
	if err := r.s.UpdateQuestionContent(ctx, q); err != nil {
		return err
	}
	r.emitEvent(HomeworkEvent{Type: HwGuide, QuestionID: q.ID, Guide: guide})
	r.emitEvent(HomeworkEvent{Type: HwQuestion, Question: q})
	return nil
}

// --- candidates and context -----------------------------------------------------------

// candidates picks the pages a locate call sees, exact before fuzzy: the
// book's confirmed label→page fact, then the label scan over stored page
// text, then the FTS + vector fusion — seeded as before with the
// printed-page offset and the hint's section start, with the best
// exact-text matches kept in the pool over a noisy vector half. Rejected
// pages never come back, and a widened round (a pin was already rejected)
// reaches deeper into the fused ranks instead of rerolling the same
// handful.
func (r *hwRunContext) candidates(ctx context.Context, q *store.HomeworkQuestion, limit int, widen bool) ([]int, string) {
	query, hint := questionQuery(q.Transcription)
	fts, err := r.s.SearchFTS(ctx, r.book.ID, query, searchDepth)
	if err != nil {
		fts = nil
	}
	exact := append([]int(nil), fts...)
	// A known page offset turns a printed page number the question cites
	// into a PDF page directly, with no search at all.
	if printed, ok := printedPageOf(q.Transcription); ok {
		if offset, known := r.eng.pageOffset(ctx, r.s, r.book.ID); known {
			if pdfPage := printed + offset; pdfPage >= 1 && pdfPage <= r.book.PageCount {
				fts = dedupPages(append([]int{pdfPage}, fts...))
			}
		}
	}
	if hint != "" {
		if sections, err := r.s.Sections(ctx, r.book.ID); err == nil {
			for _, sec := range sections {
				if strings.Contains(strings.ToLower(sec.Title), strings.ToLower(hint)) {
					fts = append([]int{sec.StartPage}, fts...)
				}
			}
		}
		fts = dedupPages(fts)
	}
	var vec []int
	if r.client.EmbedConfigured() {
		if ranks, err := r.eng.vectorSearch(ctx, r.s, r.book.ID, r.client, query, r.embedModelName); err == nil {
			vec = ranks
		}
	}
	pool := limit + hwFtsInsurance
	if widen {
		pool = hwWidenCandidates
	}
	merged := append(r.candidateHead(ctx, query), rrfMerge(fts, vec, limit)...)
	in := make(map[int]bool, len(merged))
	for _, p := range merged {
		in[p] = true
	}
	for _, p := range exact {
		if len(merged) >= pool {
			break
		}
		if !in[p] {
			in[p] = true
			merged = append(merged, p)
		}
	}
	out := make([]int, 0, len(merged))
	for _, p := range merged {
		if in[p] {
			in[p] = false
			out = append(out, p)
		}
	}
	if len(out) > pool {
		out = out[:pool]
	}
	return out, hint
}

// candidateHead assembles the ladder's exact tiers for a query: the page
// the book has already confirmed for its label, then the pages whose text
// opens a line with that label as a problem statement. Those pages are
// what retrieval keeps missing for label-only questions, where every rank
// it produces is noise.
func (r *hwRunContext) candidateHead(ctx context.Context, query string) []int {
	label, ok := questionLabel(query)
	if !ok {
		return nil
	}
	var head []int
	if page, ok := r.factLabelPage(ctx, label); ok {
		head = append(head, page)
	}
	pages, err := r.s.Pages(ctx, r.book.ID)
	if err != nil {
		return head
	}
	return append(head, labelScanPages(pages, label)...)
}

func dedupPages(pages []int) []int {
	seen := map[int]bool{}
	out := pages[:0]
	for _, p := range pages {
		if !seen[p] {
			seen[p] = true
			out = append(out, p)
		}
	}
	return out
}

// loadPages reads the stored text of the candidate pages, in order.
func (r *hwRunContext) loadPages(ctx context.Context, pages []int) ([]store.Page, error) {
	out := make([]store.Page, 0, len(pages))
	for _, n := range pages {
		p, err := r.s.Page(ctx, r.book.ID, n)
		if errors.Is(err, store.ErrNotFound) {
			continue
		}
		if err != nil {
			return nil, userf(err, "could not read page %d", n)
		}
		out = append(out, p)
	}
	return out, nil
}

// attachImages rasterizes pages to data URLs, one per page, skipping pages
// that fail to render.
func (r *hwRunContext) attachImages(ctx context.Context, pages []store.Page) (map[int]string, error) {
	images := make(map[int]string, len(pages))
	for _, p := range pages {
		if _, ok := images[p.Number]; ok {
			continue
		}
		url, err := r.eng.pageImageDataURL(ctx, r.book, p.Number)
		if err != nil {
			if ctx.Err() != nil {
				return nil, err
			}
			r.eng.logger.Debug("page image failed", "page", p.Number, "err", err)
			continue
		}
		images[p.Number] = url
	}
	return images, nil
}

// --- structured model calls -------------------------------------------------------------

// callJSON runs one non-streaming call and returns the reply with fences
// unwrapped. When validate is non-nil the reply must pass it, with one
// repair round before giving up.
func (r *hwRunContext) callJSON(ctx context.Context, system, user string, pages []store.Page, images map[int]string) (string, error) {
	messages := []llm.Message{llm.TextMessage("system", system)}
	messages = append(messages, r.userMessage(user, pages, images))
	reply, err := r.client.ChatOnce(ctx, llm.ChatRequest{Model: llm.ChatModel, Messages: messages})
	if err != nil {
		if ctx.Err() != nil {
			return "", ctx.Err()
		}
		return "", llmFail(err)
	}
	return unwrapFences(reply), nil
}

// callJSONValidated is callJSON with schema-style validation and one repair
// round carrying the validator's complaints.
func (r *hwRunContext) callJSONValidated(
	ctx context.Context,
	system, user string,
	pages []store.Page,
	images map[int]string,
	validate func(string) (json.RawMessage, error),
) (json.RawMessage, error) {
	reply, err := r.callJSON(ctx, system, user, pages, images)
	if err != nil {
		return nil, err
	}
	payload, verr := validate(reply)
	if verr == nil {
		return payload, nil
	}
	r.eng.logger.Debug("homework JSON repair", "err", verr)
	fixed, rerr := r.callJSON(ctx, repairSystemPrompt, fmt.Sprintf(repairPromptTemplate,
		"homework-guide", reply, strings.Join(validationErrorList(verr), "\n"),
		string(homeworkGuideSchemaData)), pages, images)
	if rerr != nil {
		return nil, verr
	}
	if payload, rerr = validate(fixed); rerr != nil {
		return nil, verr
	}
	return payload, nil
}

// userMessage builds the multimodal turn: the instruction text, then each
// candidate page labelled by number with its image next to it.
func (r *hwRunContext) userMessage(text string, pages []store.Page, images map[int]string) llm.Message {
	hasImages := false
	for _, p := range pages {
		if images[p.Number] != "" {
			hasImages = true
			break
		}
	}
	if !hasImages {
		return llm.TextMessage("user", text)
	}
	content := llm.PartsContent(llm.TextPart(text))
	for _, p := range pages {
		if url := images[p.Number]; url != "" {
			content.AppendPart(llm.TextPart(fmt.Sprintf("Page %d:", p.Number)))
			content.AppendPart(llm.ImagePart(url))
		}
	}
	return llm.Message{Role: "user", Content: content}
}

// pdfRectJSON is the wire form of a normalized rect inside a model reply.
type pdfRectJSON struct {
	X, Y, W, H float64
}

func (r *pdfRectJSON) rect() *store.HomeworkRect {
	if r == nil {
		return nil
	}
	return &store.HomeworkRect{X: r.X, Y: r.Y, W: r.W, H: r.H}
}

// --- prompts ------------------------------------------------------------------------------

const extractSystemPrompt = `You read the pasted text of one homework assignment and list its
questions.

Reply with only JSON, no prose and no code fences:
{"questions":[{"text":"...","hint":"...","source":"book"}]}

- One entry per question, in assignment order, keeping the wording.
- Parts (a), (b), (c) of one question stay in that question's text.
- hint names the chapter or section the assignment mentions (such as
  "Chapter 4" or "Section 2.3"); empty when the assignment names none.
- source is "book" when the question is tied to the book's content — an
  exercise, a figure, a theorem or a passage from it — and "standalone"
  when the question is self-contained: fully answerable from its own
  statement, whatever the book contains. Professor-written questions,
  definitions, opinion prompts, and calculations with all numbers given
  are standalone.
- No solutions, no commentary, at most 30 entries.`

const locateSystemPrompt = `You locate one textbook problem among candidate page images.

Reply with only JSON, no prose and no code fences:
{"page": 12, "question_rect": {"x": 0.1, "y": 0.2, "w": 0.8, "h": 0.3},
 "diagrams": [{"label": "Figure 2.7", "rect": {"x": 0.1, "y": 0.5, "w": 0.3, "h": 0.2}}]}

- Rect coordinates are fractions of the full page image, in [0, 1], with y
  measured from the top of the page.
- question_rect tightly bounds the problem statement text, including all
  of its parts and its answer space label, but no figure: a figure the
  statement embeds is cropped again as a diagram, so keeping it in the
  rect would show the same artwork twice.
- diagrams lists every figure the problem refers to — one embedded in the
  statement or a separate one — tightly bounded and labelled with the
  book's own figure name.
- Course assignments cite the chapter-end "Problems" run. When candidates
  include both such a page and a mid-chapter page carrying a worked
  "Practice Problem" of the same number, the assignment means the
  chapter-end problem: pin that page.
- If no candidate page contains the problem, reply {"page": 0}.`

const guideSystemPrompt = `You write the walkthrough for one textbook problem, for a student who
will work the solution themselves.

The user gives you the problem's page (text plus image) and its
transcription. Reply with only a JSON object, no prose and no code fences:

{"reading":{"given":["..."],"find":"...","figure":"..."},"setup":"...","hints":["..."],"steps":["..."],"equations":[{"title":"...","tex":"...","note":"..."}],"answer":"..."}

- reading: how you read the problem, before solving it. "given" lists the
  quantities and conditions you are taking as given, one short phrase each
  ("24 V source", "R_1 = 4 kΩ", "the switch closes at t = 0"). "find" is
  what the problem asks for, in one line. "figure" is how you read the
  figure — orientations, polarities, current directions, labels — in one or
  two sentences; leave it empty only when the problem has no figure. The
  student reads this box first to catch a misread before trusting anything
  below it, so state what you actually used, not what a typical problem
  would have.
- setup: two or three sentences that frame the problem and name the
  principle that solves it. No worked algebra here.
- hints: up to 4 nudges, each one sentence, in the order a reader wants
  them. No full steps.
- steps: the worked solution. Every solving move lives here and nowhere
  else: setting up each relation with this problem's quantities, the
  substitutions, the algebra, the arithmetic. One short sentence or
  equation per step, inline math in $...$ where it appears.
- equations: the governing relations, in symbolic form, that a student
  needs in front of them before starting — Ohm's law, KVL around a mesh,
  the definition being applied. They are the tools, not the work: state
  them with symbols, never with this problem's numbers substituted in, and
  never carry a partial or final result. If an equation would only make
  sense after some of the solving has happened, it is a step, not an
  equation. Two or three is usually right; none is fine when the steps
  need no stated relation. Bare LaTeX (no $, no $$, no \displaystyle).
  Their "note" strings are prose saying when the relation applies or what
  each symbol is; any math in a note goes inline in $...$, exactly as in
  steps — never a bare I_1.
- answer: the final result in one line.
- Cite the page the content came from as [p. N] where it supports a claim;
  citations live only in text fields, never inside a "tex" string.
- Only use what the page and the problem show: if the page is unreadable,
  say so in setup rather than inventing content.`

const standaloneGuideSystemPrompt = `You write the walkthrough for one homework problem that is
self-contained: everything needed to solve it is in the problem statement,
which does not come from the book.

Reply with only a JSON object, no prose and no code fences:

{"reading":{"given":["..."],"find":"...","figure":"..."},"setup":"...","hints":["..."],"steps":["..."],"equations":[{"title":"...","tex":"...","note":"..."}],"answer":"..."}

- reading: how you read the problem, before solving it. "given" lists the
  quantities and conditions you are taking as given, one short phrase each.
  "find" is what the problem asks for, in one line. "figure" is how you read
  any figure described in the statement; leave it empty when there is none.
  The student reads this box first to catch a misread, so state what you
  actually used.
- setup: two or three sentences that frame the problem and name the
  principle, definition, or reasoning that settles it.
- hints: up to 4 nudges, each one sentence, in the order a reader wants
  them. No full steps.
- steps: the worked solution. Every solving move lives here and nowhere
  else: the setup, the substitutions, the algebra, the arithmetic. One
  short sentence or equation per step, inline math in $...$ where it
  appears.
- equations: the governing relations, in symbolic form, that a student
  needs in front of them before starting — the law, identity, or
  definition being applied. They are the tools, not the work: symbols
  only, never this problem's numbers substituted in, and never a partial
  or final result. An equation that only makes sense after some solving
  has happened is a step, not an equation. Bare LaTeX (no $, no $$, no
  \displaystyle). Their "note" strings are prose saying when the relation
  applies or what each symbol is; any math in a note goes inline in $...$,
  exactly as in steps — never a bare I_1.
- answer: the final result in one line.
- Solve from the problem statement and standard results.
- The context may include book pages that teach the material. When one of
  them states the principle or shows the method, cite it inline as [p. N]
  right where it supports a claim — a student can then jump to the text.
  Cite only pages the context actually provides, never from memory; when
  the context is empty or unrelated, cite nothing.`

// standaloneGuideUserText carries the problem plus the candidate pages the
// writer is allowed to cite.
func standaloneGuideUserText(q *store.HomeworkQuestion, pages []store.Page) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Problem (position %d in the assignment; standalone):\n\n%s\n", q.Position, q.Transcription)
	writeUnderstandingNotes(&b, q)
	if len(pages) > 0 {
		b.WriteString("\nBook pages that may teach the material — cite them as [p. N] where they help:\n")
		for _, p := range pages {
			text := p.Text
			if len(text) > 1200 {
				text = text[:1200]
			}
			fmt.Fprintf(&b, "\nPage %d:\n%s\n", p.Number, text)
		}
	} else {
		b.WriteString("\nNo book pages matched this problem; cite nothing.")
	}
	return b.String()
}

func locateUserText(q *store.HomeworkQuestion, pages []store.Page, hint string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Find where the book covers this problem:\n\n%s\n", q.Transcription)
	if hint != "" {
		fmt.Fprintf(&b, "\nThe assignment says it comes from %q.\n", hint)
	}
	for _, p := range pages {
		text := p.Text
		if len(text) > 1200 {
			text = text[:1200]
		}
		fmt.Fprintf(&b, "\nPage %d text:\n%s\n", p.Number, text)
	}
	b.WriteString("\nThe same pages are attached as images, each labelled with its page number.")
	return b.String()
}

func guideUserText(q *store.HomeworkQuestion, page store.Page) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Problem (position %d in the assignment):\n\n%s\n\n", q.Position, q.Transcription)
	writeUnderstandingNotes(&b, q)
	fmt.Fprintf(&b, "The book's page %d follows, as extracted text and as an image:\n\n%s",
		page.Number, page.Text)
	return b.String()
}

// writeUnderstandingNotes carries the student's corrections into a guide
// (re)write: a note exists precisely because the book page alone misleads.
func writeUnderstandingNotes(b *strings.Builder, q *store.HomeworkQuestion) {
	if len(q.UnderstandingNotes) == 0 {
		return
	}
	b.WriteString("How the student says this problem must be read (authoritative over the page):\n")
	for _, n := range q.UnderstandingNotes {
		fmt.Fprintf(b, "- %s\n", n.Note)
	}
	b.WriteString("\n")
}

// pageImageDataURL rasterizes one page of a book as a data URL for the model.
func (e *Engine) pageImageDataURL(ctx context.Context, book *store.Book, n int) (string, error) {
	jpegBytes, err := pdf.PageImage(ctx, book.FilePath, n, hwImageDPI)
	if err != nil {
		return "", err
	}
	return "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(jpegBytes), nil
}

// oneLine flattens a transcription to one line for the command context.
func oneLine(s string) string {
	s = strings.ReplaceAll(s, "\n", " ")
	if len(s) > 200 {
		s = s[:200] + "…"
	}
	return s
}

// withInstruction appends a rewrite instruction the student gave, so a redo
// can be steered rather than merely repeated.
func (r *hwRunContext) withInstruction(user string) string {
	if r.instruction == "" {
		return user
	}
	return user + "\n\nThe student asked for this specifically: " + r.instruction
}
