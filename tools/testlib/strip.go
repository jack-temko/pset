package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
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

// kept are the tables the snapshot keeps (pages_fts and its shadow tables
// with them). Check refuses any table in neither list, so a table a new
// migration adds stops the snapshot until someone decides what to do with it.
var kept = []string{
	"books", "pages", "sections", "embeddings", "homework", "questions",
	"settings", "schema_migrations",
}

func isKept(name string) bool {
	if strings.HasPrefix(name, "pages_fts") || strings.HasPrefix(name, "sqlite_") {
		return true
	}
	for _, k := range kept {
		if k == name {
			return true
		}
	}
	for _, k := range dropped {
		if k == name {
			return true
		}
	}
	return false
}

type queryer interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func hasTable(ctx context.Context, q queryer, name string) (bool, error) {
	var n int
	err := q.QueryRowContext(ctx, `SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = ?`, name).Scan(&n)
	return n > 0, err
}

// inFlight are the states of a question a job is working on. The jobs are
// not in the snapshot, so such a question would never finish.
var inFlight = `('locating', 'reading', 'writing')`

// Strip removes from an open copy of a library everything the test library
// does not keep: the dropped tables, every homework set past the newest three
// of its book, and every secret in settings. Questions caught mid-step in a kept
// set go back to waiting, as the app puts them back on shutdown. Foreign keys
// must be on, so a removed set takes its questions with it. It returns the
// secret values it removed, for Check to look for; never print them.
func Strip(ctx context.Context, d *sql.DB) ([]string, error) {
	tx, err := d.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	for _, t := range dropped {
		ok, err := hasTable(ctx, tx, t)
		if err != nil {
			return nil, err
		}
		if !ok {
			continue
		}
		if _, err := tx.ExecContext(ctx, "DELETE FROM "+t); err != nil {
			return nil, fmt.Errorf("empty %s: %w", t, err)
		}
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM homework WHERE id NOT IN (`+keptSets+`)`); err != nil {
		return nil, fmt.Errorf("drop old sets: %w", err)
	}
	// What the app's waiting() does: found means located, else pending.
	if _, err := tx.ExecContext(ctx, `UPDATE questions SET activity = '',
		state = CASE WHEN page IS NOT NULL THEN 'located' ELSE 'pending' END
		WHERE state IN `+inFlight); err != nil {
		return nil, fmt.Errorf("reset questions: %w", err)
	}
	secrets, err := stripSecrets(ctx, tx)
	if err != nil {
		return nil, fmt.Errorf("remove secrets: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	_, err = d.ExecContext(ctx, `VACUUM`)
	return secrets, err
}

// keptSets selects the ids of the sets to keep: per book, the newest three.
var keptSets = fmt.Sprintf(`SELECT id FROM (
	SELECT id, row_number() OVER (PARTITION BY book_id ORDER BY created_at DESC, id DESC) AS n FROM homework
) WHERE n <= %d`, setsPerBook)

// secretWords mark a settings field as a secret by its name, wherever it
// sits in a row (chat, embeddings or profile) and however deep, so an older
// or newer shape of a row is covered too. The non-secret choices (models,
// endpoints, the name) stay.
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

// minSecret is the shortest removed value Check looks for in the file; a
// shorter one would match by chance.
const minSecret = 8

// skPattern is what an OpenRouter or OpenAI style key looks like.
var skPattern = regexp.MustCompile(`sk-[A-Za-z0-9_-]{16,}`)

// scrub removes every secret-named field from a decoded JSON value, at any
// depth, and appends the strings it removed to out.
func scrub(v any, out *[]string) (any, bool) {
	changed := false
	switch t := v.(type) {
	case map[string]any:
		for k, x := range t {
			if isSecret(k) {
				collect(x, out)
				delete(t, k)
				changed = true
				continue
			}
			if nx, c := scrub(x, out); c {
				t[k] = nx
				changed = true
			}
		}
	case []any:
		for i, x := range t {
			if nx, c := scrub(x, out); c {
				t[i] = nx
				changed = true
			}
		}
	}
	return v, changed
}

func collect(v any, out *[]string) {
	switch t := v.(type) {
	case string:
		if len(t) >= minSecret {
			*out = append(*out, t)
		}
	case map[string]any:
		for _, x := range t {
			collect(x, out)
		}
	case []any:
		for _, x := range t {
			collect(x, out)
		}
	}
}

func secretsLeft(v any, path string, out *[]string) {
	switch t := v.(type) {
	case map[string]any:
		for k, x := range t {
			if isSecret(k) {
				*out = append(*out, path+"."+k)
				continue
			}
			secretsLeft(x, path+"."+k, out)
		}
	case []any:
		for i, x := range t {
			secretsLeft(x, fmt.Sprintf("%s[%d]", path, i), out)
		}
	}
}

func settingRows(ctx context.Context, q queryer) (map[string]string, error) {
	rows, err := q.QueryContext(ctx, `SELECT key, value FROM settings`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		out[k] = v
	}
	return out, rows.Err()
}

func stripSecrets(ctx context.Context, tx *sql.Tx) ([]string, error) {
	rows, err := settingRows(ctx, tx)
	if err != nil {
		return nil, err
	}
	var secrets []string
	for row, raw := range rows {
		var v any
		if json.Unmarshal([]byte(raw), &v) != nil {
			continue
		}
		v, changed := scrub(v, &secrets)
		if !changed {
			continue
		}
		b, err := json.Marshal(v)
		if err != nil {
			return nil, err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE settings SET value = ? WHERE key = ?`, string(b), row); err != nil {
			return nil, err
		}
	}
	return secrets, nil
}

// Check verifies a stripped library: d is its open database, file the path of
// that database and dir the folder holding books/. It fails on a table the
// snapshot has no decision about, a secret-named field left in settings, a row
// in a dropped table, a book with more than three sets, a question without its
// set, a book without its PDF, and any of the removed secrets (or a key-shaped
// "sk-" string) in the database file's bytes. d must have no WAL pending, or
// the file scan misses what is in it.
func Check(ctx context.Context, d *sql.DB, dir, file string, secrets []string) error {
	var errs []error
	fail := func(format string, a ...any) { errs = append(errs, fmt.Errorf(format, a...)) }

	tables, err := d.QueryContext(ctx, `SELECT name FROM sqlite_master WHERE type = 'table'`)
	if err != nil {
		return err
	}
	for tables.Next() {
		var name string
		if err := tables.Scan(&name); err != nil {
			tables.Close()
			return err
		}
		if !isKept(name) {
			fail("table %s is in neither the keep nor the drop list", name)
		}
	}
	tables.Close()

	rows, err := settingRows(ctx, d)
	if err != nil {
		return err
	}
	for row, raw := range rows {
		var v any
		if json.Unmarshal([]byte(raw), &v) != nil {
			continue
		}
		var left []string
		secretsLeft(v, row, &left)
		for _, f := range left {
			fail("settings %s is still there", f)
		}
	}

	var n int
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
	if err := d.QueryRowContext(ctx, `SELECT count(*) FROM questions WHERE state IN `+inFlight).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		fail("%d questions are mid-step", n)
	}
	brows, err := d.QueryContext(ctx, `SELECT id FROM books`)
	if err != nil {
		return err
	}
	for brows.Next() {
		var id string
		if err := brows.Scan(&id); err != nil {
			brows.Close()
			return err
		}
		if _, err := os.Stat(filepath.Join(dir, "books", id+".pdf")); err != nil {
			fail("book %s has no PDF", id)
		}
	}
	brows.Close()

	raw, err := os.ReadFile(file)
	if err != nil {
		return err
	}
	for _, s := range secrets {
		if bytes.Contains(raw, []byte(s)) {
			fail("a removed secret is still in %s", filepath.Base(file))
		}
	}
	if skPattern.Match(raw) {
		fail("a key-shaped string (sk-...) is in %s", filepath.Base(file))
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
