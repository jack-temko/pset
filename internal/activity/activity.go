// Package activity is time spent: stretches of study from the workspace,
// folded into the week Home reports. It reports, never nags: no targets.
package activity

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"sort"
	"time"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/httpx"
)

func Migrations() []db.Migration {
	return []db.Migration{
		{Name: "activity/1", SQL: `
CREATE TABLE heartbeats (
	book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
	kind    TEXT NOT NULL,
	at      TEXT NOT NULL
);
CREATE INDEX heartbeats_at ON heartbeats (at);`},
		// Stretches replace beats (2026-09-29): a beat counted only with
		// input in the last two minutes, and homework is mostly paper. The
		// beats become stretches, run together where they came one after
		// another, half a minute apart.
		{Name: "activity/2", SQL: `
CREATE TABLE study (
	id      TEXT PRIMARY KEY,
	book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
	kind    TEXT NOT NULL,
	started TEXT NOT NULL,
	ended   TEXT NOT NULL
);
CREATE INDEX study_ended ON study (ended);`, Do: beatsToStretches},
	}
}

// Beat is how long a heartbeat stood for, before stretches.
const Beat = 30 * time.Second

// beatsToStretches is activity/2: each beat is the half-minute before
// it, and a book's beats of one kind that came one after another (45 s
// apart at most, a beat and its jitter) are one stretch: exactly the
// time the beats counted, no more.
func beatsToStretches(ctx context.Context, tx *sql.Tx) error {
	rows, err := tx.QueryContext(ctx, `SELECT book_id, kind, at FROM heartbeats ORDER BY book_id, kind, at`)
	if err != nil {
		return err
	}
	type stretch struct {
		book, kind string
		from, to   time.Time
	}
	var out []stretch
	for rows.Next() {
		var book, kind, at string
		if err := rows.Scan(&book, &kind, &at); err != nil {
			rows.Close()
			return err
		}
		t, err := time.Parse(time.RFC3339Nano, at)
		if err != nil {
			continue
		}
		if n := len(out); n > 0 && out[n-1].book == book && out[n-1].kind == kind && t.Sub(out[n-1].to) <= Beat*3/2 {
			out[n-1].to = t
			continue
		}
		out = append(out, stretch{book, kind, t.Add(-Beat), t})
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	for i, s := range out {
		if _, err := tx.ExecContext(ctx, `INSERT INTO study (id, book_id, kind, started, ended) VALUES (?, ?, ?, ?, ?)`,
			fmt.Sprintf("beats-%d", i), s.book, s.kind, db.At(s.from), db.At(s.to)); err != nil {
			return err
		}
	}
	_, err = tx.ExecContext(ctx, `DROP TABLE heartbeats`)
	return err
}

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

// Limits on what a stretch can claim: none ends in the future, and none
// is longer than a sitting. A client that sends more is clamped, not
// refused, since its clock may be off.
const (
	maxAhead   = 5 * time.Second
	maxStretch = 6 * time.Hour
)

// Save records a stretch of study, or its latest end: the workspace sends
// the stretch it's in every half-minute, and once more as the tab goes,
// so saving the same stretch again only moves its end, and never back.
func (s *Service) Save(ctx context.Context, st Stretch) error {
	switch st.Kind {
	case KindReading, KindHomework, KindAsking:
	default:
		return httpx.Invalid("kind", "There's no activity called %q.", st.Kind)
	}
	if st.ID == "" || len(st.ID) > 64 {
		return httpx.Invalid("id", "Name the stretch with an id of up to 64 characters.")
	}
	from, err1 := time.Parse(time.RFC3339Nano, st.Started)
	to, err2 := time.Parse(time.RFC3339Nano, st.Ended)
	if err1 != nil || err2 != nil {
		return httpx.Invalid("started", "Say when the stretch started and ended, as RFC 3339 times.")
	}
	to = minTime(to.UTC(), s.now().UTC().Add(maxAhead))
	from = maxTime(minTime(from.UTC(), to), to.Add(-maxStretch))
	_, err := s.db.ExecContext(ctx, `INSERT INTO study (id, book_id, kind, started, ended) VALUES (?, ?, ?, ?, ?)
		ON CONFLICT (id) DO UPDATE SET ended = max(ended, excluded.ended)`,
		st.ID, st.BookID, st.Kind, db.At(from), db.At(to))
	if err != nil {
		// A book that no longer exists: nothing to record.
		return httpx.NotFound("book")
	}
	return nil
}

// Week sums everything since the start of the student's week. Stretches
// that overlap (two tabs open on one book) count once: each total is the
// length of their union.
func (s *Service) Week(ctx context.Context, since time.Time) (Week, error) {
	w := Week{ByBook: []BookMinutes{}}
	rows, err := s.db.QueryContext(ctx, `SELECT book_id, kind, started, ended FROM study WHERE ended > ?`, db.At(since))
	if err != nil {
		return Week{}, err
	}
	byKind := map[Kind][]span{}
	byBook := map[string][]span{}
	for rows.Next() {
		var book, from, to string
		var k Kind
		if err := rows.Scan(&book, &k, &from, &to); err != nil {
			rows.Close()
			return Week{}, err
		}
		a, err1 := time.Parse(time.RFC3339Nano, from)
		b, err2 := time.Parse(time.RFC3339Nano, to)
		if err1 != nil || err2 != nil {
			continue
		}
		sp := span{maxTime(a, since), b}
		if !sp.to.After(sp.from) {
			continue
		}
		byKind[k] = append(byKind[k], sp)
		byBook[book] = append(byBook[book], sp)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return Week{}, err
	}
	w.Homework, w.Reading, w.Asking = minutes(byKind[KindHomework]), minutes(byKind[KindReading]), minutes(byKind[KindAsking])
	for book, spans := range byBook {
		if m := minutes(spans); m > 0 {
			w.ByBook = append(w.ByBook, BookMinutes{BookID: book, Minutes: m})
		}
	}
	sort.Slice(w.ByBook, func(i, j int) bool {
		if w.ByBook[i].Minutes != w.ByBook[j].Minutes {
			return w.ByBook[i].Minutes > w.ByBook[j].Minutes
		}
		return w.ByBook[i].BookID < w.ByBook[j].BookID
	})
	if s.hw != nil {
		if w.Questions, w.ProblemSets, err = s.hw.QuestionsDoneSince(ctx, since); err != nil {
			return Week{}, err
		}
	}
	return w, nil
}

// Clear forgets all time spent, in every book. Questions worked stay:
// they come from homework, not from here.
func (s *Service) Clear(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM study`)
	return err
}

type span struct{ from, to time.Time }

// minutes is how long the spans cover together, an overlap once, rounded
// to the minute.
func minutes(spans []span) int {
	if len(spans) == 0 {
		return 0
	}
	sort.Slice(spans, func(i, j int) bool { return spans[i].from.Before(spans[j].from) })
	var total time.Duration
	cur := spans[0]
	for _, sp := range spans[1:] {
		if !sp.from.After(cur.to) {
			cur.to = maxTime(cur.to, sp.to)
			continue
		}
		total += cur.to.Sub(cur.from)
		cur = sp
	}
	total += cur.to.Sub(cur.from)
	return int(total.Round(time.Minute) / time.Minute)
}

func minTime(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}

func maxTime(a, b time.Time) time.Time {
	if a.After(b) {
		return a
	}
	return b
}

func (s *Service) Routes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/study", httpx.Take(func(r *http.Request, st Stretch) error {
		return s.Save(r.Context(), st)
	}))
	mux.HandleFunc("DELETE /api/study", httpx.Act(func(r *http.Request) error {
		return s.Clear(r.Context())
	}))
	mux.HandleFunc("GET /api/week", httpx.Reply(func(r *http.Request) (Week, error) {
		since, err := time.Parse(time.RFC3339, r.URL.Query().Get("since"))
		if err != nil {
			return Week{}, httpx.Invalid("since", "Say when the week starts, as an RFC 3339 time.")
		}
		return s.Week(r.Context(), since)
	}))
}
