package homework

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"sync"

	"github.com/jackt/pset/internal/agent"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/doc"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/usage"
)

type questionPayload struct {
	QuestionID string `json:"questionId"`
	// Run is the run this step belongs to, set by the step that queued it
	// (a find queues a figure read and a guide in its own run); empty for
	// a step that starts one (a retry, a rewrite after notes), which then
	// takes its own job's id.
	Run string `json:"run,omitempty"`
}

// chained is a step queued from inside a run: the same run as the one
// queuing it.
func chained(spec jobs.Spec, run string) jobs.Spec {
	if p, ok := spec.Payload.(questionPayload); ok {
		p.Run = run
		spec.Payload = p
	}
	return spec
}

// stageOf is what a question's job step is called in the usage modal.
func stageOf(kind string, boxed bool) string {
	switch kind {
	case JobRead:
		return "Figures"
	case JobGuide:
		return "Guide"
	}
	if boxed {
		return "Boxed read"
	}
	return "Find"
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
	// One session per step of a question, so a guide's rounds and repairs
	// read as one conversation on OpenRouter. Every call the step makes
	// was spent on this question.
	ctx = llm.WithSession(ctx, fmt.Sprintf("question-%s-%s", p.QuestionID, j.Kind))
	ctx = llm.WithSubject(ctx, llm.Subject{Type: usage.SubjectQuestion, ID: p.QuestionID})
	run := p.Run
	if run == "" {
		run = j.ID
	}
	ctx = llm.WithRun(ctx, run)
	q, err := getQuestion(ctx, s.c.DB, p.QuestionID)
	if errors.Is(err, errNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	ctx = llm.WithStage(ctx, stageOf(j.Kind, len(q.Boxes) > 0))
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
		s.setState(settle, q.ID, waiting(q))
		return err
	}
	// A find that didn't see the question, and boxes that couldn't be read,
	// are their own outer entry; anything else is the step that failed.
	failed := err
	if !errors.Is(err, notFoundInBook) && !errors.Is(err, boxesUnreadable) {
		outer := map[string]*errs.Entry{JobLocate: findFailed, JobRead: figureReadFailed}[j.Kind]
		if outer == nil {
			outer = guideFailed
		}
		failed = outer.Wrap(err, "name", problemName(q))
	}
	v := errs.Report(settle, failed, errs.Where{Route: "job " + j.Kind, Book: q.BookID, Set: q.HomeworkID, Question: q.ID})
	s.setFailed(settle, q.ID, &v)
	return err
}

// setFailed marks a question failed, with the catalog error that says why.
func (s *Service) setFailed(ctx context.Context, id string, v *errs.View) {
	if _, err := s.c.DB.ExecContext(ctx, `UPDATE questions SET state = 'failed', error = ?, activity = '', failed_at = ?, updated_at = ? WHERE id = ?`,
		v.Stored().Marshal(), db.Now(), db.Now(), id); err != nil {
		slog.Error("question: set failed", "question", id, "err", err)
		return
	}
	s.announceQuestion(ctx, id)
	// A find that failed was the last one the set was waiting on, maybe.
	var set string
	if s.c.DB.QueryRowContext(ctx, `SELECT homework_id FROM questions WHERE id = ?`, id).Scan(&set) == nil {
		s.rankWhenFound(ctx, set)
	}
}

func (s *Service) setState(ctx context.Context, id string, st State) {
	if _, err := s.c.DB.ExecContext(ctx, `UPDATE questions SET state = ?, error = '', activity = '', updated_at = ? WHERE id = ?`,
		st, db.Now(), id); err != nil {
		slog.Error("question: set state", "question", id, "err", err)
		return
	}
	s.announceQuestion(ctx, id)
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
		return llm.KeyMissing.New()
	}
	return step(ctx, model{client: llm.Open(cfg), name: cfg.ChatModel}, book, q)
}

// find locates a question and saves where it is and what it says. Its
// guide is queued in the same write, so a found question is never left
// without one.
func (s *Service) find(ctx context.Context, m model, book Book, q row) error {
	s.setState(ctx, q.ID, StateLocating)
	// A reference the parser couldn't read, rewritten by the model in the
	// book's form first, if it can be.
	next, err := s.rewriteReference(ctx, m, book, q)
	if err != nil {
		return err
	}
	if next != nil {
		q = *next
	}
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
	err = db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `UPDATE questions SET page = ?, label = ?, statement = ?, rect = ?, figures = ?, rounds = '[]', reading = '[]', reading_edited = 0, reading_doubts = '[]', state = ?, activity = '', updated_at = ? WHERE id = ?`,
			loc.Page, label, mustJSON(runsOf(statement)), mustJSON(loc.Rect), mustJSON(loc.Figures), StateLocated, db.Now(), q.ID); err != nil {
			return err
		}
		next := nextStep(q.ID, false)
		if len(loc.Figures) > 0 {
			next = readStep(q.ID)
		}
		next = chained(next, llm.RunOf(ctx))
		_, err := s.c.Queue.Enqueue(ctx, tx, next)
		return err
	})
	if err != nil {
		return err
	}
	// No Wake: the guide waits for this job's slot, and settling wakes
	// the queue.
	s.announceQuestion(ctx, q.ID)
	// With the last of the set found, it can be ranked.
	s.rankWhenFound(ctx, q.HomeworkID)
	return nil
}

// read reads a found question's figures into words, then queues its
// guide, which is written from them. A reading that fails leaves none,
// and the guide reads the figures itself, as it did before readings: a
// question never fails over its reading.
func (s *Service) read(ctx context.Context, m model, book Book, q row) error {
	s.setState(ctx, q.ID, StateReading)
	lines, doubts, err := s.readFigures(ctx, m, book, q, "")
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		slog.Warn("question: reading the figures", "question", q.ID, "err", err)
		lines, doubts = nil, nil
	}
	err = db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `UPDATE questions SET reading = ?, reading_edited = 0, reading_doubts = ?, state = ?, activity = '', updated_at = ? WHERE id = ?`,
			mustJSON(runLists(orEmpty(lines))), mustJSON(runLists(orEmpty(doubts))), StateLocated, db.Now(), q.ID); err != nil {
			return err
		}
		_, err := s.c.Queue.Enqueue(ctx, tx, chained(nextStep(q.ID, false), llm.RunOf(ctx)))
		return err
	})
	if err != nil {
		return err
	}
	s.announceQuestion(ctx, q.ID)
	return nil
}

// readFigures is a reading of a question's figures, one fact a line, by
// the Reader, and where its readings disagreed: read three times, quickly
// and at once, then settled into one with more thought. The settling
// says what it settled; readings that agree are nearly always right, and
// ones that don't nearly always hold a wrong one, so those points are
// the student's to check (design/backend.md, "Models"). On the nine circuits of a real problem set a single quick
// reading got a node or a direction wrong about one time in four, never
// the same way twice; settled, the hardest five came out right ten times
// in ten. A reading that fails is left out, and when the settling fails
// the first reading stands. None when there are no figures to read.
func (s *Service) readFigures(ctx context.Context, m model, book Book, q row, focus string) (lines, doubts []string, err error) {
	if q.Page == nil {
		return nil, nil, nil
	}
	figs := s.figureParts(ctx, book, q)
	if len(figs) == 0 {
		return nil, nil, nil
	}
	ask := func(system, effort string, extra ...llm.Part) (string, error) {
		content := llm.PartsContent(llm.TextPart(fmt.Sprintf("The problem:\n\n%s\n\nIts figures follow.", source(q.Statement))))
		for _, p := range append(slices.Clone(figs), extra...) {
			content.AppendPart(p)
		}
		if focus != "" {
			content.AppendPart(llm.TextPart("The tutor working from an earlier reading questioned this point: " + focus +
				"\nLook at it in the figures closely and read what they show. The earlier reading may have been right."))
		}
		return m.client.ChatOnce(ctx, llm.Reader.Ask(llm.ChatRequest{ReasoningEffort: effort, Messages: []llm.Message{
			llm.TextMessage("system", system),
			{Role: "user", Content: content},
		}}))
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
		return nil, nil, ctx.Err()
	}
	if len(read) == 0 {
		return nil, nil, errors.Join(errs...)
	}
	s.setActivity(ctx, q.ID, "Checking the reading…")
	var b strings.Builder
	for i, lines := range read {
		fmt.Fprintf(&b, "Reading %d:\n%s\n", i+1, bullets(lines))
	}
	settled, err := ask(settlePrompt, "", llm.TextPart(b.String()))
	if err != nil {
		if ctx.Err() != nil {
			return nil, nil, ctx.Err()
		}
		slog.Warn("question: settling the reading", "question", q.ID, "err", err)
		return read[0], nil, nil
	}
	reading, differed := splitDoubts(settled)
	if lines := readingLines(reading); len(lines) > 0 {
		return lines, doubtLines(differed), nil
	}
	return read[0], nil, nil
}

// splitDoubts parts a settled reading from the points where the readings
// differed, which follow a "Differed:" line.
func splitDoubts(settled string) (reading, differed string) {
	lines := strings.SplitAfter(settled, "\n")
	for i, l := range lines {
		t := strings.ToLower(strings.Trim(strings.TrimSpace(l), "*#_ "))
		if strings.HasPrefix(t, "differed") {
			return strings.Join(lines[:i], ""), strings.Join(lines[i+1:], "")
		}
	}
	return settled, ""
}

// doubtLines is the points the readings differed on, one a line; "None"
// is none.
func doubtLines(differed string) []string {
	var out []string
	for _, l := range readingLines(differed) {
		if strings.ToLower(strings.TrimRight(l, ".")) != "none" {
			out = append(out, l)
		}
	}
	return out
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
	s.setState(ctx, q.ID, StateWriting)
	hint, walk, err := s.writeGuide(ctx, m, book, q, "")
	if err != nil {
		return err
	}
	hint, walk = s.crossCheck(ctx, m, book, q, hint, walk)
	if _, err := s.c.DB.ExecContext(ctx, `UPDATE questions SET hint = ?, walkthrough = ?, state = 'ready', error = '', activity = '', rounds = '[]', updated_at = ? WHERE id = ?`,
		mustJSON(hint), mustJSON(walk), db.Now(), q.ID); err != nil {
		return err
	}
	s.announceQuestion(ctx, q.ID)
	return nil
}

// model is one chat connection and the model to ask.
type model struct {
	client *llm.Client
	name   string
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

// guideAttempts: a guide missing its hint or its answers is asked for
// once more.
const guideAttempts = 2

// writeGuide streams the guide, a document of blocks: a hint, then the
// walkthrough. It has the same tools Ask has: it searches and reads the
// book for the theory, looks at pages, and does its arithmetic with
// compute. The hint is saved and published the moment the block after it
// arrives, so the student can open it while the rest is still being
// written; the walkthrough is saved once its parts all have answers.
//
// Only the final round is the document: what the writer says on its way to
// a tool call is narration, and the parser forgets it. Each tool round is
// saved as it finishes. A guide the app stopped partway, or one asked
// again after a failure, carries on from its last round rather than
// thinking the whole problem through again.
//
// recheck, when set, is what the cross-check found: the guide is written
// again from the start with it, and its rounds aren't saved.
func (s *Service) writeGuide(ctx context.Context, m model, book Book, q row, recheck string) (hint, walk []doc.Block, err error) {
	user, shown, err := s.guideUser(ctx, book, q)
	if err != nil {
		return nil, nil, err
	}
	var rounds []llm.Message
	if recheck == "" {
		if rounds, err = savedRounds(ctx, s.c.DB, q.ID); err != nil {
			return nil, nil, err
		}
	} else {
		user.Content.AppendPart(llm.TextPart("\n" + recheck))
	}
	for attempt := 1; attempt <= guideAttempts; attempt++ {
		msgs := append([]llm.Message{user}, rounds...)
		hintSaved := false
		var parser *doc.Parser
		parser = doc.NewParser(ctx, doc.Options{
			Mode: doc.Guide, Pages: book.Pages, PageCount: book.PageCount, Model: m.client.Mechanical(m.name),
		}, doc.Handler{
			Block: func(doc.Block, bool) {
				// The hint is whole once a block comes after it.
				if hintSaved {
					return
				}
				hint, walk := doc.SplitGuide(parser.Blocks())
				if len(hint) > 0 && len(walk) > 0 {
					hintSaved = true
					s.saveStage(ctx, q.ID, "hint", hint)
				}
			},
		})
		loop := &agent.Loop{
			Extra:  s.readingCheck(m, book, q),
			Client: m.client, Model: m.name, Library: s.c.Library,
			Book:   agent.Book{ID: book.ID, Title: book.Title, PageCount: book.PageCount, Pages: book.Pages},
			Rounds: guideRounds,
			System: guideSystem(),
			Memory: s.c.Memory,
			Step: func(label string, running bool) {
				if running {
					s.setActivity(ctx, q.ID, label)
				}
			},
			Writing: func() { s.setActivity(ctx, q.ID, "Writing the guide…") },
			Delta:   parser.Feed,
			Aside: func() {
				parser.Reset()
				hintSaved = false
			},
			Shown: shown,
			Round: func(all []llm.Message) {
				if recheck != "" {
					return
				}
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
				return nil, nil, ctx.Err()
			}
			return nil, nil, err
		}
		if len(parser.Blocks()) > 0 {
			s.setActivity(ctx, q.ID, "Checking the guide…")
			parser.Finalize()
		}
		hint, walk := doc.SplitGuide(parser.Blocks())
		if len(hint) == 0 || len(doc.Answers(walk)) == 0 {
			slog.Warn("guide missing a part", "question", q.ID, "attempt", attempt, "blocks", len(parser.Blocks()), "hint", len(hint), "answers", len(doc.Answers(walk)))
			continue
		}
		slog.Info("guide written", "question", q.ID, "blocks", len(parser.Blocks()), "raw", parser.Failed(), "repairs", parser.RepairCalls(), "recheck", recheck != "")
		return hint, walk, nil
	}
	return nil, nil, guideIncomplete.New()
}

// readingCheck is the guide writer's check_reading: when it sees the
// figures show something the reading has wrong, the figures are read
// again, three times and settled, with that point looked at closely, and
// the new reading is saved and handed back to work from. On 4.71 the
// writer saw 120v_o where the reading had 12v_o and could only hedge.
// Once a guide; none when there's no reading to check, or the student
// wrote it.
func (s *Service) readingCheck(m model, book Book, q row) []agent.Tool {
	if len(q.Reading) == 0 || q.ReadingEdited || len(q.FigRect) == 0 {
		return nil
	}
	var once sync.Once
	return []agent.Tool{{Def: checkReadingTool, Run: func(ctx context.Context, args string) string {
		answer := "The figures were read again already. Work from that reading."
		once.Do(func() {
			var a struct {
				Concern string `json:"concern"`
			}
			cleanup.Log("question: read the tool arguments", json.Unmarshal([]byte(args), &a))
			s.setActivity(ctx, q.ID, "Reading the figures again…")
			lines, doubts, err := s.readFigures(ctx, m, book, q, strings.TrimSpace(a.Concern))
			if err != nil || len(lines) == 0 {
				answer = "The figures couldn't be read again. Work from the reading you have."
				return
			}
			if _, err := s.c.DB.ExecContext(ctx, `UPDATE questions SET reading = ?, reading_doubts = ?, updated_at = ? WHERE id = ? AND reading_edited = 0`,
				mustJSON(runLists(lines)), mustJSON(runLists(orEmpty(doubts))), db.Now(), q.ID); err != nil {
				slog.Warn("guide: save the checked reading", "question", q.ID, "err", err)
			}
			s.announceQuestion(ctx, q.ID)
			answer = "The figures, read again with that point looked at closely. Work from this reading, not the first one:\n" + bullets(lines)
			if len(doubts) > 0 {
				answer += "Where the readings differed, now settled:\n" + bullets(doubts)
			}
		})
		return answer
	}}}
}

var checkReadingTool = llm.NewTool("check_reading",
	"Have the figures read again, carefully, when they plainly show something the reading has wrong: a value, a direction, which end is +, what joins to what. Say what you see and what the reading says. Returns the figures read again, which you then work from. Once a guide.",
	json.RawMessage(`{"type":"object","properties":{"concern":{"type":"string","description":"What the figure shows and what the reading says instead."}},"required":["concern"]}`))

// guideRounds bounds the writer's tool rounds: enough to look up the
// theory and check every number, not enough to wander.
const guideRounds = 10

// setActivity shows what the writer is doing on the walkthrough's working
// line.
func (s *Service) setActivity(ctx context.Context, id, label string) {
	if _, err := s.c.DB.ExecContext(ctx, `UPDATE questions SET activity = ? WHERE id = ?`, label, id); err != nil {
		return
	}
	s.announceQuestion(ctx, id)
}

func (s *Service) saveStage(ctx context.Context, id, stage string, blocks []doc.Block) {
	col := map[string]string{"hint": "hint", "walkthrough": "walkthrough"}[stage]
	if _, err := s.c.DB.ExecContext(ctx, `UPDATE questions SET `+col+` = ?, updated_at = ? WHERE id = ?`,
		mustJSON(blocks), db.Now(), id); err != nil {
		slog.Error("question: save stage", "question", id, "err", err)
		return
	}
	s.announceQuestion(ctx, id)
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
	statement := source(q.Statement)
	if q.Label != "" && q.Label != statement {
		fmt.Fprintf(&b, " (%s)", q.Label)
	}
	fmt.Fprintf(&b, ":\n\n%s\n", statement)
	b.WriteString(notesText(q))
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
	fmt.Fprintf(&b, "\nThe book is %q: search and read it for the theory the problem rests on.\n", book.Title)
	if len(parts) == 0 {
		return llm.TextMessage("user", b.String()), shown, nil
	}
	content := llm.PartsContent(llm.TextPart(b.String()))
	for _, p := range parts {
		content.AppendPart(p)
	}
	return llm.Message{Role: "user", Content: content}, shown, nil
}

// notesText is the professor's instructions, for the writer: first, and
// over the book.
func notesText(q row) string {
	if len(q.Notes) == 0 {
		return ""
	}
	return "\nYour professor's instructions for this problem, which come before the book wherever they differ:\n" +
		bullets(sources(q.Notes)) +
		"Follow them: work only the parts they name, use their numbers in place of the book's, leave out what they rule out, and do what they add. Say in a note, first in the walkthrough, which of them you followed.\n"
}

// readingText is how the figures read, for the writer, which works from
// it rather than its own look at them: the reading was made with care
// and checked, and the student may have corrected it. Nothing when there
// isn't one.
func readingText(q row) string {
	if len(q.Reading) == 0 {
		return ""
	}
	lead := "How the figures read, checked line by line against them. Work from this reading. If the figures plainly show something it has wrong (a value, a direction, which end is +, what joins to what), call check_reading with what you see, before you set up any equations: don't work from your own reading instead, and don't call it over wording or node names."
	if q.ReadingEdited {
		lead = "How the figures read, as the student corrected it. Work from this reading: it is the problem, even where you would read the figures differently."
	}
	return "\n" + lead + "\n" + bullets(sources(q.Reading))
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

func clip(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
