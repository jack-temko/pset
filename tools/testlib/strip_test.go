package main

import (
	"context"
	"database/sql"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"

	"github.com/jackt/pset/internal/activity"
	"github.com/jackt/pset/internal/ask"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/homework"
	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/library"
	"github.com/jackt/pset/internal/memory"
	"github.com/jackt/pset/internal/settings"
	"github.com/jackt/pset/internal/testx"
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
	t.Cleanup(func() { cleanup.Close(d) })
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
	for n := 2; n <= 6; n++ {
		at := fmt.Sprintf("2026-03-0%dT00:00:00Z", n)
		exec(t, d, `INSERT INTO turns (id, book_id, question, state, created_at, updated_at) VALUES (?, 'b1', 'why', 'done', ?, ?)`, fmt.Sprint("t", n), at, at)
	}
	// Calls: kept = qk, setk, book, tk; dropped = qd, setd, read, td.
	for _, c := range [][2]string{{"question", "q5"}, {"question", "q1"}, {"set", "h5"}, {"set", "h1"}, {"book", "b1"}, {"turn", "t6"}, {"turn", "t1"}, {"read", "r1"}} {
		exec(t, d, `INSERT INTO calls (at, subject_type, subject_id, model, ms) VALUES (?, ?, ?, 'm', 1)`, ts, c[0], c[1])
	}
	exec(t, d, `INSERT INTO forgotten (subject_type, subject_id, at) VALUES ('turn', 't0', ?)`, ts)
	exec(t, d, `INSERT INTO jobs (id, kind, lane, state, created_at, updated_at) VALUES ('j1', 'k', 'l', 'queued', ?, ?)`, ts, ts)
	exec(t, d, `INSERT INTO settings (key, value, updated_at) VALUES ('chat', '{"model":"m/one","apiKey":"sk-secret-00000000000"}', ?)`, ts)
	exec(t, d, `INSERT INTO settings (key, value, updated_at) VALUES ('embeddings', '{"endpoint":"http://localhost:11434","model":"e/one","api_key":"sk-embed-0000000000000","accessToken":"tok-1234567890","nested":{"auth":{"password":"pw-1234567890"},"list":[{"secret":"scrt-1234567890","ok":"fine"}]}}', ?)`, ts)
	exec(t, d, `INSERT INTO settings (key, value, updated_at) VALUES ('profile', '{"name":"Sam"}', ?)`, ts)
	return dir, d
}

func TestStripKeepsTheSampleAndDropsTheRest(t *testing.T) {
	ctx := context.Background()
	dir, d := fixture(t)

	file := filepath.Join(dir, "pset.db")
	if err := Check(ctx, d, dir, file, nil); err == nil {
		t.Fatal("check passed on a db still holding a key")
	}
	exec(t, d, `UPDATE questions SET state = 'writing', activity = 'busy', page = 3 WHERE id = 'q5'`)
	exec(t, d, `UPDATE questions SET state = 'locating' WHERE id = 'q4'`)
	exec(t, d, `UPDATE questions SET state = 'reading' WHERE id = 'q1'`)
	secrets, err := Strip(ctx, d)
	if err != nil {
		t.Fatal(err)
	}
	if len(secrets) != 5 {
		t.Errorf("removed %d secret values, want 5", len(secrets))
	}
	exec(t, d, `PRAGMA journal_mode = DELETE`)
	if err := Check(ctx, d, dir, file, secrets); err != nil {
		t.Fatal(err)
	}
	// The same file with a secret put back is caught by the byte scan.
	if err := Check(ctx, d, dir, file, []string{"books"}); err == nil {
		t.Error("check passed with a removed secret still in the file")
	}
	exec(t, d, `INSERT INTO calls (at, subject_type, subject_id, model, ms, session) VALUES ('2026-01-01T00:00:00Z', 'book', 'b1', 'm', 1, 'ask-0123456789abcdef0123')`)
	if err := Check(ctx, d, dir, file, secrets); err != nil {
		t.Errorf("an ask- session id was taken for a key: %v", err)
	}
	exec(t, d, `DELETE FROM calls WHERE session = 'ask-0123456789abcdef0123'`)
	// A prefixed key right after a letter is still a key.
	exec(t, d, `INSERT INTO calls (at, subject_type, subject_id, model, ms, session) VALUES ('2026-01-01T00:00:00Z', 'book', 'b1', 'm', 1, ?)`, "\x03\x81Ask-or-v1-"+strings.Repeat("ab12", 16))
	exec(t, d, `PRAGMA wal_checkpoint(TRUNCATE)`)
	if err := Check(ctx, d, dir, file, secrets); err == nil {
		t.Error("check passed with an sk-or- key after a letter")
	}
	exec(t, d, `DELETE FROM calls WHERE session LIKE '%sk-or-v1-%'`)
	exec(t, d, `VACUUM`)
	var st5, st4 string
	testx.Check(t, d.QueryRow(`SELECT state FROM questions WHERE id = 'q5'`).Scan(&st5))
	testx.Check(t, d.QueryRow(`SELECT state FROM questions WHERE id = 'q4'`).Scan(&st4))
	if st5 != "located" || st4 != "pending" {
		t.Errorf("in-flight questions are %s and %s, want located and pending", st5, st4)
	}
	if n := count(t, d, `SELECT count(*) FROM questions WHERE activity != ''`); n != 0 {
		t.Errorf("%d questions keep their activity", n)
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
	if n := count(t, d, `SELECT count(*) FROM turns`); n != 4 {
		t.Errorf("turns = %d, want the newest 4", n)
	}
	if n := count(t, d, `SELECT count(*) FROM turns WHERE id IN ('t3','t4','t5','t6')`); n != 4 {
		t.Errorf("newest turns not kept")
	}
	if n := count(t, d, `SELECT count(*) FROM calls`); n != 4 {
		t.Errorf("calls = %d, want 4", n)
	}
	if n := count(t, d, `SELECT count(*) FROM calls WHERE subject_id IN ('q5','h5','b1','t6')`); n != 4 {
		t.Errorf("the kept subjects' calls did not all survive")
	}
	exec(t, d, `INSERT INTO calls (at, subject_type, subject_id, model, ms) VALUES ('2026-01-01T00:00:00Z', 'question', 'gone', 'm', 1)`)
	if err := Check(ctx, d, dir, file, secrets); err == nil {
		t.Error("check passed with an orphan call")
	}
	exec(t, d, `DELETE FROM calls WHERE subject_id = 'gone'`)
	for _, tbl := range []string{"assignment_reads", "memories", "study", "forgotten", "jobs"} {
		if n := count(t, d, "SELECT count(*) FROM "+tbl); n != 0 {
			t.Errorf("%s has %d rows", tbl, n)
		}
	}
	var v string
	if err := d.QueryRow(`SELECT group_concat(value) FROM settings`).Scan(&v); err != nil {
		t.Fatal(err)
	}
	for _, keep := range []string{"m/one", "e/one", "http://localhost:11434", "Sam", "fine"} {
		if !strings.Contains(v, keep) {
			t.Errorf("non-secret setting %q lost", keep)
		}
	}
	for _, gone := range []string{"apiKey", "sk-secret", "api_key", "sk-embed", "accessToken", "tok-", "pw-", "scrt-", "auth", "\"secret\""} {
		if strings.Contains(v, gone) {
			t.Errorf("secret %q still in settings", gone)
		}
	}
}

func TestCheckFailsOnAMissingPDF(t *testing.T) {
	dir, d := fixture(t)
	if _, err := Strip(context.Background(), d); err != nil {
		t.Fatal(err)
	}
	testx.Check(t, os.Remove(filepath.Join(dir, "books", "b1.pdf")))
	if err := Check(context.Background(), d, dir, filepath.Join(dir, "pset.db"), nil); err == nil {
		t.Fatal("check passed with a book missing its PDF")
	}
}

// snapshotTree is every file under root with its mode and size, for comparing.
func snapshotTree(t *testing.T, root string) string {
	t.Helper()
	var b strings.Builder
	err := filepath.WalkDir(root, func(p string, e fs.DirEntry, err error) error {
		if err != nil {
			t.Fatal(err)
		}
		st, _ := e.Info()
		fmt.Fprintf(&b, "%s %v %d %d\n", p, st.Mode(), st.Size(), st.ModTime().UnixNano())
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return b.String()
}

func TestSnapshotThenSeed(t *testing.T) {
	ctx := context.Background()
	src, d := fixture(t)
	if err := os.MkdirAll(filepath.Join(src, "cache", "pages", "b1"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(src, "cache", "pages", "b1", "1.png"), []byte("png"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := d.Exec(`PRAGMA journal_mode = DELETE`); err != nil {
		t.Fatal(err)
	}
	cleanup.Close(d)
	before := snapshotTree(t, src)

	root := t.TempDir()
	snap := filepath.Join(root, "lib")
	t.Cleanup(func() { makeWritable(root) })
	if err := snapshot([]string{"-from", src, "-to", snap}); err != nil {
		t.Fatal(err)
	}
	if after := snapshotTree(t, src); after != before {
		t.Errorf("the source changed:\n%s\n--\n%s", before, after)
	}
	snapBefore := snapshotTree(t, snap)

	data := filepath.Join(root, "data")
	if err := seed([]string{data, "-from", snap}); err != nil {
		t.Fatal(err)
	}
	if after := snapshotTree(t, snap); after != snapBefore {
		t.Errorf("seeding changed the snapshot")
	}
	for _, f := range []string{"books/b1.pdf", "cache/pages/b1/1.png"} {
		st, err := os.Stat(filepath.Join(data, f))
		if err != nil {
			t.Fatal(err)
		}
		if n := st.Sys().(*syscall.Stat_t).Nlink; n != 2 {
			t.Errorf("%s has %d links, want 2", f, n)
		}
	}
	for _, f := range []string{"pset.db", "books/b1.pdf"} {
		if st, _ := os.Stat(filepath.Join(snap, f)); st.Mode().Perm()&0o222 != 0 {
			t.Errorf("snapshot %s is writable", f)
		}
	}
	if st, _ := os.Stat(filepath.Join(data, "pset.db")); st.Mode().Perm()&0o200 == 0 {
		t.Error("the seeded db is not writable")
	}
	for _, f := range []string{filepath.Join(snap, "pset.db"), filepath.Join(data, "pset.db")} {
		raw, _ := os.ReadFile(f)
		for _, s := range []string{"sk-secret-00000000000", "sk-embed-0000000000000", "tok-1234567890", "pw-1234567890", "scrt-1234567890"} {
			if strings.Contains(string(raw), s) {
				t.Errorf("%s holds a secret", f)
			}
		}
	}
	if _, err := os.Stat(filepath.Join(snap, "MANIFEST.json")); err != nil {
		t.Error(err)
	}
	// A second seed refuses; -force replaces; the snapshot and Jack's dir are never targets.
	if err := seed([]string{data, "-from", snap}); err == nil {
		t.Error("seed replaced a library without -force")
	}
	if err := seed([]string{"-force", data, "-from", snap}); err != nil {
		t.Errorf("seed -force: %v", err)
	}
	if err := seed([]string{"-force", snap, "-from", snap}); err == nil {
		t.Error("seed -force went into the snapshot")
	}
	link := filepath.Join(root, "link")
	if err := os.Symlink(snap, link); err != nil {
		t.Fatal(err)
	}
	if err := seed([]string{"-force", link, "-from", snap}); err == nil {
		t.Error("seed -force went into the snapshot through a symlink")
	}
	_ = ctx
}

func TestSeedAndSnapshotGuards(t *testing.T) {
	src, d := fixture(t)
	if _, err := d.Exec(`PRAGMA journal_mode = DELETE`); err != nil {
		t.Fatal(err)
	}
	cleanup.Close(d)
	root := t.TempDir()
	t.Cleanup(func() { makeWritable(root) })
	snap := filepath.Join(root, "lib")

	// -to must be absent or an earlier snapshot.
	other := filepath.Join(root, "other")
	testx.Check(t, os.MkdirAll(other, 0o755))
	testx.Check(t, os.WriteFile(filepath.Join(other, "mine.txt"), []byte("x"), 0o644))
	if err := snapshot([]string{"-from", src, "-to", other}); err == nil {
		t.Error("snapshot replaced a directory that is not a test library")
	}
	if _, err := os.Stat(filepath.Join(other, "mine.txt")); err != nil {
		t.Error("snapshot touched a directory that is not a test library")
	}
	if err := snapshot([]string{"-from", src, "-to", filepath.Join(root, "a?b")}); err == nil {
		t.Error("snapshot accepted a path with a ?")
	}
	if err := snapshot([]string{"-from", src, "-to", snap}); err != nil {
		t.Fatal(err)
	}

	// A seed does not empty books or caches it did not start.
	data := filepath.Join(root, "data")
	testx.Check(t, os.MkdirAll(filepath.Join(data, "books"), 0o700))
	testx.Check(t, os.WriteFile(filepath.Join(data, "books", "keep.pdf"), []byte("x"), 0o600))
	if err := seed([]string{data, "-from", snap}); err == nil {
		t.Error("seed went over a non-empty books dir with no pset.db")
	}
	if _, err := os.Stat(filepath.Join(data, "books", "keep.pdf")); err != nil {
		t.Error("seed removed a file it did not own")
	}
	testx.Check(t, os.Remove(filepath.Join(data, "books", "keep.pdf")))
	// A seed that stopped halfway (marker left) is cleared and redone.
	testx.Check(t, os.MkdirAll(filepath.Join(data, "cache", "pages"), 0o700))
	testx.Check(t, os.WriteFile(filepath.Join(data, "cache", "pages", "half"), []byte("x"), 0o600))
	testx.Check(t, os.WriteFile(filepath.Join(data, ".seeding"), nil, 0o600))
	if err := seed([]string{data, "-from", snap}); err != nil {
		t.Fatalf("seed after an interrupted seed: %v", err)
	}
	if exists(filepath.Join(data, ".seeding")) || exists(filepath.Join(data, "cache", "pages", "half")) {
		t.Error("an interrupted seed's leftovers remain")
	}

	// The environment's data dirs are protected, and so are odd paths.
	t.Setenv("PSET_DATA", filepath.Join(root, "env"))
	if err := seed([]string{"-force", filepath.Join(root, "env"), "-from", snap}); err == nil {
		t.Error("seed went into $PSET_DATA")
	}
	t.Setenv("PSET_DATA", "")
	t.Setenv("XDG_DATA_HOME", filepath.Join(root, "xdg"))
	if err := seed([]string{"-force", filepath.Join(root, "xdg", "pset"), "-from", snap}); err == nil {
		t.Error("seed went into $XDG_DATA_HOME/pset")
	}
	if err := seed([]string{filepath.Join(root, "d#1"), "-from", snap}); err == nil {
		t.Error("seed accepted a path with a #")
	}

	// A refresh leaves the files a seeded worktree shares read-only.
	if err := snapshot([]string{"-from", src, "-to", snap}); err != nil {
		t.Fatal(err)
	}
	for _, f := range []string{filepath.Join(data, "books", "b1.pdf"), filepath.Join(snap, "books", "b1.pdf")} {
		if st, err := os.Stat(f); err != nil || st.Mode().Perm()&0o222 != 0 {
			t.Errorf("%s is writable or missing after a refresh (%v)", f, err)
		}
	}
}
