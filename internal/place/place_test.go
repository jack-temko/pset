package place

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/action"
	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/course"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/store"
	"github.com/jackt/pset/internal/testx"
)

var bg = context.Background()

// setup is a store with a course c1, its set s1 and question q1, and two
// materials, m1 and m2.
func setup(t *testing.T) (*Service, *store.Store) {
	t.Helper()
	s, err := store.Open(bg, filepath.Join(t.TempDir(), "store.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cleanup.Close(s.DB) })
	now := db.Now()
	if err := s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		for _, q := range []string{
			`INSERT INTO courses (id, name, created_at) VALUES ('c1', 'ECE 210', '` + now + `')`,
			`INSERT INTO sets (id, course_id, title, created_at) VALUES ('s1', 'c1', 'Problem set 4', '` + now + `')`,
			`INSERT INTO questions (id, set_id, position, text, created_at) VALUES ('q1', 's1', 0, '1.3', '` + now + `')`,
			`INSERT INTO materials (id, course_id, title, added_at) VALUES ('m1', 'c1', 'Oppenheim', '` + now + `')`,
			`INSERT INTO materials (id, course_id, title, added_at) VALUES ('m2', 'c1', 'Notes', '` + now + `')`,
		} {
			if _, err := tx.Exec(q); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	return New(s), s
}

func places(t *testing.T, svc *Service, kind change.Resource, id string) []Place {
	t.Helper()
	got, err := svc.Of(bg, []Owner{{kind, id}})
	if err != nil {
		t.Fatal(err)
	}
	return got.Places
}

// A tab's spot in a material is also the material's last spot, which a new
// tab starts from; two tabs keep their own.
func TestATabsSpotIsAlsoTheMaterialsLast(t *testing.T) {
	svc, _ := setup(t)
	for _, p := range []Place{
		{OwnerKind: change.ResourceMaterial, OwnerID: "m1", Kind: KindPage, TabID: "t1", Page: 40, Down: 0.5},
		{OwnerKind: change.ResourceMaterial, OwnerID: "m1", Kind: KindPage, TabID: "t2", Page: 7},
	} {
		got, err := svc.Set(bg, p)
		if err != nil {
			t.Fatal(err)
		}
		if got.ID == "" || got.Seq == 0 || got.Group != GroupWhere || got.Page != p.Page {
			t.Fatalf("set %+v", got)
		}
	}
	byTab := map[string]int{}
	for _, p := range places(t, svc, change.ResourceMaterial, "m1") {
		byTab[p.TabID] = p.Page
	}
	if byTab["t1"] != 40 || byTab["t2"] != 7 || byTab[""] != 7 {
		t.Fatalf("pages by tab %v: want each tab its own, and the last one as the material's", byTab)
	}
}

// sides is a course's layout of the given material tabs (id: material).
func sides(course string, tabs map[string]string) Place {
	var ts []Tab
	open := ""
	for _, id := range []string{"t1", "t2", "t3"} {
		if m, ok := tabs[id]; ok {
			ts = append(ts, Tab{ID: id, Kind: TabKindMaterial, ThingID: m})
			open = id
		}
	}
	return Place{OwnerKind: change.ResourceCourse, OwnerID: course, Kind: KindSides, Split: 0.5, Sides: []Side{{Tabs: ts, Open: open}}}
}

// Closing a tab (sides without it) drops its spot and zoom; the material's
// last spot stays, and another course's tabs are not touched.
func TestClosingATabDropsItsSpot(t *testing.T) {
	svc, s := setup(t)
	if err := s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		if _, err := tx.Exec(`INSERT INTO courses (id, name, created_at) VALUES ('c2', 'PHYS 211', ?)`, db.Now()); err != nil {
			return err
		}
		_, err := tx.Exec(`INSERT INTO materials (id, course_id, title, added_at) VALUES ('m3', 'c2', 'Griffiths', ?)`, db.Now())
		return err
	}); err != nil {
		t.Fatal(err)
	}
	for _, p := range []Place{
		sides("c1", map[string]string{"t1": "m1", "t2": "m2"}),
		sides("c2", map[string]string{"t3": "m3"}),
		{OwnerKind: change.ResourceMaterial, OwnerID: "m1", Kind: KindPage, TabID: "t1", Page: 40},
		{OwnerKind: change.ResourceMaterial, OwnerID: "m1", Kind: KindZoom, TabID: "t1", Zoom: 1.5},
		{OwnerKind: change.ResourceMaterial, OwnerID: "m2", Kind: KindPage, TabID: "t2", Page: 3},
		{OwnerKind: change.ResourceMaterial, OwnerID: "m3", Kind: KindPage, TabID: "t3", Page: 9},
		sides("c1", map[string]string{"t2": "m2"}),
	} {
		if _, err := svc.Set(bg, p); err != nil {
			t.Fatal(err)
		}
	}
	for _, p := range places(t, svc, change.ResourceMaterial, "m1") {
		if p.TabID == "t1" {
			t.Fatalf("the closed tab's %s is kept", p.Kind)
		}
	}
	if len(places(t, svc, change.ResourceMaterial, "m1")) != 2 {
		t.Fatal("the material's last spot and zoom went with the tab")
	}
	if got := places(t, svc, change.ResourceMaterial, "m2"); len(got) != 2 {
		t.Fatalf("the open tab's spot: %+v", got)
	}
	if got := places(t, svc, change.ResourceMaterial, "m3"); len(got) != 2 {
		t.Fatalf("another course's tab: %+v", got)
	}
	// Closing every tab.
	if _, err := svc.Set(bg, sides("c1", map[string]string{})); err != nil {
		t.Fatal(err)
	}
	for _, p := range places(t, svc, change.ResourceMaterial, "m2") {
		if p.TabID == "t2" {
			t.Fatal("a tab closed with every other kept its spot")
		}
	}
	// A spot written after its tab closed keeps only the material's last.
	got, err := svc.Set(bg, Place{OwnerKind: change.ResourceMaterial, OwnerID: "m2", Kind: KindPage, TabID: "t2", Page: 11})
	if err != nil {
		t.Fatal(err)
	}
	if got.TabID != "" || got.Page != 11 {
		t.Fatalf("a late write kept %+v", got)
	}
	for _, p := range places(t, svc, change.ResourceMaterial, "m2") {
		if p.TabID == "t2" {
			t.Fatal("a late write brought a closed tab's spot back")
		}
	}
}

// Typing a draft away clears it: no error, and nothing kept.
func TestAnEmptyDraftIsCleared(t *testing.T) {
	svc, _ := setup(t)
	d := Place{OwnerKind: change.ResourceCourse, OwnerID: "c1", Kind: KindAskDraft, Text: "What"}
	if _, err := svc.Set(bg, d); err != nil {
		t.Fatal(err)
	}
	d.Text = ""
	got, err := svc.Set(bg, d)
	if err != nil {
		t.Fatalf("typing a draft away: %v", err)
	}
	if got.ID != "" || len(places(t, svc, change.ResourceCourse, "c1")) != 0 {
		t.Fatalf("an empty draft kept %+v", got)
	}
	// Never typed at all: nothing to clear, still no error.
	if _, err := svc.Set(bg, Place{OwnerKind: change.ResourceQuestion, OwnerID: "q1", Kind: KindNoteDraft}); err != nil {
		t.Fatal(err)
	}
}

// A guide's line is kept on its document.
func TestALineOnAGuide(t *testing.T) {
	svc, s := setup(t)
	if err := s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		_, err := tx.Exec(`INSERT INTO documents (id, owner_kind, owner_id, blocks, state) VALUES ('d1', 'question', 'q1', '[]', 'done')`)
		return err
	}); err != nil {
		t.Fatal(err)
	}
	block := 4
	got, err := svc.Set(bg, Place{OwnerKind: change.ResourceDocument, OwnerID: "d1", Kind: KindLine, Block: &block})
	if err != nil || got.Block == nil || *got.Block != 4 {
		t.Fatalf("a guide's line: %+v (%v)", got, err)
	}
}

// Clear empties only a draft: a page bug can't wipe a layout.
func TestClearIsForDrafts(t *testing.T) {
	svc, _ := setup(t)
	lay, err := svc.Set(bg, sides("c1", map[string]string{"t1": "m1"}))
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.Clear(bg, lay.ID); err != nil {
		t.Fatal(err)
	}
	if err := svc.Clear(bg, "nope"); err != nil {
		t.Fatal(err)
	}
	if len(places(t, svc, change.ResourceCourse, "c1")) != 1 {
		t.Fatal("Clear emptied a layout")
	}
}

// What can't be a place is refused, saying why.
func TestWhatIsntAPlaceIsRefused(t *testing.T) {
	svc, _ := setup(t)
	block := -1
	for name, p := range map[string]Place{
		"unknown kind":     {OwnerKind: change.ResourceSet, OwnerID: "s1", Kind: "filter"},
		"wrong owner":      {OwnerKind: change.ResourceCourse, OwnerID: "c1", Kind: KindProblem, QuestionID: "q1"},
		"tab on a problem": {OwnerKind: change.ResourceSet, OwnerID: "s1", Kind: KindProblem, QuestionID: "q1", TabID: "t1"},
		"page 0":           {OwnerKind: change.ResourceMaterial, OwnerID: "m1", Kind: KindPage, Page: 0},
		"down past 1":      {OwnerKind: change.ResourceMaterial, OwnerID: "m1", Kind: KindPage, Page: 2, Down: 1.5},
		"negative block":   {OwnerKind: change.ResourceDocument, OwnerID: "d1", Kind: KindLine, Block: &block},
		"zoom 0":           {OwnerKind: change.ResourceMaterial, OwnerID: "m1", Kind: KindZoom},
		"three sides":      {OwnerKind: change.ResourceCourse, OwnerID: "c1", Kind: KindSides, Sides: []Side{{}, {}, {}}},
		"open not a tab": {OwnerKind: change.ResourceCourse, OwnerID: "c1", Kind: KindSides, Sides: []Side{
			{Tabs: []Tab{{ID: "t1", Kind: TabKindAsk}}, Open: "t9"}}},
		"a draft too long":  {OwnerKind: change.ResourceCourse, OwnerID: "c1", Kind: KindAskDraft, Text: strings.Repeat("x", maxText+1)},
		"about too long":    {OwnerKind: change.ResourceCourse, OwnerID: "c1", Kind: KindAskDraft, AboutID: strings.Repeat("q", maxID+1)},
		"a bad due date":    {OwnerKind: change.ResourceCourse, OwnerID: "c1", Kind: KindNewSet, Due: "Friday"},
		"page past the end": {OwnerKind: change.ResourceMaterial, OwnerID: "m1", Kind: KindPage, Page: maxPage + 1},
		"too many tabs":     {OwnerKind: change.ResourceCourse, OwnerID: "c1", Kind: KindSides, Sides: []Side{manyTabs(maxTabs + 1)}},
	} {
		if _, err := svc.Set(bg, p); !errors.Is(err, bad) {
			t.Errorf("%s: %v", name, err)
		}
	}
}

// A place of something removed, or never there, is refused as gone.
func TestAPlaceOfSomethingGone(t *testing.T) {
	svc, s := setup(t)
	if err := s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		_, err := tx.Exec(`UPDATE sets SET removed_at = ? WHERE id = 's1'`, db.Now())
		return err
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Set(bg, Place{OwnerKind: change.ResourceSet, OwnerID: "s1", Kind: KindProblem, QuestionID: "q1"}); !errors.Is(err, errs.Gone) {
		t.Fatalf("a removed set: %v", err)
	}
}

// A draft is kept until it is sent, then cleared; writing what is already
// kept logs nothing.
func TestADraftIsKeptThenCleared(t *testing.T) {
	svc, s := setup(t)
	d := Place{OwnerKind: change.ResourceCourse, OwnerID: "c1", Kind: KindAskDraft, Text: "What is a pole?", AboutID: "q1"}
	got, err := svc.Set(bg, d)
	if err != nil {
		t.Fatal(err)
	}
	before, err := s.Latest(bg)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Set(bg, d); err != nil {
		t.Fatal(err)
	}
	if after, _ := s.Latest(bg); after != before {
		t.Fatal("writing the same draft again logged a change")
	}
	if err := svc.Clear(bg, got.ID); err != nil {
		t.Fatal(err)
	}
	if left := places(t, svc, change.ResourceCourse, "c1"); len(left) != 0 {
		t.Fatalf("a sent draft is kept: %+v", left)
	}
}

// Ctrl+Z never moves the student back: a place is no action.
func TestCtrlZPassesOverPlaces(t *testing.T) {
	svc, s := setup(t)
	c := action.New(s)
	course.New(s, c)
	in, err := json.Marshal(course.Rename{ID: "c1", Name: "ECE 211"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := c.Run(bg, "course.rename", in); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Set(bg, Place{OwnerKind: change.ResourceSet, OwnerID: "s1", Kind: KindProblem, QuestionID: "q1"}); err != nil {
		t.Fatal(err)
	}
	u, err := c.Undo(bg, "", true)
	if err != nil {
		t.Fatal(err)
	}
	if u.Entry != "course.rename" || len(places(t, svc, change.ResourceSet, "s1")) != 1 {
		t.Fatalf("Ctrl+Z took back %+v", u)
	}
}

// The routes: a tab reads the places of what it shows once, by owner.
func TestTheRoutes(t *testing.T) {
	svc, _ := setup(t)
	mux := http.NewServeMux()
	svc.Routes(mux)
	srv := httptest.NewServer(mux)
	defer srv.Close()
	req, err := http.NewRequest(http.MethodPut, srv.URL+"/api/places",
		strings.NewReader(`{"ownerKind":"set","ownerId":"s1","kind":"problem","questionId":"q1"}`))
	if err != nil {
		t.Fatal(err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	cleanup.Close(resp.Body)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("put %d", resp.StatusCode)
	}
	resp, err = http.Get(srv.URL + "/api/places?owner=set:s1&owner=material:m1")
	if err != nil {
		t.Fatal(err)
	}
	var got Places
	testx.Check(t, json.NewDecoder(resp.Body).Decode(&got))
	cleanup.Close(resp.Body)
	if len(got.Places) != 1 || got.Places[0].QuestionID != "q1" || got.Places[0].Group != GroupWhere {
		t.Fatalf("places %+v", got)
	}
	resp, err = http.Get(srv.URL + "/api/places?owner=s1")
	if err != nil {
		t.Fatal(err)
	}
	cleanup.Close(resp.Body)
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("an owner without its kind: %d", resp.StatusCode)
	}
}

func manyTabs(n int) Side {
	var ts []Tab
	for i := range n {
		ts = append(ts, Tab{ID: fmt.Sprint("t", i), Kind: TabKindAsk})
	}
	return Side{Tabs: ts, Open: "t0"}
}

// A layout with an empty side keeps its tabs as a list, never null.
func TestAnEmptySideIsAList(t *testing.T) {
	svc, _ := setup(t)
	got, err := svc.Set(bg, Place{OwnerKind: change.ResourceCourse, OwnerID: "c1", Kind: KindSides, Sides: []Side{{}}})
	if err != nil {
		t.Fatal(err)
	}
	if got.Sides[0].Tabs == nil {
		t.Fatal("an empty side's tabs are null")
	}
}
