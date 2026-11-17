package store

import (
	"context"
	"database/sql"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
)

var bg = context.Background()

func open(t *testing.T) *Store {
	t.Helper()
	s, err := Open(bg, filepath.Join(t.TempDir(), "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cleanup.Close(s.DB) })
	return s
}

func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

// ids of the one row seed makes in each logged table.
var ids = map[string]string{
	"courses": "c1", "materials": "m1", "sets": "s1", "questions": "q1", "finds": "f1",
	"readings": "r1", "documents": "d1", "turns": "t1", "memories": "y1", "incidents": "INC001",
	"conditions": "key",
}

// seed fills every logged table with one row, and a page and a section, as
// PSet. It returns the seq it left the log at.
func seed(t *testing.T, s *Store) int64 {
	t.Helper()
	now := db.Now()
	must(t, s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		for _, q := range []string{
			`INSERT INTO courses (id, name, created_at) VALUES ('c1', 'Signals', '` + now + `')`,
			`INSERT INTO materials (id, course_id, title, page_count, aspect, page_runs, added_at) VALUES ('m1', 'c1', 'Oppenheim', 3, 1.29, '[{"from":1,"to":3}]', '` + now + `')`,
			`INSERT INTO pages (material_id, number, text) VALUES ('m1', 1, 'one'), ('m1', 2, 'two')`,
			`INSERT INTO sections (id, material_id, title, page, position) VALUES ('sec1', 'm1', 'Chapter 1', 1, 0)`,
			`INSERT INTO sets (id, course_id, title, due, created_at) VALUES ('s1', 'c1', 'Problem set 4', '2026-11-20', '` + now + `')`,
			`INSERT INTO questions (id, set_id, position, text, label, notes, created_at) VALUES ('q1', 's1', 0, '1.3', '1.3', '[["Show work"]]', '` + now + `')`,
			`INSERT INTO questions (id, set_id, position, text, label, created_at) VALUES ('q2', 's1', 1, '1.4', '1.4', '` + now + `')`,
			`INSERT INTO finds (id, question_id, material_id, page, boxes, statement) VALUES ('f1', 'q1', 'm1', 2, '[{"page":2,"x":0.1}]', '[["Find x."]]')`,
			`INSERT INTO readings (id, question_id, lines, doubts) VALUES ('r1', 'q1', '[["R = 2 ohm"]]', '[0]')`,
			`INSERT INTO documents (id, owner_kind, owner_id, blocks, state) VALUES ('d1', 'question', 'q1', '[{"type":"para"}]', 'done')`,
			`INSERT INTO turns (id, course_id, question, about, created_at) VALUES ('t1', 'c1', 'What is a pole?', '{"label":"1.3"}', '` + now + `')`,
			`INSERT INTO memories (id, course_id, text, created_at) VALUES ('y1', 'c1', 'Short answers', '` + now + `')`,
			`INSERT INTO incidents (id, error, kind, subject_kind, subject_id, course_id, set_id, born, first_at, last_at) VALUES ('INC001', '{"id":"llm.key_missing"}', 'waiting_on_you', 'question', 'q1', 'c1', 's1', 'step', '` + now + `', '` + now + `')`,
			`INSERT INTO conditions (id, holds, since) VALUES ('key', 1, '` + now + `')`,
		} {
			if _, err := tx.Exec(q); err != nil {
				return fmt.Errorf("%s: %w", q, err)
			}
		}
		return nil
	}))
	n, err := s.Latest(bg)
	must(t, err)
	return n
}

type row map[string]any

// snapshot is every column of every row of every table, the log excepted,
// with seq left out: it is what Undo must give back exactly.
func snapshot(t *testing.T, s *Store) map[string][]row {
	t.Helper()
	out := map[string][]row{}
	names := []string{"pages", "sections"}
	for _, tb := range Tables {
		names = append(names, tb.Name)
	}
	for _, name := range names {
		rs, err := s.DB.Query(`SELECT * FROM ` + name + ` ORDER BY rowid`)
		must(t, err)
		cols, err := rs.Columns()
		must(t, err)
		for rs.Next() {
			vals := make([]any, len(cols))
			ptrs := make([]any, len(cols))
			for i := range vals {
				ptrs[i] = &vals[i]
			}
			must(t, rs.Scan(ptrs...))
			r := row{}
			for i, c := range cols {
				if c != "seq" {
					r[c] = vals[i]
				}
			}
			out[name] = append(out[name], r)
		}
		must(t, rs.Err())
		cleanup.Close(rs)
	}
	return out
}

// diff says how two snapshots differ, value and type both.
func diff(a, b map[string][]row) []string {
	var out []string
	for name, rows := range a {
		if len(rows) != len(b[name]) {
			out = append(out, fmt.Sprintf("%s: %d rows, then %d", name, len(rows), len(b[name])))
			continue
		}
		for i, r := range rows {
			for c, v := range r {
				w := b[name][i][c]
				if fmt.Sprintf("%T %v", v, v) != fmt.Sprintf("%T %v", w, w) {
					out = append(out, fmt.Sprintf("%s[%d].%s: %T %v, then %T %v", name, i, c, v, v, w, w))
				}
			}
		}
	}
	sort.Strings(out)
	return out
}

func count(t *testing.T, s *Store, q string, args ...any) int {
	t.Helper()
	var n int
	must(t, s.DB.QueryRow(q, args...).Scan(&n))
	return n
}

func columns(t *testing.T, s *Store, table string) map[string]string {
	t.Helper()
	rs, err := s.DB.Query(`SELECT name, type FROM pragma_table_info(?)`, table)
	must(t, err)
	defer cleanup.Close(rs)
	out := map[string]string{}
	for rs.Next() {
		var n, typ string
		must(t, rs.Scan(&n, &typ))
		out[n] = typ
	}
	return out
}

// fixed are the columns a CHECK or a key limits, and the other value each
// takes. Columns naming a parent are left out of the walk: changing them is
// moving a thing, which no action does.
var fixed = map[string]any{
	"incidents.state": "dismissed", "incidents.kind": "cant", "incidents.born": "page",
	"documents.state": "stopped", "documents.owner_kind": "turn",
	"materials.course_id": nil, "sets.course_id": nil, "questions.set_id": nil, "finds.question_id": nil,
	"readings.question_id": nil, "turns.course_id": nil, "memories.course_id": nil,
}

func readFile(name string) (string, error) {
	b, err := os.ReadFile(name)
	return string(b), err
}

// changed is a value of the column's type that differs from v.
func changed(col, typ string, v any) any {
	switch {
	case col == "removed_at" || strings.HasSuffix(col, "_at"):
		if v == "" {
			return db.Now()
		}
		return ""
	case typ == "INTEGER":
		return v.(int64) + 1
	case typ == "REAL":
		return v.(float64) + 0.5
	default:
		return fmt.Sprint(v) + " (edited)"
	}
}

func TestEveryColumnIsClassifiedOnce(t *testing.T) {
	s := open(t)
	for _, tb := range Tables {
		seen := map[string]int{"id": 1}
		for _, c := range slices.Concat(tb.Student, tb.PSet, tb.Meta) {
			seen[c]++
		}
		cols := columns(t, s, tb.Name)
		for c := range cols {
			if seen[c] != 1 {
				t.Errorf("%s.%s is classified %d times, want once", tb.Name, c, seen[c])
			}
		}
		for c := range seen {
			if _, ok := cols[c]; !ok {
				t.Errorf("%s classifies %s, which it does not have", tb.Name, c)
			}
		}
		if _, ok := cols["seq"]; !ok {
			t.Errorf("%s has no seq", tb.Name)
		}
		if tb.Removed != "" && !slices.Contains(tb.Student, tb.Removed) {
			t.Errorf("%s: its marker %s is not the student's", tb.Name, tb.Removed)
		}
		for _, c := range cols {
			if c == "BLOB" {
				t.Errorf("%s has a BLOB column: it must be Meta, never logged", tb.Name)
			}
		}
	}
}

func TestEveryWriteOutsideWriteIsRefused(t *testing.T) {
	s := open(t)
	seed(t, s)
	for _, tb := range Tables {
		cols := tb.Student
		if len(cols) == 0 {
			cols = tb.PSet
		}
		col := cols[0]
		typ := columns(t, s, tb.Name)[col]
		var v any
		must(t, s.DB.QueryRow(`SELECT `+col+` FROM `+tb.Name+` WHERE id = ?`, ids[tb.Name]).Scan(&v))
		to, isFixed := fixed[tb.Name+"."+col]
		if !isFixed || to == nil {
			to = changed(col, typ, v)
		}
		if _, err := s.DB.Exec(`UPDATE `+tb.Name+` SET `+col+` = ? WHERE id = ?`, to, ids[tb.Name]); err == nil || !strings.Contains(err.Error(), "outside store.Write") {
			t.Errorf("%s: an update outside Write: %v", tb.Name, err)
		}
		if _, err := s.DB.Exec(`DELETE FROM `+tb.Name+` WHERE id = ?`, ids[tb.Name]); err == nil {
			t.Errorf("%s: a delete outside Write went through", tb.Name)
		}
		err := s.Write(bg, change.ActorStudent, "a1", func(tx *sql.Tx) error {
			_, err := tx.Exec(`DELETE FROM `+tb.Name+` WHERE id = ?`, ids[tb.Name])
			return err
		})
		if err == nil || !strings.Contains(err.Error(), "only the purge") {
			t.Errorf("%s: a student's delete: %v", tb.Name, err)
		}
		// REPLACE is a delete and an insert: with recursive triggers on,
		// the delete is refused rather than the old row dropped unlogged.
		err = s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
			_, err := tx.Exec(`INSERT OR REPLACE INTO `+tb.Name+` SELECT * FROM `+tb.Name+` WHERE id = ?`, ids[tb.Name])
			return err
		})
		if err == nil {
			t.Errorf("%s: INSERT OR REPLACE went through", tb.Name)
		}
	}
	for _, name := range throughParent {
		if _, err := s.DB.Exec(`DELETE FROM ` + name); err == nil {
			t.Errorf("%s: a delete outside Write went through", name)
		}
	}
	if _, err := s.DB.Exec(`INSERT INTO courses (id, name, created_at) VALUES ('c2', 'x', 'now')`); err == nil {
		t.Error("an insert outside Write went through")
	}
	if n := count(t, s, `SELECT count(*) FROM change_ctx`); n != 0 {
		t.Fatalf("%d context rows left behind", n)
	}
}

func TestAStudentWriteNeedsAnAction(t *testing.T) {
	s := open(t)
	if err := s.Write(bg, change.ActorStudent, "", func(*sql.Tx) error { return nil }); err == nil {
		t.Fatal("a student write without an action id went through")
	}
}

func TestNoOpAndMetaUpdatesLogNothing(t *testing.T) {
	s := open(t)
	seed(t, s)
	before := count(t, s, `SELECT count(*) FROM changes`)
	for _, tb := range Tables {
		col := slices.Concat(tb.Student, tb.PSet)[0]
		// Neither needs a context: the triggers do not fire.
		if _, err := s.DB.Exec(`UPDATE `+tb.Name+` SET `+col+` = `+col+` WHERE id = ?`, ids[tb.Name]); err != nil {
			t.Errorf("%s: a no-op update: %v", tb.Name, err)
		}
		if _, err := s.DB.Exec(`UPDATE `+tb.Name+` SET seq = seq + 0 WHERE id = ?`, ids[tb.Name]); err != nil {
			t.Errorf("%s: a meta update: %v", tb.Name, err)
		}
	}
	if after := count(t, s, `SELECT count(*) FROM changes`); after != before {
		t.Fatalf("%d rows logged by no-op and meta updates", after-before)
	}
}

// TestEveryTableLogsUndoesAndCompares is the track's acceptance: for every
// logged column of every table, a student action changes it, the log says
// so with the values, and Undo gives back every column of every row of
// every table, types included. A PSet change to a PSet column logs no
// values and cannot be undone.
func TestEveryTableLogsUndoesAndCompares(t *testing.T) {
	s := open(t)
	seed(t, s)
	n := 0
	for _, tb := range Tables {
		cols := columns(t, s, tb.Name)
		for _, col := range slices.Concat(tb.Student, tb.PSet) {
			to, isFixed := fixed[tb.Name+"."+col]
			if isFixed && to == nil || col == "owner_kind" {
				continue
			}
			n++
			action := fmt.Sprintf("a%d", n)
			var v any
			must(t, s.DB.QueryRow(`SELECT `+col+` FROM `+tb.Name+` WHERE id = ?`, ids[tb.Name]).Scan(&v))
			if b, ok := v.([]byte); ok {
				v = string(b)
			}
			was := snapshot(t, s)
			seqWas := count(t, s, `SELECT seq FROM `+tb.Name+` WHERE id = ?`, ids[tb.Name])
			must(t, s.Write(bg, change.ActorStudent, action, func(tx *sql.Tx) error {
				if !isFixed {
					to = changed(col, cols[col], v)
				}
				_, err := tx.Exec(`UPDATE `+tb.Name+` SET `+col+` = ? WHERE id = ?`, to, ids[tb.Name])
				return err
			}))
			var kind, op, actor string
			var before, after sql.NullString
			must(t, s.DB.QueryRow(`SELECT kind, op, actor, before, after FROM changes WHERE action_id = ? AND echo = 0`, action).
				Scan(&kind, &op, &actor, &before, &after))
			wantOp := "changed"
			if col == tb.Removed {
				wantOp = "removed"
			}
			if kind != string(tb.Kind) || op != wantOp || actor != "student" || !before.Valid || !after.Valid ||
				!strings.Contains(after.String, `"`+col+`"`) {
				t.Errorf("%s.%s: logged %s %s by %s, before %v after %v", tb.Name, col, kind, op, actor, before, after)
			}
			if seq := count(t, s, `SELECT seq FROM `+tb.Name+` WHERE id = ?`, ids[tb.Name]); seq <= seqWas {
				t.Errorf("%s.%s: seq %d did not rise past %d", tb.Name, col, seq, seqWas)
			}
			if _, err := s.Undo(bg, action, "undo-"+action); err != nil {
				t.Errorf("%s.%s: undo: %v", tb.Name, col, err)
				continue
			}
			if d := diff(was, snapshot(t, s)); len(d) > 0 {
				t.Errorf("%s.%s: undo left %v", tb.Name, col, d)
			}
		}
	}
}

func TestPSetsOwnChangesCarryNoPSetValues(t *testing.T) {
	s := open(t)
	seed(t, s)
	must(t, s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		_, err := tx.Exec(`UPDATE documents SET blocks = '[]', state = 'writing' WHERE id = 'd1'`)
		return err
	}))
	var op, action string
	var before, after sql.NullString
	must(t, s.DB.QueryRow(`SELECT op, action_id, before, after FROM changes WHERE kind = 'document' ORDER BY seq DESC LIMIT 1`).
		Scan(&op, &action, &before, &after))
	if op != "changed" || action != "" || before.Valid || after.Valid {
		t.Fatalf("PSet's guide rewrite logged %s %q %v %v, want changed with no values", op, action, before, after)
	}
	// A reading PSet reads again carries its lines: they are the student's
	// too, so a correction can be undone only if nothing wrote over it.
	must(t, s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		_, err := tx.Exec(`UPDATE readings SET lines = '[["R = 3 ohm"]]', doubts = '[]' WHERE id = 'r1'`)
		return err
	}))
	must(t, s.DB.QueryRow(`SELECT after FROM changes WHERE kind = 'reading' ORDER BY seq DESC LIMIT 1`).Scan(&after))
	if after.String != `{"lines":"[[\"R = 3 ohm\"]]"}` {
		t.Fatalf("PSet's reading logged %s, want the lines only", after.String)
	}
}

func TestStoreContextIsOnlyTouchedHere(t *testing.T) {
	// change_ctx is the store's alone: a row set anywhere else and left
	// behind would attribute the next stray write to someone's action.
	var files []string
	for _, root := range []string{"../../internal", "../../cmd", "../../tools"} {
		must(t, filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
			if err == nil && !d.IsDir() && strings.HasSuffix(p, ".go") {
				files = append(files, p)
			}
			return err
		}))
	}
	for _, f := range files {
		if strings.Contains(f, "/internal/store/") {
			continue
		}
		b, err := readFile(f)
		must(t, err)
		if strings.Contains(b, "change_ctx") {
			t.Errorf("%s names change_ctx: only internal/store may", f)
		}
		for _, tb := range Tables {
			for _, form := range []string{"OR REPLACE INTO " + tb.Name, "REPLACE INTO " + tb.Name + " "} {
				if strings.Contains(strings.ToUpper(b), strings.ToUpper(form)) {
					t.Errorf("%s replaces into %s: use ON CONFLICT DO UPDATE", f, tb.Name)
				}
			}
		}
	}
}
