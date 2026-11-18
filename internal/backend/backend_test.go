package backend

import (
	"bufio"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/jackt/pset/internal/action"
	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/store"
)

// world is a fresh store with one of everything the catalog's actions act
// on, and the catalog over it.
func world(t *testing.T) (*store.Store, *action.Catalog, action.Seed) {
	t.Helper()
	s, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "store.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cleanup.Close(s.DB) })
	seed := action.Seed{CourseID: "c1", MaterialID: "m1", IncidentID: "INC001", SetID: "s1", QuestionID: "q1"}
	if err := s.Write(context.Background(), change.ActorPSet, "", func(tx *sql.Tx) error {
		if _, err := tx.Exec(`INSERT INTO courses (id, name, created_at) VALUES (?, 'ECE 210', ?)`, seed.CourseID, db.Now()); err != nil {
			return err
		}
		if _, err := tx.Exec(`INSERT INTO materials (id, course_id, title, file_hash, added_at) VALUES (?, ?, 'Oppenheim', 'h1', ?)`,
			seed.MaterialID, seed.CourseID, db.Now()); err != nil {
			return err
		}
		if _, err := tx.Exec(`INSERT INTO sets (id, course_id, title, created_at) VALUES (?, ?, 'Problem set 4', ?)`,
			seed.SetID, seed.CourseID, db.Now()); err != nil {
			return err
		}
		if _, err := tx.Exec(`INSERT INTO questions (id, set_id, position, text, label, find, created_at) VALUES
			(?, ?, 0, '3.1 #7', '3.1 #7', 1, ?), ('q2', ?, 1, '3.1 #9', '3.1 #9', 1, ?)`,
			seed.QuestionID, seed.SetID, db.Now(), seed.SetID, db.Now()); err != nil {
			return err
		}
		_, err := tx.Exec(`INSERT INTO incidents (id, error, kind, born, first_at, last_at) VALUES (?, '{"id":"internal.unexpected"}', 'ours', 'step', ?, ?)`,
			seed.IncidentID, db.Now(), db.Now())
		return err
	}); err != nil {
		t.Fatal(err)
	}
	b := New(s, Options{DataDir: t.TempDir()})
	f, err := os.Open(filepath.Join("..", "..", "testdata", "sample-digital.pdf"))
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup.Close(f)
	up, err := b.Materials.Stage(f, "sample-digital.pdf")
	if err != nil {
		t.Fatal(err)
	}
	seed.UploadID = up.ID
	return s, b.Actions, seed
}

// visible is every logged table as the student sees it: removed rows left
// out, and each row's place in the log (seq) set aside.
func visible(t *testing.T, s *store.Store) map[string][]map[string]any {
	t.Helper()
	out := map[string][]map[string]any{}
	for _, tb := range store.Tables {
		q := "SELECT * FROM " + tb.Name
		if tb.Removed != "" {
			q += " WHERE " + tb.Removed + " = ''"
		}
		rows, err := s.DB.Query(q + " ORDER BY rowid")
		if err != nil {
			t.Fatal(err)
		}
		cols, err := rows.Columns()
		if err != nil {
			t.Fatal(err)
		}
		for rows.Next() {
			vals := make([]any, len(cols))
			ptrs := make([]any, len(cols))
			for i := range vals {
				ptrs[i] = &vals[i]
			}
			if err := rows.Scan(ptrs...); err != nil {
				t.Fatal(err)
			}
			row := map[string]any{}
			for i, c := range cols {
				if c != "seq" {
					// Typed: NULL, "<nil>", 5 and "5" all differ.
					row[c] = fmt.Sprintf("%T:%v", vals[i], vals[i])
				}
			}
			out[tb.Name] = append(out[tb.Name], row)
		}
		cleanup.Close(rows)
	}
	return out
}

// Every undoable action in the catalog, run in a fresh world: Undo puts
// everything back as it was, says so, and undoing the undo puts it back as
// the action left it.
func TestEveryUndoableActionUndoesAndRedoes(t *testing.T) {
	_, all, _ := world(t)
	for _, e := range all.Entries() {
		if !e.Undoable {
			t.Run(e.ID, func(t *testing.T) { cantBeUndone(t, e.ID) })
			continue
		}
		t.Run(e.ID, func(t *testing.T) {
			s, c, seed := world(t)
			in, ok := c.Try(e.ID, seed)
			if !ok {
				t.Fatal("an undoable action with no Try input: the catalog's test can't prove it undoes")
			}
			before := visible(t, s)
			done, err := c.Run(context.Background(), e.ID, json.RawMessage(in))
			if err != nil {
				t.Fatal(err)
			}
			after := visible(t, s)
			if done.Action == "" || reflect.DeepEqual(before, after) {
				t.Fatalf("its Try input changed nothing (%+v)", done)
			}
			u, err := c.Undo(context.Background(), done.Action, false)
			if err != nil {
				t.Fatal(err)
			}
			if got := visible(t, s); !reflect.DeepEqual(got, before) {
				t.Fatalf("undone, the store is\n%v\nwant\n%v", got, before)
			}
			// It names what it took back, in the entry's own words, not the
			// plain fallback.
			if u.Entry != e.ID || u.Kind != done.Kind || u.ID != done.ID || u.Said == "" || u.Said == "Took that back." {
				t.Fatalf("Undo said %+v after %+v", u, done)
			}
			r, err := c.Undo(context.Background(), u.Undo, false)
			if err != nil {
				t.Fatal(err)
			}
			if r.Said == "" || r.Said == "Did that again." || r.Said == u.Said {
				t.Fatalf("redo said %q (undo said %q)", r.Said, u.Said)
			}
			if got := visible(t, s); !reflect.DeepEqual(got, after) {
				t.Fatalf("redone, the store is\n%v\nwant\n%v", got, after)
			}
		})
	}
}

// cantBeUndone runs an action that can't be undone: it gives nothing to undo
// it by, and none of its changes are the student's, so Ctrl+Z never meets
// them.
func cantBeUndone(t *testing.T, id string) {
	s, c, seed := world(t)
	in, ok := c.Try(id, seed)
	if !ok {
		t.Skip("no Try input")
	}
	done, err := c.Run(context.Background(), id, json.RawMessage(in))
	if err != nil {
		t.Fatal(err)
	}
	var n int
	if err := s.DB.QueryRow(`SELECT count(*) FROM changes WHERE actor = 'student'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if done.Action != "" || n != 0 {
		t.Fatalf("an action that can't be undone left %d student changes and %+v", n, done)
	}
}

// No two actions answer to the same key. Every key is global until the
// palette's design pass says which screen each belongs to.
func TestNoTwoActionsShareAKey(t *testing.T) {
	_, c, _ := world(t)
	seen := map[string]string{}
	for _, e := range c.Entries() {
		if e.Key == "" {
			continue
		}
		if other, ok := seen[e.Key]; ok {
			t.Errorf("%s and %s both answer to %q", other, e.ID, e.Key)
		}
		seen[e.Key] = e.ID
	}
}

// The store's change stream is mounted at GET /api/changes: a page that
// asks from seq 0 gets the changes logged so far, as server-sent events.
func TestTheChangeStreamIsMounted(t *testing.T) {
	s, _, seed := world(t)
	mux := http.NewServeMux()
	New(s, Options{DataDir: t.TempDir()}).Routes(mux)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL+"/api/changes?after=0", nil)
	if err != nil {
		t.Fatal(err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup.Close(resp.Body)
	if resp.StatusCode != http.StatusOK || !strings.HasPrefix(resp.Header.Get("Content-Type"), "text/event-stream") {
		t.Fatalf("GET /api/changes answered %d %q", resp.StatusCode, resp.Header.Get("Content-Type"))
	}
	lines := bufio.NewScanner(resp.Body)
	for lines.Scan() {
		if strings.HasPrefix(lines.Text(), "data:") && strings.Contains(lines.Text(), seed.CourseID) {
			return
		}
	}
	t.Fatalf("the stream never sent the course's change (%v)", lines.Err())
}

// A page that connects with no seq first gets an open event, whose id is
// where the log stood: an action whose reply seq is at or below it has
// caught up.
func TestAFreshStreamSaysWhereTheLogStands(t *testing.T) {
	s, _, _ := world(t)
	latest, err := s.Latest(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	New(s, Options{DataDir: t.TempDir()}).Routes(mux)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL+"/api/changes", nil)
	if err != nil {
		t.Fatal(err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup.Close(resp.Body)
	lines := bufio.NewScanner(resp.Body)
	var id, data string
	for lines.Scan() && lines.Text() != "" {
		switch {
		case strings.HasPrefix(lines.Text(), "id: "):
			id = strings.TrimPrefix(lines.Text(), "id: ")
		case strings.HasPrefix(lines.Text(), "data: "):
			data = strings.TrimPrefix(lines.Text(), "data: ")
		}
	}
	if id != fmt.Sprint(latest) || data != fmt.Sprintf(`{"type":"open","data":{"seq":%d}}`, latest) {
		t.Fatalf("the first event: id %q (want %d), data %q", id, latest, data)
	}
}

// A removal's reply counts what went with it; undoing the removal of a thing
// whose course is removed says it is still hidden (ideas/dependencies-
// grill.md, A2 and D6).
func TestARemovalCountsAndUndoSaysWhatStillHides(t *testing.T) {
	ctx := context.Background()
	_, c, seed := world(t)
	run := func(id string, in any) action.Done {
		t.Helper()
		raw, err := json.Marshal(in)
		if err != nil {
			t.Fatal(err)
		}
		done, err := c.Run(ctx, id, raw)
		if err != nil {
			t.Fatal(err)
		}
		return done
	}
	removedCourse := run("course.remove", map[string]string{"id": seed.CourseID})
	if want := []action.Took{{Kind: change.ResourceMaterial, N: 1}, {Kind: change.ResourceSet, N: 1}}; !reflect.DeepEqual(removedCourse.Took, want) {
		t.Fatalf("removing the course took %+v, want %+v", removedCourse.Took, want)
	}
	if _, err := c.Undo(ctx, removedCourse.Action, false); err != nil {
		t.Fatal(err)
	}
	// The material removed on its own, then its course: undoing the
	// material's removal brings it back, still hidden by the course.
	removedMaterial := run("material.remove", map[string]string{"id": seed.MaterialID})
	if len(removedMaterial.Took) != 0 {
		t.Fatalf("a material took %+v", removedMaterial.Took)
	}
	if again := run("course.remove", map[string]string{"id": seed.CourseID}); !reflect.DeepEqual(again.Took, []action.Took{{Kind: change.ResourceSet, N: 1}}) {
		t.Fatalf("a course whose material is removed on its own took %+v, want its set alone", again.Took)
	}
	u, err := c.Undo(ctx, removedMaterial.Action, false)
	if err != nil {
		t.Fatal(err)
	}
	if u.Said != "Brought back Oppenheim. Its course is still removed." {
		t.Fatalf("undo said %q", u.Said)
	}
	// Redoing the removal removes it again: no note, it is removed itself.
	redo, err := c.Undo(ctx, u.Undo, false)
	if err != nil {
		t.Fatal(err)
	}
	if redo.Said != "Removed Oppenheim again." {
		t.Fatalf("redo said %q", redo.Said)
	}
}
