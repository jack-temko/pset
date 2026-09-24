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

	"github.com/jackt/pset/internal/agent"
	"github.com/jackt/pset/internal/cards"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/pdf"
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

// runGuide is a question's second step: write its hint and walkthrough.
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
	loc, err := s.locate(ctx, m, book, q)
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
		if _, err := tx.ExecContext(ctx, `UPDATE questions SET page = ?, label = ?, statement = ?, rect = ?, figures = ?, rounds = '[]', state = ?, activity = '', updated_at = ? WHERE id = ?`,
			loc.Page, label, statement, mustJSON(loc.Rect), mustJSON(loc.Figures), StateLocated, db.Now(), q.ID); err != nil {
			return err
		}
		_, err := s.c.Queue.Enqueue(ctx, tx, nextStep(q.ID, false))
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

// printedName is how a PDF page is named to the model: by its printed
// number, which is what the page itself says and what citations use.
func printedName(page, offset int) string {
	if p := page - offset; p >= 1 {
		return fmt.Sprintf("p. %d", p)
	}
	return fmt.Sprintf("a front-matter page (PDF page %d)", page)
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
			Offset:   book.PageOffset,
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
			Book:   agent.Book{ID: book.ID, Title: book.Title, PageCount: book.PageCount, PageOffset: book.PageOffset},
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
	if err := s.c.Memory.SawProblem(ctx, book.ID, book.PageOffset, chapter, label, loc.Page); err != nil {
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
		page := printedName(*q.Page, book.PageOffset)
		if figs := s.figureParts(ctx, book, q); len(figs) > 0 {
			fmt.Fprintf(&b, "\nThe problem is on %s of %q. Its figures follow, cut from the page; view_page shows the whole page.\n", page, book.Title)
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

// figureParts is a question's figures as images, each under its label,
// cut the way the walkthrough shows them. None when any fails to cut: a
// problem missing one of its figures is better read off the whole page.
func (s *Service) figureParts(ctx context.Context, book Book, q row) []llm.Part {
	var parts []llm.Part
	for _, f := range q.FigRect {
		img, err := s.crop(ctx, book.ID, *q.Page, f.Rect)
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
	start, end, ok, err := s.c.Library.ChapterSpan(ctx, book.ID, chapter)
	if err != nil || !ok {
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
		fmt.Fprintf(&b, "\n%s:\n%s\n", printedName(p, book.PageOffset), clip(text, 5000))
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

// ---------------------------------------------------------------- locate

// location is where a question is and what it says.
type location struct {
	Page      int
	Label     string
	Statement string
	Rect      *pdf.Rect
	Figures   []figure
	// FromMemory is the range memory that led to the page, when it was
	// one of its pages and nothing exact had pointed there.
	FromMemory *Problems
}

// locate runs the ladder: a page the student pinned is the only
// candidate; otherwise the exact tiers and search first, a wider search
// second, then a sweep of the chapter's pages as images.
func (s *Service) locate(ctx context.Context, m model, book Book, q row) (location, error) {
	notFound := fail(FailureNotFound, nil, "Searched the book for %s and didn't see it. If you know the printed page, give it here; if it isn't from this book, paste it below.", problemName(q))
	if q.Pinned != nil {
		loc, ok, err := s.locateOnce(ctx, m, book, q, []int{*q.Pinned})
		if err != nil {
			return location{}, err
		}
		if !ok {
			return location{}, fail(FailureNotFound, nil, "It isn't on %s either. Check the page number, or paste the problem below.", printedName(*q.Pinned, book.PageOffset))
		}
		return loc, nil
	}

	// Memory's pages go after the exact tiers: a few in the first round,
	// the rest in the wider one.
	var problems Problems
	var remembered []int
	if label, chapter, ok := problemLabel(q.Text, q.Label); ok && s.c.Memory != nil {
		if p, err := s.c.Memory.ProblemsSeen(ctx, book.ID, chapter); err == nil {
			problems, remembered = p, rememberedPages(p.Seen, label)
		}
	}
	tried := map[int]bool{}
	for i, k := range []int{firstRound, widerRound} {
		take := len(remembered)
		if i == 0 {
			take = min(take, firstRemembered)
		}
		cands, exact, err := s.candidates(ctx, book, q.Text, k, tried, remembered[:take])
		if err != nil {
			return location{}, err
		}
		if len(cands) == 0 {
			break
		}
		fromMemory := map[int]bool{}
		for _, p := range cands {
			tried[p] = true
			if slices.Contains(remembered, p) && !exact[p] {
				fromMemory[p] = true
			}
		}
		if len(fromMemory) > 0 {
			s.setActivity(ctx, q.ID, "Checking the pages memory points to…")
		}
		loc, ok, err := s.locateOnce(ctx, m, book, q, cands)
		if err != nil {
			return location{}, err
		}
		if ok {
			if fromMemory[loc.Page] {
				loc.FromMemory = &problems
			}
			return loc, nil
		}
	}

	// Last: read the chapter's pages, where the text layer may be too poor
	// for search to find the problem at all.
	label, _ := questionLabel(q.Text)
	chapter, ok := labelChapter(label)
	if !ok {
		return location{}, notFound
	}
	start, end, ok, err := s.c.Library.ChapterSpan(ctx, book.ID, chapter)
	if err != nil || !ok {
		return location{}, notFound
	}
	for _, batch := range sweepBatchesOf(start, end) {
		loc, ok, err := s.locateOnce(ctx, m, book, q, batch)
		if err != nil {
			return location{}, err
		}
		if ok {
			return loc, nil
		}
	}
	return location{}, notFound
}

// Candidate pool sizes: the first round is small and sharp, the second
// reaches deeper into the ranks the first left out.
const (
	firstRound = 6
	widerRound = 10
	// firstRemembered is how many of memory's pages the first round shows.
	firstRemembered = 3
)

// candidates picks the pages a locate round looks at, exact before
// fuzzy: a printed page the question cites, pages that open a line with
// its label, the pages memory points to, then search. exact is what the
// first two tiers found.
func (s *Service) candidates(ctx context.Context, book Book, text string, k int, exclude map[int]bool, remembered []int) ([]int, map[int]bool, error) {
	var out []int
	exact := map[int]bool{}
	seen := map[int]bool{}
	add := func(p int) {
		if p >= 1 && p <= book.PageCount && !exclude[p] && !seen[p] && len(out) < k {
			seen[p] = true
			out = append(out, p)
		}
	}
	if printed, ok := printedPageOf(text); ok {
		exact[printed+book.PageOffset] = true
		add(printed + book.PageOffset)
	}
	if label, ok := questionLabel(text); ok {
		texts, err := s.c.Library.PageTexts(ctx, book.ID)
		if err != nil {
			return nil, nil, err
		}
		for _, p := range labelScan(texts, label) {
			exact[p] = true
			add(p)
		}
	}
	for _, p := range remembered {
		add(p)
	}
	hits, err := s.c.Library.Search(ctx, book.ID, text, k+len(exclude))
	if err != nil {
		return nil, nil, err
	}
	for _, p := range hits {
		add(p)
	}
	return out, exact, nil
}

// locateOnce shows the model a handful of pages as images and asks which
// one holds the problem. ok is false when none does, or the answer isn't
// usable; an error is a call that failed.
func (s *Service) locateOnce(ctx context.Context, m model, book Book, q row, pages []int) (location, bool, error) {
	var b strings.Builder
	fmt.Fprintf(&b, "The problem, as the student gave it:\n\n%s\n\nThe pages follow as images, numbered from 1.", q.Text)
	content := llm.PartsContent(llm.TextPart(b.String()))
	shown := 0
	var order []int
	for _, p := range pages {
		url, err := s.pageImage(ctx, book.ID, p, 1100)
		if err != nil {
			if ctx.Err() != nil {
				return location{}, false, ctx.Err()
			}
			continue
		}
		shown++
		order = append(order, p)
		content.AppendPart(llm.TextPart(fmt.Sprintf("Image %d:", shown)))
		content.AppendPart(llm.ImagePart(url))
	}
	if shown == 0 {
		return location{}, false, nil
	}
	reply, err := m.client.ChatOnce(ctx, llm.ChatRequest{Model: m.name, Messages: []llm.Message{
		llm.TextMessage("system", locatePrompt),
		{Role: "user", Content: content},
	}})
	if err != nil {
		if ctx.Err() != nil {
			return location{}, false, ctx.Err()
		}
		return location{}, false, modelDown(err, q)
	}
	var pin struct {
		Image     int       `json:"image"`
		Label     string    `json:"label"`
		Statement string    `json:"statement"`
		Rect      *pdf.Rect `json:"question_rect"`
		Figures   []struct {
			Label string    `json:"label"`
			Rect  *pdf.Rect `json:"rect"`
		} `json:"figures"`
	}
	if err := json.Unmarshal([]byte(llm.Unfence(reply)), &pin); err != nil {
		slog.Warn("locate: reply wasn't JSON", "question", q.ID, "err", err)
		return location{}, false, nil
	}
	if pin.Image < 1 || pin.Image > len(order) {
		return location{}, false, nil
	}
	loc := location{Page: order[pin.Image-1], Label: strings.TrimSpace(pin.Label), Statement: strings.TrimSpace(pin.Statement)}
	if pin.Rect != nil && pin.Rect.Valid() {
		loc.Rect = pin.Rect
	}
	for _, f := range pin.Figures {
		if f.Rect != nil && f.Rect.Valid() && len(loc.Figures) < maxFigures {
			loc.Figures = append(loc.Figures, figure{Label: strings.TrimSpace(f.Label), Rect: *f.Rect})
		}
	}
	return loc, true, nil
}

// maxFigures caps the figures one question shows.
const maxFigures = 3
