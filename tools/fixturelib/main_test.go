package main

import (
	"context"
	"database/sql"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/usage"
)

func inRepoRoot(t *testing.T) {
	t.Helper()
	if _, err := exec.LookPath("pdftotext"); err != nil {
		t.Skip("pdftotext is not installed")
	}
	t.Chdir(filepath.Join("..", ".."))
}

func count(t *testing.T, d *sql.DB, q string, args ...any) int {
	t.Helper()
	var n int
	if err := d.QueryRow(q, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestBuildHasEveryAuditTarget(t *testing.T) {
	inRepoRoot(t)
	ctx := context.Background()
	dir := filepath.Join(t.TempDir(), "fixture")
	if err := build(ctx, dir, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	d, err := db.Open(filepath.Join(dir, "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()

	if n := count(t, d, `SELECT COUNT(*) FROM books WHERE state = 'ready'`); n != 2 {
		t.Errorf("ready books = %d, want 2", n)
	}
	for _, id := range []string{"fx-digital", "fx-flat"} {
		if _, err := os.Stat(filepath.Join(dir, "books", id+".pdf")); err != nil {
			t.Error(err)
		}
		if n := count(t, d, `SELECT COUNT(*) FROM pages WHERE book_id = ? AND status = 'text'`, id); n == 0 {
			t.Errorf("%s has no page text", id)
		}
		if n := count(t, d, `SELECT COUNT(*) FROM sections WHERE book_id = ?`, id); n == 0 {
			t.Errorf("%s has no sections", id)
		}
		if n := count(t, d, `SELECT COUNT(*) FROM homework WHERE book_id = ? AND turned_in_at = ''  AND due_date != ''`, id); n != 1 {
			t.Errorf("%s: due sets = %d, want 1", id, n)
		}
		if n := count(t, d, `SELECT COUNT(*) FROM homework WHERE book_id = ? AND turned_in_at != ''`, id); n != 1 {
			t.Errorf("%s: turned-in sets = %d, want 1", id, n)
		}
		if n := count(t, d, `SELECT COUNT(*) FROM questions q JOIN homework h ON h.id = q.homework_id WHERE h.book_id = ?`, id); n != 8 {
			t.Errorf("%s: questions = %d, want 8", id, n)
		}
		if n := count(t, d, `SELECT COUNT(*) FROM questions q JOIN homework h ON h.id = q.homework_id WHERE h.book_id = ? AND q.state = 'unwritten'`, id); n == 0 {
			t.Errorf("%s has no unwritten question", id)
		}
		if n := count(t, d, `SELECT COUNT(*) FROM calls WHERE subject_type = 'book' AND subject_id = ? AND stage != '' AND run != ''`, id); n == 0 {
			t.Errorf("%s has no import calls", id)
		}
	}
	if n := count(t, d, `SELECT COUNT(*) FROM turns WHERE book_id = 'fx-digital' AND state = 'done' AND answer != '[]'`); n != 2 {
		t.Errorf("answered turns = %d, want 2", n)
	}
	// The audit's usage scenarios look for a finished question and an answered
	// turn that carry a usage line.
	q := count(t, d, `SELECT COUNT(*) FROM questions WHERE state = 'ready' AND walkthrough != '[]'`)
	if q == 0 {
		t.Fatal("no written guide")
	}
	uses, err := usage.ForSubjects(ctx, d, usage.SubjectQuestion, []string{"fx-hw-digital-due-q1"})
	if err != nil || uses["fx-hw-digital-due-q1"] == nil {
		t.Errorf("question usage = %v, %v", uses, err)
	}
	uses, err = usage.ForSubjects(ctx, d, usage.SubjectTurn, []string{"fx-turn-1", "fx-turn-2"})
	if err != nil || uses["fx-turn-1"] == nil || uses["fx-turn-2"] == nil {
		t.Errorf("turn usage = %v, %v", uses, err)
	}
	if n := count(t, d, `SELECT COUNT(*) FROM settings WHERE key IN ('chat', 'embeddings')`); n != 0 {
		t.Errorf("the fixture holds %d model settings, want none", n)
	}
}

func TestRefusals(t *testing.T) {
	inRepoRoot(t)
	ctx := context.Background()
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_DATA_HOME", "")
	t.Setenv("PSET_DATA", "")

	// A directory that holds a library already.
	full := filepath.Join(t.TempDir(), "full")
	if err := os.MkdirAll(full, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(full, "pset.db"), nil, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := build(ctx, full, time.Now()); err == nil || !strings.Contains(err.Error(), "pset.db") {
		t.Errorf("a directory with a pset.db: %v", err)
	}

	for _, rel := range []string{".local/share/pset", ".local/share/pset-test-library", ".local/share/pset/sub", ".local/share"} {
		dir := filepath.Join(home, rel)
		if err := build(ctx, dir, time.Now()); err == nil {
			t.Errorf("%s was not refused", rel)
		}
		if _, err := os.Stat(dir); err == nil {
			t.Errorf("%s was created", rel)
		}
	}

	t.Setenv("PSET_DATA", filepath.Join(home, "elsewhere"))
	if err := build(ctx, filepath.Join(home, "elsewhere"), time.Now()); err == nil {
		t.Error("PSET_DATA was not refused")
	}
}
