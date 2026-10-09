package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/activity"
	"github.com/jackt/pset/internal/ask"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/homework"
	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/library"
	"github.com/jackt/pset/internal/memory"
	"github.com/jackt/pset/internal/settings"
	"github.com/jackt/pset/internal/usage"
)

func migrations() []db.Migration {
	var all []db.Migration
	for _, m := range [][]db.Migration{
		jobs.Migrations(), settings.Migrations(), usage.Migrations(), library.Migrations(),
		memory.Migrations(), homework.Migrations(), ask.Migrations(), activity.Migrations(),
	} {
		all = append(all, m...)
	}
	return all
}

func exec(t *testing.T, d *sql.DB, q string, args ...any) {
	t.Helper()
	if _, err := d.Exec(q, args...); err != nil {
		t.Fatalf("%s: %v", q, err)
	}
}

func count(t *testing.T, d *sql.DB, q string) int {
	t.Helper()
	var n int
	if err := d.QueryRow(q).Scan(&n); err != nil {
		t.Fatalf("%s: %v", q, err)
	}
	return n
}

// fixture builds a library in a temp dir with every kind of row the snapshot
// keeps or drops.
func fixture(t *testing.T) (string, *sql.DB) {
	t.Helper()
	dir := t.TempDir()
	d, err := db.Open(filepath.Join(dir, "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	if err := db.Migrate(context.Background(), d, migrations()); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "books"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "books", "b1.pdf"), []byte("%PDF"), 0o644); err != nil {
		t.Fatal(err)
	}
	const ts = "2026-01-01T00:00:00Z"
	exec(t, d, `INSERT INTO books (id, sha256, title, state, created_at, updated_at) VALUES ('b1', 'x', 'Book', 'ready', ?, ?)`, ts, ts)
	for n := 1; n <= 3; n++ {
		exec(t, d, `INSERT INTO pages (book_id, number, text, status) VALUES ('b1', ?, 'hello page', 'text')`, n)
	}
	for i := 1; i <= 5; i++ {
		at := fmt.Sprintf("2026-02-0%dT00:00:00Z", i)
		exec(t, d, `INSERT INTO homework (id, book_id, title, created_at, updated_at) VALUES (?, 'b1', ?, ?, ?)`, fmt.Sprint("h", i), fmt.Sprint("Set ", i), at, at)
		exec(t, d, `INSERT INTO questions (id, homework_id, position, text, in_book, state, created_at, updated_at) VALUES (?, ?, 1, 'q', 1, 'ready', ?, ?)`, fmt.Sprint("q", i), fmt.Sprint("h", i), at, at)
	}
	exec(t, d, `INSERT INTO assignment_reads (id, book_id, source, file, state, created_at, updated_at) VALUES ('r1', 'b1', 'file', x'00', 'done', ?, ?)`, ts, ts)
	exec(t, d, `INSERT INTO turns (id, book_id, question, state, created_at, updated_at) VALUES ('t1', 'b1', 'why', 'done', ?, ?)`, ts, ts)
	exec(t, d, `INSERT INTO memories (id, book_id, kind, text, norm, source, created_at, updated_at) VALUES ('m1', 'b1', 'k', 't', 't', 's', ?, ?)`, ts, ts)
	exec(t, d, `INSERT INTO study (id, book_id, kind, started, ended) VALUES ('s1', 'b1', 'read', ?, ?)`, ts, ts)
	exec(t, d, `INSERT INTO calls (at, subject_type, subject_id, model, ms) VALUES (?, 'turn', 't1', 'm', 1)`, ts)
	exec(t, d, `INSERT INTO forgotten (subject_type, subject_id, at) VALUES ('turn', 't0', ?)`, ts)
	exec(t, d, `INSERT INTO jobs (id, kind, lane, state, created_at, updated_at) VALUES ('j1', 'k', 'l', 'queued', ?, ?)`, ts, ts)
	exec(t, d, `INSERT INTO settings (key, value, updated_at) VALUES ('chat', '{"model":"m/one","apiKey":"sk-secret"}', ?)`, ts)
	exec(t, d, `INSERT INTO settings (key, value, updated_at) VALUES ('embeddings', '{"endpoint":"http://localhost:11434","model":"e/one","api_key":"sk-embed","accessToken":"tok"}', ?)`, ts)
	exec(t, d, `INSERT INTO settings (key, value, updated_at) VALUES ('profile', '{"name":"Sam"}', ?)`, ts)
	return dir, d
}

func TestStripKeepsTheSampleAndDropsTheRest(t *testing.T) {
	ctx := context.Background()
	dir, d := fixture(t)

	if err := Check(ctx, d, dir); err == nil {
		t.Fatal("check passed on a db still holding a key")
	}
	if err := Strip(ctx, d); err != nil {
		t.Fatal(err)
	}
	if err := Check(ctx, d, dir); err != nil {
		t.Fatal(err)
	}

	if n := count(t, d, `SELECT count(*) FROM books`); n != 1 {
		t.Errorf("books = %d, want 1", n)
	}
	if n := count(t, d, `SELECT count(*) FROM pages`); n != 3 {
		t.Errorf("pages = %d, want 3", n)
	}
	if n := count(t, d, `SELECT count(*) FROM pages_fts WHERE pages_fts MATCH 'hello'`); n != 3 {
		t.Errorf("searchable pages = %d, want 3", n)
	}
	if n := count(t, d, `SELECT count(*) FROM homework WHERE id IN ('h3','h4','h5')`); n != 3 {
		t.Errorf("newest sets kept = %d, want 3", n)
	}
	if n := count(t, d, `SELECT count(*) FROM homework WHERE id IN ('h1','h2')`); n != 0 {
		t.Errorf("oldest sets left = %d, want 0", n)
	}
	if n := count(t, d, `SELECT count(*) FROM questions`); n != 3 {
		t.Errorf("questions = %d, want 3", n)
	}
	for _, tbl := range []string{"assignment_reads", "turns", "memories", "study", "calls", "forgotten", "jobs"} {
		if n := count(t, d, "SELECT count(*) FROM "+tbl); n != 0 {
			t.Errorf("%s has %d rows", tbl, n)
		}
	}
	var v string
	if err := d.QueryRow(`SELECT group_concat(value) FROM settings`).Scan(&v); err != nil {
		t.Fatal(err)
	}
	for _, keep := range []string{"m/one", "e/one", "http://localhost:11434", "Sam"} {
		if !strings.Contains(v, keep) {
			t.Errorf("non-secret setting %q lost", keep)
		}
	}
	for _, gone := range []string{"apiKey", "sk-secret", "api_key", "sk-embed", "accessToken", "tok\""} {
		if strings.Contains(v, gone) {
			t.Errorf("secret %q still in settings", gone)
		}
	}
}

func TestCheckFailsOnAMissingPDF(t *testing.T) {
	dir, d := fixture(t)
	if err := Strip(context.Background(), d); err != nil {
		t.Fatal(err)
	}
	os.Remove(filepath.Join(dir, "books", "b1.pdf"))
	if err := Check(context.Background(), d, dir); err == nil {
		t.Fatal("check passed with a book missing its PDF")
	}
}
