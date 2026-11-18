package store

import (
	"database/sql"
	"strings"
	"testing"
	"time"

	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/db"
)

// rowsOwned are the rows that are no thing of the change log but go with
// their owner: by a cascading foreign key, not the map.
var rowsOwned = []struct{ table, column, parent string }{
	{"pages", "material_id", "materials"},
	{"sections", "material_id", "materials"},
	{"embeddings", "material_id", "materials"},
	{"calls", "step_id", "steps"},
	{"study", "course_id", "courses"},
}

// notLinks are the columns that name another row but are no link of the
// map, each with why. A new *_id column must be a link or listed here, so a
// new table can't leave a dependency undeclared.
var notLinks = map[string]string{
	"incidents.subject_id": "an incident is about its subject; it is kept on its own clock (a week once resolved)",
	"incidents.course_id":  "where its subject was, for the list; not a link",
	"incidents.set_id":     "where its subject was, for the list; not a link",
	"incidents.step_id":    "the step that failed, if any; kept with the incident",
	"steps.subject_id":     "a step goes with its subject: the purge sweeps steps whose subject is gone",
	"steps.incident_id":    "the incident holding a step, while it is open; not a link",
	"places.owner_id":      "a place goes with its owner: the purge sweeps places whose owner is gone",
	"places.tab_id":        "a browser tab, not a row",
}

// Every link names a table and column that exist; every owns-link to a
// single parent is a foreign key that cascades; and every column that names
// another row is a link or says why not.
func TestTheMapMatchesTheSchema(t *testing.T) {
	s := open(t)
	cols := map[string]map[string]bool{}
	for _, tb := range Tables {
		cols[tb.Name] = map[string]bool{}
		rows, err := s.DB.Query(`SELECT name FROM pragma_table_info(?)`, tb.Name)
		must(t, err)
		for rows.Next() {
			var c string
			must(t, rows.Scan(&c))
			cols[tb.Name][c] = true
		}
		must(t, rows.Close())
	}
	linked := map[string]bool{}
	for _, l := range Links {
		if !cols[l.Table][l.Column] || (l.KindColumn != "" && !cols[l.Table][l.KindColumn]) {
			t.Fatalf("link %+v names a column %s does not have", l, l.Table)
		}
		linked[l.Table+"."+l.Column] = true
		if l.Kind != Owns || l.KindColumn != "" {
			continue
		}
		var cascades int
		must(t, s.DB.QueryRow(`SELECT count(*) FROM pragma_foreign_key_list(?) WHERE "from" = ? AND "table" = ? AND on_delete = 'CASCADE'`,
			l.Table, l.Column, nameOf(l.Parent)).Scan(&cascades))
		if cascades != 1 {
			t.Errorf("%s.%s owns-links %s but is not a foreign key that cascades", l.Table, l.Column, l.Parent)
		}
	}
	for _, r := range rowsOwned {
		var cascades int
		must(t, s.DB.QueryRow(`SELECT count(*) FROM pragma_foreign_key_list(?) WHERE "from" = ? AND "table" = ? AND on_delete = 'CASCADE'`,
			r.table, r.column, r.parent).Scan(&cascades))
		if cascades != 1 {
			t.Errorf("%s.%s should go with %s by a cascading foreign key", r.table, r.column, r.parent)
		}
	}
	for table, cs := range cols {
		for c := range cs {
			name := table + "." + c
			if c == "id" || !strings.HasSuffix(c, "_id") || linked[name] {
				continue
			}
			if _, ok := notLinks[name]; !ok {
				t.Errorf("%s names another row but is no link of the map, and not listed in notLinks", name)
			}
		}
	}
}

// world is a course with a textbook and a set of two problems, the second
// referring to the first's find; and a turn with its answer.
func world(t *testing.T, s *Store) {
	t.Helper()
	now := db.Now()
	for _, q := range []string{
		`INSERT INTO courses (id, name, created_at) VALUES ('c', 'ECE 210', ?1)`,
		`INSERT INTO materials (id, course_id, title, added_at) VALUES ('m', 'c', 'Book', ?1)`,
		`INSERT INTO sets (id, course_id, title, created_at) VALUES ('s1', 'c', 'Set 1', ?1), ('s2', 'c', 'Set 2', ?1)`,
		`INSERT INTO questions (id, set_id, position, text, created_at) VALUES ('q1', 's1', 0, '3.12', ?1), ('q2', 's2', 0, 'Redo 3.12', ?1)`,
		`INSERT INTO finds (id, question_id, material_id, page) VALUES ('f1', 'q1', 'm', 95)`,
		`INSERT INTO finds (id, question_id, material_id, page, earlier_id) VALUES ('f2', 'q2', 'm', 95, 'f1')`,
		`INSERT INTO documents (id, owner_kind, owner_id) VALUES ('g1', 'question', 'q1')`,
		`INSERT INTO turns (id, course_id, question, created_at) VALUES ('t', 'c', 'why?', ?1)`,
		`INSERT INTO documents (id, owner_kind, owner_id) VALUES ('a', 'turn', 't')`,
		`UPDATE turns SET answer_id = 'a' WHERE id = 't'`,
	} {
		write(t, s, q, now)
	}
}

func write(t *testing.T, s *Store, q string, args ...any) {
	t.Helper()
	must(t, s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		_, err := tx.Exec(q, args...)
		return err
	}))
}

func visibleNow(t *testing.T, s *Store, k change.Resource, id string) bool {
	t.Helper()
	var v bool
	must(t, s.DB.QueryRow(`SELECT `+Visible(k, "?"), id).Scan(&v))
	return v
}

// A thing is hidden while it or any owner is removed, and only then: a set
// removed hides its problems and their finds and guides, not the textbook
// they point into; a course removed hides everything in it.
func TestVisibilityFollowsOwners(t *testing.T) {
	s := open(t)
	world(t, s)
	type thing struct {
		k  change.Resource
		id string
	}
	all := []thing{
		{change.ResourceCourse, "c"}, {change.ResourceMaterial, "m"}, {change.ResourceSet, "s1"},
		{change.ResourceQuestion, "q1"}, {change.ResourceFind, "f1"}, {change.ResourceDocument, "g1"},
		{change.ResourceSet, "s2"}, {change.ResourceTurn, "t"}, {change.ResourceDocument, "a"},
	}
	check := func(when string, hidden ...string) {
		t.Helper()
		gone := map[string]bool{}
		for _, h := range hidden {
			gone[h] = true
		}
		for _, x := range all {
			if got := visibleNow(t, s, x.k, x.id); got == gone[x.id] {
				t.Errorf("%s: %s %s visible %v", when, x.k, x.id, got)
			}
		}
	}
	check("nothing removed")
	write(t, s, `UPDATE sets SET removed_at = ? WHERE id = 's1'`, db.Now())
	check("set 1 removed", "s1", "q1", "f1", "g1")
	write(t, s, `UPDATE turns SET removed_at = ? WHERE id = 't'`, db.Now())
	check("and the turn", "s1", "q1", "f1", "g1", "t", "a")
	write(t, s, `UPDATE sets SET removed_at = '' WHERE id = 's1'`)
	write(t, s, `UPDATE turns SET removed_at = '' WHERE id = 't'`)
	write(t, s, `UPDATE courses SET removed_at = ? WHERE id = 'c'`, db.Now())
	check("the course removed", "c", "m", "s1", "q1", "f1", "g1", "s2", "t", "a")
	if visibleNow(t, s, change.ResourceSet, "nope") {
		t.Fatal("a set that isn't there is visible")
	}
}

// A removed thing is purged after a week only once nothing outside it refers
// to it or to anything inside it (D4): set 1 waits while set 2's find refers
// to its find, the textbook while any find points into it; a reference from
// inside what is purged goes with it.
func TestThePurgeKeepsWhatIsStillReferred(t *testing.T) {
	s := open(t)
	world(t, s)
	old := db.At(time.Now().Add(-2 * Keep))
	write(t, s, `UPDATE sets SET removed_at = ? WHERE id = 's1'`, old)
	write(t, s, `UPDATE materials SET removed_at = ? WHERE id = 'm'`, old)
	count := func(table, id string) int {
		t.Helper()
		var n int
		must(t, s.DB.QueryRow(`SELECT count(*) FROM `+table+` WHERE id = ?`, id).Scan(&n))
		return n
	}
	must(t, s.Purge(bg, time.Now()))
	if count("sets", "s1") != 1 || count("materials", "m") != 1 {
		t.Fatal("purged set 1 while set 2's find refers to its find, or the textbook while finds point into it")
	}
	// A referrer removed but still inside its week keeps it too.
	write(t, s, `UPDATE questions SET removed_at = ? WHERE id = 'q2'`, db.Now())
	must(t, s.Purge(bg, time.Now()))
	if count("sets", "s1") != 1 {
		t.Fatal("set 1 was purged while a problem removed this week still refers into it")
	}
	// Once that problem's week is up, it goes, and that frees set 1 in the
	// same purge: the problem goes after the sets in a pass, so set 1 needs
	// a second pass.
	write(t, s, `UPDATE questions SET removed_at = ? WHERE id = 'q2'`, old)
	must(t, s.Purge(bg, time.Now()))
	if count("questions", "q2") != 0 || count("sets", "s1") != 0 || count("finds", "f1") != 0 {
		t.Fatal("set 1 was not purged in the same purge as the problem that alone referred into it")
	}
	if count("materials", "m") != 0 {
		t.Fatal("the textbook was kept with no find left pointing into it")
	}
	// A turn's own answer is inside it: it never keeps the turn.
	write(t, s, `UPDATE turns SET removed_at = ? WHERE id = 't'`, old)
	must(t, s.Purge(bg, time.Now()))
	if count("turns", "t") != 0 || count("documents", "a") != 0 {
		t.Fatal("a turn was kept by its own answer")
	}
}

// A course is kept while another course's work points into it: a find in
// course 2 into course 1's material.
func TestThePurgeKeepsACourseOthersPointInto(t *testing.T) {
	s := open(t)
	world(t, s)
	now := db.Now()
	write(t, s, `INSERT INTO courses (id, name, created_at) VALUES ('c2', 'MATH 285', ?)`, now)
	write(t, s, `INSERT INTO sets (id, course_id, title, created_at) VALUES ('s3', 'c2', 'Set 1', ?)`, now)
	write(t, s, `INSERT INTO questions (id, set_id, position, text, created_at) VALUES ('q3', 's3', 0, '1.1', ?)`, now)
	write(t, s, `INSERT INTO finds (id, question_id, material_id, page) VALUES ('f3', 'q3', 'm', 3)`)
	write(t, s, `UPDATE courses SET removed_at = ? WHERE id = 'c'`, db.At(time.Now().Add(-2*Keep)))
	must(t, s.Purge(bg, time.Now()))
	var n int
	must(t, s.DB.QueryRow(`SELECT count(*) FROM courses WHERE id = 'c'`).Scan(&n))
	if n != 1 {
		t.Fatal("a course was purged while another course's find points into its material")
	}
}

// Undo's note names the nearest owner that hides a thing, and none when the
// thing is removed itself.
func TestHiddenByIsTheNearestOwner(t *testing.T) {
	s := open(t)
	world(t, s)
	write(t, s, `UPDATE turns SET removed_at = ? WHERE id = 't'`, db.Now())
	write(t, s, `UPDATE courses SET removed_at = ? WHERE id = 'c'`, db.Now())
	by, err := s.HiddenBy(bg, change.ResourceDocument, "a")
	must(t, err)
	if by != change.ResourceTurn {
		t.Fatalf("a turn's answer, its turn and course removed, is hidden by %q", by)
	}
	by, err = s.HiddenBy(bg, change.ResourceTurn, "t")
	must(t, err)
	if by != "" {
		t.Fatalf("a turn removed itself is hidden by %q", by)
	}
	// A problem's guide, its set and course removed: its set is nearest.
	write(t, s, `UPDATE sets SET removed_at = ? WHERE id = 's1'`, db.Now())
	by, err = s.HiddenBy(bg, change.ResourceDocument, "g1")
	must(t, err)
	if by != change.ResourceSet {
		t.Fatalf("a problem's guide, its set and course removed, is hidden by %q", by)
	}
	// Only the course removed: reached through the question and the turn
	// alike, it is the course.
	write(t, s, `UPDATE sets SET removed_at = '' WHERE id = 's1'`)
	write(t, s, `UPDATE turns SET removed_at = '' WHERE id = 't'`)
	by, err = s.HiddenBy(bg, change.ResourceDocument, "g1")
	must(t, err)
	if by != change.ResourceCourse {
		t.Fatalf("a problem's guide, only its course removed, is hidden by %q", by)
	}
}
