package memory

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"github.com/jackt/pset/internal/pagenum"
	"net/http"
	"net/http/httptest"
	"path/filepath"
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

func page(n int) *int { return &n }

func TestSaveKeepsOneOfEach(t *testing.T) {
	ctx := context.Background()
	s, _ := newService(t)
	first, out, err := s.Save(ctx, "b1", Save{Kind: KindBook, Text: "Theorem 1.5 is Cauchy-Schwarz.", Page: page(24), Source: SourceTutor})
	if err != nil || out != OutcomeSaved {
		t.Fatal(out, err)
	}
	// Case, spacing and punctuation aside, it's the same sentence.
	again, out, err := s.Save(ctx, "b1", Save{Kind: KindBook, Text: "  theorem 1.5 is   Cauchy Schwarz", Source: SourceTutor})
	if err != nil || out != OutcomeDuplicate || again.ID != first.ID {
		t.Fatalf("duplicate: %v %v %v", out, again.ID, err)
	}
	// Another book is another memory.
	if _, out, _ := s.Save(ctx, "b2", Save{Kind: KindBook, Text: "Theorem 1.5 is Cauchy-Schwarz.", Source: SourceTutor}); out != OutcomeSaved {
		t.Fatalf("other book: %v", out)
	}
	if ms, _ := s.List(ctx, "b1"); len(ms) != 1 || *ms[0].Page != 24 {
		t.Fatalf("list %+v", ms)
	}
}

func TestSaveRefuses(t *testing.T) {
	ctx := context.Background()
	s, _ := newService(t)
	mine, _, _ := s.Save(ctx, "b1", Save{Kind: KindPreference, Text: "Use SI units.", Source: SourceYou})
	for name, in := range map[string]Save{
		"no kind":            {Text: "x", Source: SourceTutor},
		"empty":              {Kind: KindBook, Text: "   ", Source: SourceTutor},
		"too long":           {Kind: KindBook, Text: strings.Repeat("a", MaxText+1), Source: SourceTutor},
		"page on preference": {Kind: KindPreference, Text: "Octave", Page: page(3), Source: SourceTutor},
		"page zero":          {Kind: KindBook, Text: "x", Page: page(0), Source: SourceTutor},
	} {
		var e *httpx.Error
		if _, _, err := s.Save(ctx, "b1", in); !errors.As(err, &e) || e.Code != httpx.CodeInvalid {
			t.Errorf("%s: %v", name, err)
		}
	}
	// The tutor never overwrites the student's own.
	if _, _, err := s.Save(ctx, "b1", Save{Kind: KindPreference, Text: "Use imperial.", Source: SourceTutor, Replaces: ShortID(mine.ID)}); !errors.Is(err, ErrStudentsOwn) {
		t.Errorf("replace yours: %v", err)
	}
	if _, _, err := s.Save(ctx, "b1", Save{Kind: KindBook, Text: "x", Source: SourceTutor, Replaces: "zzzzzz"}); !errors.Is(err, ErrNoSuchMemory) {
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
	if _, _, err := s.Save(ctx, "nope", Save{Kind: KindBook, Text: "x", Source: SourceTutor}); err == nil {
		t.Error("saved to a book that doesn't exist")
	}
}

func TestReplaceRewritesInPlace(t *testing.T) {
	ctx := context.Background()
	s, _ := newService(t)
	old, _, _ := s.Save(ctx, "b1", Save{Kind: KindBook, Text: "Theorem 2.1 is on p. 40.", Source: SourceTutor})
	m, out, err := s.Save(ctx, "b1", Save{Kind: KindBook, Text: "Theorem 2.1 (spectral theorem)", Page: page(42), Source: SourceTutor, Replaces: "[" + ShortID(old.ID) + "]"})
	if err != nil || out != OutcomeReplaced || m.ID != old.ID || m.Text != "Theorem 2.1 (spectral theorem)" {
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

func TestSawProblemKeepsOneRangePerChapter(t *testing.T) {
	ctx := context.Background()
	s, ev := newService(t)
	// Offset 10: PDF 160 is printed 150.
	if err := s.SawProblem(ctx, "b1", pagenum.Single(10), 3, "3.10", 160); err != nil {
		t.Fatal(err)
	}
	s.SawProblem(ctx, "b1", pagenum.Single(10), 3, "3.30", 164)
	s.SawProblem(ctx, "b1", pagenum.Single(10), 4, "4.2", 200)
	ms, _ := s.List(ctx, "b1")
	if len(ms) != 2 {
		t.Fatalf("%d memories", len(ms))
	}
	var ch3 Memory
	for _, m := range ms {
		if strings.HasPrefix(m.Text, "Chapter 3") {
			ch3 = m
		}
	}
	if ch3.Text != "Chapter 3 has problems on p. 150–154." || ch3.Source != SourcePSet || *ch3.Page != 160 {
		t.Fatalf("%+v", ch3)
	}
	// Seeing the same problem on the same page again changes nothing.
	n := len(ev.events)
	s.SawProblem(ctx, "b1", pagenum.Single(10), 3, "3.30", 164)
	if len(ev.events) != n {
		t.Error("a repeat published")
	}
	p, _ := s.ProblemsSeen(ctx, "b1", 3)
	if p.MemoryID != ch3.ID || len(p.Seen) != 2 {
		t.Fatalf("%+v", p)
	}
	// Delete the memory and the points go with it.
	s.Remove(ctx, ch3.ID)
	if p, _ := s.ProblemsSeen(ctx, "b1", 3); len(p.Seen) != 0 {
		t.Fatal("points outlived their memory")
	}
	// The tutor saying the same sentence doesn't collide with PSet's.
	s.SawProblem(ctx, "b1", pagenum.Single(10), 4, "4.9", 202)
	if _, out, _ := s.Save(ctx, "b1", Save{Kind: KindBook, Text: "Chapter 4 has problems on p. 190–192.", Source: SourceTutor}); out != OutcomeSaved {
		t.Errorf("tutor's twin: %v", out)
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

	resp, body := do("POST", "/api/books/b1/memories", `{"kind":"book","text":"Problems come right before each new section.","page":12}`)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("%d %s", resp.StatusCode, body)
	}
	var m Memory
	json.Unmarshal(body, &m)
	if m.Source != SourceYou || m.BookID != "b1" {
		t.Fatalf("%+v", m)
	}
	resp, body = do("POST", "/api/books/b1/memories", `{"kind":"preference","text":"x","page":1}`)
	var e httpx.Error
	json.Unmarshal(body, &e)
	if resp.StatusCode != http.StatusUnprocessableEntity || e.Field != "page" {
		t.Fatalf("%d %s", resp.StatusCode, body)
	}
	if resp, _ := do("POST", "/api/books/nope/memories", `{"kind":"book","text":"x"}`); resp.StatusCode != http.StatusNotFound {
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
