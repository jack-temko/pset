package memory

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/httpx"
)

type recorder struct {
	mu     sync.Mutex
	events []string
}

func (r *recorder) Publish(typ string, _ any) {
	r.mu.Lock()
	r.events = append(r.events, typ)
	r.mu.Unlock()
}

func newService(t *testing.T) (*Service, *recorder) {
	t.Helper()
	d, err := db.Open(filepath.Join(t.TempDir(), "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	migs := append([]db.Migration{{Name: "t/books", SQL: `CREATE TABLE books (id TEXT PRIMARY KEY)`}}, Migrations()...)
	if err := db.Migrate(context.Background(), d, migs); err != nil {
		t.Fatal(err)
	}
	d.Exec(`INSERT INTO books VALUES ('b1'), ('b2')`)
	ev := &recorder{}
	return New(d, ev), ev
}

func TestSaveKeepsOneOfEach(t *testing.T) {
	ctx := context.Background()
	s, _ := newService(t)
	first, out, err := s.Save(ctx, "b1", Save{Text: "Use V_0, V_1 for nodal voltages.", Source: SourceYou})
	if err != nil || out != OutcomeSaved {
		t.Fatal(out, err)
	}
	// Case, spacing and punctuation aside, it's the same sentence.
	again, out, err := s.Save(ctx, "b1", Save{Text: "  use v_0 v_1 for NODAL   voltages", Source: SourceYou})
	if err != nil || out != OutcomeDuplicate || again.ID != first.ID {
		t.Fatalf("duplicate: %v %v %v", out, again.ID, err)
	}
	// Another book is another memory.
	if _, out, _ := s.Save(ctx, "b2", Save{Text: "Use V_0, V_1 for nodal voltages.", Source: SourceYou}); out != OutcomeSaved {
		t.Fatalf("other book: %v", out)
	}
	if ms, _ := s.List(ctx, "b1"); len(ms) != 1 {
		t.Fatalf("list %+v", ms)
	}
}

func TestSaveRefuses(t *testing.T) {
	ctx := context.Background()
	s, _ := newService(t)
	mine, _, _ := s.Save(ctx, "b1", Save{Text: "Use SI units.", Source: SourceYou})
	for name, in := range map[string]Save{
		"empty":    {Text: "   ", Source: SourceYou},
		"too long": {Text: strings.Repeat("a", MaxText+1), Source: SourceYou},
	} {
		var e *httpx.Error
		if _, _, err := s.Save(ctx, "b1", in); !errors.As(err, &e) || e.Code != httpx.CodeInvalid {
			t.Errorf("%s: %v", name, err)
		}
	}
	// The tutor never overwrites the student's own.
	if _, _, err := s.Save(ctx, "b1", Save{Text: "Use imperial.", Source: SourceTutor, Replaces: ShortID(mine.ID)}); !errors.Is(err, ErrStudentsOwn) {
		t.Errorf("replace yours: %v", err)
	}
	if _, _, err := s.Save(ctx, "b1", Save{Text: "x", Source: SourceTutor, Replaces: "zzzzzz"}); !errors.Is(err, ErrNoSuchMemory) {
		t.Errorf("replace nothing: %v", err)
	}
	// A LIKE wildcard is not a way to match everything.
	if _, err := s.Forget(ctx, "b1", "%"); !errors.Is(err, ErrNoSuchMemory) {
		t.Errorf("forget %%: %v", err)
	}
	// Nor is another book's id.
	if _, err := s.Forget(ctx, "b2", ShortID(mine.ID)); !errors.Is(err, ErrNoSuchMemory) {
		t.Errorf("forget across books: %v", err)
	}
	if _, _, err := s.Save(ctx, "nope", Save{Text: "x", Source: SourceTutor}); err == nil {
		t.Error("saved to a book that doesn't exist")
	}
}

func TestReplaceRewritesInPlace(t *testing.T) {
	ctx := context.Background()
	s, _ := newService(t)
	old, _, _ := s.Save(ctx, "b1", Save{Text: "Answer in feet.", Source: SourceTutor})
	m, out, err := s.Save(ctx, "b1", Save{Text: "Answer in metres.", Source: SourceYou, Replaces: "[" + ShortID(old.ID) + "]"})
	if err != nil || out != OutcomeReplaced || m.ID != old.ID || m.Text != "Answer in metres." || m.Source != SourceYou {
		t.Fatalf("%v %v %+v", out, err, m)
	}
	if ms, _ := s.List(ctx, "b1"); len(ms) != 1 {
		t.Fatalf("replace added one: %d", len(ms))
	}
}

func TestPromptKeepsYoursPastTheCap(t *testing.T) {
	var all []Memory
	for i := range promptMax + 10 {
		all = append(all, Memory{ID: string(rune('a' + i%26)), Text: "tutor note", Source: SourceTutor})
	}
	all = append(all, Memory{Text: "mine, the oldest", Source: SourceYou})
	got := pick(all)
	if len(got) != promptMax || got[0].Source != SourceYou {
		t.Fatalf("got %d, first %+v", len(got), got[0])
	}
	// The character cap binds as well as the count.
	long := []Memory{{Text: strings.Repeat("x", promptMaxChars-10), Source: SourceTutor}, {Text: strings.Repeat("y", 20), Source: SourceTutor}}
	if got := pick(long); len(got) != 1 {
		t.Fatalf("char cap: %d", len(got))
	}
}

// Upgrading a library keeps its preferences and nothing else, whoever
// saved them.
func TestMigrationKeepsOnlyPreferences(t *testing.T) {
	ctx := context.Background()
	d, err := db.Open(filepath.Join(t.TempDir(), "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	books := db.Migration{Name: "t/books", SQL: `CREATE TABLE books (id TEXT PRIMARY KEY)`}
	if err := db.Migrate(ctx, d, []db.Migration{books, Migrations()[0]}); err != nil {
		t.Fatal(err)
	}
	d.Exec(`INSERT INTO books VALUES ('b1')`)
	for _, r := range []struct{ id, kind, source, key string }{
		{"book-note", "book", "tutor", ""},
		{"range", "book", "pset", "problems/3"},
		{"yours", "preference", "you", ""},
		{"tutors", "preference", "tutor", ""},
	} {
		if _, err := d.Exec(`INSERT INTO memories (id, book_id, kind, text, norm, page, source, key, created_at, updated_at)
			VALUES (?, 'b1', ?, ?, ?, 4, ?, ?, 't', 't')`, r.id, r.kind, r.id, r.id, r.source, r.key); err != nil {
			t.Fatal(err)
		}
	}
	if err := db.Migrate(ctx, d, []db.Migration{books, Migrations()[0], Migrations()[1]}); err != nil {
		t.Fatal(err)
	}
	ms, err := New(d, &recorder{}).List(ctx, "b1")
	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, m := range ms {
		ids = append(ids, m.ID)
	}
	slices.Sort(ids)
	if !slices.Equal(ids, []string{"tutors", "yours"}) {
		t.Fatalf("kept %v", ids)
	}
	// A new one saves on the slimmer table.
	if _, out, err := New(d, &recorder{}).Save(ctx, "b1", Save{Text: "Octave.", Source: SourceYou}); err != nil || out != OutcomeSaved {
		t.Fatal(out, err)
	}
}

func TestHTTP(t *testing.T) {
	s, _ := newService(t)
	mux := http.NewServeMux()
	s.Routes(mux)
	srv := httptest.NewServer(mux)
	defer srv.Close()
	do := func(method, path, body string) (*http.Response, []byte) {
		req, _ := http.NewRequest(method, srv.URL+path, bytes.NewBufferString(body))
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		var buf bytes.Buffer
		buf.ReadFrom(resp.Body)
		return resp, buf.Bytes()
	}

	resp, body := do("POST", "/api/books/b1/memories", `{"text":"Use SI units."}`)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("%d %s", resp.StatusCode, body)
	}
	var m Memory
	json.Unmarshal(body, &m)
	if m.Source != SourceYou || m.BookID != "b1" {
		t.Fatalf("%+v", m)
	}
	resp, body = do("POST", "/api/books/b1/memories", `{"text":"  "}`)
	var e httpx.Error
	json.Unmarshal(body, &e)
	if resp.StatusCode != http.StatusUnprocessableEntity || e.Field != "text" {
		t.Fatalf("%d %s", resp.StatusCode, body)
	}
	if resp, _ := do("POST", "/api/books/nope/memories", `{"text":"x"}`); resp.StatusCode != http.StatusNotFound {
		t.Fatalf("unknown book: %d", resp.StatusCode)
	}
	_, body = do("GET", "/api/books/b1/memories", "")
	var list Memories
	json.Unmarshal(body, &list)
	if len(list.Memories) != 1 {
		t.Fatalf("%s", body)
	}
	if resp, _ := do("DELETE", "/api/memories/"+m.ID, ""); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("delete %d", resp.StatusCode)
	}
	if resp, _ := do("DELETE", "/api/memories/"+m.ID, ""); resp.StatusCode != http.StatusNotFound {
		t.Fatalf("delete twice %d", resp.StatusCode)
	}
	_, body = do("GET", "/api/books/b2/memories", "")
	if !strings.Contains(string(body), `"memories":[]`) {
		t.Fatalf("empty list isn't []: %s", body)
	}
}
