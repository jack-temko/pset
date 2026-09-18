package store

import (
	"context"
	"fmt"
)

// Counts reports what a reset would remove: books, stored pages, and
// finished task rows.
func (s *Store) Counts(ctx context.Context) (books, pages, finishedTasks int64, err error) {
	err = s.ro().QueryRowContext(ctx,
		`SELECT (SELECT COUNT(*) FROM books), (SELECT COUNT(*) FROM pages), (SELECT COUNT(*) FROM tasks)`).
		Scan(&books, &pages, &finishedTasks)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("count books: %w", err)
	}
	return books, pages, finishedTasks, nil
}

// Reset deletes every book, page, and task row, returning the counts
// removed. The schema itself is kept at its current version — base state is
// an empty database at the latest schema. Only finished tasks can exist
// here (the engine refuses a reset over unfinished work); their phases go
// with them by cascade.
func (s *Store) Reset(ctx context.Context) (books, pages, finishedTasks int64, err error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("begin reset: %w", err)
	}
	defer tx.Rollback()

	row := tx.QueryRowContext(ctx,
		`SELECT (SELECT COUNT(*) FROM books), (SELECT COUNT(*) FROM pages), (SELECT COUNT(*) FROM tasks)`)
	if err := row.Scan(&books, &pages, &finishedTasks); err != nil {
		return 0, 0, 0, fmt.Errorf("count before reset: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM tasks`); err != nil {
		return 0, 0, 0, fmt.Errorf("reset tasks: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM pages`); err != nil {
		return 0, 0, 0, fmt.Errorf("reset pages: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM books`); err != nil {
		return 0, 0, 0, fmt.Errorf("reset books: %w", err)
	}
	return books, pages, finishedTasks, tx.Commit()
}
