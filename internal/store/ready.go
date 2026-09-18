package store

import (
	"context"
	"fmt"
	"time"
)

// Readiness is the derived preparation state of one book. It is computed
// from stored rows, never read from a flag: a book that lost data is
// instantly not ready, and no write site can leave a stale claim behind.
type Readiness struct {
	PageCount   int
	PagesStored int
	PagesFailed int
	// PagesWithText excludes blank pages. A blank page is a finished page —
	// the tools read it and it genuinely has no text — but there is nothing
	// on it to embed, so it is not something search can be missing. The
	// count comes from the stored outcome rather than re-deciding what
	// "empty" means in SQL: one definition, written once, at read time.
	PagesWithText int
	Sections      int
	Vectors       int
	EmbedModel    string
}

// Ready reports whether every phase of preparation left complete, usable
// data: a row for every page, no page whose text a tool failed to produce,
// at least one section, and a vector for every page that has text.
//
// A blank page is not a failure — the tools succeeded and the page genuinely
// has no text — so blanks never block a book.
func (r Readiness) Ready() bool {
	return r.PageCount > 0 &&
		r.PagesStored == r.PageCount &&
		r.PagesFailed == 0 &&
		r.Sections > 0 &&
		r.Vectors >= r.PagesWithText
}

// Missing names the first incomplete phase, for display; empty when ready.
func (r Readiness) Missing() string {
	switch {
	case r.PageCount == 0:
		return "examine"
	case r.PagesStored < r.PageCount:
		return "read"
	case r.PagesFailed > 0:
		return "read"
	case r.Sections == 0:
		return "index"
	case r.Vectors < r.PagesWithText:
		return "search"
	}
	return ""
}

// Readiness computes one book's preparation state in a single round trip.
func (s *Store) Readiness(ctx context.Context, bookID, embedModel string) (Readiness, error) {
	r := Readiness{EmbedModel: embedModel}
	row := s.ro().QueryRowContext(ctx, `
		SELECT
			(SELECT page_count FROM books WHERE id = ?1),
			(SELECT COUNT(*) FROM pages WHERE book_id = ?1),
			(SELECT COUNT(*) FROM pages WHERE book_id = ?1 AND ocr_status = ?2),
			(SELECT COUNT(*) FROM pages WHERE book_id = ?1 AND ocr_status = ?4),
			(SELECT COUNT(*) FROM sections WHERE book_id = ?1),
			(SELECT COUNT(*) FROM embeddings WHERE book_id = ?1 AND model = ?3)`,
		bookID, PageFailed, embedModel, PageText)
	if err := row.Scan(&r.PageCount, &r.PagesStored, &r.PagesFailed,
		&r.PagesWithText, &r.Sections, &r.Vectors); err != nil {
		return r, fmt.Errorf("readiness of book %s: %w", bookID, err)
	}
	return r, nil
}

// RefreshReady recomputes a book's readiness and caches it on the row,
// returning what it computed. Call it whenever a task touches the book.
func (s *Store) RefreshReady(ctx context.Context, bookID, embedModel string) (Readiness, error) {
	r, err := s.Readiness(ctx, bookID, embedModel)
	if err != nil {
		return r, err
	}
	if _, err := s.db.ExecContext(ctx,
		`UPDATE books SET ready = ?, updated_at = ? WHERE id = ?`,
		r.Ready(), formatTime(time.Now().UTC()), bookID); err != nil {
		return r, fmt.Errorf("cache readiness of book %s: %w", bookID, err)
	}
	return r, nil
}
