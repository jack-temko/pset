package homework

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/probnum"
)

// An assignment read in the background waits here until it's imported
// or dismissed. What it read is stored as the model read it; which of
// its dates and lines are already in the student's sets is worked out
// each time it's shown, so it's never stale.

const readColumns = `id, book_id, source, set_id, state, error, result, created_at, updated_at`

func scanRead(row interface{ Scan(...any) error }) (AssignmentRead, error) {
	var r AssignmentRead
	var result string
	if err := row.Scan(&r.ID, &r.BookID, &r.Source, &r.SetID, &r.State, &r.Error, &result, &r.CreatedAt, &r.UpdatedAt); err != nil {
		return r, err
	}
	if result != "" {
		var a Assignment
		if err := json.Unmarshal([]byte(result), &a); err != nil {
			return r, err
		}
		r.Assignment = &a
	}
	return r, nil
}

// Reads is the book's assignments being read or waiting for review,
// newest first.
func (s *Service) Reads(ctx context.Context, bookID string) ([]AssignmentRead, error) {
	book, err := s.c.Library.Book(ctx, bookID)
	if err != nil {
		return nil, err
	}
	rows, err := s.c.DB.QueryContext(ctx, `SELECT `+readColumns+` FROM assignment_reads WHERE book_id = ? ORDER BY created_at DESC`, bookID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AssignmentRead{}
	for rows.Next() {
		r, err := scanRead(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range out {
		if err := s.mark(ctx, book.Problems, out[i]); err != nil {
			return nil, err
		}
	}
	return out, nil
}

// Read is one read, marked against the sets already made.
func (s *Service) Read(ctx context.Context, id string) (AssignmentRead, error) {
	r, err := scanRead(s.c.DB.QueryRowContext(ctx, `SELECT `+readColumns+` FROM assignment_reads WHERE id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return r, httpx.NotFound("assignment")
	} else if err != nil {
		return r, err
	}
	book, err := s.c.Library.Book(ctx, r.BookID)
	if err != nil {
		return r, err
	}
	return r, s.mark(ctx, book.Problems, r)
}

// DismissRead drops a read, stopping it if it's still going.
func (s *Service) DismissRead(ctx context.Context, id string) error {
	var bookID string
	err := s.c.DB.QueryRowContext(ctx, `SELECT book_id FROM assignment_reads WHERE id = ?`, id).Scan(&bookID)
	if errors.Is(err, sql.ErrNoRows) {
		return httpx.NotFound("assignment")
	} else if err != nil {
		return err
	}
	if err := s.c.Queue.StopSubject(ctx, id); err != nil {
		return err
	}
	if _, err := s.c.DB.ExecContext(ctx, `DELETE FROM assignment_reads WHERE id = ?`, id); err != nil {
		return err
	}
	s.c.Events.Publish(EventReadRemoved, ReadRemoved{ID: id, BookID: bookID})
	return nil
}

func (s *Service) publishRead(ctx context.Context, id string) (AssignmentRead, error) {
	r, err := s.Read(ctx, id)
	if err != nil {
		return r, err
	}
	s.c.Events.Publish(EventReadChanged, ReadChanged{Read: r})
	return r, nil
}

func isNotFound(err error) bool {
	var he *httpx.Error
	return errors.As(err, &he) && he.Code == httpx.CodeNotFound
}

// mark compares a read's dates with the sets they'd update: a set made
// from the same source for that date, or, read to update one set, that
// set for every date. So reading a course page again offers what the
// professor added since, what they changed, and what they took away.
func (s *Service) mark(ctx context.Context, style probnum.Style, r AssignmentRead) error {
	a := r.Assignment
	if a == nil {
		return nil
	}
	sets := map[string]string{}
	if r.SetID == "" {
		rows, err := s.c.DB.QueryContext(ctx, `SELECT due_date, id FROM homework WHERE book_id = ? AND source = ? AND due_date != '' ORDER BY created_at`,
			r.BookID, a.Source)
		if err != nil {
			return err
		}
		for rows.Next() {
			var due, id string
			if err := rows.Scan(&due, &id); err != nil {
				rows.Close()
				return err
			}
			sets[due] = id
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return err
		}
	}
	for gi := range a.Groups {
		g := &a.Groups[gi]
		id := r.SetID
		if id == "" && g.Due != "" {
			id = sets[g.Due]
		}
		g.Imported, g.SetID = r.SetID == "" && id != "", id
		c, err := s.setHas(ctx, id, style)
		if err != nil {
			return err
		}
		c.compare(g)
	}
	return nil
}
