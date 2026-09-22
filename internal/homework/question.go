package homework

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"

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
	msg string
	err error
}

func (f *failure) Error() string {
	if f.err != nil {
		return f.msg + ": " + f.err.Error()
	}
	return f.msg
}

func (f *failure) Unwrap() error { return f.err }

func fail(err error, format string, args ...any) error {
	return &failure{msg: fmt.Sprintf(format, args...), err: err}
}

// modelDown is what any failed model call means to the student.
func modelDown(err error) error {
	return fail(err, "The chat model stopped answering. Check it in Settings, then try again.")
}

// runQuestion is the question job: locate it (if it's in the book), then
// write its hint and walkthrough, publishing each step.
func (s *Service) runQuestion(ctx context.Context, j jobs.Job) error {
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
	err = s.work(ctx, q)
	settle := context.WithoutCancel(ctx)
	switch {
	case err == nil:
		return nil
	case jobs.Stopped(ctx):
		return err // removed; nothing left to update
	case ctx.Err() != nil:
		// Shutting down: it starts over on the next run.
		s.setState(settle, q.ID, StatePending, "")
		return err
	}
	reason := "Something went wrong writing this guide. The details are in the log."
	var f *failure
	if errors.As(err, &f) {
		reason = f.msg
	}
	slog.Warn("question failed", "question", q.ID, "err", err)
	s.setState(settle, q.ID, StateFailed, reason)
	return err
}

func (s *Service) setState(ctx context.Context, id string, st State, reason string) {
	if _, err := s.c.DB.ExecContext(ctx, `UPDATE questions SET state = ?, reason = ?, updated_at = ? WHERE id = ?`,
		st, reason, db.Now(), id); err != nil {
		slog.Error("question: set state", "question", id, "err", err)
		return
	}
	s.publishQuestion(ctx, id)
}

func (s *Service) work(ctx context.Context, q row) error {
	book, err := s.c.Library.Book(ctx, q.BookID)
	if err != nil {
		return err
	}
	cfg, err := s.c.Settings.LLM(ctx)
	if err != nil {
		return err
	}
	if !cfg.ChatReady() {
		return fail(nil, "Set up a chat model in Settings, then try again.")
	}
	m := model{client: llm.Open(cfg), name: cfg.ChatModel}

	if q.InBook {
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
		if _, err := s.c.DB.ExecContext(ctx, `UPDATE questions SET page = ?, label = ?, statement = ?, rect = ?, figures = ?, updated_at = ? WHERE id = ?`,
			loc.Page, label, statement, mustJSON(loc.Rect), mustJSON(loc.Figures), db.Now(), q.ID); err != nil {
			return err
		}
	}
	s.setState(ctx, q.ID, StateWriting, "")
	if q, err = getQuestion(ctx, s.c.DB, q.ID); err != nil {
		return err
	}
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

// writeGuide streams the hint and the walkthrough. The hint is saved and
// published the moment the walkthrough heading arrives, so the student can
// open it while the rest is still being written.
func (s *Service) writeGuide(ctx context.Context, m model, book Book, q row) error {
	system := guideSystem(s.c.Settings.Name(ctx))
	user, err := s.guideUser(ctx, book, q)
	if err != nil {
		return err
	}
	for attempt := 1; attempt <= guideAttempts; attempt++ {
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
		_, err := m.client.ChatStreamFull(ctx, llm.ChatRequest{
			Model:    m.name,
			Messages: []llm.Message{llm.TextMessage("system", system), user},
		}, func(delta string) error {
			parser.Feed(delta)
			return nil
		})
		parser.Finish()
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return modelDown(err)
		}
		hint, walk := parser.Section(stageHint), parser.Section(stageWalkthrough)
		if len(hint) == 0 || len(walk) == 0 {
			slog.Warn("guide missing a part", "question", q.ID, "attempt", attempt, "hint", len(hint), "walkthrough", len(walk))
			continue
		}
		_, err = s.c.DB.ExecContext(ctx, `UPDATE questions SET hint = ?, walkthrough = ?, state = 'ready', reason = '', updated_at = ? WHERE id = ?`,
			mustJSON(hint), mustJSON(walk), db.Now(), q.ID)
		if err != nil {
			return err
		}
		s.publishQuestion(ctx, q.ID)
		return nil
	}
	return fail(nil, "The guide came back incomplete. Try again.")
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

// contextPages is how many pages beyond the problem's own a guide may
// read (and cite) for the theory behind it.
const contextPages = 3

func (s *Service) guideUser(ctx context.Context, book Book, q row) (llm.Message, error) {
	var b strings.Builder
	fmt.Fprintf(&b, "The problem")
	if q.Label != "" && q.Label != q.Statement {
		fmt.Fprintf(&b, " (%s)", q.Label)
	}
	fmt.Fprintf(&b, ":\n\n%s\n", q.Statement)
	if !q.InBook {
		b.WriteString("\nIt isn't from the book: the student typed it in. Solve it from its own statement.\n")
	}

	// The pages that teach the material, for the reasoning and the
	// citations. Text only; the problem's own page also comes as an image.
	query := q.Statement
	if query == "" {
		query = q.Text
	}
	var parts []llm.Part
	hits, err := s.c.Library.Search(ctx, book.ID, query, contextPages+1)
	if err != nil {
		return llm.Message{}, err
	}
	seen := map[int]bool{}
	if q.Page != nil {
		text, _ := s.c.Library.PageText(ctx, book.ID, *q.Page)
		fmt.Fprintf(&b, "\nThe problem is on %s of %q. Its text:\n\n%s\n", printedName(*q.Page, book.PageOffset), book.Title, clip(text, 3000))
		seen[*q.Page] = true
		if url, err := s.pageImage(ctx, book.ID, *q.Page, 1400); err == nil {
			parts = append(parts, llm.TextPart(fmt.Sprintf("The problem's page, %s:", printedName(*q.Page, book.PageOffset))), llm.ImagePart(url))
		}
	}
	n := 0
	for _, p := range hits {
		if seen[p] || n == contextPages {
			continue
		}
		seen[p] = true
		n++
		text, _ := s.c.Library.PageText(ctx, book.ID, p)
		fmt.Fprintf(&b, "\nFrom the book, %s:\n\n%s\n", printedName(p, book.PageOffset), clip(text, 1800))
	}
	if len(parts) == 0 {
		return llm.TextMessage("user", b.String()), nil
	}
	content := llm.PartsContent(llm.TextPart(b.String()))
	for _, p := range parts {
		content.AppendPart(p)
	}
	return llm.Message{Role: "user", Content: content}, nil
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
}

// locate runs the ladder: a page the student pinned is the only
// candidate; otherwise the exact tiers and search first, a wider search
// second, then a sweep of the chapter's pages as images.
func (s *Service) locate(ctx context.Context, m model, book Book, q row) (location, error) {
	notFound := fail(nil, "Couldn't find %s in this book. Tell it the page, or paste the question.", quoteLabel(q.Label))
	if q.Pinned != nil {
		loc, ok, err := s.locateOnce(ctx, m, book, q, []int{*q.Pinned})
		if err != nil {
			return location{}, err
		}
		if !ok {
			return location{}, fail(nil, "It isn't on %s either. Check the page, or paste the question.", printedName(*q.Pinned, book.PageOffset))
		}
		return loc, nil
	}

	tried := map[int]bool{}
	for _, k := range []int{firstRound, widerRound} {
		cands, err := s.candidates(ctx, book, q.Text, k, tried)
		if err != nil {
			return location{}, err
		}
		if len(cands) == 0 {
			break
		}
		for _, p := range cands {
			tried[p] = true
		}
		loc, ok, err := s.locateOnce(ctx, m, book, q, cands)
		if err != nil {
			return location{}, err
		}
		if ok {
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

func quoteLabel(label string) string {
	if label == "" {
		return "this question"
	}
	return label
}

// Candidate pool sizes: the first round is small and sharp, the second
// reaches deeper into the ranks the first left out.
const (
	firstRound = 6
	widerRound = 10
)

// candidates picks the pages a locate round looks at, exact before
// fuzzy: a printed page the question cites, pages that open a line with
// its label, then search.
func (s *Service) candidates(ctx context.Context, book Book, text string, k int, exclude map[int]bool) ([]int, error) {
	var out []int
	seen := map[int]bool{}
	add := func(p int) {
		if p >= 1 && p <= book.PageCount && !exclude[p] && !seen[p] && len(out) < k {
			seen[p] = true
			out = append(out, p)
		}
	}
	if printed, ok := printedPageOf(text); ok {
		add(printed + book.PageOffset)
	}
	if label, ok := questionLabel(text); ok {
		texts, err := s.c.Library.PageTexts(ctx, book.ID)
		if err != nil {
			return nil, err
		}
		for _, p := range labelScan(texts, label) {
			add(p)
		}
	}
	hits, err := s.c.Library.Search(ctx, book.ID, text, k+len(exclude))
	if err != nil {
		return nil, err
	}
	for _, p := range hits {
		add(p)
	}
	return out, nil
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
		return location{}, false, modelDown(err)
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
	if err := json.Unmarshal([]byte(unfence(reply)), &pin); err != nil {
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

// unfence tolerates JSON wrapped in a code fence.
func unfence(s string) string {
	s = strings.TrimSpace(s)
	if !strings.HasPrefix(s, "```") {
		return s
	}
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		s = s[i+1:]
	}
	if i := strings.LastIndex(s, "```"); i >= 0 {
		s = s[:i]
	}
	return strings.TrimSpace(s)
}
