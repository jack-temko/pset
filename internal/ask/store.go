package ask

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/jackt/pset/internal/cards"
	"github.com/jackt/pset/internal/db"
)

// Migrations: one conversation per book, as its turns.
func Migrations() []db.Migration {
	return []db.Migration{{Name: "ask/1", SQL: `
CREATE TABLE turns (
	id         TEXT PRIMARY KEY,
	book_id    TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
	question   TEXT NOT NULL,
	about      TEXT NOT NULL DEFAULT '',
	about_text TEXT NOT NULL DEFAULT '',
	steps      TEXT NOT NULL DEFAULT '[]',
	answer     TEXT NOT NULL DEFAULT '[]',
	state      TEXT NOT NULL,
	reason     TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE INDEX turns_book ON turns (book_id, created_at);`}}
}

var errNotFound = errors.New("not found")

type row struct {
	Turn
	AboutText string
}

const cols = `id, book_id, question, about, about_text, steps, answer, state, reason, created_at, updated_at`

func scan(s interface{ Scan(...any) error }) (row, error) {
	var r row
	var steps, answer string
	err := s.Scan(&r.ID, &r.BookID, &r.Question, &r.About, &r.AboutText, &steps, &answer, &r.State, &r.Reason, &r.CreatedAt, &r.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return r, errNotFound
	}
	json.Unmarshal([]byte(steps), &r.Steps)
	json.Unmarshal([]byte(answer), &r.Answer)
	// "null" unmarshals to nil: the wire always carries lists.
	if r.Steps == nil {
		r.Steps = []Step{}
	}
	if r.Answer == nil {
		r.Answer = []cards.Segment{}
	}
	return r, err
}

func getTurn(ctx context.Context, d *sql.DB, id string) (row, error) {
	return scan(d.QueryRowContext(ctx, `SELECT `+cols+` FROM turns WHERE id = ?`, id))
}

func listTurns(ctx context.Context, d *sql.DB, bookID string) ([]row, error) {
	rows, err := d.QueryContext(ctx, `SELECT `+cols+` FROM turns WHERE book_id = ? ORDER BY created_at, rowid`, bookID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []row
	for rows.Next() {
		r, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
