//go:build !race

package library

import (
	"fmt"
	"strings"
	"testing"
	"time"
)

// The race detector makes the pure-Go SQLite far slower, so this timing
// runs without it; TestTriggersDeleteByLookup holds the reason under it.
// Removing a book was a full read of the whole index for every page it
// had: 17 seconds for 800 pages among ten books, holding the write lock.
func TestRemovingABookIsNotSlowInABigLibrary(t *testing.T) {
	d := ftsDB(t, Migrations())
	text := strings.Repeat("voltage current resistor node loop theorem ", 40)
	tx, err := d.Begin()
	if err != nil {
		t.Fatal(err)
	}
	for b := 0; b < 10; b++ {
		id := fmt.Sprintf("%08d-aaaa-bbbb-cccc-dddddddddddd", b)
		tx.Exec(`INSERT INTO books (id, sha256, title, state, created_at, updated_at) VALUES (?, ?, 'b', 'ready', '', '')`, id, id)
		for p := 1; p <= 800; p++ {
			tx.Exec(`INSERT INTO pages (book_id, number, text, status) VALUES (?, ?, ?, 'text')`, id, p, fmt.Sprintf("%s page %d", text, p))
		}
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	start := time.Now()
	if _, err := d.Exec(`DELETE FROM books WHERE id = ?`, "00000003-aaaa-bbbb-cccc-dddddddddddd"); err != nil {
		t.Fatal(err)
	}
	if took := time.Since(start); took > 5*time.Second {
		t.Errorf("removing an 800-page book among ten took %v", took)
	} else {
		t.Logf("removed an 800-page book among ten in %v", took)
	}
	var n int
	d.QueryRow(`SELECT count(*) FROM pages_fts`).Scan(&n)
	if n != 9*800 {
		t.Errorf("the index holds %d rows, want %d", n, 9*800)
	}
}
