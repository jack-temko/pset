// Package changelog is a spike: a change log written by triggers, with undo,
// replay and purge, measured against PSet's real tables. It is throwaway code
// and is not wired into the app.
package changelog

import (
	"fmt"
	"strings"
)

// Table describes one resource table for the trigger generator.
type Table struct {
	Name string // SQL table name
	Kind string // resource kind written to changes.kind
	// Key are the columns that identify a row; the resource id is them
	// joined with ':' (one column: the column itself).
	Key []string
	// SetID and CourseID are SQL expressions over the row alias {r}
	// (OLD or NEW) giving the parents; "" for NULL.
	SetID, CourseID string
	// Student are the columns the student makes (or may make: a column PSet
	// and the student both write is listed here): their before and after
	// values are logged.
	Student []string
	// PSet are the columns PSet makes: a change to them is logged as
	// "changed" with no values.
	PSet []string
	// Meta are columns whose change alone is not a change (rev, stamps).
	// They are never compared and never logged.
	Meta []string
	// Removed is the marker column ("" if the table has none). Setting it
	// logs "removed", clearing it "restored".
	Removed string
}

// Policy says which values a change row carries.
type Policy int

const (
	// StudentColsOnly logs values only for Student columns, whoever writes.
	StudentColsOnly Policy = iota
	// AllColsWhenStudent also logs PSet columns' values when the actor is
	// the student, so an action the student took (which may clear a guide)
	// is undoable whole. PSet's own writes still carry no PSet values.
	AllColsWhenStudent
)

func (t Table) idExpr(r string) string {
	parts := make([]string, len(t.Key))
	for i, k := range t.Key {
		parts[i] = r + "." + k
	}
	return strings.Join(parts, " || ':' || ")
}

func sub(expr, r string) string {
	if expr == "" {
		return "NULL"
	}
	return strings.ReplaceAll(expr, "{r}", r)
}

// valuesJSON is a JSON object of the given columns of row r that differ
// between OLD and NEW (all of them when diff is false), or NULL when none.
// cond is an extra SQL condition per column (for the student-only policy).
func valuesJSON(cols []string, r string, diff bool, extra func(col string) string) string {
	if len(cols) == 0 {
		return "NULL"
	}
	var arms []string
	for _, c := range cols {
		var where []string
		if diff {
			where = append(where, fmt.Sprintf("OLD.%s IS NOT NEW.%s", c, c))
		}
		if e := extra(c); e != "" {
			where = append(where, e)
		}
		w := ""
		if len(where) > 0 {
			w = " WHERE " + strings.Join(where, " AND ")
		}
		arms = append(arms, fmt.Sprintf("SELECT '%s' AS k, %s.%s AS v%s", c, r, c, w))
	}
	return fmt.Sprintf("NULLIF((SELECT json_group_object(k, v) FROM (\n\t\t\t%s)), '{}')", strings.Join(arms, "\n\t\t\tUNION ALL "))
}

const guard = "\tSELECT RAISE(ABORT, 'changelog: write to %s without a change context') WHERE NOT EXISTS (SELECT 1 FROM change_ctx);\n"

// Triggers generates the INSERT, UPDATE and DELETE triggers for t.
func Triggers(t Table, p Policy) string {
	var b strings.Builder
	cols := "at, kind, res_id, set_id, course_id, op, actor, action_id, undoes, before, after"
	logged := append(append([]string{}, t.Student...), t.PSet...)

	// Which columns carry values, and when.
	valueCols := t.Student
	extra := func(string) string { return "" }
	if p == AllColsWhenStudent {
		valueCols = logged
		isStudent := map[string]bool{}
		for _, c := range t.Student {
			isStudent[c] = true
		}
		extra = func(c string) string {
			if isStudent[c] {
				return ""
			}
			return "c.actor = 'student'"
		}
	}

	// INSERT: created, with the student's values.
	fmt.Fprintf(&b, "CREATE TRIGGER %s_log_i AFTER INSERT ON %s FOR EACH ROW BEGIN\n", t.Name, t.Name)
	fmt.Fprintf(&b, guard, t.Name)
	fmt.Fprintf(&b, "\tINSERT INTO changes (%s)\n\tSELECT c.at, '%s', %s, %s, %s, 'created', c.actor, c.action_id, c.undoes, NULL,\n\t\t%s\n\tFROM change_ctx c;\nEND;\n\n",
		cols, t.Kind, t.idExpr("NEW"), sub(t.SetID, "NEW"), sub(t.CourseID, "NEW"),
		valuesJSON(t.Student, "NEW", false, func(string) string { return "" }))

	// UPDATE: only when a logged column really changed (IS NOT treats NULLs
	// as values), so a no-op or a Meta-only update (rev, updated_at) logs
	// nothing and needs no context.
	var when []string
	for _, c := range logged {
		when = append(when, fmt.Sprintf("OLD.%s IS NOT NEW.%s", c, c))
	}
	op := "'changed'"
	if t.Removed != "" {
		op = fmt.Sprintf("CASE WHEN OLD.%[1]s = '' AND NEW.%[1]s != '' THEN 'removed' WHEN OLD.%[1]s != '' AND NEW.%[1]s = '' THEN 'restored' ELSE 'changed' END", t.Removed)
	}
	// UPDATE OF the logged columns: a statement that sets none of them (an
	// update of rev, updated_at or an unlogged column) does not even compile
	// this trigger into its program.
	fmt.Fprintf(&b, "CREATE TRIGGER %s_log_u AFTER UPDATE OF %s ON %s FOR EACH ROW\nWHEN %s\nBEGIN\n", t.Name, strings.Join(logged, ", "), t.Name, strings.Join(when, "\n\tOR "))
	fmt.Fprintf(&b, guard, t.Name)
	fmt.Fprintf(&b, "\tINSERT INTO changes (%s)\n\tSELECT c.at, '%s', %s, %s, %s,\n\t\t%s,\n\t\tc.actor, c.action_id, c.undoes,\n\t\t%s,\n\t\t%s\n\tFROM change_ctx c;\nEND;\n\n",
		cols, t.Kind, t.idExpr("NEW"), sub(t.SetID, "NEW"), sub(t.CourseID, "NEW"), op,
		valuesJSON(valueCols, "OLD", true, extra), valuesJSON(valueCols, "NEW", true, extra))

	// DELETE: only the purge deletes a logged row, and it logs nothing (the
	// row was already hidden and announced as removed). Anything else is
	// refused, so a stray DELETE or a cascade outside the purge fails loudly.
	fmt.Fprintf(&b, "CREATE TRIGGER %s_log_d AFTER DELETE ON %s FOR EACH ROW BEGIN\n", t.Name, t.Name)
	fmt.Fprintf(&b, guard, t.Name)
	fmt.Fprintf(&b, "\tSELECT RAISE(ABORT, 'changelog: only the purge deletes from %s') WHERE (SELECT actor FROM change_ctx) != 'purge';\nEND;\n", t.Name)
	return b.String()
}

// The three spike tables, classified column by column from today's schema.
var (
	Homework = Table{
		Name: "homework", Kind: "set", Key: []string{"id"},
		SetID: "{r}.id", CourseID: "{r}.book_id",
		Student: []string{"title", "due_date", "turned_in_at", "removed_at"},
		PSet:    []string{"book_id", "source"},
		Meta:    []string{"created_at", "updated_at"},
		Removed: "removed_at",
	}
	Questions = Table{
		Name: "questions", Kind: "question", Key: []string{"id"},
		SetID:    "{r}.homework_id",
		CourseID: "(SELECT book_id FROM homework WHERE id = {r}.homework_id)",
		Student: []string{"position", "text", "in_book", "label", "pinned_page", "boxes", "notes",
			"revealed", "done_at", "reading", "reading_edited", "removed_at"},
		PSet: []string{"homework_id", "statement", "page", "rect", "figures", "hint", "walkthrough", "state", "activity",
			"rounds", "reading_doubts", "difficulty", "attempts", "failed_at", "error"},
		Meta:    []string{"rev", "created_at", "updated_at"},
		Removed: "removed_at",
	}
	Pages = Table{
		Name: "pages", Kind: "page", Key: []string{"book_id", "number"},
		CourseID: "{r}.book_id",
		PSet:     []string{"text", "status"},
		Meta:     []string{},
	}
)

// Schema is the change log, the context row and the removal markers.
const Schema = `
CREATE TABLE changes (
	seq       INTEGER PRIMARY KEY AUTOINCREMENT,
	at        TEXT NOT NULL,
	kind      TEXT NOT NULL,
	res_id    TEXT NOT NULL,
	set_id    TEXT,
	course_id TEXT,
	op        TEXT NOT NULL CHECK (op IN ('created', 'changed', 'removed', 'restored')),
	actor     TEXT NOT NULL CHECK (actor IN ('student', 'pset')),
	action_id TEXT NOT NULL,
	undoes    TEXT NOT NULL DEFAULT '',
	before    TEXT,
	after     TEXT
);
CREATE INDEX changes_action ON changes (action_id);
CREATE INDEX changes_res ON changes (kind, res_id, seq);
CREATE INDEX changes_undoes ON changes (undoes) WHERE undoes != '';

CREATE TABLE change_ctx (
	only      INTEGER PRIMARY KEY CHECK (only = 1),
	actor     TEXT NOT NULL CHECK (actor IN ('student', 'pset', 'purge')),
	action_id TEXT NOT NULL,
	undoes    TEXT NOT NULL DEFAULT '',
	at        TEXT NOT NULL
);

ALTER TABLE homework ADD COLUMN removed_at TEXT NOT NULL DEFAULT '';
ALTER TABLE questions ADD COLUMN removed_at TEXT NOT NULL DEFAULT '';
`
