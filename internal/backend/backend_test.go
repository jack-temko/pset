package backend

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"path/filepath"
	"reflect"
	"testing"

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
	seed := action.Seed{CourseID: "c1"}
	if err := s.Write(context.Background(), change.ActorPSet, "", func(tx *sql.Tx) error {
		_, err := tx.Exec(`INSERT INTO courses (id, name, created_at) VALUES (?, 'ECE 210', ?)`, seed.CourseID, db.Now())
		return err
	}); err != nil {
		t.Fatal(err)
	}
	return s, New(s).Actions, seed
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
