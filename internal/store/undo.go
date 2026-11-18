package store

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"

	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
)

// What Undo refuses, in the student's words.
var (
	NothingToUndo = errs.Define(errs.Entry{
		ID:     "store.nothing_to_undo",
		What:   "There's nothing to undo.",
		Why:    "Nothing you did in the last week is left to take back.",
		Status: http.StatusNotFound,
	})
	AlreadyUndone = errs.Define(errs.Entry{
		ID:     "store.already_undone",
		What:   "That was already undone.",
		Why:    "It was taken back earlier, perhaps from another tab.",
		Status: http.StatusConflict,
	})
	ChangedSince = errs.Define(errs.Entry{
		ID:     "store.changed_since",
		What:   "That can't be undone on its own.",
		Why:    "You changed the same thing again afterwards.",
		Fix:    "Undo the newer change first.",
		Status: http.StatusConflict,
	})
	RewrittenSince = errs.Define(errs.Entry{
		ID:     "store.rewritten_since",
		What:   "That can't be undone any more.",
		Why:    "PSet has worked on it since, and undoing would throw that away.",
		Status: http.StatusConflict,
	})
	NotUndoable = errs.Define(errs.Entry{
		ID:     "store.not_undoable",
		What:   "That can't be undone.",
		Why:    "It made something PSet has no way to take back.",
		Status: http.StatusConflict,
	})
)

// logged is one change row as Undo reads it.
type logged struct {
	seq       int64
	kind, id  string
	op        change.Op
	before    sql.NullString
	after     map[string]json.RawMessage
	hasValues bool
}

// Undo takes back a student's action as a new action (asNew, the student's
// too, which undoes it): every value it changed is written back, newest
// first, and what it created is removed. Undoing that undo is redo.
//
// It refuses when the action is already undone; when a later action still
// in force changed any of the same values (undo the newer one first); and
// when the values are no longer what the action left, which happens when
// PSet has written over them (a guide rewritten after a note was edited):
// undoing then would throw PSet's work away. It returns the seq of its last
// change.
func (s *Store) Undo(ctx context.Context, action, asNew string) (int64, error) {
	if action == "" || asNew == "" {
		return 0, NothingToUndo.New()
	}
	var last int64
	err := s.write(ctx, actor(change.ActorStudent), asNew, action, func(tx *sql.Tx) error {
		var n int
		if err := tx.QueryRowContext(ctx, `SELECT count(*) FROM changes WHERE undoes = ?`, action).Scan(&n); err != nil {
			return errs.Database.Wrap(err)
		}
		if n > 0 {
			return AlreadyUndone.New()
		}
		cs, err := actionChanges(ctx, tx, action)
		if err != nil {
			return err
		}
		if len(cs) == 0 {
			return NothingToUndo.New()
		}
		// Newest first: a column this action wrote again later is checked
		// only against its last write.
		later := map[string]bool{}
		for _, c := range cs {
			if err := stillNewest(ctx, tx, action, c, later); err != nil {
				return err
			}
		}
		for _, c := range cs {
			if err := revert(ctx, tx, c); err != nil {
				return err
			}
		}
		return errs.Database.Of(tx.QueryRowContext(ctx, `SELECT ifnull(max(seq), 0) FROM changes`).Scan(&last))
	})
	return last, err
}

// Newest is what Ctrl+Z takes back: the student's newest change in force
// not yet undone, an action or a redo (even depth). An undo is not one:
// Ctrl+Z after an undo takes the next older action back, and after undo,
// redo, undo it goes further back still rather than toggling.
func (s *Store) Newest(ctx context.Context) (string, error) {
	var id string
	err := s.DB.QueryRowContext(ctx, `
SELECT action_id FROM changes c
WHERE actor = 'student' AND action_id != '' AND echo = 0 AND depth % 2 = 0
  AND NOT EXISTS (SELECT 1 FROM changes u WHERE u.undoes = c.action_id)
ORDER BY seq DESC LIMIT 1`).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return id, errs.Database.Of(err)
}

// actionChanges is an action's own changes, newest first. Echoes are left
// out: a parent's echo comes back by itself when its child is reverted.
func actionChanges(ctx context.Context, tx *sql.Tx, action string) ([]logged, error) {
	rows, err := tx.QueryContext(ctx, `
SELECT seq, kind, res_id, op, before, after FROM changes
WHERE action_id = ? AND echo = 0 ORDER BY seq DESC`, action)
	if err != nil {
		return nil, errs.Database.Wrap(err)
	}
	defer cleanup.Close(rows)
	var out []logged
	for rows.Next() {
		var c logged
		var after sql.NullString
		if err := rows.Scan(&c.seq, &c.kind, &c.id, &c.op, &c.before, &after); err != nil {
			return nil, errs.Database.Wrap(err)
		}
		if after.Valid {
			if err := json.Unmarshal([]byte(after.String), &c.after); err != nil {
				return nil, errs.Data.Wrap(err)
			}
		}
		c.hasValues = c.before.Valid || after.Valid
		out = append(out, c)
	}
	return out, errs.Database.Of(rows.Err())
}

// stillNewest refuses when a later change still in force wrote any value c
// wrote, or the row no longer holds what c left. later holds the columns a
// newer change of the same action wrote: those were checked against it.
func stillNewest(ctx context.Context, tx *sql.Tx, action string, c logged, later map[string]bool) error {
	t, ok := tableOf(c.kind)
	if !ok {
		return errs.Data.Wrap(fmt.Errorf("store: undo of an unknown kind %q", c.kind))
	}
	if c.op == change.OpCreated && t.Removed == "" {
		// Nothing to hide it with; deleting is the purge's alone. Only PSet
		// makes rows in such a table, so this is a bug, said plainly.
		return NotUndoable.New()
	}
	if c.op == change.OpCreated {
		// Undoing an add only hides the thing, which throws nothing away,
		// whoever wrote to it since.
		return nil
	}
	if !c.hasValues {
		// A student action that changed only what PSet makes logs its
		// values; a row without them was not the student's to undo.
		return errs.Data.Wrap(fmt.Errorf("store: %s %s (seq %d) has no values to undo", c.kind, c.id, c.seq))
	}
	// Later changes to the same thing that carry values and are still in
	// force: PSet's, or a student change at an even depth (an action or a
	// redo) that is not undone. An undo, or a change undone, cancels out.
	rows, err := tx.QueryContext(ctx, `
SELECT l.seq, l.actor, l.after FROM changes l
WHERE l.kind = ? AND l.res_id = ? AND l.seq > ? AND l.action_id != ?
  AND l.after IS NOT NULL
  AND (l.action_id = '' OR (l.depth % 2 = 0 AND NOT EXISTS (SELECT 1 FROM changes u WHERE u.undoes = l.action_id)))`,
		c.kind, c.id, c.seq, action)
	if err != nil {
		return errs.Database.Wrap(err)
	}
	defer cleanup.Close(rows)
	for rows.Next() {
		var seq int64
		var who, raw string
		if err := rows.Scan(&seq, &who, &raw); err != nil {
			return errs.Database.Wrap(err)
		}
		var newer map[string]json.RawMessage
		if err := json.Unmarshal([]byte(raw), &newer); err != nil {
			return errs.Data.Wrap(err)
		}
		for col := range newer {
			if _, ok := c.after[col]; ok {
				if who == string(change.ActorPSet) {
					return RewrittenSince.New()
				}
				return ChangedSince.New()
			}
		}
	}
	if err := rows.Err(); err != nil {
		return errs.Database.Wrap(err)
	}
	var cols []string
	for _, col := range sortedKeys(c.after) {
		key := c.kind + "\x00" + c.id + "\x00" + col
		if !later[key] {
			cols = append(cols, col)
		}
		later[key] = true
	}
	if len(cols) == 0 {
		return nil
	}
	// The values must still be what c left: compare as the triggers wrote
	// them, through json_object, so types compare too.
	pairs := make([]string, len(cols))
	for i, col := range cols {
		pairs[i] = fmt.Sprintf("'%s', %s", col, col)
	}
	var now string
	q := fmt.Sprintf(`SELECT json_object(%s) FROM %s WHERE id = ?`, strings.Join(pairs, ", "), t.Name)
	if err := tx.QueryRowContext(ctx, q, c.id).Scan(&now); err != nil {
		return errs.Database.Wrap(err)
	}
	var cur map[string]json.RawMessage
	if err := json.Unmarshal([]byte(now), &cur); err != nil {
		return errs.Data.Wrap(err)
	}
	for _, col := range cols {
		if !bytes.Equal(compact(cur[col]), compact(c.after[col])) {
			return RewrittenSince.New()
		}
	}
	return nil
}

func compact(v json.RawMessage) []byte {
	var b bytes.Buffer
	if json.Compact(&b, v) != nil {
		return v
	}
	return b.Bytes()
}

func sortedKeys(m map[string]json.RawMessage) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// revert writes c's before values back; what c created gets its removal
// marker instead.
func revert(ctx context.Context, tx *sql.Tx, c logged) error {
	t, _ := tableOf(c.kind)
	if c.op == change.OpCreated {
		_, err := tx.ExecContext(ctx, fmt.Sprintf(`UPDATE %s SET %s = ? WHERE id = ?`, t.Name, t.Removed), db.Now(), c.id)
		return errs.Database.Of(err)
	}
	if !c.before.Valid {
		return nil
	}
	var before map[string]json.RawMessage
	if err := json.Unmarshal([]byte(c.before.String), &before); err != nil {
		return errs.Data.Wrap(err)
	}
	cols := sortedKeys(before)
	sets := make([]string, len(cols))
	for i, col := range cols {
		// json_extract gives back the value's own SQL type: a JSON number
		// an INTEGER or REAL, a string TEXT, null NULL.
		sets[i] = fmt.Sprintf("%s = json_extract(?1, '$.%s')", col, col)
		if col == t.Removed {
			// Removed again (a redo) is removed now: its week to undo
			// starts today, not on the day it was first removed.
			sets[i] = fmt.Sprintf("%s = CASE json_extract(?1, '$.%s') WHEN '' THEN '' ELSE ?3 END", col, col)
		}
	}
	q := fmt.Sprintf(`UPDATE %s SET %s WHERE id = ?2`, t.Name, strings.Join(sets, ", "))
	_, err := tx.ExecContext(ctx, q, c.before.String, c.id, db.Now())
	return errs.Database.Of(err)
}
