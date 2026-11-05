package ask

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/doc"
	"github.com/jackt/pset/internal/errs"
)

// Migrations creates one conversation per book, as its turns.
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
CREATE INDEX turns_book ON turns (book_id, created_at);`},
		// Structured guides: an answer is a document of blocks now, and the
		// old conversations, written as prose and cards, are deleted.
		{Name: "ask/2", SQL: `DELETE FROM turns`},
		// A failed turn says what kind of failure it was, so the page needn't
		// read its sentence. Turns that failed before this get the kind their
		// sentence names.
		{Name: "ask/3", SQL: `
ALTER TABLE turns ADD COLUMN failure TEXT NOT NULL DEFAULT '';
UPDATE turns SET failure = 'setup' WHERE state = 'failed' AND (
	reason LIKE '%no OpenRouter key yet%' OR reason LIKE '%out of credit%' OR reason LIKE '%turned the request down%');
UPDATE turns SET failure = 'unavailable' WHERE state = 'failed' AND failure = '' AND reason LIKE '%busy right now%';
UPDATE turns SET failure = 'generation' WHERE state = 'failed' AND failure = '';`},
		// A failed turn keeps its error as a catalog entry (the ids of its
		// chain), not as a sentence and a kind: the page draws the entry's
		// words. Turns that failed before get the entries their sentence
		// named, and the old columns go.
		{Name: "ask/4", SQL: `ALTER TABLE turns ADD COLUMN error TEXT NOT NULL DEFAULT ''`, Do: failuresToErrors},
		{Name: "ask/5", SQL: `
ALTER TABLE turns DROP COLUMN reason;
ALTER TABLE turns DROP COLUMN failure;`},
	}
}

var errNotFound = errors.New("not found")

// failuresToErrors is ask/4: the entries a failed turn's sentence named.
func failuresToErrors(ctx context.Context, tx *sql.Tx) error {
	rows, err := tx.QueryContext(ctx, `SELECT id, reason FROM turns WHERE state = 'failed'`)
	if err != nil {
		return errs.Database.Wrap(err)
	}
	type old struct{ id, reason string }
	var failed []old
	for rows.Next() {
		var o old
		if err := rows.Scan(&o.id, &o.reason); err != nil {
			cleanup.Close(rows)
			return errs.Database.Of(err)
		}
		failed = append(failed, o)
	}
	if err := rows.Err(); err != nil {
		return errs.Database.Wrap(err)
	}
	cleanup.Close(rows)
	for _, o := range failed {
		chain := []string{"ask.turn_failed"}
		switch {
		case strings.Contains(o.reason, "no OpenRouter key yet"):
			chain = append(chain, "key.missing")
		case strings.Contains(o.reason, "out of credit"):
			chain = append(chain, "key.out_of_credit")
		case strings.Contains(o.reason, "turned the request down"):
			chain = append(chain, "key.refused")
		case strings.Contains(o.reason, "busy right now"):
			chain = append(chain, "model.busy")
		case strings.Contains(o.reason, "stopped partway"):
			chain = append(chain, "model.cut")
		case strings.Contains(o.reason, "stopped without answering"):
			chain = append(chain, "agent.no_answer")
		}
		if _, err := tx.ExecContext(ctx, `UPDATE turns SET error = ? WHERE id = ?`, errs.Chain(chain...), o.id); err != nil {
			return errs.Database.Wrap(err)
		}
	}
	return nil
}

type row struct {
	Turn
	AboutText string
}

const cols = `id, book_id, question, about, about_text, steps, answer, state, error, created_at, updated_at`

func scan(s interface{ Scan(...any) error }) (row, error) {
	var r row
	var steps, answer, failed string
	err := s.Scan(&r.ID, &r.BookID, &r.Question, &r.About, &r.AboutText, &steps, &answer, &r.State, &failed, &r.CreatedAt, &r.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return r, errNotFound
	}
	if v, ok := errs.ParseStored(failed); ok {
		r.Error = &v
	}
	decodeColumn("steps", steps, &r.Steps)
	decodeColumn("answer", answer, &r.Answer)
	// "null" unmarshals to nil: the wire always carries lists.
	if r.Steps == nil {
		r.Steps = []Step{}
	}
	if r.Answer == nil {
		r.Answer = []doc.Block{}
	}
	return r, err
}

func getTurn(ctx context.Context, d *sql.DB, id string) (row, error) {
	return scan(d.QueryRowContext(ctx, `SELECT `+cols+` FROM turns WHERE id = ?`, id))
}

func listTurns(ctx context.Context, d *sql.DB, bookID string) ([]row, error) {
	rows, err := d.QueryContext(ctx, `SELECT `+cols+` FROM turns WHERE book_id = ? ORDER BY created_at, rowid`, bookID)
	if err != nil {
		return nil, errs.Database.Wrap(err)
	}
	defer cleanup.Close(rows)
	var out []row
	for rows.Next() {
		r, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, errs.Database.Of(rows.Err())
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

// decodeColumn reads a JSON column into dst. An empty one leaves dst as it
// is; a malformed one is logged, and dst keeps what decoded.
func decodeColumn(name, col string, dst any) {
	if col == "" {
		return
	}
	cleanup.Log("ask: read the "+name+" column", json.Unmarshal([]byte(col), dst))
}
