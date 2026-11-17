package store

import (
	"strings"

	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/db"
)

// baseline is the schema for courses, materials and work. Nothing has
// shipped on it yet, so it is edited in place until the cut-over (track 9 of
// ideas/backend-courses.md); from then on every change is a new migration.
// The steps and calls tables come with the step runner (track 3), images and
// assignment reads with the work (track 5), places with track 7.
//
// Conventions: ids are TEXT; stamps are db.Stamp text; "" is "none" for a
// stamp or a reference, so `IS NOT` comparisons and markers stay simple;
// lists are JSON text and never NULL. Every logged row carries seq, the
// change-log sequence of its last change, set by its own triggers.
const baseline = `
CREATE TABLE courses (
	id         TEXT PRIMARY KEY,
	name       TEXT NOT NULL,
	created_at TEXT NOT NULL,
	removed_at TEXT NOT NULL DEFAULT '',
	seq        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE materials (
	id         TEXT PRIMARY KEY,
	course_id  TEXT NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
	title      TEXT NOT NULL,
	file_hash  TEXT NOT NULL DEFAULT '',
	page_count INTEGER NOT NULL DEFAULT 0,
	aspect     REAL NOT NULL DEFAULT 0,
	page_runs  TEXT NOT NULL DEFAULT '[]',
	problems   TEXT NOT NULL DEFAULT 'null',
	textbook   INTEGER NOT NULL DEFAULT 0,
	pages_read INTEGER NOT NULL DEFAULT 0,
	added_at   TEXT NOT NULL,
	removed_at TEXT NOT NULL DEFAULT '',
	seq        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX materials_course ON materials (course_id);

-- A material's pages and contents are logged through the material (its
-- pages_read and page_count), never row by row: per row, a 700-page import
-- was a quarter to a half slower (the change-log spike, 2026-11-17).
CREATE TABLE pages (
	material_id TEXT NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
	number      INTEGER NOT NULL,
	text        TEXT NOT NULL DEFAULT '',
	PRIMARY KEY (material_id, number)
);

CREATE TABLE sections (
	id          TEXT PRIMARY KEY,
	material_id TEXT NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
	parent_id   TEXT NOT NULL DEFAULT '',
	title       TEXT NOT NULL,
	page        INTEGER NOT NULL,
	position    INTEGER NOT NULL
);
CREATE INDEX sections_material ON sections (material_id, position);

CREATE TABLE sets (
	id           TEXT PRIMARY KEY,
	course_id    TEXT NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
	title        TEXT NOT NULL,
	due          TEXT NOT NULL DEFAULT '',
	turned_in_at TEXT NOT NULL DEFAULT '',
	sheet_id     TEXT NOT NULL DEFAULT '',
	opened_at    TEXT NOT NULL DEFAULT '',
	created_at   TEXT NOT NULL,
	removed_at   TEXT NOT NULL DEFAULT '',
	seq          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX sets_course ON sets (course_id);

CREATE TABLE questions (
	id         TEXT PRIMARY KEY,
	set_id     TEXT NOT NULL REFERENCES sets (id) ON DELETE CASCADE,
	position   INTEGER NOT NULL,
	text       TEXT NOT NULL,
	label      TEXT NOT NULL DEFAULT '',
	notes      TEXT NOT NULL DEFAULT '[]',
	done_at    TEXT NOT NULL DEFAULT '',
	revealed   TEXT NOT NULL DEFAULT '[]',
	difficulty INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL,
	removed_at TEXT NOT NULL DEFAULT '',
	seq        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX questions_set ON questions (set_id, position);

CREATE TABLE finds (
	id          TEXT PRIMARY KEY,
	question_id TEXT NOT NULL UNIQUE REFERENCES questions (id) ON DELETE CASCADE,
	material_id TEXT NOT NULL DEFAULT '',
	page        INTEGER NOT NULL DEFAULT 0,
	earlier_id  TEXT NOT NULL DEFAULT '',
	boxes       TEXT NOT NULL DEFAULT '[]',
	figures     TEXT NOT NULL DEFAULT '[]',
	statement   TEXT NOT NULL DEFAULT '[]',
	seq         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE readings (
	id          TEXT PRIMARY KEY,
	question_id TEXT NOT NULL UNIQUE REFERENCES questions (id) ON DELETE CASCADE,
	lines       TEXT NOT NULL DEFAULT '[]',
	doubts      TEXT NOT NULL DEFAULT '[]',
	corrected   INTEGER NOT NULL DEFAULT 0,
	seq         INTEGER NOT NULL DEFAULT 0
);

-- A document's owner is a question or a turn, so it has no foreign key: the
-- purge removes documents whose owner is gone.
CREATE TABLE documents (
	id         TEXT PRIMARY KEY,
	owner_kind TEXT NOT NULL CHECK (owner_kind IN ('question', 'turn')),
	owner_id   TEXT NOT NULL,
	blocks     TEXT NOT NULL DEFAULT '[]',
	state      TEXT NOT NULL DEFAULT 'writing' CHECK (state IN ('writing', 'done', 'stopped')),
	corrected  TEXT NOT NULL DEFAULT '[]',
	rounds     TEXT NOT NULL DEFAULT '[]',
	seq        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX documents_owner ON documents (owner_kind, owner_id);

CREATE TABLE turns (
	id         TEXT PRIMARY KEY,
	course_id  TEXT NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
	question   TEXT NOT NULL,
	about      TEXT NOT NULL DEFAULT 'null',
	answer_id  TEXT NOT NULL DEFAULT '',
	tools      TEXT NOT NULL DEFAULT '[]',
	remembered TEXT NOT NULL DEFAULT '[]',
	created_at TEXT NOT NULL,
	removed_at TEXT NOT NULL DEFAULT '',
	seq        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX turns_course ON turns (course_id, created_at);

CREATE TABLE memories (
	id         TEXT PRIMARY KEY,
	course_id  TEXT NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
	text       TEXT NOT NULL,
	created_at TEXT NOT NULL,
	removed_at TEXT NOT NULL DEFAULT '',
	seq        INTEGER NOT NULL DEFAULT 0
);

-- One row per failure, said once until it resolves (ideas/errors-grill.md).
-- It replaces the old errors table and every row's own error column.
CREATE TABLE incidents (
	id           TEXT PRIMARY KEY,
	error        TEXT NOT NULL,
	kind         TEXT NOT NULL CHECK (kind IN ('passing', 'waiting_on_you', 'your_input', 'cant', 'ours')),
	subject_kind TEXT NOT NULL DEFAULT '',
	subject_id   TEXT NOT NULL DEFAULT '',
	course_id    TEXT NOT NULL DEFAULT '',
	set_id       TEXT NOT NULL DEFAULT '',
	step_id      TEXT NOT NULL DEFAULT '',
	action       TEXT NOT NULL DEFAULT '',
	born         TEXT NOT NULL CHECK (born IN ('request', 'step', 'page')),
	route        TEXT NOT NULL DEFAULT '',
	state        TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'healed', 'tried_again', 'subject_removed', 'dismissed')),
	count        INTEGER NOT NULL DEFAULT 1,
	first_at     TEXT NOT NULL,
	last_at      TEXT NOT NULL,
	resolved_at  TEXT NOT NULL DEFAULT '',
	detail       TEXT NOT NULL DEFAULT '',
	seq          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX incidents_open ON incidents (state, subject_kind, subject_id);

CREATE TABLE conditions (
	id    TEXT PRIMARY KEY,
	holds INTEGER NOT NULL,
	since TEXT NOT NULL,
	error TEXT NOT NULL DEFAULT 'null',
	fix   TEXT NOT NULL DEFAULT '',
	seq   INTEGER NOT NULL DEFAULT 0
);

-- The change log. Written only by the triggers. AUTOINCREMENT keeps seq
-- rising across purges: a plain rowid restarts at 1 once the log is emptied,
-- and a page would take new changes for ones it has seen.
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
	echo      INTEGER NOT NULL DEFAULT 0,
	before    TEXT,
	after     TEXT
);
-- Plain, not partial: a query comparing with a bound value cannot use an
-- index "WHERE action_id != ''", since SQLite cannot prove ? != ''.
CREATE INDEX changes_action ON changes (action_id);
CREATE INDEX changes_res ON changes (kind, res_id, seq);
CREATE INDEX changes_undoes ON changes (undoes);

-- Who is writing, inside store.Write only: inserted first and deleted last
-- in the same transaction, so it never commits, and the write lock taken at
-- BEGIN keeps every other connection from seeing it.
CREATE TABLE change_ctx (
	only      INTEGER PRIMARY KEY CHECK (only = 1),
	actor     TEXT NOT NULL CHECK (actor IN ('student', 'pset', 'purge')),
	action_id TEXT NOT NULL,
	undoes    TEXT NOT NULL DEFAULT '',
	at        TEXT NOT NULL
);
`

// questionSet and questionCourse find a question's set and course from a row
// that names the question in {q}.
const (
	questionSet    = "(SELECT set_id FROM questions WHERE id = {q})"
	questionCourse = "(SELECT s.course_id FROM questions q JOIN sets s ON s.id = q.set_id WHERE q.id = {q})"
)

func ofQuestion(expr, col string) string { return strings.ReplaceAll(expr, "{q}", "{r}."+col) }

var (
	setCount = &Echo{
		Table: "sets", Kind: change.ResourceSet,
		ID: "{r}.set_id", SetID: "{r}.set_id",
		CourseID: "(SELECT course_id FROM sets WHERE id = {r}.set_id)",
		// What a set's counts and bar read: how many, how many done, and
		// each one's place and weight.
		Cols: []string{"position", "done_at", "removed_at", "difficulty"},
	}

	// Tables is every logged table. Its order is the order of the purge's
	// sweep for orphaned change rows, and nothing else.
	Tables = []Table{
		{
			Name: "courses", Kind: change.ResourceCourse,
			CourseID: "{r}.id",
			Student:  []string{"name", "removed_at"},
			Meta:     []string{"created_at", "seq"},
			Removed:  "removed_at",
		},
		{
			Name: "materials", Kind: change.ResourceMaterial,
			CourseID: "{r}.course_id",
			Student:  []string{"title", "textbook", "removed_at"},
			PSet:     []string{"course_id", "file_hash", "page_count", "aspect", "page_runs", "problems", "pages_read"},
			Meta:     []string{"added_at", "seq"},
			Removed:  "removed_at",
			JSON:     []string{"page_runs", "problems"},
			Wire:     map[string]Field{"textbook": {"textbook", truth}},
		},
		{
			Name: "sets", Kind: change.ResourceSet,
			SetID: "{r}.id", CourseID: "{r}.course_id",
			Student: []string{"title", "due", "turned_in_at", "sheet_id", "removed_at"},
			PSet:    []string{"course_id"},
			// When the student last opened it is not an action, and never
			// undone: Home reads it when it loads.
			Meta:    []string{"opened_at", "created_at", "seq"},
			Removed: "removed_at",
		},
		{
			Name: "questions", Kind: change.ResourceQuestion,
			SetID:    "{r}.set_id",
			CourseID: "(SELECT course_id FROM sets WHERE id = {r}.set_id)",
			Student:  []string{"position", "text", "label", "notes", "done_at", "revealed", "removed_at"},
			PSet:     []string{"set_id", "difficulty"},
			Meta:     []string{"created_at", "seq"},
			Removed:  "removed_at",
			JSON:     []string{"notes", "revealed"},
			Wire:     map[string]Field{"done_at": {"done", set}},
			Echo:     setCount,
		},
		{
			Name: "finds", Kind: change.ResourceFind,
			SetID:    ofQuestion(questionSet, "question_id"),
			CourseID: ofQuestion(questionCourse, "question_id"),
			// Boxing a problem by hand says where it is: material, page, boxes.
			Student: []string{"material_id", "page", "boxes"},
			PSet:    []string{"question_id", "earlier_id", "figures", "statement"},
			Meta:    []string{"seq"},
			JSON:    []string{"boxes"},
		},
		{
			Name: "readings", Kind: change.ResourceReading,
			SetID:    ofQuestion(questionSet, "question_id"),
			CourseID: ofQuestion(questionCourse, "question_id"),
			Student:  []string{"lines", "corrected"},
			PSet:     []string{"question_id", "doubts"},
			Meta:     []string{"seq"},
			JSON:     []string{"lines"},
			Wire:     map[string]Field{"corrected": {"corrected", truth}},
		},
		{
			Name: "documents", Kind: change.ResourceDocument,
			SetID: "CASE {r}.owner_kind WHEN 'question' THEN " + ofQuestion(questionSet, "owner_id") + " END",
			CourseID: "CASE {r}.owner_kind WHEN 'question' THEN " + ofQuestion(questionCourse, "owner_id") +
				" ELSE (SELECT course_id FROM turns WHERE id = {r}.owner_id) END",
			PSet: []string{"owner_kind", "owner_id", "blocks", "state", "corrected"},
			// Saved model rounds can hold images, and are never shown.
			Meta: []string{"rounds", "seq"},
		},
		{
			Name: "turns", Kind: change.ResourceTurn,
			CourseID: "{r}.course_id",
			Student:  []string{"question", "about", "removed_at"},
			PSet:     []string{"course_id", "answer_id", "tools", "remembered"},
			Meta:     []string{"created_at", "seq"},
			Removed:  "removed_at",
			JSON:     []string{"about"},
		},
		{
			Name: "memories", Kind: change.ResourceMemory,
			CourseID: "{r}.course_id",
			Student:  []string{"text", "removed_at"},
			PSet:     []string{"course_id"},
			Meta:     []string{"created_at", "seq"},
			Removed:  "removed_at",
		},
		{
			Name: "incidents", Kind: change.ResourceIncident,
			SetID: "NULLIF({r}.set_id, '')", CourseID: "NULLIF({r}.course_id, '')",
			// The student dismisses one; everything else is PSet's.
			Student: []string{"state"},
			PSet: []string{"error", "kind", "subject_kind", "subject_id", "course_id", "set_id", "step_id",
				"action", "born", "route", "count", "first_at", "last_at", "resolved_at", "detail"},
			Meta: []string{"seq"},
		},
		{
			Name: "conditions", Kind: change.ResourceCondition,
			PSet: []string{"holds", "since", "error", "fix"},
			Meta: []string{"seq"},
		},
	}

	// throughParent are the tables logged through their material: only their
	// deletes are guarded.
	throughParent = []string{"pages", "sections"}
)

// tableOf is the logged table of a kind of resource.
func tableOf(kind string) (Table, bool) {
	for _, t := range Tables {
		if string(t.Kind) == kind {
			return t, true
		}
	}
	return Table{}, false
}

// Schema is the baseline and every trigger.
func Schema() string {
	var b strings.Builder
	b.WriteString(baseline)
	for _, t := range Tables {
		b.WriteString("\n")
		b.WriteString(t.Triggers())
	}
	for _, name := range throughParent {
		b.WriteString("\n")
		b.WriteString(guardDelete(name))
	}
	return b.String()
}

// Migrations is the store's list: the baseline, then (after the cut-over)
// one migration per change. A migration that changes a logged table's
// columns drops its triggers, alters it, and creates them again from Schema's
// generator in the same migration; one that writes runs its Do through
// write, as PSet.
func Migrations() []db.Migration {
	return []db.Migration{{Name: "store/1", SQL: Schema()}}
}
