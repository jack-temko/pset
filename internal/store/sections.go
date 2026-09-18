package store

import (
	"context"
	"fmt"
)

type Section struct {
	SortOrder int
	Level     int
	Title     string
	Source    string
	StartPage int
	EndPage   int
}

// CreateSections replaces a book's sections in one transaction: existing rows
// are deleted, then the given sections are inserted with SortOrder assigned
// from their slice position. An empty slice clears the book's sections.
func (s *Store) CreateSections(ctx context.Context, bookID string, sections []Section) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin section replace: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `DELETE FROM sections WHERE book_id = ?`, bookID); err != nil {
		return fmt.Errorf("clear sections of book %s: %w", bookID, err)
	}
	for i, sec := range sections {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO sections (book_id, sort_order, level, title, source, start_page, end_page)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			bookID, i, sec.Level, sec.Title, sec.Source, sec.StartPage, sec.EndPage); err != nil {
			return fmt.Errorf("insert section %d of book %s: %w", i, bookID, err)
		}
	}
	return tx.Commit()
}

// Sections returns a book's sections ordered by sort order; a book that was
// never indexed has none.
func (s *Store) Sections(ctx context.Context, bookID string) ([]Section, error) {
	rows, err := s.ro().QueryContext(ctx,
		`SELECT sort_order, level, title, source, start_page, end_page
		 FROM sections WHERE book_id = ? ORDER BY sort_order`, bookID)
	if err != nil {
		return nil, fmt.Errorf("list sections of book %s: %w", bookID, err)
	}
	defer rows.Close()

	var out []Section
	for rows.Next() {
		var sec Section
		if err := rows.Scan(&sec.SortOrder, &sec.Level, &sec.Title, &sec.Source,
			&sec.StartPage, &sec.EndPage); err != nil {
			return nil, fmt.Errorf("list sections of book %s: %w", bookID, err)
		}
		out = append(out, sec)
	}
	return out, rows.Err()
}
