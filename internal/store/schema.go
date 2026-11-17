package store

import (
	"strings"

	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/db"
)

// baseline is the schema for courses, materials and work. Nothing has
// shipped on it yet, so it is edited in place until the cut-over (track 9 of
// ideas/backend-courses.md); from then on every change is a new migration.
// Images and assignment reads come with the work (track 5), places with
// track 7.
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
	removed_at  TEXT NOT NULL DEFAULT '',
	seq         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE readings (
	id          TEXT PRIMARY KEY,
	question_id TEXT NOT NULL UNIQUE REFERENCES questions (id) ON DELETE CASCADE,
	lines       TEXT NOT NULL DEFAULT '[]',
	doubts      TEXT NOT NULL DEFAULT '[]',
	corrected   INTEGER NOT NULL DEFAULT 0,
	removed_at  TEXT NOT NULL DEFAULT '',
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
	-- For a waiting_on_you failure, the condition whose return clears it.
	clears       TEXT NOT NULL DEFAULT '',
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

-- A piece of background work on one thing (D3): its state is the step's
-- alone, and what it makes lives in its own table (finds, readings,
-- documents). input_hash is what its inputs were when it last finished: a
-- done step whose inputs still hash the same is never run again.
CREATE TABLE steps (
	id           TEXT PRIMARY KEY,
	subject_kind TEXT NOT NULL,
	subject_id   TEXT NOT NULL,
	name         TEXT NOT NULL,
	position     INTEGER NOT NULL,
	state        TEXT NOT NULL CHECK (state IN ('waiting', 'running', 'retrying', 'done', 'failed', 'out_of_date', 'not_asked')),
	priority     INTEGER NOT NULL DEFAULT 0,
	input_hash   TEXT NOT NULL DEFAULT '',
	attempts     INTEGER NOT NULL DEFAULT 0,
	retry_at     TEXT NOT NULL DEFAULT '',
	incident_id  TEXT NOT NULL DEFAULT '',
	started_at   TEXT NOT NULL DEFAULT '',
	ended_at     TEXT NOT NULL DEFAULT '',
	created_at   TEXT NOT NULL,
	seq          INTEGER NOT NULL DEFAULT 0,
	UNIQUE (subject_kind, subject_id, name)
);
CREATE INDEX steps_runnable ON steps (state, priority DESC, created_at);

-- One model call, keyed to the step that made it: a step's usage is the sum
-- of its calls, and they go with it. Not logged: nothing on screen is a call.
CREATE TABLE calls (
	id                 INTEGER PRIMARY KEY,
	step_id            TEXT NOT NULL REFERENCES steps (id) ON DELETE CASCADE,
	attempt            INTEGER NOT NULL,
	at                 TEXT NOT NULL,
	model              TEXT NOT NULL,
	answered           TEXT NOT NULL DEFAULT '',
	host               TEXT NOT NULL DEFAULT '',
	ms                 INTEGER NOT NULL DEFAULT 0,
	prompt_tokens      INTEGER NOT NULL DEFAULT 0,
	completion_tokens  INTEGER NOT NULL DEFAULT 0,
	cached_tokens      INTEGER NOT NULL DEFAULT 0,
	cache_write_tokens INTEGER NOT NULL DEFAULT 0,
	reasoning_tokens   INTEGER NOT NULL DEFAULT 0,
	cost               REAL NOT NULL DEFAULT 0,
	-- 0 when the provider reported no usage (a failed or stopped call):
	-- its tokens and cost are not known, only that it happened.
	counted            INTEGER NOT NULL DEFAULT 0,
	error_id           TEXT NOT NULL DEFAULT ''
);
CREATE INDEX calls_step ON calls (step_id);

-- The student's place (ideas/actions-conditions-place-grill.md): where
-- they were, how they laid it out, what they had not sent. One per owner,
-- kind and tab (a material's spot is per tab); value is the kind's fields.
-- Logged, so a newly opened tab finds it, but written outside any action:
-- Ctrl+Z never moves the student back (A4). It goes with its owner.
CREATE TABLE places (
	id         TEXT PRIMARY KEY,
	owner_kind TEXT NOT NULL,
	owner_id   TEXT NOT NULL,
	kind       TEXT NOT NULL,
	tab_id     TEXT NOT NULL DEFAULT '',
	value      TEXT NOT NULL DEFAULT '{}',
	updated_at TEXT NOT NULL,
	seq        INTEGER NOT NULL DEFAULT 0,
	UNIQUE (owner_kind, owner_id, kind, tab_id)
);

-- Each student action run, by the catalog entry it was (internal/action):
-- what Undo says it took back, and where its Show goes. Not logged; it goes
-- with its changes.
CREATE TABLE actions (
	id     TEXT PRIMARY KEY,
	entry  TEXT NOT NULL,
	kind   TEXT NOT NULL DEFAULT '',
	res_id TEXT NOT NULL DEFAULT '',
	at     TEXT NOT NULL
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
	-- How deep in a chain of undos: 0 an action, 1 its undo, 2 the redo,
	-- 3 the redo undone. Even is a change in force; odd takes one back.
	depth     INTEGER NOT NULL DEFAULT 0,
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
	depth     INTEGER NOT NULL DEFAULT 0,
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
			Student: []string{"material_id", "page", "boxes", "removed_at"},
			PSet:    []string{"question_id", "earlier_id", "figures", "statement"},
			Meta:    []string{"seq"},
			// A find the student made by boxing is taken back by Undo.
			Removed: "removed_at",
			JSON:    []string{"boxes"},
		},
		{
			Name: "readings", Kind: change.ResourceReading,
			SetID:    ofQuestion(questionSet, "question_id"),
			CourseID: ofQuestion(questionCourse, "question_id"),
			Student:  []string{"lines", "corrected", "removed_at"},
			PSet:     []string{"question_id", "doubts"},
			Meta:     []string{"seq"},
			Removed:  "removed_at",
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
				"action", "born", "route", "count", "first_at", "last_at", "resolved_at", "detail", "clears"},
			Meta: []string{"seq"},
		},
		{
			Name: "places", Kind: change.ResourcePlace,
			SetID: "CASE {r}.owner_kind WHEN 'set' THEN {r}.owner_id WHEN 'question' THEN " + ofQuestion(questionSet, "owner_id") + " END",
			CourseID: "CASE {r}.owner_kind WHEN 'course' THEN {r}.owner_id" +
				" WHEN 'set' THEN (SELECT course_id FROM sets WHERE id = {r}.owner_id)" +
				" WHEN 'material' THEN (SELECT course_id FROM materials WHERE id = {r}.owner_id)" +
				" WHEN 'question' THEN " + ofQuestion(questionCourse, "owner_id") +
				" WHEN 'document' THEN (SELECT CASE d.owner_kind WHEN 'question' THEN " + strings.ReplaceAll(questionCourse, "{q}", "d.owner_id") +
				" WHEN 'turn' THEN (SELECT course_id FROM turns WHERE id = d.owner_id) END FROM documents d WHERE d.id = {r}.owner_id) END",
			// The student's, but no action's: what it held is not logged
			// (the page reads it again), and Undo never writes it back.
			PSet: []string{"owner_kind", "owner_id", "kind", "tab_id", "value"},
			Meta: []string{"updated_at", "seq"},
			JSON: []string{"value"},
		},
		{
			Name: "steps", Kind: change.ResourceStep,
			SetID: "CASE {r}.subject_kind WHEN 'question' THEN " + ofQuestion(questionSet, "subject_id") +
				" WHEN 'set' THEN {r}.subject_id END",
			CourseID: "CASE {r}.subject_kind WHEN 'question' THEN " + ofQuestion(questionCourse, "subject_id") +
				" WHEN 'set' THEN (SELECT course_id FROM sets WHERE id = {r}.subject_id)" +
				" WHEN 'material' THEN (SELECT course_id FROM materials WHERE id = {r}.subject_id)" +
				" WHEN 'turn' THEN (SELECT course_id FROM turns WHERE id = {r}.subject_id) END",
			PSet: []string{"subject_kind", "subject_id", "name", "position", "state", "attempts", "retry_at",
				"incident_id", "started_at", "ended_at"},
			// Which goes first and what its inputs were are the runner's own.
			Meta: []string{"priority", "input_hash", "created_at", "seq"},
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
