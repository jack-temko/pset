package changelog

import (
	"database/sql"
	"errors"
	"testing"

	"github.com/jackt/pset/internal/db"
)

// Columns that are meant to move when an undo writes values back: the rev
// trigger bumps rev on every update, and the real statements stamp
// updated_at. Everything else must come back exactly, type included.
var moving = []string{"rev", "updated_at"}

func snapshot(t *testing.T, d *sql.DB, setID string) [][]Row {
	t.Helper()
	h, err := Rows(d, `SELECT * FROM homework WHERE id = ?`, setID)
	must(t, err)
	q, err := Rows(d, `SELECT * FROM questions WHERE homework_id = ? ORDER BY id`, setID)
	must(t, err)
	im, err := Rows(d, `SELECT * FROM question_images ORDER BY id`)
	must(t, err)
	b, err := Rows(d, `SELECT * FROM books ORDER BY id`)
	must(t, err)
	return [][]Row{h, q, im, b}
}

func compare(t *testing.T, label string, before, after [][]Row) bool {
	t.Helper()
	return compareX(t, label, before, after, false)
}

// compareX with expectLoss logs the differences instead of failing.
func compareX(t *testing.T, label string, before, after [][]Row, expectLoss bool) bool {
	t.Helper()
	errorf := t.Errorf
	if expectLoss {
		errorf = t.Logf
	}
	ok := true
	for i, name := range []string{"homework", "questions", "question_images", "books"} {
		if diff := Diff(before[i], after[i], moving...); len(diff) > 0 {
			ok = false
			errorf("%s: %s differs after undo:", label, name)
			for _, d := range diff {
				errorf("   %s", d)
			}
		}
	}
	if ok {
		t.Logf("%s: every row of homework, questions, question_images and books matches (ignoring %v)", label, moving)
	}
	return ok
}

func student(t *testing.T, d *sql.DB, action string, fn func(tx *sql.Tx) error) {
	t.Helper()
	must(t, Write(bg, d, "student", action, fn))
}

// move is homework.move, verbatim.
func move(tx *sql.Tx, setID, id string, from, to int) error {
	shift := `UPDATE questions SET position = position + 1 WHERE homework_id = ? AND position >= ? AND position < ?`
	if to > from {
		shift = `UPDATE questions SET position = position - 1 WHERE homework_id = ? AND position <= ? AND position > ?`
	}
	if _, err := tx.Exec(shift, setID, to, from); err != nil {
		return err
	}
	_, err := tx.Exec(`UPDATE questions SET position = ? WHERE id = ?`, to, id)
	return err
}

func TestUndoEachAction(t *testing.T) {
	for _, p := range []struct {
		name string
		pol  Policy
	}{{"StudentColsOnly", StudentColsOnly}, {"AllColsWhenStudent", AllColsWhenStudent}} {
		t.Run(p.name, func(t *testing.T) {
			d := open(t, Options{Log: []Table{Homework, Questions, Pages}, Policy: p.pol})
			setID, qs := seed(t, d, 12)
			cases := []struct {
				name string
				do   func(tx *sql.Tx) error
			}{
				{"rename a set", func(tx *sql.Tx) error {
					_, err := tx.Exec(`UPDATE homework SET title = ?, due_date = ?, turned_in_at = ?, updated_at = ? WHERE id = ?`,
						"HW 3 (Thevenin)", "2026-11-20", "", db.Now(), setID)
					return err
				}},
				{"reorder questions (5 to 2)", func(tx *sql.Tx) error { return move(tx, setID, qs[4], 5, 2) }},
				{"reorder questions (1 to 12)", func(tx *sql.Tx) error { return move(tx, setID, qs[0], 1, 12) }},
				{"mark done", func(tx *sql.Tx) error {
					_, err := tx.Exec(`UPDATE questions SET done_at = ? WHERE id = ?`, db.Now(), qs[2])
					return err
				}},
				{"edit a note (rewrite clears the guide)", func(tx *sql.Tx) error {
					_, err := tx.Exec(`UPDATE questions SET notes = ?, hint = '[]', walkthrough = '[]', rounds = '[]',
			state = ?, error = '', activity = '', updated_at = ? WHERE id = ?`, `[[{"text":"do part c only"}]]`, "located", db.Now(), qs[3])
					return err
				}},
				{"remove the set (12 questions) by marker", func(tx *sql.Tx) error {
					_, err := tx.Exec(`UPDATE homework SET removed_at = ?, updated_at = ? WHERE id = ?`, db.Now(), db.Now(), setID)
					return err
				}},
			}
			for i, c := range cases {
				before := snapshot(t, d, setID)
				action := "a" + string(rune('0'+i))
				student(t, d, action, c.do)
				n := count(t, d, `SELECT count(*) FROM changes WHERE action_id = ?`, action)
				err := Undo(bg, d, action, "undo-"+action)
				t.Logf("%s: %d change rows; undo -> %v", c.name, n, err)
				if err != nil {
					t.Errorf("%s: undo failed: %v", c.name, err)
					continue
				}
				loss := p.pol == StudentColsOnly && i == 4
				if loss {
					t.Logf("EXPECTED under StudentColsOnly: the guide the edit cleared was never logged")
				}
				compareX(t, c.name, before, snapshot(t, d, setID), loss)
			}
		})
	}
}

func TestUndoOrder(t *testing.T) {
	d := open(t, all())
	setID, qs := seed(t, d, 2)
	orig := snapshot(t, d, setID)
	rename := func(action, title string) {
		student(t, d, action, func(tx *sql.Tx) error {
			_, err := tx.Exec(`UPDATE homework SET title = ?, updated_at = ? WHERE id = ?`, title, db.Now(), setID)
			return err
		})
	}
	rename("A", "Y")
	afterA := snapshot(t, d, setID)
	rename("B", "Z")
	// PSet's own write to the same row, without values, does not block.
	must(t, Write(bg, d, "pset", "job", func(tx *sql.Tx) error {
		_, err := tx.Exec(`UPDATE homework SET source = 'https://example.edu/hw3' WHERE id = ?`, setID)
		return err
	}))

	err := Undo(bg, d, "A", "undo-A-early")
	t.Logf("undo A while B is newer on the title -> %v", err)
	if !errors.Is(err, ErrNotNewest) {
		t.Errorf("want ErrNotNewest, got %v", err)
	}
	must(t, Undo(bg, d, "B", "undo-B"))
	// The source PSet wrote stays (it is not B's): restore it in the
	// expectation.
	afterA[0][0]["source"] = "https://example.edu/hw3"
	compare(t, "undo B (newest)", afterA, snapshot(t, d, setID))

	err = Undo(bg, d, "B", "undo-B-again")
	t.Logf("undo B twice -> %v", err)
	if !errors.Is(err, ErrAlreadyUndone) {
		t.Errorf("want ErrAlreadyUndone, got %v", err)
	}
	must(t, Undo(bg, d, "A", "undo-A"))
	orig[0][0]["source"] = "https://example.edu/hw3"
	compare(t, "then undo A", orig, snapshot(t, d, setID))

	// Redo = undoing the undo.
	err = Undo(bg, d, "undo-A", "redo-A")
	t.Logf("undo the undo of A (a redo) -> %v", err)
	var title string
	must(t, d.QueryRow(`SELECT title FROM homework WHERE id = ?`, setID).Scan(&title))
	t.Logf("title after redo: %q", title)

	// A PSet write to a mixed column (reading, logged with values) after a
	// student's correction blocks undoing the correction.
	student(t, d, "fix-reading", func(tx *sql.Tx) error {
		_, err := tx.Exec(`UPDATE questions SET reading = '["R1 = 4 ohm"]', reading_edited = 1 WHERE id = ?`, qs[0])
		return err
	})
	must(t, Write(bg, d, "pset", "reread", func(tx *sql.Tx) error {
		_, err := tx.Exec(`UPDATE questions SET reading = '["R1 = 40 ohm"]' WHERE id = ?`, qs[0])
		return err
	}))
	err = Undo(bg, d, "fix-reading", "undo-fix")
	t.Logf("undo the student's reading fix after PSet read it again -> %v", err)
	if !errors.Is(err, ErrNotNewest) {
		t.Errorf("want ErrNotNewest, got %v", err)
	}
}

// Under AllColsWhenStudent, a note edit that cleared the guide is undoable
// whole until PSet writes the new guide; after that the values the action
// left are gone and undo refuses rather than throwing the new guide away
// silently.
func TestUndoNoteAfterGuideRewritten(t *testing.T) {
	d := open(t, Options{Log: []Table{Homework, Questions, Pages}, Policy: AllColsWhenStudent})
	_, qs := seed(t, d, 1)
	student(t, d, "note", func(tx *sql.Tx) error {
		_, err := tx.Exec(`UPDATE questions SET notes = '[["c only"]]', hint = '[]', walkthrough = '[]', state = 'located', activity = '' WHERE id = ?`, qs[0])
		return err
	})
	must(t, Write(bg, d, "pset", "guide", func(tx *sql.Tx) error {
		_, err := tx.Exec(`UPDATE questions SET hint = '["new"]', walkthrough = '["new"]', state = 'ready' WHERE id = ?`, qs[0])
		return err
	}))
	err := Undo(bg, d, "note", "undo-note")
	t.Logf("undo the note after the new guide was written -> %v", err)
	if !errors.Is(err, ErrDrifted) {
		t.Errorf("want ErrDrifted, got %v", err)
	}
}

func TestUndoCreate(t *testing.T) {
	d := open(t, all())
	setID, _ := seed(t, d, 1)
	student(t, d, "add", func(tx *sql.Tx) error {
		_, err := tx.Exec(`INSERT INTO questions (id, homework_id, position, text, in_book, label, state, created_at, updated_at) VALUES ('q-new', ?, 2, '3.4', 1, '3.4', 'pending', ?, ?)`, setID, db.Now(), db.Now())
		return err
	})
	must(t, Undo(bg, d, "add", "undo-add"))
	dump(t, d, `SELECT * FROM changes WHERE action_id IN ('add', 'undo-add') ORDER BY seq`)
	var removed string
	must(t, d.QueryRow(`SELECT removed_at FROM questions WHERE id = 'q-new'`).Scan(&removed))
	if removed == "" {
		t.Error("undoing a create did not hide the row")
	}
}
