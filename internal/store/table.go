package store

import (
	"fmt"
	"strings"

	"github.com/jackt/pset/internal/change"
)

// Table describes one logged table for the trigger generator: what kind of
// resource its rows are, how to find their parents, and who makes each
// column. Every column is classified exactly once (a test checks it against
// the real table), because a student column put among PSet's loses its undo
// with no error.
type Table struct {
	Name string
	Kind change.Resource
	// SetID and CourseID are SQL over the row alias {r} (OLD or NEW) giving
	// the row's set and course; "" for none.
	SetID, CourseID string
	// Student are the columns the student makes, including columns both
	// write (a reading's lines): their old and new values are logged, so
	// Undo can write them back and the page can patch from them.
	Student []string
	// PSet are the columns PSet makes. A change to one is logged without
	// values (the page reads the thing again; a step can make it again),
	// except when the student's own action changed it: then its values are
	// logged too, so undoing the action brings it back whole.
	PSet []string
	// Meta are columns whose change alone is not a change: seq, stamps,
	// blobs, saved model rounds. Never compared, never logged.
	Meta []string
	// Removed is the removal marker column, "" if the student cannot remove
	// the thing. Setting it logs "removed", clearing it "restored".
	Removed string
	// JSON are the logged columns that hold JSON text, sent on the wire as
	// JSON rather than as a string.
	JSON []string
	// Wire renames a column on the wire where camelCase is not its name,
	// and converts its value (done_at is "done", true when set).
	Wire map[string]Field
	// Echo, when set, logs a value-less change to the row's parent whenever
	// the row is created or one of Echo.Cols changes, and bumps the parent's
	// seq, so what the parent carries about its children (a set's counts)
	// arrives with them.
	Echo *Echo
}

// Field is one column's name and value on the wire.
type Field struct {
	Name string
	// Value converts the stored value; nil keeps it.
	Value func(any) any
}

// Echo names a parent that hears about its children's changes.
type Echo struct {
	Table string
	Kind  change.Resource
	// ID, SetID and CourseID are SQL over the child row {r}.
	ID, SetID, CourseID string
	Cols                []string
}

// set is a non-empty stamp: a marker column read as a yes or no.
func set(v any) any { s, ok := v.(string); return ok && s != "" }

// nonzero is an INTEGER where 0 means none: sent as null, as the reads leave
// it out (a question's pinPage).
func nonzero(v any) any {
	switch n := v.(type) {
	case int64:
		if n == 0 {
			return nil
		}
	case float64:
		if n == 0 {
			return nil
		}
	}
	return v
}

// truth is an INTEGER flag read as a yes or no.
func truth(v any) any {
	switch n := v.(type) {
	case int64:
		return n != 0
	case float64:
		return n != 0
	}
	return false
}

// logged is every column a change to which is logged.
func (t Table) logged() []string { return append(append([]string{}, t.Student...), t.PSet...) }

func (t Table) isStudent(c string) bool {
	for _, s := range t.Student {
		if s == c {
			return true
		}
	}
	return false
}

func sub(expr, r string) string {
	if expr == "" {
		return "NULL"
	}
	return strings.ReplaceAll(expr, "{r}", r)
}

// values is a JSON object of row r's columns, only those that differ
// between OLD and NEW when diff is set, PSet's only when the actor is the
// student; NULL when there are none.
func (t Table) values(cols []string, r string, diff bool) string {
	if len(cols) == 0 {
		return "NULL"
	}
	arms := make([]string, 0, len(cols))
	for _, c := range cols {
		var where []string
		if diff {
			where = append(where, fmt.Sprintf("OLD.%[1]s IS NOT NEW.%[1]s", c))
		}
		if !t.isStudent(c) {
			where = append(where, "c.actor = 'student'")
		}
		w := ""
		if len(where) > 0 {
			w = " WHERE " + strings.Join(where, " AND ")
		}
		arms = append(arms, fmt.Sprintf("SELECT '%s' AS k, %s.%s AS v%s", c, r, c, w))
	}
	return fmt.Sprintf("NULLIF((SELECT json_group_object(k, v) FROM (\n\t\t\t%s)), '{}')",
		strings.Join(arms, "\n\t\t\tUNION ALL "))
}

const (
	insertCols = "at, kind, res_id, set_id, course_id, op, actor, action_id, undoes, depth, echo, before, after"
	guard      = "\tSELECT RAISE(ABORT, 'store: write to %s outside store.Write') WHERE NOT EXISTS (SELECT 1 FROM change_ctx);\n"
	// lastSeq is the seq of the change just logged: max on the rowid is a
	// single lookup.
	lastSeq = "(SELECT max(seq) FROM changes)"
)

// echo logs the parent's value-less change and bumps its seq, when cond.
func (t Table) echo(cond string) string {
	e := t.Echo
	if e == nil {
		return ""
	}
	where := ""
	if cond != "" {
		where = " WHERE " + cond
	}
	var b strings.Builder
	fmt.Fprintf(&b, "\tINSERT INTO changes (%s)\n\tSELECT c.at, '%s', %s, %s, %s, 'changed', c.actor, c.action_id, c.undoes, c.depth, 1, NULL, NULL\n\tFROM change_ctx c%s;\n",
		insertCols, e.Kind, sub(e.ID, "NEW"), sub(e.SetID, "NEW"), sub(e.CourseID, "NEW"), where)
	fmt.Fprintf(&b, "\tUPDATE %s SET seq = %s WHERE id = %s", e.Table, lastSeq, sub(e.ID, "NEW"))
	if cond != "" {
		b.WriteString(" AND (" + cond + ")")
	}
	b.WriteString(";\n")
	return b.String()
}

// Triggers is the SQL of t's three triggers.
//
//   - After an insert: "created", with the student's values.
//   - After an update of a logged column that really changed (IS NOT treats
//     NULLs as values, so a no-op or a Meta-only update logs nothing and
//     needs no context): "changed", "removed" or "restored", with the values
//     of the columns that changed.
//   - After a delete: refused unless the purge is running; logs nothing (the
//     row was already announced as removed a week before).
//
// Every one first refuses a write made outside store.Write, so no write can
// forget to announce itself or go unattributed.
func (t Table) Triggers() string {
	var b strings.Builder
	logged := t.logged()

	fmt.Fprintf(&b, "CREATE TRIGGER %[1]s_log_i AFTER INSERT ON %[1]s FOR EACH ROW BEGIN\n", t.Name)
	fmt.Fprintf(&b, guard, t.Name)
	fmt.Fprintf(&b, "\tINSERT INTO changes (%s)\n\tSELECT c.at, '%s', NEW.id, %s, %s, 'created', c.actor, c.action_id, c.undoes, c.depth, 0, NULL,\n\t\t%s\n\tFROM change_ctx c;\n",
		insertCols, t.Kind, sub(t.SetID, "NEW"), sub(t.CourseID, "NEW"), t.values(t.Student, "NEW", false))
	fmt.Fprintf(&b, "\tUPDATE %s SET seq = %s WHERE id = NEW.id;\n", t.Name, lastSeq)
	b.WriteString(t.echo(""))
	b.WriteString("END;\n\n")

	when := make([]string, len(logged))
	for i, c := range logged {
		when[i] = fmt.Sprintf("OLD.%[1]s IS NOT NEW.%[1]s", c)
	}
	op := "'changed'"
	if t.Removed != "" {
		op = fmt.Sprintf("CASE WHEN OLD.%[1]s = '' AND NEW.%[1]s != '' THEN 'removed' WHEN OLD.%[1]s != '' AND NEW.%[1]s = '' THEN 'restored' ELSE 'changed' END", t.Removed)
	}
	// UPDATE OF the logged columns: a statement that sets none of them
	// (seq, a stamp) does not compile this trigger into its program at all.
	fmt.Fprintf(&b, "CREATE TRIGGER %[1]s_log_u AFTER UPDATE OF %[2]s ON %[1]s FOR EACH ROW\nWHEN %[3]s\nBEGIN\n",
		t.Name, strings.Join(logged, ", "), strings.Join(when, "\n\tOR "))
	fmt.Fprintf(&b, guard, t.Name)
	fmt.Fprintf(&b, "\tINSERT INTO changes (%s)\n\tSELECT c.at, '%s', NEW.id, %s, %s,\n\t\t%s,\n\t\tc.actor, c.action_id, c.undoes, c.depth, 0,\n\t\t%s,\n\t\t%s\n\tFROM change_ctx c;\n",
		insertCols, t.Kind, sub(t.SetID, "NEW"), sub(t.CourseID, "NEW"), op,
		t.values(logged, "OLD", true), t.values(logged, "NEW", true))
	fmt.Fprintf(&b, "\tUPDATE %s SET seq = %s WHERE id = NEW.id;\n", t.Name, lastSeq)
	if t.Echo != nil {
		conds := make([]string, len(t.Echo.Cols))
		for i, c := range t.Echo.Cols {
			conds[i] = fmt.Sprintf("OLD.%[1]s IS NOT NEW.%[1]s", c)
		}
		b.WriteString(t.echo(strings.Join(conds, " OR ")))
	}
	b.WriteString("END;\n\n")

	b.WriteString(guardDelete(t.Name))

	// An id never changes: the log names things by it.
	fmt.Fprintf(&b, "\nCREATE TRIGGER %[1]s_id BEFORE UPDATE OF id ON %[1]s FOR EACH ROW WHEN OLD.id IS NOT NEW.id BEGIN\n\tSELECT RAISE(ABORT, 'store: the id of a row in %[1]s never changes');\nEND;\n", t.Name)
	return b.String()
}

// guardDelete is the delete trigger alone: for logged tables, and for the
// tables logged through their parent (pages, sections), whose rows only the
// purge may delete.
func guardDelete(table string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "CREATE TRIGGER %[1]s_log_d AFTER DELETE ON %[1]s FOR EACH ROW BEGIN\n", table)
	fmt.Fprintf(&b, guard, table)
	fmt.Fprintf(&b, "\tSELECT RAISE(ABORT, 'store: only the purge deletes from %s') WHERE (SELECT actor FROM change_ctx) != 'purge';\nEND;\n", table)
	return b.String()
}
