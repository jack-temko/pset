package homework

import (
	"context"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"sync"

	"github.com/jackt/pset/internal/agent"
	"github.com/jackt/pset/internal/cards"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/llm"
)

type questionPayload struct {
	QuestionID string `json:"questionId"`
}

// failure is a question failure in words for the student: it becomes the
// failed question's one line, as written.
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

func fail(kind Failure, err error, format string, args ...any) error {
	return &failure{kind: kind, msg: fmt.Sprintf(format, args...), err: err}
}

// modelDown is what a failed model call means to the student, about the
// question it was for: the page names the kind, this says what happened.
func modelDown(err error, q row) error {
	trouble, status := llm.Classify(err)
	switch trouble {
	case llm.TroubleCut:
		return fail(FailureGeneration, err, "The walkthrough for %s stopped partway: the connection to the chat model dropped. Trying again usually works.", problemName(q))
	case llm.TroubleRejected:
		return fail(FailureSetup, err, "%s Check the chat connection in Settings, then try again.", llm.Refusal(status))
	}
	return fail(FailureUnavailable, err, "Your chat model provider didn't answer, or is busy right now. Nothing is wrong with %s: try again in a minute.", problemName(q))
}

// problemName is a question as a sentence names it: "problem 4.44", or
// "this question" when it has no number.
func problemName(q row) string {
	for _, l := range []string{q.Label, q.Text} {
		if label, ok := questionLabel(l); ok {
			return "problem " + label
		}
	}
	return "this question"
}

// nextStep is the job for what a question needs next: finding it, while
// it's in the book and not yet found, else writing its guide.
func nextStep(id string, find bool) jobs.Spec {
	p := questionPayload{QuestionID: id}
	if find {
		return jobs.Spec{Kind: JobLocate, Subject: id, Priority: locateFirst, Payload: p}
	}
	return jobs.Spec{Kind: JobGuide, Subject: id, Payload: p}
}

// readStep is the job that reads a found question's figures. It runs
// with the finds, ahead of every guide, so a set's readings are there to
// check while its guides wait.
func readStep(id string) jobs.Spec {
	return jobs.Spec{Kind: JobRead, Subject: id, Priority: locateFirst, Payload: questionPayload{QuestionID: id}}
}

// waiting is the state a question waits for its next step in: a found
// one waits for its guide as located, anything else as pending.
func waiting(q row) State {
	if q.Page != nil {
		return StateLocated
	}
	return StatePending
}

// runLocate is a question's first step: find it in the book, then queue
// its guide.
func (s *Service) runLocate(ctx context.Context, j jobs.Job) error {
	return s.runStep(ctx, j, s.find)
}

// runRead is a found question's step when it has figures: read them
// into words, then queue its guide.
func (s *Service) runRead(ctx context.Context, j jobs.Job) error {
	return s.runStep(ctx, j, s.read)
}

// runGuide is a question's last step: write its hint and walkthrough.
func (s *Service) runGuide(ctx context.Context, j jobs.Job) error {
	return s.runStep(ctx, j, s.write)
}

// runStep runs one step of a question's job and settles what it leaves:
// a question stopped on shutdown goes back to waiting (its job resumes on
// the next run), and a failure is the question's, in words.
func (s *Service) runStep(ctx context.Context, j jobs.Job, step func(context.Context, model, Book, row) error) error {
	var p questionPayload
	if err := j.Decode(&p); err != nil {
		return err
	}
	q, err := getQuestion(ctx, s.c.DB, p.QuestionID)
	if errors.Is(err, errNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	err = s.withModel(ctx, q, step)
	settle := context.WithoutCancel(ctx)
	switch {
	case err == nil:
		return nil
	case jobs.Stopped(ctx):
		return err // removed; nothing left to update
	case ctx.Err() != nil:
		// Shutting down: the step runs again on the next start. A find
		// starts over; a guide carries on from its last saved round.
		s.setState(settle, q.ID, waiting(q), "")
		return err
	}
	f := &failure{kind: FailureGeneration, msg: fmt.Sprintf("Something went wrong writing the walkthrough for %s. Trying again usually works.", problemName(q))}
	errors.As(err, &f)
	slog.Warn("question failed", "question", q.ID, "kind", j.Kind, "err", err)
	s.setFailed(settle, q.ID, f.kind, f.msg)
	return err
}

// setFailed marks a question failed: what kind, and in words.
func (s *Service) setFailed(ctx context.Context, id string, kind Failure, reason string) {
	if _, err := s.c.DB.ExecContext(ctx, `UPDATE questions SET state = 'failed', failure = ?, reason = ?, activity = '', updated_at = ? WHERE id = ?`,
		kind, reason, db.Now(), id); err != nil {
		slog.Error("question: set failed", "question", id, "err", err)
		return
	}
	s.publishQuestion(ctx, id)
}

func (s *Service) setState(ctx context.Context, id string, st State, reason string) {
	if _, err := s.c.DB.ExecContext(ctx, `UPDATE questions SET state = ?, reason = ?, activity = '', updated_at = ? WHERE id = ?`,
		st, reason, db.Now(), id); err != nil {
		slog.Error("question: set state", "question", id, "err", err)
		return
	}
	s.publishQuestion(ctx, id)
}

// withModel runs a step with the question's book and the chat model, or
// fails it readably when there's no model to run it with.
func (s *Service) withModel(ctx context.Context, q row, step func(context.Context, model, Book, row) error) error {
	book, err := s.c.Library.Book(ctx, q.BookID)
	if err != nil {
		return err
	}
	cfg, err := s.c.Settings.LLM(ctx)
	if err != nil {
		return err
	}
	if !cfg.ChatReady() {
		return fail(FailureSetup, nil, "There's no chat model set up yet. Add one in Settings, under Connections, then try again.")
	}
	return step(ctx, model{client: llm.Open(cfg), name: cfg.ChatModel}, book, q)
}

// find locates a question and saves where it is and what it says. Its
// guide is queued in the same write, so a found question is never left
// without one.
func (s *Service) find(ctx context.Context, m model, book Book, q row) error {
	// A run starts its memory lines over: a requeued one left some.
	if _, err := s.c.DB.ExecContext(ctx, `UPDATE questions SET memory = '[]' WHERE id = ?`, q.ID); err != nil {
		return err
	}
	s.setState(ctx, q.ID, StateLocating, "")
	// Boxed by the student: read where they showed, nothing to look for.
	locate := s.locate
	if len(q.Boxes) > 0 {
		locate = s.fromBoxes
	}
	loc, err := locate(ctx, m, book, q)
	if err != nil {
		return err
	}
	label := q.Label
	if loc.Label != "" {
		label = loc.Label
	}
	statement := loc.Statement
	if statement == "" {
		statement = q.Text
	}
	s.sawProblem(ctx, book, q, loc)
	err = db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `UPDATE questions SET page = ?, label = ?, statement = ?, rect = ?, figures = ?, rounds = '[]', reading = '[]', reading_edited = 0, state = ?, activity = '', updated_at = ? WHERE id = ?`,
			loc.Page, label, statement, mustJSON(loc.Rect), mustJSON(loc.Figures), StateLocated, db.Now(), q.ID); err != nil {
			return err
		}
		next := nextStep(q.ID, false)
		if len(loc.Figures) > 0 {
			next = readStep(q.ID)
		}
		_, err := s.c.Queue.Enqueue(ctx, tx, next)
		return err
	})
	if err != nil {
		return err
	}
	// No Wake: the guide waits for this job's slot, and settling wakes
	// the queue.
	s.publishQuestion(ctx, q.ID)
	return nil
}

// read reads a found question's figures into words, then queues its
// guide, which is written from them. A reading that fails leaves none,
// and the guide reads the figures itself, as it did before readings: a
// question never fails over its reading.
func (s *Service) read(ctx context.Context, m model, book Book, q row) error {
	s.setState(ctx, q.ID, StateReading, "")
	lines, err := s.readFigures(ctx, m, book, q)
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		slog.Warn("question: reading the figures", "question", q.ID, "err", err)
		lines = nil
	}
	err = db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `UPDATE questions SET reading = ?, reading_edited = 0, state = ?, activity = '', updated_at = ? WHERE id = ?`,
			mustJSON(orEmpty(lines)), StateLocated, db.Now(), q.ID); err != nil {
			return err
		}
		_, err := s.c.Queue.Enqueue(ctx, tx, nextStep(q.ID, false))
		return err
	})
	if err != nil {
		return err
	}
	s.publishQuestion(ctx, q.ID)
	return nil
}

// readFigures is a reading of a question's figures, one fact a line:
// read three times, quickly and at once, then settled into one with more
// thought. On the nine circuits of a real problem set a single quick
// reading got a node or a direction wrong about one time in four, never
// the same way twice; settled, the hardest five came out right ten times
// in ten. A reading that fails is left out, and when the settling fails
// the first reading stands. None when there are no figures to read.
func (s *Service) readFigures(ctx context.Context, m model, book Book, q row) ([]string, error) {
	if q.Page == nil {
		return nil, nil
	}
	figs := s.figureParts(ctx, book, q)
	if len(figs) == 0 {
		return nil, nil
	}
	ask := func(system, effort string, extra ...llm.Part) (string, error) {
		content := llm.PartsContent(llm.TextPart(fmt.Sprintf("The problem:\n\n%s\n\nIts figures follow.", q.Statement)))
		for _, p := range append(slices.Clone(figs), extra...) {
			content.AppendPart(p)
		}
		return m.client.ChatOnce(ctx, llm.ChatRequest{Model: m.name, ReasoningEffort: effort, Messages: []llm.Message{
			llm.TextMessage("system", system),
			{Role: "user", Content: content},
		}})
	}
	replies := make([]string, readings)
	errs := make([]error, readings)
	var wg sync.WaitGroup
	for i := range readings {
		wg.Add(1)
		go func() {
			defer wg.Done()
			replies[i], errs[i] = ask(readPrompt, "low")
		}()
	}
	wg.Wait()
	var read [][]string
	for i, r := range replies {
		if errs[i] != nil {
			continue
		}
		if lines := readingLines(r); len(lines) > 0 {
			read = append(read, lines)
		}
	}
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	if len(read) == 0 {
		return nil, errors.Join(errs...)
	}
	s.setActivity(ctx, q.ID, "Checking the reading…")
	var b strings.Builder
	for i, lines := range read {
		fmt.Fprintf(&b, "Reading %d:\n%s\n", i+1, bullets(lines))
	}
	settled, err := ask(settlePrompt, "", llm.TextPart(b.String()))
	if err != nil {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		slog.Warn("question: settling the reading", "question", q.ID, "err", err)
		return read[0], nil
	}
	if lines := readingLines(settled); len(lines) > 0 {
		return lines, nil
	}
	return read[0], nil
}

// readings is how many times a figure is read before the readings are
// settled into one.
const readings = 3

// Caps on a reading: a figure's facts run to a couple of dozen lines.
const (
	maxReadingLines = 80
	maxReadingLine  = 400
)

// readingLines is a reading as the model writes it, one fact a line
// after a "- ", as lines. Lines without a marker count only when none
// has one; blank ones never do.
func readingLines(text string) []string {
	var marked, plain []string
	for _, l := range strings.Split(text, "\n") {
		l = strings.TrimSpace(l)
		if l == "" || strings.HasPrefix(l, "```") {
			continue
		}
		if rest, ok := strings.CutPrefix(l, "- "); ok {
			marked = append(marked, strings.TrimSpace(rest))
		} else if rest, ok := strings.CutPrefix(l, "* "); ok {
			marked = append(marked, strings.TrimSpace(rest))
		} else {
			plain = append(plain, l)
		}
	}
	out := marked
	if len(out) == 0 {
		out = plain
	}
	if len(out) > maxReadingLines {
		out = out[:maxReadingLines]
	}
	return out
}

// bullets is a reading as the model reads it back: a line each, marked.
func bullets(lines []string) string {
	var b strings.Builder
	for _, l := range lines {
		b.WriteString("- " + l + "\n")
	}
	return b.String()
}

func orEmpty(lines []string) []string {
	if lines == nil {
		return []string{}
	}
	return lines
}

// write writes a question's guide, found or never looked for.
func (s *Service) write(ctx context.Context, m model, book Book, q row) error {
	// A run starts its own memory lines over (a requeued one left some),
	// keeping the line the find wrote, unless it carries on a guide's
	// saved rounds: then the lines are theirs.
	kept := []MemoryLine{}
	for _, l := range q.Memory {
		if l.Use == MemoryUseFound {
			kept = append(kept, l)
		}
	}
	if _, err := s.c.DB.ExecContext(ctx, `UPDATE questions SET memory = ? WHERE id = ? AND rounds = '[]'`, mustJSON(kept), q.ID); err != nil {
		return err
	}
	s.setState(ctx, q.ID, StateWriting, "")
	return s.writeGuide(ctx, m, book, q)
}

// model is one chat connection and the model to ask.
type model struct {
	client *llm.Client
	name   string
}

// repair is the cards parser's one try at fixing an invalid card.
func (m model) repair(ctx context.Context, k cards.Kind, raw string, problems []string, schema string) (string, error) {
	return m.client.ChatOnce(ctx, llm.ChatRequest{Model: m.name, Messages: []llm.Message{
		llm.TextMessage("system", repairPrompt),
		llm.TextMessage("user", fmt.Sprintf("Kind: %s\n\nThe card:\n%s\n\nWhat's wrong:\n- %s\n\nIts schema:\n%s",
			k, raw, strings.Join(problems, "\n- "), schema)),
	}})
}

// pageImage is a page as a data URL for the model to look at.
func (s *Service) pageImage(ctx context.Context, bookID string, page, width int) (string, error) {
	data, err := s.c.Library.PageJPEG(ctx, bookID, page, width)
	if err != nil {
		return "", err
	}
	return "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(data), nil
}

// ---------------------------------------------------------------- guide

// Stage names, as the model writes them and the walkthrough shows them.
const (
	stageHint        = "Hint"
	stageWalkthrough = "Walkthrough"
)

// guideAttempts: a guide missing a part is asked for once more.
const guideAttempts = 2

// writeGuide streams the hint and the walkthrough, with the same tools
// Ask has: it searches and reads the book for the theory, looks at pages,
// and does its arithmetic with compute. The hint is saved and published
// the moment the walkthrough heading arrives, so the student can open it
// while the rest is still being written.
//
// Each tool round is saved as it finishes. A guide the app stopped
// partway, or one asked again after a failure, carries on from its last
// round rather than thinking the whole problem through again.
func (s *Service) writeGuide(ctx context.Context, m model, book Book, q row) error {
	user, shown, err := s.guideUser(ctx, book, q)
	if err != nil {
		return err
	}
	rounds, err := savedRounds(ctx, s.c.DB, q.ID)
	if err != nil {
		return err
	}
	for attempt := 1; attempt <= guideAttempts; attempt++ {
		msgs := append([]llm.Message{user}, rounds...)
		var parser *cards.Parser
		parser = cards.NewParser(ctx, cards.Options{
			Pages:    book.Pages,
			Repair:   m.repair,
			Sections: []string{stageHint, stageWalkthrough},
		}, cards.Handler{
			Section: func(name string) {
				if name != stageWalkthrough {
					return
				}
				if hint := tidy(parser.Section(stageHint)); len(hint) > 0 {
					s.saveStage(ctx, q.ID, "hint", hint)
				}
			},
		})
		loop := &agent.Loop{
			Client: m.client, Model: m.name, Library: s.c.Library,
			Book:   agent.Book{ID: book.ID, Title: book.Title, PageCount: book.PageCount, Pages: book.Pages},
			Rounds: guideRounds,
			System: guideSystem(),
			Memory: s.memory(),
			Remembered: func(n agent.Note, outcome string) {
				use := MemoryUseSaved
				if outcome == agent.Replaced {
					use = MemoryUseUpdated
				}
				s.addMemoryLine(ctx, q.ID, MemoryLine{MemoryID: n.ID, Use: use, Text: n.Text, Page: pageOrNil(n.Page)})
			},
			Step: func(label string, running bool) {
				if running {
					s.setActivity(ctx, q.ID, label)
				}
			},
			Writing: func() { s.setActivity(ctx, q.ID, "Writing the guide…") },
			Delta:   parser.Feed,
			Shown:   shown,
			Complete: func() bool {
				return len(parser.Section(stageHint)) > 0 && len(parser.Section(stageWalkthrough)) > 0
			},
			Round: func(all []llm.Message) {
				rounds = slices.Clone(all[1:])
				if _, err := s.c.DB.ExecContext(ctx, `UPDATE questions SET rounds = ? WHERE id = ?`, mustJSON(rounds), q.ID); err != nil {
					slog.Warn("question: save rounds", "question", q.ID, "err", err)
				}
			},
		}
		err := loop.Run(ctx, msgs)
		parser.Finish()
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return modelDown(err, q)
		}
		hint, walk := parser.Section(stageHint), parser.Section(stageWalkthrough)
		if len(hint) == 0 || len(walk) == 0 {
			slog.Warn("guide missing a part", "question", q.ID, "attempt", attempt, "hint", len(hint), "walkthrough", len(walk))
			continue
		}
		_, err = s.c.DB.ExecContext(ctx, `UPDATE questions SET hint = ?, walkthrough = ?, state = 'ready', reason = '', activity = '', rounds = '[]', updated_at = ? WHERE id = ?`,
			mustJSON(hint), mustJSON(walk), db.Now(), q.ID)
		if err != nil {
			return err
		}
		s.publishQuestion(ctx, q.ID)
		return nil
	}
	return fail(FailureGeneration, nil, "The walkthrough for %s came back missing a part. Trying again usually works.", problemName(q))
}

// guideRounds bounds the writer's tool rounds: enough to look up the
// theory and check every number, not enough to wander.
const guideRounds = 10

// memory is the loop's memory, or none: a nil Memory must stay a nil
// interface once it's an agent.Memory.
func (s *Service) memory() agent.Memory {
	if s.c.Memory == nil {
		return nil
	}
	return s.c.Memory
}

func pageOrNil(p int) *int {
	if p < 1 {
		return nil
	}
	return &p
}

// addMemoryLine puts a line under the question's walkthrough.
func (s *Service) addMemoryLine(ctx context.Context, id string, l MemoryLine) {
	if _, err := s.c.DB.ExecContext(ctx, `UPDATE questions SET memory = json_insert(memory, '$[#]', json(?)) WHERE id = ?`, mustJSON(l), id); err != nil {
		slog.Error("question: memory line", "question", id, "err", err)
		return
	}
	s.publishQuestion(ctx, id)
}

// problemLabel is the label of the problem a question names, as a range
// memory keys it ("3.36"), and its chapter.
func problemLabel(labels ...string) (string, int, bool) {
	for _, l := range labels {
		if label, ok := questionLabel(l); ok {
			if ch, ok := labelChapter(label); ok {
				return label, ch, true
			}
		}
	}
	return "", 0, false
}

// sawProblem tells memory where a located problem is, and says so under
// the walkthrough when a remembered range found it.
func (s *Service) sawProblem(ctx context.Context, book Book, q row, loc location) {
	if s.c.Memory == nil {
		return
	}
	if loc.FromMemory != nil {
		s.addMemoryLine(ctx, q.ID, MemoryLine{MemoryID: loc.FromMemory.MemoryID, Use: MemoryUseFound, Text: loc.FromMemory.Text})
	}
	label, chapter, ok := problemLabel(loc.Label, q.Label, q.Text)
	if !ok {
		return
	}
	if err := s.c.Memory.SawProblem(ctx, book.ID, book.Pages, chapter, label, loc.Page); err != nil {
		slog.Warn("question: remember problem", "question", q.ID, "err", err)
	}
}

// setActivity shows what the writer is doing on the walkthrough's working
// line.
func (s *Service) setActivity(ctx context.Context, id, label string) {
	if _, err := s.c.DB.ExecContext(ctx, `UPDATE questions SET activity = ? WHERE id = ?`, label, id); err != nil {
		return
	}
	s.publishQuestion(ctx, id)
}

func (s *Service) saveStage(ctx context.Context, id, stage string, segs []cards.Segment) {
	col := map[string]string{"hint": "hint", "walkthrough": "walkthrough"}[stage]
	if _, err := s.c.DB.ExecContext(ctx, `UPDATE questions SET `+col+` = ?, updated_at = ? WHERE id = ?`,
		mustJSON(segs), db.Now(), id); err != nil {
		slog.Error("question: save stage", "question", id, "err", err)
		return
	}
	s.publishQuestion(ctx, id)
}

// tidy is a section mid-stream as it will be stored: prose trimmed, blank
// prose dropped.
func tidy(segs []cards.Segment) []cards.Segment {
	var out []cards.Segment
	for _, s := range segs {
		if s.Type == cards.SegmentProse {
			s.Text = strings.Trim(s.Text, "\n")
			if strings.TrimSpace(s.Text) == "" {
				continue
			}
		}
		out = append(out, s)
	}
	return out
}

// guideUser is the writer's opening message, and the PDF pages it shows
// whole. A problem with figures gets its figures, cut from the page, and
// not the page: on a page of eight circuits the one that matters is a
// corner, and a model that can't make out which way a source points
// reasons for many minutes over it and still gets it wrong. view_page
// shows the whole page when the writer wants the rest.
func (s *Service) guideUser(ctx context.Context, book Book, q row) (llm.Message, []int, error) {
	var b strings.Builder
	fmt.Fprintf(&b, "The problem")
	if q.Label != "" && q.Label != q.Statement {
		fmt.Fprintf(&b, " (%s)", q.Label)
	}
	fmt.Fprintf(&b, ":\n\n%s\n", q.Statement)
	if !q.InBook {
		b.WriteString("\nIt isn't from the book: the student typed it in. Solve it from its own statement.\n")
	}

	var parts []llm.Part
	var shown []int
	if q.Page != nil {
		page := book.Pages.Name(*q.Page)
		if figs := s.figureParts(ctx, book, q); len(figs) > 0 {
			fmt.Fprintf(&b, "\nThe problem is on %s of %q. Its figures follow, cut from the page; view_page shows the whole page.\n", page, book.Title)
			b.WriteString(readingText(q))
			parts = figs
		} else {
			text, _ := s.c.Library.PageText(ctx, book.ID, *q.Page)
			fmt.Fprintf(&b, "\nThe problem is on %s of %q. Its text:\n\n%s\n", page, book.Title, clip(text, 3000))
			if url, err := s.pageImage(ctx, book.ID, *q.Page, 1400); err == nil {
				parts = append(parts, llm.TextPart(fmt.Sprintf("The problem's page, %s:", page)), llm.ImagePart(url))
				shown = append(shown, *q.Page)
			}
		}
	}
	if theory := s.theory(ctx, book, q); theory != "" {
		fmt.Fprintf(&b, "\nThe book is %q. Your memory points to these pages for this problem's theory; search and read it for anything more.\n%s", book.Title, theory)
	} else {
		fmt.Fprintf(&b, "\nThe book is %q: search and read it for the theory the problem rests on.\n", book.Title)
	}
	if len(parts) == 0 {
		return llm.TextMessage("user", b.String()), shown, nil
	}
	content := llm.PartsContent(llm.TextPart(b.String()))
	for _, p := range parts {
		content.AppendPart(p)
	}
	return llm.Message{Role: "user", Content: content}, shown, nil
}

// readingText is how the figures read, for the writer, which works from
// it rather than its own look at them: the reading was made with care
// and checked, and the student may have corrected it. Nothing when there
// isn't one.
func readingText(q row) string {
	if len(q.Reading) == 0 {
		return ""
	}
	lead := "How the figures read, checked line by line against them. Work from this reading, not your own look at the figures: where the two seem to disagree, the reading is right."
	if q.ReadingEdited {
		lead = "How the figures read, as the student corrected it. Work from this reading: it is the problem, even where you would read the figures differently."
	}
	return "\n" + lead + "\n" + bullets(q.Reading)
}

// figureParts is a question's figures as images, each under its label,
// cut as the walkthrough shows them but from a wider render. None when
// any fails to cut: a problem missing one of its figures is better read
// off the whole page.
func (s *Service) figureParts(ctx context.Context, book Book, q row) []llm.Part {
	var parts []llm.Part
	for _, f := range q.FigRect {
		img, err := s.crop(ctx, book.ID, f.on(q), f.Rect, modelCropWidth)
		if err != nil {
			slog.Warn("guide: figure crop", "question", q.ID, "figure", f.Label, "err", err)
			return nil
		}
		label := f.Label
		if label == "" {
			label = "A figure"
		}
		parts = append(parts, llm.TextPart(label+":"), llm.ImagePart("data:image/jpeg;base64,"+base64.StdEncoding.EncodeToString(img)))
	}
	return parts
}

// theoryPages bounds the pages memory puts in a guide's opening message.
const theoryPages = 2

// theoryDepth is how far down a search for the problem a remembered page
// may rank. A problem's words match the problem pages around it best, so
// the theory it rests on sits lower than a question's would.
const theoryDepth = 30

// theory is the text of the pages memory points to for a problem, so the
// writer starts with them instead of spending a round, and all the
// thinking a round costs, reading them. A page qualifies when a book
// memory names it, it's in the problem's chapter, and a search for the
// problem finds it: memory says the page is worth reading, the chapter
// and the search that it's this problem's.
func (s *Service) theory(ctx context.Context, book Book, q row) string {
	if s.c.Memory == nil || strings.TrimSpace(q.Statement) == "" {
		return ""
	}
	_, chapter, ok := problemLabel(q.Label, q.Text)
	if !ok {
		return ""
	}
	start, end, ok := book.span(fmt.Sprint(chapter))
	if !ok {
		return ""
	}
	notes, err := s.c.Memory.Notes(ctx, book.ID)
	if err != nil {
		return ""
	}
	named := map[int]bool{}
	for _, n := range notes {
		if n.Kind == "book" && n.Page >= start && n.Page <= end && (q.Page == nil || n.Page != *q.Page) {
			named[n.Page] = true
		}
	}
	if len(named) == 0 {
		return ""
	}
	hits, err := s.c.Library.Search(ctx, book.ID, q.Statement, theoryDepth)
	if err != nil {
		slog.Warn("guide: theory search", "question", q.ID, "err", err)
		return ""
	}
	var b strings.Builder
	n := 0
	for _, p := range hits {
		if !named[p] {
			continue
		}
		text, err := s.c.Library.PageText(ctx, book.ID, p)
		if err != nil || strings.TrimSpace(text) == "" {
			continue
		}
		fmt.Fprintf(&b, "\n%s:\n%s\n", book.Pages.Name(p), clip(text, 5000))
		if n++; n == theoryPages {
			break
		}
	}
	return b.String()
}

func clip(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
