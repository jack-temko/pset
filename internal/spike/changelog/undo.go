package changelog

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackt/pset/internal/db"
)

var (
	ErrNothingToUndo = errors.New("no such action")
	ErrAlreadyUndone = errors.New("action already undone")
	ErrNotNewest     = errors.New("a later change touched the same values")
	ErrDrifted       = errors.New("the values are no longer what the action left")
	ErrNotUndoable   = errors.New("the action changed values that were not logged")
)

type change struct {
	seq           int64
	kind, resID   string
	op            string
	action        string
	undoes        string
	before, after map[string]any
	hasBefore     bool
	beforeRaw     string
}

func decode(s sql.NullString) (map[string]any, bool) {
	if !s.Valid {
		return nil, false
	}
	m := map[string]any{}
	d := json.NewDecoder(strings.NewReader(s.String))
	d.UseNumber()
	if err := d.Decode(&m); err != nil {
		panic(err)
	}
	return m, true
}

var tablesByKind = map[string]Table{Homework.Kind: Homework, Questions.Kind: Questions, Pages.Kind: Pages}

// Undo undoes action as a new action (newAction, by the student): it writes
// each logged row's before values back, newest first.
//
// It refuses when the action is already undone, when a later action that is
// still in force wrote any of the same values (it is not the newest on its
// rows), when the current values are not what the action left (something
// changed them without logging values), and, under StudentColsOnly, when the
// action changed PSet-made columns whose old values were never logged.
func Undo(ctx context.Context, d *sql.DB, action, newAction string) error {
	return WriteUndo(ctx, d, "student", newAction, action, func(tx *sql.Tx) error {
		var n int
		if err := tx.QueryRowContext(ctx, `SELECT count(*) FROM changes WHERE undoes = ?`, action).Scan(&n); err != nil {
			return err
		}
		if n > 0 {
			return ErrAlreadyUndone
		}
		rows, err := tx.QueryContext(ctx, `SELECT seq, kind, res_id, op, before, after FROM changes WHERE action_id = ? ORDER BY seq DESC`, action)
		if err != nil {
			return err
		}
		var cs []change
		for rows.Next() {
			var c change
			var b, a sql.NullString
			if err := rows.Scan(&c.seq, &c.kind, &c.resID, &c.op, &b, &a); err != nil {
				rows.Close()
				return err
			}
			c.before, c.hasBefore = decode(b)
			c.beforeRaw = b.String
			c.after, _ = decode(a)
			cs = append(cs, c)
		}
		rows.Close()
		if len(cs) == 0 {
			return ErrNothingToUndo
		}
		for _, c := range cs {
			if err := checkNewest(ctx, tx, action, c); err != nil {
				return err
			}
		}
		for _, c := range cs {
			if err := revert(ctx, tx, c); err != nil {
				return err
			}
		}
		return nil
	})
}

// checkNewest refuses when a later, still-standing change wrote any value
// this change wrote, or the row's values are no longer the change's after.
func checkNewest(ctx context.Context, tx *sql.Tx, action string, c change) error {
	t := tablesByKind[c.kind]
	if c.op == "changed" && !c.hasBefore {
		return fmt.Errorf("%w: %s %s (seq %d) changed only PSet-made columns", ErrNotUndoable, c.kind, c.resID, c.seq)
	}
	// Later rows on the same resource that carry values, from actions not
	// undone and not themselves undos (an undo's target is newer than this
	// action only if it was undone, which cancels the pair).
	rows, err := tx.QueryContext(ctx, `
SELECT l.seq, l.action_id, l.after FROM changes l
WHERE l.kind = ? AND l.res_id = ? AND l.seq > ? AND l.action_id != ?
  AND l.after IS NOT NULL AND l.undoes = ''
  AND NOT EXISTS (SELECT 1 FROM changes u WHERE u.undoes = l.action_id AND u.undoes != '')`, c.kind, c.resID, c.seq, action)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var seq int64
		var other string
		var a sql.NullString
		if err := rows.Scan(&seq, &other, &a); err != nil {
			return err
		}
		later, _ := decode(a)
		for k := range later {
			if _, ok := c.after[k]; ok {
				return fmt.Errorf("%w: %s %s.%s was changed again by action %s (seq %d)", ErrNotNewest, c.kind, c.resID, k, other, seq)
			}
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	// The values must still be what this change left.
	if c.op == "created" {
		return nil
	}
	for k, want := range c.after {
		var got any
		q := fmt.Sprintf(`SELECT %s FROM %s WHERE %s = ?`, k, t.Name, t.idExpr(t.Name))
		if err := tx.QueryRowContext(ctx, q, c.resID).Scan(&got); err != nil {
			return err
		}
		if !same(got, want) {
			return fmt.Errorf("%w: %s %s.%s is %v, the action left %v", ErrDrifted, c.kind, c.resID, k, got, want)
		}
	}
	return nil
}

func same(got any, want any) bool {
	if b, ok := got.([]byte); ok {
		got = string(b)
	}
	switch w := want.(type) {
	case nil:
		return got == nil
	case json.Number:
		return fmt.Sprint(got) == w.String()
	default:
		return fmt.Sprint(got) == fmt.Sprint(w)
	}
}

// revert writes c's before values back; a created row gets its removal
// marker set instead.
func revert(ctx context.Context, tx *sql.Tx, c change) error {
	t := tablesByKind[c.kind]
	if c.op == "created" {
		if t.Removed == "" {
			return fmt.Errorf("%w: %s has no removal marker", ErrNotUndoable, t.Name)
		}
		_, err := tx.ExecContext(ctx, fmt.Sprintf(`UPDATE %s SET %s = ? WHERE %s = ?`, t.Name, t.Removed, t.idExpr(t.Name)), db.Now(), c.resID)
		return err
	}
	var sets []string
	for k := range c.before {
		// json_extract turns a JSON number back into an INTEGER or REAL, a
		// string into TEXT and null into NULL: the column's own value.
		sets = append(sets, fmt.Sprintf("%s = json_extract(?1, '$.%s')", k, k))
	}
	if len(sets) == 0 {
		return nil
	}
	q := fmt.Sprintf(`UPDATE %s SET %s WHERE %s = ?2`, t.Name, strings.Join(sets, ", "), t.idExpr(t.Name))
	_, err := tx.ExecContext(ctx, q, c.beforeRaw, c.resID)
	return err
}
