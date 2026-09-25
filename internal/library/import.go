package library

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/pdf"
)

type importPayload struct {
	BookID string `json:"bookId"`
}

// failure is an import failure in words for the student: it becomes the
// failed row's reason as written.
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

// Classification: a page "has text" at ten words (scans carry stray words:
// stamps, watermarks), and a book is digital when half its pages have text
// and it has 120 words in all. Calling a scan digital is the dangerous
// mistake; calling a digital book a scan only costs OCR it didn't need.
const (
	pageTextMinWords    = 10
	digitalMinPageRatio = 0.5
	digitalMinWords     = 120
)

func classify(pages []string) string {
	if len(pages) == 0 {
		return "scanned"
	}
	withText, words := 0, 0
	for _, t := range pages {
		n := len(strings.Fields(t))
		words += n
		if n >= pageTextMinWords {
			withText++
		}
	}
	if float64(withText)/float64(len(pages)) >= digitalMinPageRatio && words >= digitalMinWords {
		return "digital"
	}
	return "scanned"
}

// runExamine is an import's first job: examine the book, then queue its
// preparation, a digital book ahead of scans.
func (s *Service) runExamine(ctx context.Context, j jobs.Job) error {
	return s.runStep(ctx, j, func(ctx context.Context, b row) error {
		_, kind, err := s.examine(ctx, b, s.pdfPath(b.ID))
		if err != nil {
			return err
		}
		prepare := jobs.Spec{Kind: JobPrepare, Subject: b.ID, Payload: importPayload{BookID: b.ID}}
		if kind == string(KindDigital) {
			prepare.Priority = digitalFirst
		}
		err = db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
			if err := setState(ctx, tx, b.ID, BookState{Kind: StateQueued}); err != nil {
				return err
			}
			_, err := s.c.Queue.Enqueue(ctx, tx, prepare)
			return err
		})
		if err != nil {
			return err
		}
		// No Wake: preparing waits for this job's slot, and settling wakes
		// the queue.
		if _, err := s.publish(ctx, b.ID); err != nil && !isNotFound(err) {
			slog.Error("import: publish", "book", b.ID, "err", err)
		}
		return nil
	})
}

// runPrepare is an import's second job: read a scan's pages, work out the
// contents, build search, then ready. It can be interrupted at any point
// and resumes where it stopped.
func (s *Service) runPrepare(ctx context.Context, j jobs.Job) error {
	return s.runStep(ctx, j, func(ctx context.Context, b row) error {
		if err := s.prepare(ctx, b); err != nil {
			return err
		}
		// Finished is finished, even if the job was asked to stop just now.
		s.setState(context.WithoutCancel(ctx), b.ID, BookState{Kind: StateReady}, true)
		return nil
	})
}

// runStep runs one of an import's jobs on its book and settles what the
// job leaves. Stopped, the book fails with "Stopped."; interrupted for
// another book, or shut down, it's queued again and resumes later; failed,
// it says why. A book removed meanwhile ends the job quietly.
func (s *Service) runStep(ctx context.Context, j jobs.Job, step func(context.Context, row) error) error {
	var p importPayload
	if err := j.Decode(&p); err != nil {
		return err
	}
	b, err := getBook(ctx, s.c.DB, p.BookID)
	if errors.Is(err, errNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	err = step(ctx, b)
	settle := context.WithoutCancel(ctx)
	switch {
	case err == nil:
		return nil
	case jobs.Stopped(ctx):
		s.setState(settle, b.ID, BookState{Kind: StateFailed, Reason: "Stopped."}, true)
		return err
	case ctx.Err() != nil:
		s.setState(settle, b.ID, s.requeued(settle, b), true)
		return err
	}
	var f *failure
	reason := "Something went wrong preparing this book. The details are in the log."
	if errors.As(err, &f) {
		reason = f.msg
	}
	slog.Warn("import failed", "book", b.ID, "job", j.Kind, "err", err)
	s.setState(settle, b.ID, BookState{Kind: StateFailed, Reason: reason}, true)
	return err
}

// requeued is the state of a book going back to the queue. A scan stopped
// partway through reading keeps its count, so its row doesn't forget the
// pages already read.
func (s *Service) requeued(ctx context.Context, b row) BookState {
	st := BookState{Kind: StateQueued}
	if b.Kind != KindScanned {
		return st
	}
	settled, err := settledPages(ctx, s.c.DB, b.ID)
	if err != nil || len(settled) == 0 || len(settled) >= b.PageCount {
		return st
	}
	done, total := len(settled), b.PageCount
	st.Phase, st.Done, st.Total = PhaseRead, &done, &total
	return st
}

// prepare is everything after examining: a scan's pages read, then the
// contents and search. Each part skips what an earlier run finished.
func (s *Service) prepare(ctx context.Context, b row) error {
	path := s.pdfPath(b.ID)
	var pages []string
	var err error
	if b.Kind == KindScanned {
		pages, err = s.read(ctx, b.ID, path, b.PageCount)
	} else {
		// A digital book's pages were stored when it was examined.
		pages, err = s.pageTexts(ctx, b.ID, b.PageCount)
	}
	if err != nil {
		return err
	}
	if err := s.index(ctx, b, path, string(b.Kind), pages); err != nil {
		return err
	}
	return s.buildSearch(ctx, b.ID)
}

// examine reads the file's metadata and text layer, decides whether it's
// digital or scanned, and stores a digital book's pages straight away.
func (s *Service) examine(ctx context.Context, b row, path string) ([]string, string, error) {
	s.setState(ctx, b.ID, BookState{Kind: StatePreparing, Phase: PhaseExamine}, true)
	meta, err := s.c.Tools.Metadata(ctx, path)
	if err != nil {
		if ctx.Err() != nil {
			return nil, "", ctx.Err()
		}
		return nil, "", fail(err, "This PDF can't be read. PSet couldn't open it.")
	}
	if meta.PageCount <= 0 {
		return nil, "", fail(nil, "This PDF has no pages.")
	}
	text, err := s.c.Tools.Text(ctx, path)
	if err != nil {
		if ctx.Err() != nil {
			return nil, "", ctx.Err()
		}
		return nil, "", fail(err, "This PDF can't be read. PSet couldn't get at its pages.")
	}
	pages := splitPages(text, meta.PageCount)
	kind := classify(pages)

	err = db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
		title, author := b.Title, b.Author
		if !b.Edited {
			if t := metaTitle(meta.Title); t != "" {
				title = t
			}
			if a := strings.TrimSpace(meta.Author); a != "" {
				author = a
			}
		}
		if _, err := tx.ExecContext(ctx, `UPDATE books SET title = ?, author = ?, page_count = ?, page_width = ?, page_height = ?, kind = ?, updated_at = ? WHERE id = ?`,
			title, author, meta.PageCount, meta.PageWidth, meta.PageHeight, kind, db.Now(), b.ID); err != nil {
			return err
		}
		if kind != "digital" {
			return nil
		}
		for i, t := range pages {
			status := "text"
			if strings.TrimSpace(t) == "" {
				status = "blank"
			}
			if err := savePage(ctx, tx, b.ID, storedPage{Number: i + 1, Text: t, Status: status}); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, "", err
	}
	// The title may have just changed from the filename to the real one.
	s.setState(ctx, b.ID, BookState{Kind: StatePreparing, Phase: PhaseExamine}, true)
	return pages, kind, nil
}

// splitPages splits pdftotext output on form feeds into exactly n pages.
func splitPages(text string, n int) []string {
	parts := strings.Split(text, "\f")
	out := make([]string, n)
	copy(out, parts)
	return out
}

// metaTitle is the PDF's own title, unless it's the kind of junk that
// authoring tools leave there.
func metaTitle(t string) string {
	t = strings.TrimSpace(t)
	lower := strings.ToLower(t)
	for _, junk := range []string{".pdf", ".dvi", ".tex", ".doc", "untitled", "microsoft word", "powerpoint"} {
		if strings.Contains(lower, junk) {
			return ""
		}
	}
	if len([]rune(t)) < 2 {
		return ""
	}
	return t
}

// read recognizes a scanned book page by page. Pages already read are
// skipped, so a retried or resumed import picks up where it stopped. A
// page the tools choke on is stored as failed and the import fails with
// the list; a genuinely blank page is not a failure.
func (s *Service) read(ctx context.Context, bookID, path string, count int) ([]string, error) {
	settled, err := settledPages(ctx, s.c.DB, bookID)
	if err != nil {
		return nil, err
	}
	done := len(settled)
	s.progress(ctx, bookID, PhaseRead, done, count, true)
	var failed []int
	for n := 1; n <= count; n++ {
		if settled[n] {
			continue
		}
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		text, err := s.c.Tools.OCR(ctx, path, n)
		p := storedPage{Number: n, Text: text, Status: "text"}
		switch {
		case err != nil && ctx.Err() != nil:
			return nil, ctx.Err()
		case err != nil:
			p = storedPage{Number: n, Status: "failed"}
			failed = append(failed, n)
		case strings.TrimSpace(text) == "":
			p.Status = "blank"
		}
		if err := savePage(ctx, s.c.DB, bookID, p); err != nil {
			return nil, err
		}
		if p.Status != "failed" {
			done++
		}
		s.progress(ctx, bookID, PhaseRead, done, count, false)
	}
	if len(failed) > 0 {
		return nil, fail(nil, "%s couldn't be read (%s). Try again, or check that Tesseract works in Settings.",
			plural(len(failed), "page"), pageList(failed))
	}
	return s.pageTexts(ctx, bookID, count)
}

// pageTexts is a book's stored pages as text, one per page.
func (s *Service) pageTexts(ctx context.Context, bookID string, count int) ([]string, error) {
	stored, err := loadPages(ctx, s.c.DB, bookID)
	if err != nil {
		return nil, err
	}
	pages := make([]string, count)
	for _, p := range stored {
		if p.Number >= 1 && p.Number <= count {
			pages[p.Number-1] = p.Text
		}
	}
	return pages, nil
}

func plural(n int, word string) string {
	if n == 1 {
		return "1 " + word
	}
	return fmt.Sprintf("%d %ss", n, word)
}

func pageList(pages []int) string {
	const show = 5
	var parts []string
	for i, n := range pages {
		if i == show {
			parts = append(parts, fmt.Sprintf("and %d more", len(pages)-show))
			break
		}
		parts = append(parts, fmt.Sprintf("p. %d", n))
	}
	return strings.Join(parts, ", ")
}

// index works out the book's name and contents (the PDF's outline, else
// as the model reads them) and its printed page offset.
func (s *Service) index(ctx context.Context, b row, path, kind string, pages []string) error {
	s.setState(ctx, b.ID, BookState{Kind: StatePreparing, Phase: PhaseContents}, true)
	count := len(pages)
	var secs []section
	var lines []pdf.XMLLine
	if kind == "digital" {
		doc, err := s.c.Tools.XML(ctx, path)
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return fail(err, "PSet couldn't read this book's structure.")
		}
		secs, lines = outlineSections(doc.Outline), doc.Lines
	}
	m, err := s.chatModel(ctx)
	if err != nil {
		return err
	}
	// Examine has since set the page count, size and metadata.
	if b, err = getBook(ctx, s.c.DB, b.ID); err != nil {
		return err
	}
	printed := findContentsPages(pages)
	if err := s.nameBook(ctx, m, b, path, pages, printed); err != nil {
		return err
	}
	if len(secs) == 0 {
		if secs, err = s.readContents(ctx, m, b, path, pages, lines, printed); err != nil {
			return err
		}
	}

	s.setState(ctx, b.ID, BookState{Kind: StatePreparing, Phase: PhaseIndex}, true)
	secs = cleanSections(secs, count)
	assignEndPages(secs, count)
	if len(secs) == 0 {
		// Every book has structure: a contents nobody wrote is one section.
		secs = []section{{Level: 1, Title: "Whole book", StartPage: 1, EndPage: count}}
	}
	if err := saveSections(ctx, s.c.DB, b.ID, secs); err != nil {
		return err
	}
	if runs, ok := detectRuns(pages); ok {
		// Never over the student's own numbering.
		if _, err := s.c.DB.ExecContext(ctx, `UPDATE books SET page_runs = ?, page_offset = ? WHERE id = ? AND pages_edited = 0`,
			runsJSON(runs), runs[0].Offset, b.ID); err != nil {
			return err
		}
	}
	return nil
}

// embedBatch is how many pages go to the embeddings server at once.
const embedBatch = 32

// buildSearch embeds every page with text that doesn't have a vector in
// the current model's space yet, then checks the count: a book is
// searchable when every page with text has a vector, and nothing else
// says so.
func (s *Service) buildSearch(ctx context.Context, bookID string) error {
	cfg, err := s.c.Models.LLM(ctx)
	if err != nil {
		return err
	}
	if !cfg.EmbedReady() {
		return fail(nil, "Set up an embeddings server in Settings, then try again.")
	}
	pages, err := loadPages(ctx, s.c.DB, bookID)
	if err != nil {
		return err
	}
	have, err := embeddedPages(ctx, s.c.DB, bookID, cfg.EmbedModel)
	if err != nil {
		return err
	}
	var todo []storedPage
	total := 0
	for _, p := range pages {
		if p.Status != "text" {
			continue
		}
		total++
		if !have[p.Number] {
			todo = append(todo, p)
		}
	}
	done := total - len(todo)
	s.progress(ctx, bookID, PhaseSearch, done, total, true)
	client := llm.Open(cfg)
	for len(todo) > 0 {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		batch := todo[:min(embedBatch, len(todo))]
		todo = todo[len(batch):]
		texts := make([]string, len(batch))
		for i, p := range batch {
			texts[i] = p.Text
		}
		vecs, err := client.Embed(ctx, texts)
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return fail(err, "The embeddings server stopped answering. Check it in Settings, then try again.")
		}
		err = db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
			for i, p := range batch {
				if err := saveEmbedding(ctx, tx, bookID, p.Number, cfg.EmbedModel, vecs[i]); err != nil {
					return err
				}
			}
			return nil
		})
		if err != nil {
			return err
		}
		done += len(batch)
		s.progress(ctx, bookID, PhaseSearch, done, total, false)
	}
	return nil
}

// ---------------------------------------------------------------- state

// setState stores a book's state and announces it. force publishes even
// if the pacer would hold it back.
func (s *Service) setState(ctx context.Context, id string, st BookState, force bool) {
	if err := setState(ctx, s.c.DB, id, st); err != nil {
		slog.Error("import: set state", "book", id, "err", err)
		return
	}
	if force || s.pacer.ready(id) {
		if _, err := s.publish(ctx, id); err != nil && !isNotFound(err) {
			slog.Error("import: publish", "book", id, "err", err)
		}
	}
}

func (s *Service) progress(ctx context.Context, id string, ph Phase, done, total int, force bool) {
	if ctx.Err() != nil {
		return
	}
	s.setState(ctx, id, BookState{Kind: StatePreparing, Phase: ph, Done: &done, Total: &total}, force || done == total)
}

func isNotFound(err error) bool {
	var e interface{ Status() int }
	return errors.As(err, &e) && e.Status() == 404
}

// pacer holds progress events to a few a second per book: every page is a
// row write, but the UI only needs to see the bar move.
type pacer struct {
	mu   sync.Mutex
	last map[string]time.Time
}

const pace = 250 * time.Millisecond

func newPacer() *pacer { return &pacer{last: map[string]time.Time{}} }

func (p *pacer) ready(id string) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	if time.Since(p.last[id]) < pace {
		return false
	}
	p.last[id] = time.Now()
	return true
}
