package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

var ErrNotFound = errors.New("not found")

// Section sources: outline entries from the PDF, or headings inferred from
// font sizes when the PDF has no outline.
const (
	SourceOutline  = "outline"
	SourceInferred = "inferred"
)

// Book kinds, decided by the import pipeline from the extracted text and
// locked for the book's life: digital books are read from their text layer,
// scanned books are OCRed.
const (
	KindDigital = "digital"
	KindScanned = "scanned"
)

type Book struct {
	ID         string
	SHA256     string
	FilePath   string
	FileSize   int64
	Title      string
	Author     string
	Subject    string
	PageCount  int
	PDFVersion string
	PageWidth  float64
	PageHeight float64
	OriginPath string
	Kind       string
	// Ready is the cached result of Readiness; it is an optimization, never
	// the source of truth. Any read path may recompute.
	Ready     bool
	CreatedAt time.Time
	UpdatedAt time.Time
}

const bookColumns = `id, sha256, file_path, file_size, title, author, subject, page_count, pdf_version, page_width, page_height, origin_path, kind, ready, created_at, updated_at`

// CreateBook inserts b, setting its ID and any zero timestamps.
func (s *Store) CreateBook(ctx context.Context, b *Book) error {
	return s.CreateBookWithPages(ctx, b, nil)
}

func (s *Store) BookBySHA256(ctx context.Context, sha string) (*Book, error) {
	row := s.ro().QueryRowContext(ctx,
		`SELECT `+bookColumns+` FROM books WHERE sha256 = ?`, sha)
	b, err := scanBook(row.Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("book by sha256: %w", err)
	}
	return b, nil
}

func (s *Store) BookByID(ctx context.Context, id string) (*Book, error) {
	row := s.ro().QueryRowContext(ctx,
		`SELECT `+bookColumns+` FROM books WHERE id = ?`, id)
	b, err := scanBook(row.Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("book %s: %w", id, err)
	}
	return b, nil
}

func (s *Store) Books(ctx context.Context) ([]*Book, error) {
	rows, err := s.ro().QueryContext(ctx,
		`SELECT `+bookColumns+` FROM books ORDER BY id`)
	if err != nil {
		return nil, fmt.Errorf("list books: %w", err)
	}
	defer rows.Close()

	var out []*Book
	for rows.Next() {
		b, err := scanBook(rows.Scan)
		if err != nil {
			return nil, fmt.Errorf("list books: %w", err)
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func scanBook(scan func(dest ...any) error) (*Book, error) {
	var b Book
	var createdAt, updatedAt string
	if err := scan(&b.ID, &b.SHA256, &b.FilePath, &b.FileSize, &b.Title, &b.Author,
		&b.Subject, &b.PageCount, &b.PDFVersion, &b.PageWidth, &b.PageHeight,
		&b.OriginPath, &b.Kind, &b.Ready, &createdAt, &updatedAt); err != nil {
		return nil, err
	}
	var err error
	if b.CreatedAt, err = parseTime(createdAt); err != nil {
		return nil, fmt.Errorf("parse created_at: %w", err)
	}
	if b.UpdatedAt, err = parseTime(updatedAt); err != nil {
		return nil, fmt.Errorf("parse updated_at: %w", err)
	}
	return &b, nil
}

func formatTime(t time.Time) string { return t.UTC().Format(time.RFC3339) }

func parseTime(s string) (time.Time, error) { return time.Parse(time.RFC3339, s) }

// DeleteBook removes a book and everything derived from it — pages,
// sections, embeddings, homeworks, conversations, facts, and tasks — by
// cascade. This is the only deleting path: stopping and failing keep their
// work, so Remove book is the one door that throws anything away.
func (s *Store) DeleteBook(ctx context.Context, id string) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM books WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete book %s: %w", id, err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
