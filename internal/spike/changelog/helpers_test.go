package changelog

import (
	"context"
	"database/sql"
	"fmt"
	"math/rand"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/db"
)

var bg = context.Background()

func open(t testing.TB, o Options) *sql.DB {
	t.Helper()
	d, _, err := Open(t.TempDir(), o)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	return d
}

func all() Options { return Options{Log: []Table{Homework, Questions, Pages}} }

func must(t testing.TB, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

const bookID = "book-1"

// seed adds a book, a set and n questions with a written guide, as PSet.
func seed(t testing.TB, d *sql.DB, n int) (setID string, qs []string) {
	t.Helper()
	setID = "set-1"
	now := db.Now()
	write := func(fn func(tx *sql.Tx) error) error { return Write(bg, d, "pset", "seed", fn) }
	var hasCtx int
	must(t, d.QueryRow(`SELECT count(*) FROM sqlite_master WHERE name = 'change_ctx'`).Scan(&hasCtx))
	if hasCtx == 0 {
		write = func(fn func(tx *sql.Tx) error) error { return db.Tx(bg, d, fn) }
	}
	must(t, write(func(tx *sql.Tx) error {
		if _, err := tx.Exec(`INSERT INTO books (id, sha256, title, state, created_at, updated_at) VALUES (?, ?, 'Circuits', 'ready', ?, ?)`, bookID, bookID, now, now); err != nil {
			return err
		}
		if _, err := tx.Exec(`INSERT INTO homework (id, book_id, title, due_date, created_at, updated_at) VALUES (?, ?, 'HW 3', '2026-11-20', ?, ?)`, setID, bookID, now, now); err != nil {
			return err
		}
		for i := 1; i <= n; i++ {
			id := fmt.Sprintf("q-%02d", i)
			qs = append(qs, id)
			if _, err := tx.Exec(`INSERT INTO questions (id, homework_id, position, text, in_book, label, statement, notes, state, page, hint, walkthrough, created_at, updated_at)
				VALUES (?, ?, ?, ?, 1, ?, '[]', '[]', 'ready', ?, ?, ?, ?, ?)`,
				id, setID, i, fmt.Sprintf("2.%d", i), fmt.Sprintf("2.%d", i), 40+i, guideJSON(1, 300), guideJSON(int64(i), 6000), now, now); err != nil {
				return err
			}
		}
		return nil
	}))
	return setID, qs
}

var vocab = strings.Fields(`the voltage current resistor node loop theorem Thevenin Norton equivalent
circuit source series parallel capacitor inductor impedance phasor frequency response gain amplifier
operational feedback input output ground branch mesh analysis superposition power energy dissipated
figure example problem section chapter determine find compute assume ideal steady state transient
time constant initial condition differential equation solution step function natural forced`)

// pageText is about n characters of textbook-like text, deterministic per seed.
func pageText(seed int64, n int) string {
	r := rand.New(rand.NewSource(seed))
	var b strings.Builder
	for b.Len() < n {
		switch r.Intn(12) {
		case 0:
			fmt.Fprintf(&b, "%d.%d ", r.Intn(12)+1, r.Intn(40)+1)
		case 1:
			fmt.Fprintf(&b, "%.2f ", r.Float64()*100)
		case 2:
			b.WriteString("V = IR. ")
		default:
			b.WriteString(vocab[r.Intn(len(vocab))])
			if r.Intn(9) == 0 {
				b.WriteString(".\n")
			} else {
				b.WriteByte(' ')
			}
		}
	}
	return b.String()
}

// guideJSON is a JSON document about n bytes long.
func guideJSON(seed int64, n int) string {
	var blocks []string
	size := 0
	for i := int64(0); size < n; i++ {
		s := fmt.Sprintf(`{"kind":"step","runs":[{"text":%q}]}`, pageText(seed+i, 200))
		blocks = append(blocks, s)
		size += len(s)
	}
	return "[" + strings.Join(blocks, ",") + "]"
}

func count(t testing.TB, d *sql.DB, q string, args ...any) int {
	t.Helper()
	var n int
	must(t, d.QueryRow(q, args...).Scan(&n))
	return n
}

func dump(t testing.TB, d *sql.DB, q string, args ...any) {
	t.Helper()
	rows, err := Rows(d, q, args...)
	must(t, err)
	for _, r := range rows {
		var parts []string
		for _, k := range []string{"seq", "kind", "res_id", "set_id", "course_id", "op", "actor", "action_id", "undoes", "before", "after"} {
			if v, ok := r[k]; ok {
				parts = append(parts, fmt.Sprintf("%s=%s", k, short(v)))
			}
		}
		if len(parts) == 0 {
			for k, v := range r {
				parts = append(parts, fmt.Sprintf("%s=%s", k, short(v)))
			}
		}
		t.Log(strings.Join(parts, " "))
	}
}
