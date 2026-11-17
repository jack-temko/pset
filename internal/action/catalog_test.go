package action

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/condition"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/store"
	"github.com/jackt/pset/internal/testx"
)

var bg = context.Background()

type named struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// catalog is a store with one course, c1 "ECE 210", and a catalog of test
// actions on it.
func catalog(t *testing.T) (*Catalog, *store.Store) {
	t.Helper()
	s, err := store.Open(bg, filepath.Join(t.TempDir(), "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cleanup.Close(s.DB) })
	if err := s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		_, err := tx.Exec(`INSERT INTO courses (id, name, created_at) VALUES ('c1', 'ECE 210', ?)`, db.Now())
		return err
	}); err != nil {
		t.Fatal(err)
	}
	c := New(s)
	rename := func(ctx context.Context, do *Do, in named) error {
		return do.Write(ctx, change.ResourceCourse, in.ID, func(tx *sql.Tx) error {
			_, err := tx.Exec(`UPDATE courses SET name = ? WHERE id = ?`, in.Name, in.ID)
			return err
		})
	}
	Add(c, Def[named]{ID: "test.rename", Name: "Rename", Undoable: true,
		Undone: "Renamed back to {name}.", Redone: "Renamed to {name} again.", Run: rename})
	Add(c, Def[named]{ID: "test.keep", Name: "Keep a name", Run: rename})
	Add(c, Def[named]{ID: "test.read", Name: "Read a PDF", Undoable: true, Undone: "x", Redone: "y", Needs: []condition.ID{condition.IDPDFReader}, Run: rename})
	Add(c, Def[named]{ID: "test.twice", Name: "Write twice", Undoable: true, Undone: "x", Redone: "y", Run: func(ctx context.Context, do *Do, in named) error {
		if err := rename(ctx, do, in); err != nil {
			return err
		}
		return rename(ctx, do, in)
	}})
	return c, s
}

func run(t *testing.T, c *Catalog, id, name string) Done {
	t.Helper()
	b, err := json.Marshal(named{ID: "c1", Name: name})
	if err != nil {
		t.Fatal(err)
	}
	d, err := c.Run(bg, id, b)
	if err != nil {
		t.Fatalf("%s: %v", id, err)
	}
	return d
}

func courseName(t *testing.T, s *store.Store) string {
	t.Helper()
	var n string
	if err := s.DB.QueryRow(`SELECT name FROM courses WHERE id = 'c1'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

// An action runs, Undo takes it back and says so in the thing's own name,
// and undoing the undo is redo.
func TestUndoSaysWhatItTookBackAndRedoes(t *testing.T) {
	c, s := catalog(t)
	done := run(t, c, "test.rename", "ECE 211")
	if done.Action == "" || done.Kind != change.ResourceCourse || done.ID != "c1" || done.Seq == 0 {
		t.Fatalf("done %+v", done)
	}
	u, err := c.Undo(bg, "", true) // Ctrl+Z
	if err != nil {
		t.Fatal(err)
	}
	if courseName(t, s) != "ECE 210" || u.Action != done.Action || u.Entry != "test.rename" || u.Said != "Renamed back to ECE 210." || u.ID != "c1" {
		t.Fatalf("undone %+v, name %q", u, courseName(t, s))
	}
	r, err := c.Undo(bg, u.Undo, false)
	if err != nil {
		t.Fatal(err)
	}
	if courseName(t, s) != "ECE 211" || r.Said != "Renamed to ECE 211 again." {
		t.Fatalf("redone %+v, name %q", r, courseName(t, s))
	}
	// The redo undone, and that redone: the chain's root still names it.
	u2, err := c.Undo(bg, r.Undo, false)
	if err != nil || courseName(t, s) != "ECE 210" || u2.Said != "Renamed back to ECE 210." || u2.Entry != "test.rename" {
		t.Fatalf("the redo undone: %+v (%v), name %q", u2, err, courseName(t, s))
	}
	r2, err := c.Undo(bg, u2.Undo, false)
	if err != nil || courseName(t, s) != "ECE 211" || r2.Said != "Renamed to ECE 211 again." {
		t.Fatalf("redone again: %+v (%v), name %q", r2, err, courseName(t, s))
	}
	// Undone once already: a second tab's undo of it is refused.
	if _, err := c.Undo(bg, done.Action, false); !errors.Is(err, store.AlreadyUndone) {
		t.Fatalf("undoing it twice: %v", err)
	}
}

// Ctrl+Z after an undo and its redo goes on back, never toggling; with
// nothing left it says so. An empty action is never Ctrl+Z by accident.
func TestCtrlZWalksBack(t *testing.T) {
	c, s := catalog(t)
	run(t, c, "test.rename", "ECE 211")
	run(t, c, "test.rename", "ECE 212")
	u, err := c.Undo(bg, "", true)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := c.Undo(bg, u.Undo, false); err != nil { // redo: 212 again
		t.Fatal(err)
	}
	for _, want := range []string{"ECE 211", "ECE 210"} {
		if _, err := c.Undo(bg, "", true); err != nil {
			t.Fatal(err)
		}
		if got := courseName(t, s); got != want {
			t.Fatalf("Ctrl+Z left %q, want %q", got, want)
		}
	}
	if _, err := c.Undo(bg, "", true); !errors.Is(err, store.NothingToUndo) {
		t.Fatalf("Ctrl+Z with nothing left: %v", err)
	}
	if _, err := c.Undo(bg, "", false); !errors.Is(err, store.NothingToUndo) {
		t.Fatalf("an empty action: %v", err)
	}
	if _, err := c.Undo(bg, "no-such-action", false); err == nil {
		t.Fatal("undoing an action that never ran")
	}
}

// An action that can't be undone is outside the chain Ctrl+Z walks: it
// never stands in the way of undoing what came before it.
func TestCtrlZPassesOverWhatCantBeUndone(t *testing.T) {
	c, s := catalog(t)
	if err := s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		_, err := tx.Exec(`INSERT INTO courses (id, name, created_at) VALUES ('c2', 'PHYS 211', ?)`, db.Now())
		return err
	}); err != nil {
		t.Fatal(err)
	}
	run(t, c, "test.rename", "ECE 211")
	d, err := c.Run(bg, "test.keep", json.RawMessage(`{"id":"c2","name":"PHYS 212"}`))
	if err != nil {
		t.Fatal(err)
	}
	if d.Action != "" {
		t.Fatalf("an action that can't be undone gave an id to undo it by: %+v", d)
	}
	u, err := c.Undo(bg, "", true)
	if err != nil {
		t.Fatal(err)
	}
	if u.Entry != "test.rename" {
		t.Fatalf("Ctrl+Z took back %s, want the rename", u.Entry)
	}
}

func TestWhatTheRouteRefuses(t *testing.T) {
	c, s := catalog(t)
	if _, err := c.Run(bg, "test.nothing", nil); !errors.Is(err, Unknown) {
		t.Fatalf("an unknown action: %v", err)
	}
	if _, err := c.Run(bg, "test.rename", json.RawMessage(`{"id":"c1","nme":"x"}`)); !errors.Is(err, errs.InvalidJSON) {
		t.Fatalf("an input with a stray field: %v", err)
	}
	// A condition it needs does not hold: refused before it runs, saying why.
	if err := s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		_, err := tx.Exec(`INSERT INTO conditions (id, holds, since, error) VALUES ('pdf_reader', 0, ?, '{"id":"condition.pdf_reader","what":"PSet can''t read PDFs on this computer.","fix":"Install Poppler."}')`, db.Now())
		return err
	}); err != nil {
		t.Fatal(err)
	}
	_, err := c.Run(bg, "test.read", json.RawMessage(`{"id":"c1","name":"x"}`))
	if !errors.Is(err, Blocked) || errs.Resolve(err).Why != "PSet can't read PDFs on this computer." {
		t.Fatalf("a blocked action: %v (%+v)", err, errs.Resolve(err))
	}
	if courseName(t, s) != "ECE 210" {
		t.Fatal("a blocked action ran")
	}
	// One action is one write.
	if _, err := c.Run(bg, "test.twice", json.RawMessage(`{"id":"c1","name":"x"}`)); !errors.Is(err, wroteTwice) {
		t.Fatalf("an action writing twice: %v", err)
	}
}

func TestAddRefusesBadDeclarations(t *testing.T) {
	c := New(nil)
	for name, d := range map[string]Def[named]{
		"bad id":              {ID: "Rename", Name: "x", Run: func(context.Context, *Do, named) error { return nil }},
		"no name":             {ID: "test.x", Run: func(context.Context, *Do, named) error { return nil }},
		"undoable, no Undone": {ID: "test.y", Name: "y", Undoable: true, Redone: "z", Run: func(context.Context, *Do, named) error { return nil }},
		"undoable, no Redone": {ID: "test.z", Name: "z", Undoable: true, Undone: "z", Run: func(context.Context, *Do, named) error { return nil }},
	} {
		func() {
			defer func() {
				if recover() == nil {
					t.Errorf("%s: declared", name)
				}
			}()
			Add(c, d)
		}()
	}
}

// The routes: an action with no body is one that takes nothing; anything
// after the input is refused; Undo by route says what it took back.
func TestTheRoutes(t *testing.T) {
	c, s := catalog(t)
	Add(c, Def[struct{}]{ID: "test.touch", Name: "Touch", Run: func(ctx context.Context, do *Do, _ struct{}) error {
		return do.Write(ctx, change.ResourceCourse, "c1", func(*sql.Tx) error { return nil })
	}})
	mux := http.NewServeMux()
	c.Routes(mux)
	srv := httptest.NewServer(mux)
	defer srv.Close()
	post := func(path, body string, out any) int {
		t.Helper()
		resp, err := http.Post(srv.URL+path, "application/json", strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		defer cleanup.Close(resp.Body)
		if out != nil {
			testx.Check(t, json.NewDecoder(resp.Body).Decode(out))
		}
		return resp.StatusCode
	}
	if code := post("/api/actions/test.touch", "", nil); code != http.StatusOK {
		t.Fatalf("an action that takes nothing, with no body: %d", code)
	}
	if code := post("/api/actions/test.rename", `{"id":"c1","name":"x"} {"id":"c1","name":"y"}`, nil); code != http.StatusBadRequest {
		t.Fatalf("two inputs in one body: %d", code)
	}
	var done Done
	if code := post("/api/actions/test.rename", `{"id":"c1","name":"ECE 211"}`, &done); code != http.StatusOK || done.Action == "" {
		t.Fatalf("a rename: %d %+v", code, done)
	}
	var u Undone
	if code := post("/api/undo", `{"newest":true}`, &u); code != http.StatusOK || u.Said != "Renamed back to ECE 210." || courseName(t, s) != "ECE 210" {
		t.Fatalf("Ctrl+Z by route: %d %+v", code, u)
	}
	resp, err := http.Get(srv.URL + "/api/actions")
	if err != nil {
		t.Fatal(err)
	}
	var list List
	testx.Check(t, json.NewDecoder(resp.Body).Decode(&list))
	cleanup.Close(resp.Body)
	if len(list.Actions) != 5 || list.Actions[0].ID != "test.keep" || list.Actions[0].Needs == nil {
		t.Fatalf("the list %+v", list)
	}
}
