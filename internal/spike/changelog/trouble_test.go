package changelog

import (
	"database/sql"
	"fmt"
	"testing"
)

// INSERT OR REPLACE: with recursive_triggers off (the default here), the
// row REPLACE deletes fires no delete trigger, so the log sees a "created" for
// a row that existed, and the replaced row's children go by the foreign key's
// cascade without a word. With recursive_triggers on, the delete trigger
// fires and refuses it.
func TestInsertOrReplace(t *testing.T) {
	for _, rec := range []bool{false, true} {
		t.Run(fmt.Sprintf("recursive_triggers=%v", rec), func(t *testing.T) {
			d := open(t, all())
			d.SetMaxOpenConns(1) // so the pragma holds for every statement
			if rec {
				_, err := d.Exec(`PRAGMA recursive_triggers = ON`)
				must(t, err)
			}
			setID, _ := seed(t, d, 3)
			err := Write(bg, d, "student", "replace", func(tx *sql.Tx) error {
				_, err := tx.Exec(`INSERT OR REPLACE INTO homework (id, book_id, title, created_at, updated_at) VALUES (?, ?, 'replaced', '', '')`, setID, bookID)
				return err
			})
			t.Logf("INSERT OR REPLACE over an existing set -> %v", err)
			dump(t, d, `SELECT * FROM changes WHERE action_id = 'replace'`)
			t.Logf("questions left in the set: %d of 3", count(t, d, `SELECT count(*) FROM questions WHERE homework_id = ?`, setID))
			// A leaf row (a question, no children).
			err = Write(bg, d, "student", "replace-q", func(tx *sql.Tx) error {
				_, err := tx.Exec(`INSERT OR REPLACE INTO questions (id, homework_id, position, text, in_book, state, created_at, updated_at) VALUES ('q-01', ?, 1, 'replaced', 0, 'pending', '', '')`, setID)
				return err
			})
			t.Logf("INSERT OR REPLACE over an existing question (a leaf) -> %v", err)
			dump(t, d, `SELECT * FROM changes WHERE action_id = 'replace-q'`)
		})
	}
}

// The rev trigger with recursive triggers on: its WHEN still stops it, and
// one real update still logs exactly one row.
func TestRevTriggerWithRecursiveTriggers(t *testing.T) {
	d := open(t, all())
	d.SetMaxOpenConns(1)
	_, err := d.Exec(`PRAGMA recursive_triggers = ON`)
	must(t, err)
	_, qs := seed(t, d, 1)
	for i := 0; i < 3; i++ {
		must(t, Write(bg, d, "pset", fmt.Sprintf("a%d", i), func(tx *sql.Tx) error {
			_, err := tx.Exec(`UPDATE questions SET activity = ? WHERE id = ?`, fmt.Sprintf("x%d", i), qs[0])
			return err
		}))
	}
	var rev int
	must(t, d.QueryRow(`SELECT rev FROM questions WHERE id = ?`, qs[0]).Scan(&rev))
	n := count(t, d, `SELECT count(*) FROM changes WHERE kind = 'question' AND op = 'changed'`)
	t.Logf("3 updates with recursive triggers on: rev=%d, %d change rows", rev, n)
	if rev != 3 || n != 3 {
		t.Error("recursion changed the counts")
	}
}

// The importer's upsert: the insert path logs created, the conflict path logs
// changed, and a retry that writes the same text logs nothing.
func TestPagesUpsert(t *testing.T) {
	d := open(t, all())
	seed(t, d, 0)
	up := func(action, text string) {
		must(t, Write(bg, d, "pset", action, func(tx *sql.Tx) error {
			_, err := tx.Exec(`INSERT INTO pages (book_id, number, text, status) VALUES (?, 1, ?, 'text')
		ON CONFLICT (book_id, number) DO UPDATE SET text = excluded.text, status = excluded.status`, bookID, text)
			return err
		}))
	}
	up("first", "page one")
	up("same", "page one")
	up("fixed", "page one, read again")
	dump(t, d, `SELECT * FROM changes WHERE kind = 'page'`)
	if n := count(t, d, `SELECT count(*) FROM changes WHERE kind = 'page'`); n != 2 {
		t.Errorf("want 2 page rows, got %d", n)
	}
}

// Schema changes once triggers exist: dropping or renaming a column a trigger
// names fails; adding one leaves it unlogged (TestEveryColumnIsClassified
// catches that); a migration's Do step that writes needs a context.
func TestMigrationsAfterTriggers(t *testing.T) {
	d := open(t, all())
	seed(t, d, 1)
	for _, q := range []string{
		`ALTER TABLE questions DROP COLUMN activity`,
		`ALTER TABLE questions RENAME COLUMN notes TO prof_notes`,
		`ALTER TABLE questions ADD COLUMN spike_new TEXT NOT NULL DEFAULT ''`,
		`UPDATE questions SET error = '{"chain":["x"]}' WHERE state = 'ready'`, // a Do step's write
	} {
		_, err := d.Exec(q)
		t.Logf("%-70s -> %v", q, err)
	}
	// The renamed column: SQLite rewrites trigger bodies on RENAME COLUMN.
	rows, err := Rows(d, `SELECT name FROM sqlite_master WHERE type = 'trigger' AND sql LIKE '%prof_notes%'`)
	must(t, err)
	t.Logf("triggers rewritten by RENAME COLUMN: %v", rows)
}

// JSON in this build: a BLOB cannot go in a change row's values; REAL and
// large INTEGER values round-trip exactly.
func TestJSONEdges(t *testing.T) {
	d := open(t, Options{})
	var s sql.NullString
	err := d.QueryRow(`SELECT json_object('data', x'00ff')`).Scan(&s)
	t.Logf("json_object with a BLOB -> %v %v", s, err)
	for _, q := range []string{
		`SELECT json_extract(json_object('v', 0.1 + 0.2), '$.v') = 0.1 + 0.2`,
		`SELECT json_extract(json_object('v', 612.0), '$.v') = 612.0 AND typeof(json_extract(json_object('v', 612.0), '$.v')) = 'real'`,
		`SELECT json_extract(json_object('v', 9007199254740993), '$.v') = 9007199254740993`,
		`SELECT typeof(json_extract(json_object('v', '12'), '$.v')) = 'text'`,
		`SELECT json_extract(json_group_object('v', NULL), '$.v') IS NULL`,
	} {
		var ok int
		must(t, d.QueryRow(q).Scan(&ok))
		t.Logf("%-100s -> %v", q, ok == 1)
		if ok != 1 {
			t.Errorf("not exact: %s", q)
		}
	}
}
