// Package activity is time spent: heartbeats from the workspace, folded
// into the week Home reports. It reports, never nags: no targets.
package activity

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/httpx"
)

func Migrations() []db.Migration {
	return []db.Migration{{Name: "activity/1", SQL: `
CREATE TABLE heartbeats (
	book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
	kind    TEXT NOT NULL,
	at      TEXT NOT NULL
);
CREATE INDEX heartbeats_at ON heartbeats (at);`}}
}

// Beat is how much time one heartbeat stands for.
const Beat = 30 * time.Second

// Homework is where "questions worked" comes from.
type Homework interface {
	QuestionsDoneSince(ctx context.Context, since time.Time) (questions, sets int, err error)
}

type Service struct {
	db  *sql.DB
	hw  Homework
	now func() time.Time
}

func New(d *sql.DB, hw Homework) *Service { return &Service{db: d, hw: hw, now: time.Now} }

// Record stores a heartbeat. Two tabs open on the same book beat twice;
// a beat closer than two thirds of the interval to the last one for the
// same book is the same half-minute, and is dropped.
func (s *Service) Record(ctx context.Context, h Heartbeat) error {
	switch h.Kind {
	case KindReading, KindHomework, KindAsking:
	default:
		return httpx.Invalid("kind", "There's no activity called %q.", h.Kind)
	}
	now := s.now().UTC()
	var last string
	s.db.QueryRowContext(ctx, `SELECT max(at) FROM heartbeats WHERE book_id = ?`, h.BookID).Scan(&last)
	if t, err := time.Parse(time.RFC3339Nano, last); err == nil && now.Sub(t) < Beat*2/3 {
		return nil
	}
	_, err := s.db.ExecContext(ctx, `INSERT INTO heartbeats (book_id, kind, at) VALUES (?, ?, ?)`,
		h.BookID, h.Kind, now.Format(time.RFC3339Nano))
	if err != nil {
		// A book that no longer exists: nothing to record.
		return httpx.NotFound("book")
	}
	return nil
}

// Week sums everything since the start of the student's week.
func (s *Service) Week(ctx context.Context, since time.Time) (Week, error) {
	from := since.UTC().Format(time.RFC3339Nano)
	w := Week{ByBook: []BookMinutes{}}
	rows, err := s.db.QueryContext(ctx, `SELECT kind, count(*) FROM heartbeats WHERE at >= ? GROUP BY kind`, from)
	if err != nil {
		return Week{}, err
	}
	for rows.Next() {
		var k Kind
		var n int
		rows.Scan(&k, &n)
		m := minutes(n)
		switch k {
		case KindHomework:
			w.Homework = m
		case KindReading:
			w.Reading = m
		case KindAsking:
			w.Asking = m
		}
	}
	rows.Close()
	rows, err = s.db.QueryContext(ctx, `SELECT book_id, count(*) AS n FROM heartbeats WHERE at >= ? GROUP BY book_id ORDER BY n DESC`, from)
	if err != nil {
		return Week{}, err
	}
	for rows.Next() {
		var b BookMinutes
		var n int
		rows.Scan(&b.BookID, &n)
		if b.Minutes = minutes(n); b.Minutes > 0 {
			w.ByBook = append(w.ByBook, b)
		}
	}
	rows.Close()
	if s.hw != nil {
		if w.Questions, w.ProblemSets, err = s.hw.QuestionsDoneSince(ctx, since); err != nil {
			return Week{}, err
		}
	}
	return w, nil
}

func minutes(beats int) int {
	return int((time.Duration(beats) * Beat).Round(time.Minute) / time.Minute)
}

func (s *Service) Routes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/heartbeat", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		var h Heartbeat
		if err := httpx.Decode(r, &h); err != nil {
			return err
		}
		if err := s.Record(r.Context(), h); err != nil {
			return err
		}
		return httpx.NoContent(w)
	}))
	mux.HandleFunc("GET /api/week", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		since, err := time.Parse(time.RFC3339, r.URL.Query().Get("since"))
		if err != nil {
			return httpx.Invalid("since", "Say when the week starts, as an RFC 3339 time.")
		}
		wk, err := s.Week(r.Context(), since)
		if err != nil {
			return err
		}
		return httpx.OK(w, wk)
	}))
}
