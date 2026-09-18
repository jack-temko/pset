package store

import (
	"context"
	"fmt"
	"time"
)

// Fact keys a book can learn. PageOffset is the difference between a
// printed page number and its PDF page index, learned by arithmetic from a
// corrected location — no model call. Conventions and Sections are prose the
// locate prompt carries; Confirmed is an accumulating list of worked
// examples.
const (
	FactPageOffset  = "page_offset"
	FactConventions = "conventions"
	FactConfirmed   = "confirmed"
)

// Fact sources: measured is arithmetic the engine derived and can trust;
// learned is something a model observed.
const (
	FactMeasured = "measured"
	FactLearned  = "learned"
)

// BookFact is one thing pset knows about a book. Hits counts how many
// independent observations agreed, so a fact confirmed three times can
// outrank a fresh guess.
type BookFact struct {
	BookID    string
	Key       string
	Value     string
	Source    string
	Hits      int
	UpdatedAt time.Time
}

// BookFacts lists everything known about a book, newest-confirmed first.
func (s *Store) BookFacts(ctx context.Context, bookID string) ([]BookFact, error) {
	rows, err := s.ro().QueryContext(ctx,
		`SELECT book_id, key, value, source, hits, updated_at FROM book_facts
		 WHERE book_id = ? ORDER BY hits DESC, key`, bookID)
	if err != nil {
		return nil, fmt.Errorf("list book facts: %w", err)
	}
	defer rows.Close()

	var out []BookFact
	for rows.Next() {
		var f BookFact
		var updated string
		if err := rows.Scan(&f.BookID, &f.Key, &f.Value, &f.Source, &f.Hits, &updated); err != nil {
			return nil, fmt.Errorf("list book facts: %w", err)
		}
		if f.UpdatedAt, err = parseTime(updated); err != nil {
			return nil, fmt.Errorf("parse fact updated_at: %w", err)
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

// BookFact reads one fact; ErrNotFound when the book has not learned it.
func (s *Store) BookFact(ctx context.Context, bookID, key string) (BookFact, error) {
	facts, err := s.BookFacts(ctx, bookID)
	if err != nil {
		return BookFact{}, err
	}
	for _, f := range facts {
		if f.Key == key {
			return f, nil
		}
	}
	return BookFact{}, ErrNotFound
}

// LearnFact records what a correction taught. Re-learning the same value
// increments hits; a different value replaces it and restarts the count,
// because the newer observation is the one the student just made.
func (s *Store) LearnFact(ctx context.Context, f BookFact) error {
	if f.Source == "" {
		f.Source = FactLearned
	}
	now := formatTime(time.Now().UTC())
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO book_facts (id, book_id, key, value, source, hits, updated_at)
		 VALUES (?, ?, ?, ?, ?, 1, ?)
		 ON CONFLICT(book_id, key) DO UPDATE SET
		   hits = CASE WHEN book_facts.value = excluded.value THEN book_facts.hits + 1 ELSE 1 END,
		   value = excluded.value,
		   source = excluded.source,
		   updated_at = excluded.updated_at`,
		newID(), f.BookID, f.Key, f.Value, f.Source, now)
	if err != nil {
		return fmt.Errorf("learn fact %s: %w", f.Key, err)
	}
	return nil
}
