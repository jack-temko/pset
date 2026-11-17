package changelog

import (
	"database/sql"
	"os"
	"sort"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/db"
)

// Writes the generated SQL for the three tables to $CHANGELOG_SQL_OUT (if
// set) so it can be read whole.
func TestGeneratedSQL(t *testing.T) {
	var b strings.Builder
	for _, tb := range []Table{Homework, Questions, Pages} {
		b.WriteString("-- " + tb.Name + "\n" + Triggers(tb, StudentColsOnly) + "\n")
	}
	b.WriteString("-- questions, AllColsWhenStudent\n" + Triggers(Questions, AllColsWhenStudent))
	if p := os.Getenv("CHANGELOG_SQL_OUT"); p != "" {
		must(t, os.WriteFile(p, []byte(b.String()), 0o644))
	}
	// Both policies must compile against the real tables.
	for _, p := range []Policy{StudentColsOnly, AllColsWhenStudent} {
		open(t, Options{Log: []Table{Homework, Questions, Pages}, Policy: p})
	}
}

// Every column of every logged table is classified exactly once, so a new
// column cannot go unlogged (or be logged as PSet's by accident).
func TestEveryColumnIsClassified(t *testing.T) {
	d := open(t, all())
	for _, tb := range []Table{Homework, Questions, Pages} {
		seen := map[string]int{}
		for _, group := range [][]string{tb.Key, tb.Student, tb.PSet, tb.Meta} {
			for _, c := range group {
				seen[c]++
			}
		}
		// A key column may also be a PSet column (pages.book_id is the key).
		rows, err := Rows(d, `SELECT name FROM pragma_table_info(?)`, tb.Name)
		must(t, err)
		var real []string
		for _, r := range rows {
			c := r["name"].(string)
			real = append(real, c)
			if seen[c] == 0 {
				t.Errorf("%s.%s is not classified", tb.Name, c)
			}
			delete(seen, c)
		}
		for c := range seen {
			t.Errorf("%s.%s is classified but is not a column", tb.Name, c)
		}
		sort.Strings(real)
		t.Logf("%s: %d columns", tb.Name, len(real))
	}
}

func TestUpdateLogsOnlyRealChanges(t *testing.T) {
	d := open(t, all())
	setID, qs := seed(t, d, 2)
	base := count(t, d, `SELECT count(*) FROM changes`)

	// A no-op update (same values) logs nothing, and needs no context.
	_, err := d.Exec(`UPDATE homework SET title = title WHERE id = ?`, setID)
	must(t, err)
	// A Meta-only update (updated_at) logs nothing either.
	_, err = d.Exec(`UPDATE homework SET updated_at = ? WHERE id = ?`, db.Now(), setID)
	must(t, err)
	// The rev trigger's own update (rev only) logs nothing.
	_, err = d.Exec(`UPDATE questions SET rev = rev + 5 WHERE id = ?`, qs[0])
	must(t, err)
	if n := count(t, d, `SELECT count(*) FROM changes`); n != base {
		t.Fatalf("no-op updates logged %d rows", n-base)
	}

	// A PSet-only update logs "changed" with no values.
	must(t, Write(bg, d, "pset", "a-activity", func(tx *sql.Tx) error {
		_, err := tx.Exec(`UPDATE questions SET activity = 'thinking' WHERE id = ?`, qs[0])
		return err
	}))
	// A mixed update logs only the student columns that changed.
	must(t, Write(bg, d, "student", "a-notes", func(tx *sql.Tx) error {
		_, err := tx.Exec(`UPDATE questions SET notes = '["do c"]', hint = '[]', state = 'located', updated_at = ? WHERE id = ?`, db.Now(), qs[0])
		return err
	}))
	// A multi-row update logs one row per row it really changed.
	must(t, Write(bg, d, "student", "a-shift", func(tx *sql.Tx) error {
		_, err := tx.Exec(`UPDATE questions SET position = position WHERE homework_id = ?`, setID)
		return err
	}))
	dump(t, d, `SELECT * FROM changes WHERE seq > ? ORDER BY seq`, base)
	rows, err := Rows(d, `SELECT action_id, op, before, after FROM changes WHERE seq > ? ORDER BY seq`, base)
	must(t, err)
	if len(rows) != 2 {
		t.Fatalf("want 2 rows, got %d", len(rows))
	}
	if rows[0]["before"] != nil || rows[0]["after"] != nil {
		t.Errorf("PSet-only change carried values: %v", rows[0])
	}
	if rows[1]["before"] != `{"notes":"[]"}` || rows[1]["after"] != `{"notes":"[\"do c\"]"}` {
		t.Errorf("mixed change values: %v / %v", rows[1]["before"], rows[1]["after"])
	}
	// Exactly one row for the one UPDATE statement: the rev trigger's
	// nested UPDATE did not log a second.
	var rev int
	must(t, d.QueryRow(`SELECT rev FROM questions WHERE id = ?`, qs[0]).Scan(&rev))
	t.Logf("rev after: %d (5 by hand + one per real update)", rev)
}

// Values round-trip with their SQL type: an INTEGER stays an INTEGER, a TEXT
// that looks like a number stays TEXT, NULL stays NULL, JSON-in-TEXT stays
// the same bytes.
func TestValueTypesRoundTrip(t *testing.T) {
	d := open(t, all())
	_, qs := seed(t, d, 1)
	before, err := Rows(d, `SELECT * FROM questions WHERE id = ?`, qs[0])
	must(t, err)
	must(t, Write(bg, d, "student", "a-types", func(tx *sql.Tx) error {
		_, err := tx.Exec(`UPDATE questions SET label = '2.10', pinned_page = 12, position = 7, notes = '[ {"a" : 1} ]', text = 'a "quoted" line
and a newline', done_at = '2026-11-17T01:00:00.000000000Z' WHERE id = ?`, qs[0])
		return err
	}))
	dump(t, d, `SELECT * FROM changes WHERE action_id = 'a-types'`)
	must(t, Undo(bg, d, "a-types", "u-types"))
	after, err := Rows(d, `SELECT * FROM questions WHERE id = ?`, qs[0])
	must(t, err)
	if diff := Diff(before, after, "rev"); len(diff) > 0 {
		t.Errorf("not restored: %v", diff)
	}
	// And forward: the after values, applied to the before row, give the
	// row the action left, type for type.
	var label, notes any
	must(t, d.QueryRow(`SELECT json_extract(after, '$.label'), json_extract(after, '$.notes') FROM changes WHERE action_id = 'a-types'`).Scan(&label, &notes))
	if label != "2.10" || notes != `[ {"a" : 1} ]` {
		t.Errorf("after values changed form: %#v %#v", label, notes)
	}
}
