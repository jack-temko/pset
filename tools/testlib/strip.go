package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// setsPerBook is how many homework sets the snapshot keeps for each book.
const setsPerBook = 3

// dropped are the tables the snapshot empties. A table a later migration
// removed is skipped, so the list may name more than a given library has.
var dropped = []string{
	"assignment_reads", "turns", "memories", "study", "heartbeats",
	"calls", "forgotten", "jobs",
}

func hasTable(ctx context.Context, q interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}, name string) (bool, error) {
	var n int
	err := q.QueryRowContext(ctx, `SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = ?`, name).Scan(&n)
	return n > 0, err
}

// Strip removes from an open copy of a library everything the test library
// does not keep: the dropped tables, every homework set past the newest three
// of its book, and the API key. Foreign keys must be on, so a removed set takes
// its questions with it.
func Strip(ctx context.Context, d *sql.DB) error {
	tx, err := d.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, t := range dropped {
		ok, err := hasTable(ctx, tx, t)
		if err != nil {
			return err
		}
		if !ok {
			continue
		}
		if _, err := tx.ExecContext(ctx, "DELETE FROM "+t); err != nil {
			return fmt.Errorf("empty %s: %w", t, err)
		}
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM homework WHERE id NOT IN (`+keptSets+`)`); err != nil {
		return fmt.Errorf("drop old sets: %w", err)
	}
	if err := stripSecrets(ctx, tx); err != nil {
		return fmt.Errorf("remove key: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	_, err = d.ExecContext(ctx, `VACUUM`)
	return err
}

// secretWords mark a settings field as a secret by its name, whichever row
// holds it (chat, embeddings or profile), so an older or newer shape of a
// row is covered too. The non-secret choices (models, endpoints, the name)
// stay.
var secretWords = []string{"key", "secret", "token", "password", "auth", "credential"}

func isSecret(field string) bool {
	f := strings.ToLower(field)
	for _, w := range secretWords {
		if strings.Contains(f, w) {
			return true
		}
	}
	return false
}

type secretField struct{ row, field string }

type queryer interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}

// settingRows reads every settings row as a JSON object; a row that isn't
// one is returned with a nil map.
func settingRows(ctx context.Context, q queryer) (map[string]map[string]json.RawMessage, error) {
	rows, err := q.QueryContext(ctx, `SELECT key, value FROM settings`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]map[string]json.RawMessage{}
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		var m map[string]json.RawMessage
		_ = json.Unmarshal([]byte(v), &m)
		out[k] = m
	}
	return out, rows.Err()
}

func secretFields(ctx context.Context, q queryer) ([]secretField, error) {
	rows, err := settingRows(ctx, q)
	if err != nil {
		return nil, err
	}
	var out []secretField
	for row, m := range rows {
		for f := range m {
			if isSecret(f) {
				out = append(out, secretField{row, f})
			}
		}
	}
	return out, nil
}

func stripSecrets(ctx context.Context, tx *sql.Tx) error {
	rows, err := settingRows(ctx, tx)
	if err != nil {
		return err
	}
	for row, m := range rows {
		changed := false
		for f := range m {
			if isSecret(f) {
				delete(m, f)
				changed = true
			}
		}
		if !changed {
			continue
		}
		raw, err := json.Marshal(m)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE settings SET value = ? WHERE key = ?`, string(raw), row); err != nil {
			return err
		}
	}
	return nil
}

// keptSets selects the ids of the sets to keep: per book, the newest three.
var keptSets = fmt.Sprintf(`SELECT id FROM (
	SELECT id, row_number() OVER (PARTITION BY book_id ORDER BY created_at DESC, id DESC) AS n FROM homework
) WHERE n <= %d`, setsPerBook)

// Check verifies a stripped library in dir (its pset.db is d): no API key in
// any settings row, nothing left in a dropped table, no book with more than
// three sets, no question without its set, and every book with its PDF.
func Check(ctx context.Context, d *sql.DB, dir string) error {
	var errs []error
	fail := func(format string, a ...any) { errs = append(errs, fmt.Errorf(format, a...)) }

	var n int
	left, err := secretFields(ctx, d)
	if err != nil {
		return err
	}
	for _, f := range left {
		fail("settings %s still holds %s", f.row, f.field)
	}
	for _, t := range dropped {
		ok, err := hasTable(ctx, d, t)
		if err != nil {
			return err
		}
		if !ok {
			continue
		}
		if err := d.QueryRowContext(ctx, "SELECT count(*) FROM "+t).Scan(&n); err != nil {
			return err
		}
		if n > 0 {
			fail("%s has %d rows", t, n)
		}
	}
	if err := d.QueryRowContext(ctx, `SELECT count(*) FROM (SELECT book_id FROM homework GROUP BY book_id HAVING count(*) > ?)`, setsPerBook).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		fail("%d books have more than %d sets", n, setsPerBook)
	}
	if err := d.QueryRowContext(ctx, `SELECT count(*) FROM questions WHERE homework_id NOT IN (SELECT id FROM homework)`).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		fail("%d questions have no set", n)
	}
	brows, err := d.QueryContext(ctx, `SELECT id FROM books`)
	if err != nil {
		return err
	}
	defer brows.Close()
	for brows.Next() {
		var id string
		if err := brows.Scan(&id); err != nil {
			return err
		}
		if _, err := os.Stat(filepath.Join(dir, "books", id+".pdf")); err != nil {
			fail("book %s has no PDF", id)
		}
	}
	if err := brows.Err(); err != nil {
		return err
	}
	if len(errs) > 0 {
		var msgs []string
		for _, e := range errs {
			msgs = append(msgs, e.Error())
		}
		return errors.New("check failed: " + strings.Join(msgs, "; "))
	}
	return nil
}
