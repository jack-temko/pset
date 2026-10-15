package library

import (
	"context"
	"database/sql"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/testx"
)

func ftsDB(t *testing.T, migs []db.Migration) *sql.DB {
	t.Helper()
	d, err := db.Open(filepath.Join(t.TempDir(), "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cleanup.Close(d) })
	if err := db.Migrate(context.Background(), d, migs); err != nil {
		t.Fatal(err)
	}
	return d
}

func addBook(t *testing.T, d *sql.DB, id string, pages ...string) {
	t.Helper()
	if _, err := d.Exec(`INSERT INTO books (id, sha256, title, state, created_at, updated_at) VALUES (?, ?, 'b', 'ready', '', '')`, id, id); err != nil {
		t.Fatal(err)
	}
	for i, text := range pages {
		if _, err := d.Exec(`INSERT INTO pages (book_id, number, text, status) VALUES (?, ?, ?, 'text')`, id, i+1, text); err != nil {
			t.Fatal(err)
		}
	}
}

func search(t *testing.T, d *sql.DB, id, query string) []int {
	t.Helper()
	got, err := searchFTS(context.Background(), d, id, query, 20)
	if err != nil {
		t.Fatal(err)
	}
	return got
}

const bookA, bookB = "0a1b2c3d-4a11-8958-cccc-dddddddddddd", "99999999-4a11-1111-cccc-dddddddddddd"

// A search finds its own book's pages, and nothing of another's or of the
// index's own columns: a word that is part of an id or a page number is
// only ever text.
func TestSearchIsConfinedToItsBooksText(t *testing.T) {
	d := ftsDB(t, Migrations())
	addBook(t, d, bookA, "the theorem of eigenvalues", "determinants and matrices", "theorem 2.3 states")
	addBook(t, d, bookB, "theorem in another book", "matrices again")

	for _, tc := range []struct {
		book, query string
		want        []int
	}{
		{bookA, "theorem", []int{1, 3}},
		{bookB, "theorem", []int{1}},
		{bookA, "matrices", []int{2}},
		{bookA, "another", nil},
		{bookA, "4a11", nil},   // part of both ids
		{bookA, "8958", nil},   // part of an id
		{bookA, "2", []int{3}}, // page 2 exists, but "2" is only text on page 3
		{bookA, "Theorem 2.3", []int{3}},
		{"not-a-book", "theorem", nil},
		{"--", "theorem", nil},
	} {
		got := search(t, d, tc.book, tc.query)
		slices.Sort(got)
		if !slices.Equal(got, tc.want) && (len(got) != 0 || len(tc.want) != 0) {
			t.Errorf("%s %q: pages %v, want %v", tc.book[:8], tc.query, got, tc.want)
		}
	}
}

// Editing a page's text (a retried read) replaces what the index holds for
// it, and removing the book removes all of it.
func TestIndexFollowsPageEditsAndRemoval(t *testing.T) {
	d := ftsDB(t, Migrations())
	addBook(t, d, bookA, "alpha page", "beta page")
	addBook(t, d, bookB, "alpha elsewhere")
	if _, err := d.Exec(`UPDATE pages SET text = 'gamma page' WHERE book_id = ? AND number = 1`, bookA); err != nil {
		t.Fatal(err)
	}
	if got := search(t, d, bookA, "alpha"); len(got) != 0 {
		t.Errorf("the old text still matches: %v", got)
	}
	if got := search(t, d, bookA, "gamma"); !slices.Equal(got, []int{1}) {
		t.Errorf("the new text: %v", got)
	}
	if got := search(t, d, bookA, "page"); len(got) != 2 {
		t.Errorf("the other page went with it: %v", got)
	}
	if _, err := d.Exec(`DELETE FROM books WHERE id = ?`, bookA); err != nil {
		t.Fatal(err)
	}
	var n int
	testx.Check(t, d.QueryRow(`SELECT count(*) FROM pages_fts`).Scan(&n))
	if n != 1 || len(search(t, d, bookB, "alpha")) != 1 {
		t.Errorf("after removing a book the index holds %d rows, want the other book's 1", n)
	}
}

// Libraries that had an index before it was keyed by book get it rebuilt,
// and search answers the same.
func TestOldIndexIsRebuilt(t *testing.T) {
	migs := Migrations()
	d := ftsDB(t, migs[:4])
	addBook(t, d, bookA, "the theorem of eigenvalues", "determinants and matrices")
	addBook(t, d, bookB, "theorem in another book")
	if err := db.Migrate(context.Background(), d, migs); err != nil {
		t.Fatal(err)
	}
	if got := search(t, d, bookA, "theorem"); !slices.Equal(got, []int{1}) {
		t.Errorf("after the rebuild: %v", got)
	}
	if got := search(t, d, bookB, "another book"); !slices.Equal(got, []int{1}) {
		t.Errorf("after the rebuild, book B: %v", got)
	}
}

// The triggers delete a page's index row by MATCH on its book and number,
// which is a lookup. Deleting by the columns' values (WHERE book_id = ...
// AND number = ...) reads the whole index for every page a book has, and
// removing an 800-page book among ten took 17 seconds under the write lock.
// (fts_speed_test.go times it; this holds under the race detector too.)
func TestTriggersDeleteByLookup(t *testing.T) {
	d := ftsDB(t, Migrations())
	rows, err := d.Query(`SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND name IN ('pages_au', 'pages_ad')`)
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup.Close(rows)
	n := 0
	for rows.Next() {
		var name, body string
		testx.Check(t, rows.Scan(&name, &body))
		n++
		if !strings.Contains(body, "pages_fts MATCH") || strings.Contains(body, "book_id = old.book_id") {
			t.Errorf("%s deletes from the index by column values, not by lookup:\n%s", name, body)
		}
	}
	if n != 2 {
		t.Errorf("found %d delete triggers, want 2", n)
	}
}
