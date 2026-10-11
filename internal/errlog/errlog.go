// Package errlog keeps the errors PSet showed, so Settings can list them by
// id and a student can send an incident id with a bug report. It is the
// recorder errs.Report writes to. A row holds ids and the Go error text,
// never a key, a prompt or an answer.
package errlog

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/httpx"
)

// Migrations is the errors table.
func Migrations() []db.Migration {
	return []db.Migration{
		{Name: "errlog/1", SQL: `
CREATE TABLE errors (
	incident    TEXT PRIMARY KEY,
	error_id    TEXT NOT NULL,
	chain       TEXT NOT NULL,
	params      TEXT NOT NULL,
	detail      TEXT NOT NULL,
	route       TEXT NOT NULL,
	book_id     TEXT NOT NULL,
	set_id      TEXT NOT NULL,
	question_id TEXT NOT NULL,
	created_at  TEXT NOT NULL
);
CREATE INDEX errors_created ON errors (created_at)`},
	}
}

// maxIncidents is how many incidents of one id a group lists; its count
// still says how many there were.
const maxIncidents = 50

// Store is the errors table.
type Store struct{ db *sql.DB }

// New opens the store on d.
func New(d *sql.DB) *Store { return &Store{db: d} }

// Record keeps one error. It implements errs.Recorder.
func (s *Store) Record(ctx context.Context, r errs.Record) error {
	chain, err := json.Marshal(r.View.Chain)
	if err != nil {
		return errs.Data.Wrap(err)
	}
	// The params of each link, and the field and ref, as the row keeps them.
	st := r.View.Stored()
	params, err := json.Marshal(errs.Stored{Links: st.Links, Field: st.Field, Ref: st.Ref})
	if err != nil {
		return errs.Data.Wrap(err)
	}
	// A request that went away mid-answer should still leave its error.
	ctx = context.WithoutCancel(ctx)
	_, err = s.db.ExecContext(ctx, `INSERT INTO errors
		(incident, error_id, chain, params, detail, route, book_id, set_id, question_id, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		r.Incident, r.View.ID, string(chain), string(params), r.Detail, r.Where.Route,
		r.Where.Book, r.Where.Set, r.Where.Question, db.At(r.At))
	return errs.Database.Of(err)
}

// List is every kept error grouped by id, the group with the newest
// incident first and each group's incidents newest first.
func (s *Store) List(ctx context.Context) ([]Group, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT incident, error_id, chain, params, detail, route, created_at
		FROM errors ORDER BY created_at DESC, incident`)
	if err != nil {
		return nil, readFailed.Wrap(err)
	}
	defer cleanup.Close(rows)
	groups := []Group{}
	at := map[string]int{}
	for rows.Next() {
		var inc Incident
		var id, chain, params string
		if err := rows.Scan(&inc.Incident, &id, &chain, &params, &inc.Detail, &inc.Route, &inc.At); err != nil {
			return nil, readFailed.Wrap(err)
		}
		st := errs.Stored{}
		cleanup.Log("read a kept error's params", json.Unmarshal([]byte(params), &st))
		cleanup.Log("read a kept error's chain", json.Unmarshal([]byte(chain), &st.Chain))
		v := st.View()
		inc.What, inc.Chain = v.What, st.Chain
		i, ok := at[id]
		if !ok {
			i = len(groups)
			at[id] = i
			groups = append(groups, Group{ID: id, What: inc.What, Last: inc.At})
		}
		groups[i].Count++
		if len(groups[i].Incidents) < maxIncidents {
			groups[i].Incidents = append(groups[i].Incidents, inc)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, readFailed.Wrap(err)
	}
	return groups, nil
}

// Clear forgets every kept error.
func (s *Store) Clear(ctx context.Context) error {
	if _, err := s.db.ExecContext(ctx, `DELETE FROM errors`); err != nil {
		return clearFailed.Wrap(err)
	}
	return nil
}

// Routes registers the errors endpoints.
func (s *Store) Routes(mux *http.ServeMux) {
	mux.Handle("GET /api/errors", httpx.Reply(func(r *http.Request) ([]Group, error) { return s.List(r.Context()) }))
	mux.Handle("DELETE /api/errors", httpx.Act(func(r *http.Request) error { return s.Clear(r.Context()) }))
}
