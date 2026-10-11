package homework

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
)

// Rows that failed before the catalog get the entries their kind and
// sentence named, so an old failed question or read still says why.
func TestOldFailuresGetTheirEntries(t *testing.T) {
	ctx := context.Background()
	d, err := db.Open(filepath.Join(t.TempDir(), "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup.Close(d)
	d.SetMaxOpenConns(1)
	for _, q := range []string{`PRAGMA foreign_keys = OFF`, `CREATE TABLE books (id TEXT PRIMARY KEY)`} {
		if _, err := d.ExecContext(ctx, q); err != nil {
			t.Fatal(err)
		}
	}
	var before []db.Migration
	for _, m := range Migrations() {
		if m.Name == "homework/18" {
			break
		}
		before = append(before, m)
	}
	if err := db.Migrate(ctx, d, before); err != nil {
		t.Fatal(err)
	}
	if _, err := d.ExecContext(ctx, `INSERT INTO homework (id, book_id, title, created_at, updated_at) VALUES ('h', 'b', 'Set', '', '')`); err != nil {
		t.Fatal(err)
	}
	for id, old := range map[string][2]string{
		"missing":  {"not_found", "Searched the book for problem 3.99 and didn't see it. Show where it is on the page, or give its printed page; if it isn't from this book, paste it below."},
		"pinned":   {"not_found", "It isn't on p. 1 either. Check the page number, or paste the problem below."},
		"nokey":    {"setup", "There's no OpenRouter key yet. Add yours in Settings, under Connections, then try again."},
		"credit":   {"setup", "Your OpenRouter account is out of credit. Top it up at openrouter.ai, then try again."},
		"busy":     {"unavailable", "OpenRouter didn't answer, or is busy right now. Nothing is wrong with problem 3.36: try again in a minute."},
		"cut":      {"generation", "The walkthrough for problem 4.4 stopped partway: the connection to the model dropped. Trying again usually works."},
		"part":     {"generation", "The walkthrough for problem 4.4 came back missing a part. Trying again usually works."},
		"boxes":    {"generation", "Couldn't read the words in the boxes. Box the problem's text again, a little larger."},
		"whatever": {"generation", "Something went wrong writing the walkthrough for this question. Trying again usually works."},
	} {
		if _, err := d.ExecContext(ctx, `INSERT INTO questions (id, homework_id, position, text, in_book, state, failure, reason, created_at, updated_at) VALUES (?, 'h', 1, 't', 1, 'failed', ?, ?, '', '')`, id, old[0], old[1]); err != nil {
			t.Fatal(err)
		}
	}
	for id, msg := range map[string]string{
		"r-key":  "There's no OpenRouter key yet. Add yours in Settings, under Connections, then try again.",
		"r-page": "That page answered 404. A page behind a login can be pasted or photographed instead.",
		"r-none": "Couldn't read it. Try again, or paste just the part with the problems.",
	} {
		if _, err := d.ExecContext(ctx, `INSERT INTO assignment_reads (id, book_id, source, state, error, created_at, updated_at) VALUES (?, 'b', 's', 'failed', ?, '', '')`, id, msg); err != nil {
			t.Fatal(err)
		}
	}
	if err := db.Migrate(ctx, d, Migrations()); err != nil {
		t.Fatal(err)
	}

	for id, want := range map[string][]string{
		"missing":  {"homework.not_found_in_book"},
		"pinned":   {"homework.not_found_in_book"},
		"nokey":    {"homework.guide_failed", "key.missing"},
		"credit":   {"homework.guide_failed", "key.out_of_credit"},
		"busy":     {"homework.guide_failed", "model.busy"},
		"cut":      {"homework.guide_failed", "model.cut"},
		"part":     {"homework.guide_failed", "homework.guide_incomplete"},
		"boxes":    {"homework.boxes_unreadable"},
		"whatever": {"homework.guide_failed"},
	} {
		q, err := getQuestion(ctx, d, id)
		if err != nil || q.Error == nil || len(q.Error.Chain) != len(want) {
			t.Errorf("%s: %+v (%v), want %v", id, q.Error, err, want)
			continue
		}
		for i := range want {
			if q.Error.Chain[i] != want[i] {
				t.Errorf("%s: chain %v, want %v", id, q.Error.Chain, want)
			}
		}
	}
	missing, _ := getQuestion(ctx, d, "missing")
	if got := missing.Error.What; got != "Couldn't find problem 3.99 in this book." {
		t.Errorf("missing: %q", got)
	}
	pinned, _ := getQuestion(ctx, d, "pinned")
	if got := pinned.Error.Why; got != "PSet looked through p. 1 and didn't see it." {
		t.Errorf("pinned: %q", got)
	}
	r, err := scanRead(d.QueryRowContext(ctx, `SELECT `+readColumns+` FROM assignment_reads WHERE id = 'r-page'`))
	if err != nil || r.Error == nil || r.Error.Chain[1] != "homework.page_refused" || r.Error.What != "Couldn't read the assignment." {
		t.Errorf("read: %+v (%v)", r.Error, err)
	}
	if got := r.Error.Why; got != "It answered 404, which usually means it is behind a login." {
		t.Errorf("read why: %q", got)
	}
}
