package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// Page OCR outcomes. text means the page carries recognized or extracted
// text; blank means the tools succeeded and the page genuinely has none (an
// image-only figure, a chapter divider); failed means a tool errored and the
// page's text is missing, not absent. Only failed blocks readiness.
const (
	PageText   = "text"
	PageBlank  = "blank"
	PageFailed = "failed"
)

type Page struct {
	Number int
	Text   string
	// OCRStatus is one of PageText, PageBlank, PageFailed; the zero value is
	// treated as PageText on write.
	OCRStatus string
	Error     string
}

// Page returns one stored page by number; ErrNotFound when absent.
func (s *Store) Page(ctx context.Context, bookID string, n int) (Page, error) {
	row := s.ro().QueryRowContext(ctx,
		`SELECT page_number, text, ocr_status, error FROM pages WHERE book_id = ? AND page_number = ?`, bookID, n)
	var p Page
	err := row.Scan(&p.Number, &p.Text, &p.OCRStatus, &p.Error)
	if errors.Is(err, sql.ErrNoRows) {
		return Page{}, ErrNotFound
	}
	if err != nil {
		return Page{}, fmt.Errorf("page %d of book %s: %w", n, bookID, err)
	}
	return p, nil
}

func (s *Store) Pages(ctx context.Context, bookID string) ([]Page, error) {
	rows, err := s.ro().QueryContext(ctx,
		`SELECT page_number, text, ocr_status, error FROM pages WHERE book_id = ? ORDER BY page_number`, bookID)
	if err != nil {
		return nil, fmt.Errorf("list pages: %w", err)
	}
	defer rows.Close()

	var out []Page
	for rows.Next() {
		var p Page
		if err := rows.Scan(&p.Number, &p.Text, &p.OCRStatus, &p.Error); err != nil {
			return nil, fmt.Errorf("list pages: %w", err)
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// SavePage stores one page, replacing any row already there. OCR re-attempts
// a failed page, so the write must be an upsert rather than an insert.
func (s *Store) SavePage(ctx context.Context, bookID string, p Page) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO pages (book_id, page_number, text, ocr_status, error)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(book_id, page_number) DO UPDATE SET
		   text = excluded.text, ocr_status = excluded.ocr_status, error = excluded.error`,
		bookID, p.Number, p.Text, pageStatus(p), p.Error)
	if err != nil {
		return fmt.Errorf("save page %d: %w", p.Number, err)
	}
	return nil
}

// pageStatus defaults a page's outcome; the zero value means plain text.
func pageStatus(p Page) string {
	if p.OCRStatus == "" {
		return PageText
	}
	return p.OCRStatus
}

// InsertPages stores pages in one transaction.
func (s *Store) InsertPages(ctx context.Context, bookID string, pages []Page) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin insert pages: %w", err)
	}
	defer tx.Rollback()

	for _, p := range pages {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO pages (book_id, page_number, text, ocr_status, error) VALUES (?, ?, ?, ?, ?)`,
			bookID, p.Number, p.Text, pageStatus(p), p.Error); err != nil {
			return fmt.Errorf("insert page %d: %w", p.Number, err)
		}
	}
	return tx.Commit()
}

// PageNumbers returns the page numbers already settled for a book — the
// resume marker for OCR runs. A page that failed is deliberately absent: it
// has a row so coverage is complete, but a retry must re-attempt it.
func (s *Store) PageNumbers(ctx context.Context, bookID string) (map[int]bool, error) {
	rows, err := s.ro().QueryContext(ctx,
		`SELECT page_number FROM pages WHERE book_id = ? AND ocr_status != '`+PageFailed+`'`, bookID)
	if err != nil {
		return nil, fmt.Errorf("list page numbers: %w", err)
	}
	defer rows.Close()

	out := map[int]bool{}
	for rows.Next() {
		var n int
		if err := rows.Scan(&n); err != nil {
			return nil, fmt.Errorf("list page numbers: %w", err)
		}
		out[n] = true
	}
	return out, rows.Err()
}

// PageCounts returns stored-page counts per book id.
func (s *Store) PageCounts(ctx context.Context) (map[string]int, error) {
	rows, err := s.ro().QueryContext(ctx,
		`SELECT book_id, COUNT(*) FROM pages GROUP BY book_id`)
	if err != nil {
		return nil, fmt.Errorf("count pages: %w", err)
	}
	defer rows.Close()

	out := map[string]int{}
	for rows.Next() {
		var id string
		var n int
		if err := rows.Scan(&id, &n); err != nil {
			return nil, fmt.Errorf("count pages: %w", err)
		}
		out[id] = n
	}
	return out, rows.Err()
}

// FailedPages lists the pages whose text is missing because a tool errored,
// in page order. These are what a retry re-attempts and what the book page
// names to the reader.
func (s *Store) FailedPages(ctx context.Context, bookID string) ([]Page, error) {
	rows, err := s.ro().QueryContext(ctx,
		`SELECT page_number, text, ocr_status, error FROM pages
		 WHERE book_id = ? AND ocr_status = ? ORDER BY page_number`, bookID, PageFailed)
	if err != nil {
		return nil, fmt.Errorf("list failed pages: %w", err)
	}
	defer rows.Close()

	var out []Page
	for rows.Next() {
		var p Page
		if err := rows.Scan(&p.Number, &p.Text, &p.OCRStatus, &p.Error); err != nil {
			return nil, fmt.Errorf("list failed pages: %w", err)
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// CreateBookWithPages inserts b and its pages in one transaction, setting b's
// ID and any zero timestamps.
func (s *Store) CreateBookWithPages(ctx context.Context, b *Book, pages []Page) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin insert book: %w", err)
	}
	defer tx.Rollback()

	if err := insertBook(ctx, tx, b); err != nil {
		return err
	}
	for _, p := range pages {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO pages (book_id, page_number, text, ocr_status, error) VALUES (?, ?, ?, ?, ?)`,
			b.ID, p.Number, p.Text, pageStatus(p), p.Error); err != nil {
			return fmt.Errorf("insert page %d: %w", p.Number, err)
		}
	}
	return tx.Commit()
}

func insertBook(ctx context.Context, tx *sql.Tx, b *Book) error {
	b.ID = newID()
	if b.CreatedAt.IsZero() {
		b.CreatedAt = time.Now().UTC()
	}
	if b.UpdatedAt.IsZero() {
		b.UpdatedAt = b.CreatedAt
	}
	if b.Kind == "" {
		b.Kind = KindScanned
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO books
		(id, sha256, file_path, file_size, title, author, subject, page_count, pdf_version, page_width, page_height, origin_path, kind, ready, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		b.ID, b.SHA256, b.FilePath, b.FileSize, b.Title, b.Author, b.Subject,
		b.PageCount, b.PDFVersion, b.PageWidth, b.PageHeight, b.OriginPath,
		b.Kind, b.Ready, formatTime(b.CreatedAt), formatTime(b.UpdatedAt)); err != nil {
		return fmt.Errorf("insert book: %w", err)
	}
	return nil
}
