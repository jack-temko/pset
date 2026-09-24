// Package library is books: importing a PDF into one, its pages and
// scans, its contents, and search over it. Spec: design/import.md and
// design/workspace.md.
package library

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/events"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/llm"
)

// Models is where the saved model connections come from (settings).
type Models interface {
	LLM(ctx context.Context) (llm.Config, error)
}

// Queue is what the library needs from the job queue.
type Queue interface {
	Enqueue(ctx context.Context, ex jobs.Execer, s jobs.Spec) (string, error)
	StopSubject(ctx context.Context, subject string) error
	Handle(kind, lane string, h jobs.Handler)
}

type Config struct {
	DB      *sql.DB
	DataDir string
	Events  events.Publisher
	Queue   Queue
	Models  Models
	Tools   Tools
}

type Service struct {
	c     Config
	scans *scanCache
	pacer *pacer
}

// The import job's kind and lane.
const (
	JobImport  = "import"
	LaneImport = "import"
)

func New(c Config) *Service {
	if c.Tools.Metadata == nil {
		c.Tools = LiveTools()
	}
	s := &Service{c: c, scans: newScanCache(filepath.Join(c.DataDir, "cache", "pages"), c.Tools.PageImage)}
	s.pacer = newPacer()
	c.Queue.Handle(JobImport, LaneImport, s.runImport)
	if err := fillCovers(context.Background(), c.DB); err != nil {
		slog.Error("library: giving books their colours", "err", err)
	}
	return s
}

func (s *Service) booksDir() string { return filepath.Join(s.c.DataDir, "books") }

func (s *Service) pdfPath(id string) string { return filepath.Join(s.booksDir(), id+".pdf") }

// List is every book, in the order they were added.
func (s *Service) List(ctx context.Context) ([]Book, error) { return listBooks(ctx, s.c.DB) }

// Get is one book.
func (s *Service) Get(ctx context.Context, id string) (Book, error) {
	r, err := getBook(ctx, s.c.DB, id)
	if errors.Is(err, errNotFound) {
		return Book{}, httpx.NotFound("book")
	}
	return r.Book, err
}

// Upload stages a PDF, hashing it on the way in. A book already on the
// shelf is refused with its id, so the UI can open it instead; otherwise
// the book is queued and its import enqueued in the same transaction.
func (s *Service) Upload(ctx context.Context, r io.Reader, filename string) (Book, error) {
	cfg, err := s.c.Models.LLM(ctx)
	if err != nil {
		return Book{}, err
	}
	// Preparing needs the chat model (for the contents) and ends in search,
	// which needs embeddings: refuse now, not forty minutes into reading
	// the pages.
	if err := preparable(cfg); err != nil {
		return Book{}, err
	}
	if err := os.MkdirAll(s.booksDir(), 0o700); err != nil {
		return Book{}, err
	}
	tmp, err := os.CreateTemp(s.booksDir(), ".upload-*")
	if err != nil {
		return Book{}, err
	}
	defer os.Remove(tmp.Name()) // a no-op once renamed
	h := sha256.New()
	head := &headSniffer{}
	if _, err := io.Copy(io.MultiWriter(tmp, h, head), r); err != nil {
		tmp.Close()
		return Book{}, fmt.Errorf("stage upload: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return Book{}, err
	}
	if !head.isPDF() {
		return Book{}, httpx.Invalid("file", "That isn't a PDF.")
	}
	sha := hex.EncodeToString(h.Sum(nil))
	if existing, err := bookBySHA(ctx, s.c.DB, sha); err == nil {
		return Book{}, httpx.Errorf(httpx.CodeDuplicateBook, "%s is already on your shelf.", existing.Title).About(existing.ID)
	} else if !errors.Is(err, errNotFound) {
		return Book{}, err
	}

	id := uuid.NewString()
	if err := os.Rename(tmp.Name(), s.pdfPath(id)); err != nil {
		return Book{}, err
	}
	now := db.Now()
	err = db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
		used, err := coversInUse(ctx, tx)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO books (id, sha256, title, cover, state, created_at, updated_at) VALUES (?, ?, ?, ?, 'queued', ?, ?)`,
			id, sha, filenameTitle(filename), pickCover(sha, used), now, now); err != nil {
			return err
		}
		_, err = s.c.Queue.Enqueue(ctx, tx, jobs.Spec{Kind: JobImport, Subject: id, Payload: importPayload{BookID: id}})
		return err
	})
	if err != nil {
		os.Remove(s.pdfPath(id))
		// Two uploads of the same file at once: the second loses the race
		// on the unique sha and is the duplicate after all.
		if existing, e := bookBySHA(ctx, s.c.DB, sha); e == nil {
			return Book{}, httpx.Errorf(httpx.CodeDuplicateBook, "%s is already on your shelf.", existing.Title).About(existing.ID)
		}
		return Book{}, err
	}
	return s.publish(ctx, id)
}

// headSniffer keeps the first bytes of a stream, to check it's a PDF.
type headSniffer struct{ b []byte }

func (h *headSniffer) Write(p []byte) (int, error) {
	if n := 1024 - len(h.b); n > 0 {
		h.b = append(h.b, p[:min(n, len(p))]...)
	}
	return len(p), nil
}

// isPDF looks for the header anywhere in the first KB, as readers allow.
func (h *headSniffer) isPDF() bool { return strings.Contains(string(h.b), "%PDF-") }

// filenameTitle is the title until the PDF's own metadata is read: the
// filename's stem, separators turned into spaces.
func filenameTitle(name string) string {
	base := strings.TrimSuffix(filepath.Base(name), filepath.Ext(name))
	t := strings.Join(strings.FieldsFunc(base, func(r rune) bool {
		return r == '-' || r == '_' || r == '.' || r == ' ' || r == '+'
	}), " ")
	if t == "" {
		return "Untitled"
	}
	return t
}

// Update edits title, author or offset. Any edit marks the book as the
// student's: a retried import never overwrites it.
func (s *Service) Update(ctx context.Context, id string, p BookPatch) (Book, error) {
	cur, err := s.Get(ctx, id)
	if err != nil {
		return Book{}, err
	}
	if p.Title != nil {
		t := strings.TrimSpace(*p.Title)
		if t == "" {
			return Book{}, httpx.Invalid("title", "A book needs a title.")
		}
		cur.Title = t
	}
	if p.Author != nil {
		cur.Author = strings.TrimSpace(*p.Author)
	}
	if p.PageOffset != nil {
		if *p.PageOffset < 0 || (cur.PageCount > 0 && *p.PageOffset >= cur.PageCount) {
			return Book{}, httpx.Invalid("pageOffset", "The offset has to land inside the book: 0 to %d.", max(cur.PageCount-1, 0))
		}
		cur.PageOffset = *p.PageOffset
	}
	if p.Cover != nil {
		if !validCover(*p.Cover) {
			return Book{}, httpx.Invalid("cover", "That isn't one of the cover colours.")
		}
		cur.Cover = *p.Cover
	}
	// Only the name and the offset are the student's to guard: a retried
	// import never writes over them. A colour is never rewritten anyway.
	named := p.Title != nil || p.Author != nil || p.PageOffset != nil
	if _, err := s.c.DB.ExecContext(ctx, `UPDATE books SET title = ?, author = ?, page_offset = ?, cover = ?, edited = edited OR ?, updated_at = ? WHERE id = ?`,
		cur.Title, cur.Author, cur.PageOffset, cur.Cover, named, db.Now(), id); err != nil {
		return Book{}, err
	}
	return s.publish(ctx, id)
}

// Remove takes a book off the shelf: its import stops, its rows go (and
// with them, by cascade, everything that hangs off it), and its files go.
// It is also how a failed import is dismissed.
func (s *Service) Remove(ctx context.Context, id string) error {
	if _, err := s.Get(ctx, id); err != nil {
		return err
	}
	if err := s.c.Queue.StopSubject(ctx, id); err != nil {
		return err
	}
	if _, err := s.c.DB.ExecContext(ctx, `DELETE FROM books WHERE id = ?`, id); err != nil {
		return err
	}
	os.Remove(s.pdfPath(id))
	s.scans.drop(id)
	s.c.Events.Publish(EventBookRemoved, BookRemoved{ID: id})
	return nil
}

// Stop ends a queued or preparing import. The book stays as a failed row,
// so Try again is the undo.
func (s *Service) Stop(ctx context.Context, id string) (Book, error) {
	b, err := s.Get(ctx, id)
	if err != nil {
		return Book{}, err
	}
	if b.State.Kind != StateQueued && b.State.Kind != StatePreparing {
		return b, nil
	}
	if err := s.c.Queue.StopSubject(ctx, id); err != nil {
		return Book{}, err
	}
	reason := "Stopped."
	if b.State.Kind == StateQueued {
		reason = "Cancelled before it started."
	}
	if err := setState(ctx, s.c.DB, id, BookState{Kind: StateFailed, Reason: reason}); err != nil {
		return Book{}, err
	}
	return s.publish(ctx, id)
}

// preparable refuses when a book couldn't be prepared: it needs a chat
// model and an embeddings server.
func preparable(cfg llm.Config) error {
	switch {
	case !cfg.ChatReady() && !cfg.EmbedReady():
		return httpx.Errorf(httpx.CodeNotConfigured, "Set up a chat model and an embeddings server in Settings first. Books need both to be prepared.")
	case !cfg.ChatReady():
		return httpx.Errorf(httpx.CodeNotConfigured, "Set up a chat model in Settings first. Books need it to be prepared.")
	case !cfg.EmbedReady():
		return httpx.Errorf(httpx.CodeNotConfigured, "Set up an embeddings server in Settings first. Books need it to be prepared.")
	}
	return nil
}

// Retry queues a failed import again. Whatever the last run finished
// (pages read, vectors built) is kept and skipped.
func (s *Service) Retry(ctx context.Context, id string) (Book, error) {
	b, err := s.Get(ctx, id)
	if err != nil {
		return Book{}, err
	}
	if b.State.Kind != StateFailed {
		return Book{}, httpx.Errorf(httpx.CodeInvalid, "Only a book that failed to import can be tried again.")
	}
	cfg, err := s.c.Models.LLM(ctx)
	if err != nil {
		return Book{}, err
	}
	if err := preparable(cfg); err != nil {
		return Book{}, err
	}
	err = db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
		if err := setState(ctx, tx, id, BookState{Kind: StateQueued}); err != nil {
			return err
		}
		_, err := s.c.Queue.Enqueue(ctx, tx, jobs.Spec{Kind: JobImport, Subject: id, Payload: importPayload{BookID: id}})
		return err
	})
	if err != nil {
		return Book{}, err
	}
	return s.publish(ctx, id)
}

// Contents is the book's structure as the rail shows it: top-level
// entries as chapters, the next level down as their sections, anything
// deeper left out.
func (s *Service) Contents(ctx context.Context, id string) (Contents, error) {
	if _, err := s.Get(ctx, id); err != nil {
		return Contents{}, err
	}
	secs, err := loadSections(ctx, s.c.DB, id)
	if err != nil {
		return Contents{}, err
	}
	return buildContents(secs), nil
}

func buildContents(secs []section) Contents {
	out := Contents{Chapters: []ContentsChapter{}}
	top := 0
	for _, s := range secs {
		if top == 0 || s.Level < top {
			top = s.Level
		}
	}
	for i, s := range secs {
		switch s.Level {
		case top:
			out.Chapters = append(out.Chapters, ContentsChapter{
				ID: fmt.Sprintf("c%d", i), Title: s.Title, Page: s.StartPage, Sections: []ContentsSection{},
			})
		case top + 1:
			if len(out.Chapters) == 0 {
				continue
			}
			c := &out.Chapters[len(out.Chapters)-1]
			c.Sections = append(c.Sections, ContentsSection{ID: fmt.Sprintf("s%d", i), Title: s.Title, Page: s.StartPage})
		}
	}
	// A book whose only structure is the whole-book fallback has no rail.
	if len(out.Chapters) == 1 && len(out.Chapters[0].Sections) == 0 {
		out.Chapters = []ContentsChapter{}
	}
	return out
}

// Count is Reset's dry run.
func (s *Service) Count(ctx context.Context) (books, pages int, err error) {
	err = s.c.DB.QueryRowContext(ctx, `SELECT count(*), coalesce(sum(page_count), 0) FROM books`).Scan(&books, &pages)
	return
}

// publish reads a book back and announces it.
func (s *Service) publish(ctx context.Context, id string) (Book, error) {
	b, err := s.Get(ctx, id)
	if err != nil {
		return Book{}, err
	}
	s.c.Events.Publish(EventBookChanged, BookChanged{Book: b})
	return b, nil
}

// ---------------------------------------------------------------- for other features

// Search ranks a ready book's pages for a query, best first, fusing
// full-text and vector rankings. With no embeddings set up it is text
// search alone.
func (s *Service) Search(ctx context.Context, bookID, query string, k int) ([]int, error) {
	fts, err := searchFTS(ctx, s.c.DB, bookID, query, searchDepth)
	if err != nil {
		return nil, err
	}
	var vec []int
	cfg, err := s.c.Models.LLM(ctx)
	if err != nil {
		return nil, err
	}
	if cfg.EmbedReady() {
		q, err := llm.Open(cfg).Embed(ctx, []string{query})
		if err != nil {
			return nil, err
		}
		rows, err := vectors(ctx, s.c.DB, bookID, cfg.EmbedModel)
		if err != nil {
			return nil, err
		}
		vec = rankByVector(q[0], rows, searchDepth)
	}
	return rrfMerge(fts, vec, k), nil
}

// PageText is one page's text.
func (s *Service) PageText(ctx context.Context, bookID string, page int) (string, error) {
	return pageText(ctx, s.c.DB, bookID, page)
}

// PageJPEG is one page rendered at about width pixels.
func (s *Service) PageJPEG(ctx context.Context, bookID string, page, width int) ([]byte, error) {
	r, err := getBook(ctx, s.c.DB, bookID)
	if err != nil {
		return nil, err
	}
	return s.scans.get(ctx, r, s.pdfPath(bookID), page, width)
}

// PDFPath is where a book's file lives, for features that read it
// directly (the worksheet crops).
func (s *Service) PDFPath(bookID string) string { return s.pdfPath(bookID) }

// PageTexts is every page's text, index i holding PDF page i+1.
func (s *Service) PageTexts(ctx context.Context, bookID string) ([]string, error) {
	b, err := getBook(ctx, s.c.DB, bookID)
	if err != nil {
		return nil, err
	}
	pages, err := loadPages(ctx, s.c.DB, bookID)
	if err != nil {
		return nil, err
	}
	out := make([]string, b.PageCount)
	for _, p := range pages {
		if p.Number >= 1 && p.Number <= b.PageCount {
			out[p.Number-1] = p.Text
		}
	}
	return out, nil
}

// ChapterSpan is the PDF pages chapter n runs across, from the contents:
// the first top-level entry titled "Chapter 3..." or "3 ...". ok is false
// when no entry names it.
func (s *Service) ChapterSpan(ctx context.Context, bookID string, n int) (start, end int, ok bool, err error) {
	secs, err := loadSections(ctx, s.c.DB, bookID)
	if err != nil {
		return 0, 0, false, err
	}
	start, end, ok = chapterSpan(secs, n)
	return start, end, ok, nil
}

func chapterSpan(secs []section, n int) (int, int, bool) {
	re := regexp.MustCompile(`(?i)^\s*(?:chapter\s+)?` + strconv.Itoa(n) + `(?:$|[\s.:·\-])`)
	for _, sec := range secs {
		if re.MatchString(sec.Title) {
			return sec.StartPage, sec.EndPage, sec.EndPage >= sec.StartPage
		}
	}
	return 0, 0, false
}
