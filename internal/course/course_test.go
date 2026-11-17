package course

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/action"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/store"
	"github.com/jackt/pset/internal/testx"
)

var bg = context.Background()

func setup(t *testing.T) (*Service, *action.Catalog) {
	t.Helper()
	s, err := store.Open(bg, filepath.Join(t.TempDir(), "store.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cleanup.Close(s.DB) })
	c := action.New(s)
	return New(s, c), c
}

func do(t *testing.T, c *action.Catalog, id string, in any) (action.Done, error) {
	t.Helper()
	b, err := json.Marshal(in)
	if err != nil {
		t.Fatal(err)
	}
	return c.Run(bg, id, b)
}

func TestAddRenameRemove(t *testing.T) {
	svc, c := setup(t)
	added, err := do(t, c, "course.add", Add{Name: "  ECE   210 "})
	if err != nil {
		t.Fatal(err)
	}
	got, err := svc.Get(bg, added.ID)
	if err != nil || got.Name != "ECE 210" {
		t.Fatalf("added %+v (%v), want its name tidied to ECE 210", got, err)
	}
	// Renamed to the name it has: nothing to undo.
	if d, err := do(t, c, "course.rename", Rename{ID: added.ID, Name: "ECE 210"}); err != nil || d.Action != "" {
		t.Fatalf("a rename to its own name: %+v, %v", d, err)
	}
	if _, err := do(t, c, "course.remove", Remove{ID: added.ID}); err != nil {
		t.Fatal(err)
	}
	list, err := svc.List(bg)
	if err != nil || len(list.Courses) != 0 {
		t.Fatalf("after removing it, the list is %+v (%v)", list, err)
	}
	if _, err := svc.Get(bg, added.ID); !errors.Is(err, errs.Gone) {
		t.Fatalf("a removed course: %v", err)
	}
	if _, err := do(t, c, "course.rename", Rename{ID: added.ID, Name: "x"}); !errors.Is(err, errs.Gone) {
		t.Fatalf("renaming a removed course: %v", err)
	}
}

func TestANameIsChecked(t *testing.T) {
	_, c := setup(t)
	for _, n := range []string{"", "   ", strings.Repeat("x", maxName+1)} {
		_, err := do(t, c, "course.add", Add{Name: n})
		v := errs.Resolve(err)
		if err == nil || v.Field != "name" {
			t.Errorf("%q: %v, want an error under the name field", n, err)
		}
	}
	if _, err := do(t, c, "course.add", Add{Name: strings.Repeat("é", maxName)}); err != nil {
		t.Errorf("a name of %d characters, longer in bytes: %v", maxName, err)
	}
}

func TestTheReadRoutes(t *testing.T) {
	svc, c := setup(t)
	for _, n := range []string{"ECE 210", "PHYS 211"} {
		if _, err := do(t, c, "course.add", Add{Name: n}); err != nil {
			t.Fatal(err)
		}
	}
	mux := http.NewServeMux()
	svc.Routes(mux)
	srv := httptest.NewServer(mux)
	defer srv.Close()
	resp, err := http.Get(srv.URL + "/api/courses")
	if err != nil {
		t.Fatal(err)
	}
	var list Courses
	testx.Check(t, json.NewDecoder(resp.Body).Decode(&list))
	cleanup.Close(resp.Body)
	if len(list.Courses) != 2 || list.Courses[0].Name != "ECE 210" || list.Courses[1].Name != "PHYS 211" || list.Courses[0].Seq == 0 {
		t.Fatalf("the list %+v, want both in the order added, with their seq", list)
	}
	resp, err = http.Get(srv.URL + "/api/courses/nope")
	if err != nil {
		t.Fatal(err)
	}
	cleanup.Close(resp.Body)
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("a course that isn't there: %d", resp.StatusCode)
	}
}
