package changelog

import (
	"database/sql"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/jackt/pset/internal/db"
)

// Collapse is the stream's read: every resource changed after a sequence,
// once, with its newest row's op and actor, how many rows the burst had,
// whether it was created (or removed) inside the burst, and the newest value
// of every student column the burst wrote. SQLite gives the bare columns of
// the max(seq) row.
const Collapse = `
WITH burst AS MATERIALIZED (
	SELECT * FROM changes WHERE seq > :after
),
latest AS (
	SELECT kind, res_id, max(seq) AS seq, op, actor, set_id, course_id, count(*) AS n,
		max(op = 'created') AS created, max(op = 'removed') AS removed
	FROM burst GROUP BY kind, res_id
),
vals AS (
	SELECT kind, res_id, key, value, type,
		row_number() OVER (PARTITION BY kind, res_id, key ORDER BY seq DESC) AS rn
	FROM burst, json_each(burst.after)
)
SELECT l.kind, l.res_id, l.seq, l.op, l.actor, l.set_id, l.course_id, l.n, l.created, l.removed,
	(SELECT json_group_object(key, CASE type WHEN 'null' THEN json('null') ELSE value END)
	 FROM vals v WHERE v.kind = l.kind AND v.res_id = l.res_id AND v.rn = 1) AS latest
FROM latest l ORDER BY l.seq`

func plan(t *testing.T, d *sql.DB, q string, args ...any) {
	t.Helper()
	rows, err := Rows(d, "EXPLAIN QUERY PLAN "+q, args...)
	must(t, err)
	var out []string
	for _, r := range rows {
		out = append(out, fmt.Sprintf("  %v %v %v", r["id"], r["parent"], r["detail"]))
	}
	t.Logf("plan for %s\n%s", strings.Join(strings.Fields(q), " ")[:min(90, len(strings.Join(strings.Fields(q), " ")))], strings.Join(out, "\n"))
}

func TestReplayCollapses(t *testing.T) {
	d := open(t, all())
	setID, qs := seed(t, d, 3)
	var mark int
	must(t, d.QueryRow(`SELECT max(seq) FROM changes`).Scan(&mark))

	// Ten changes to one question: PSet writing the guide, the student
	// marking it done, renaming it, then PSet again.
	for i := 0; i < 10; i++ {
		actor, action := "pset", fmt.Sprintf("job-%d", i)
		stmt, args := `UPDATE questions SET activity = ? WHERE id = ?`, []any{fmt.Sprintf("step %d", i), qs[0]}
		switch i {
		case 3:
			actor, stmt, args = "student", `UPDATE questions SET done_at = ? WHERE id = ?`, []any{"2026-11-17T01:00:00.000000000Z", qs[0]}
		case 5, 7:
			actor, stmt, args = "student", `UPDATE questions SET label = ?, notes = ?, pinned_page = 12 WHERE id = ?`, []any{fmt.Sprintf("2.%d", i), fmt.Sprintf(`["note %d"]`, i), qs[0]}
		case 8:
			actor, stmt, args = "student", `UPDATE questions SET pinned_page = NULL, label = 'final' WHERE id = ?`, []any{qs[0]}
		}
		must(t, Write(bg, d, actor, action, func(tx *sql.Tx) error {
			_, err := tx.Exec(stmt, args...)
			return err
		}))
	}
	// And one change to another question and the set.
	must(t, Write(bg, d, "student", "x", func(tx *sql.Tx) error {
		if _, err := tx.Exec(`UPDATE questions SET done_at = 'now' WHERE id = ?`, qs[1]); err != nil {
			return err
		}
		_, err := tx.Exec(`UPDATE homework SET title = 'HW 3b' WHERE id = ?`, setID)
		return err
	}))
	t.Logf("%d rows after seq %d", count(t, d, `SELECT count(*) FROM changes WHERE seq > ?`, mark), mark)
	dump(t, d, Collapse, sql.Named("after", mark))
	rows, err := Rows(d, Collapse, sql.Named("after", mark))
	must(t, err)
	if len(rows) != 3 {
		t.Fatalf("want 3 notices, got %d", len(rows))
	}
	q := rows[0]
	if q["res_id"] != qs[0] || q["n"] != int64(10) {
		t.Errorf("first notice: %v", q)
	}
	want := `{"done_at":"2026-11-17T01:00:00.000000000Z","label":"final","notes":"[\"note 7\"]","pinned_page":null}`
	if q["latest"] != want {
		t.Errorf("latest values:\n got %v\nwant %v", q["latest"], want)
	}
	t.Logf("notice for %s: n=%v op=%v actor=%v latest=%v", q["res_id"], q["n"], q["op"], q["actor"], q["latest"])

	plan(t, d, Collapse, sql.Named("after", mark))
	plan(t, d, `SELECT * FROM changes WHERE seq > ? ORDER BY seq LIMIT 500`, mark)
	plan(t, d, `SELECT * FROM changes WHERE seq > ? AND course_id = ? ORDER BY seq`, mark, bookID)
	plan(t, d, `SELECT seq, kind, res_id, op, before, after FROM changes WHERE action_id = ? ORDER BY seq DESC`, "x")
	plan(t, d, `SELECT l.seq FROM changes l WHERE l.kind = ? AND l.res_id = ? AND l.seq > ? AND l.action_id != ? AND l.after IS NOT NULL AND l.undoes = '' AND NOT EXISTS (SELECT 1 FROM changes u WHERE u.undoes = l.action_id AND u.undoes != '')`, "question", qs[0], 1, "x")
	plan(t, d, `DELETE FROM changes WHERE seq <= (SELECT max(seq) FROM changes WHERE at < ?)`, "x")
	plan(t, d, `DELETE FROM changes WHERE at < ?`, "x")
}

// The purge: hidden rows a week old are deleted (as the purge actor, so the
// delete triggers allow it and log nothing), and change rows a week old go
// too. AUTOINCREMENT keeps seq rising even when every row was purged; a plain
// INTEGER PRIMARY KEY reuses numbers, which would make a page that last saw
// seq 40 miss the new seq 1..40.
func TestPurgeKeepsSeqMonotonic(t *testing.T) {
	d := open(t, all())
	setID, _ := seed(t, d, 12)
	student(t, d, "remove", func(tx *sql.Tx) error {
		_, err := tx.Exec(`UPDATE homework SET removed_at = ? WHERE id = ?`, db.At(time.Now().Add(-8*24*time.Hour)), setID)
		return err
	})
	var last int64
	must(t, d.QueryRow(`SELECT max(seq) FROM changes`).Scan(&last))
	// Age every change row past the week.
	_, err := d.Exec(`UPDATE changes SET at = ?`, db.At(time.Now().Add(-8*24*time.Hour)))
	must(t, err)

	cutoff := db.At(time.Now().Add(-7 * 24 * time.Hour))
	must(t, Write(bg, d, "purge", "purge-1", func(tx *sql.Tx) error {
		if _, err := tx.Exec(`DELETE FROM homework WHERE removed_at != '' AND removed_at < ?`, cutoff); err != nil {
			return err
		}
		_, err := tx.Exec(`DELETE FROM changes WHERE seq <= (SELECT max(seq) FROM changes WHERE at < ?)`, cutoff)
		return err
	}))
	t.Logf("after purge: %d sets, %d questions, %d change rows", count(t, d, `SELECT count(*) FROM homework`), count(t, d, `SELECT count(*) FROM questions`), count(t, d, `SELECT count(*) FROM changes`))
	must(t, Write(bg, d, "student", "new", func(tx *sql.Tx) error {
		_, err := tx.Exec(`INSERT INTO homework (id, book_id, title, created_at, updated_at) VALUES ('set-2', ?, 'HW 4', '', '')`, bookID)
		return err
	}))
	var next int64
	must(t, d.QueryRow(`SELECT max(seq) FROM changes`).Scan(&next))
	t.Logf("last seq before purge %d, first seq after %d", last, next)
	if next <= last {
		t.Errorf("seq went back: %d after %d", next, last)
	}

	// The same without AUTOINCREMENT.
	_, err = d.Exec(`CREATE TABLE plain (seq INTEGER PRIMARY KEY, x TEXT); INSERT INTO plain (x) VALUES ('a'), ('b'), ('c'); DELETE FROM plain; INSERT INTO plain (x) VALUES ('d')`)
	must(t, err)
	var p int64
	must(t, d.QueryRow(`SELECT seq FROM plain`).Scan(&p))
	t.Logf("plain INTEGER PRIMARY KEY: 3 rows, all deleted, the next row gets seq %d (reused)", p)
}
