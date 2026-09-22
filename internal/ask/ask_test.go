package ask

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackt/pset/internal/cards"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/llm/llmtest"
)

// library: a book whose printed page 1 is PDF page 3.
type library struct{}

var pages = []string{"Cover", "Contents", "Eigenvalues. An eigenvalue of T is a scalar λ with Tv = λv.", "Minimal polynomials."}

func (library) Book(_ context.Context, id string) (Book, error) {
	if id != "b1" {
		return Book{}, httpx.NotFound("book")
	}
	return Book{ID: "b1", Title: "Linear Algebra", PageCount: len(pages), PageOffset: 2}, nil
}
func (library) Search(context.Context, string, string, int) ([]int, error)  { return []int{3}, nil }
func (library) PageText(_ context.Context, _ string, n int) (string, error) { return pages[n-1], nil }
func (library) PageJPEG(context.Context, string, int, int) ([]byte, error) {
	return []byte{0xff, 0xd8}, nil
}

type settings struct{ cfg llm.Config }

func (s *settings) LLM(context.Context) (llm.Config, error) { return s.cfg, nil }
func (*settings) Name(context.Context) string               { return "Jack" }

type recorder struct {
	mu     sync.Mutex
	events []string
}

func (r *recorder) Publish(typ string, data any) {
	b, _ := json.Marshal(data)
	r.mu.Lock()
	r.events = append(r.events, typ+" "+string(b))
	r.mu.Unlock()
}

func (r *recorder) count(prefix string) int {
	r.mu.Lock()
	defer r.mu.Unlock()
	n := 0
	for _, e := range r.events {
		if strings.HasPrefix(e, prefix+" ") {
			n++
		}
	}
	return n
}

type env struct {
	*httptest.Server
	llm    *llmtest.Server
	events *recorder
	cfg    *settings
}

func call(id, name, args string) llm.ToolCall {
	return llm.ToolCall{ID: id, Type: "function", Function: llm.ToolCallFunc{Name: name, Arguments: args}}
}

func newEnv(t *testing.T) *env {
	t.Helper()
	d, err := db.Open(filepath.Join(t.TempDir(), "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	migs := append(jobs.Migrations(), db.Migration{Name: "test/books", SQL: `CREATE TABLE books (id TEXT PRIMARY KEY)`})
	if err := db.Migrate(context.Background(), d, append(migs, Migrations()...)); err != nil {
		t.Fatal(err)
	}
	d.Exec(`INSERT INTO books VALUES ('b1')`)
	e := &env{llm: llmtest.New(t), events: &recorder{}}
	e.cfg = &settings{cfg: e.llm.Config()}
	q := jobs.New(d, slog.New(slog.NewTextHandler(io.Discard, nil)))
	q.Lane(LaneTurn, 4)
	s := New(Config{DB: d, Events: e.events, Queue: q, Library: library{}, Settings: e.cfg})
	mux := http.NewServeMux()
	s.Routes(mux)
	e.Server = httptest.NewServer(mux)
	t.Cleanup(e.Close)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { q.Run(ctx); close(done) }()
	t.Cleanup(func() { cancel(); <-done })
	return e
}

func (e *env) do(t *testing.T, method, path string, body, out any) int {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		json.NewEncoder(&buf).Encode(body)
	}
	req, _ := http.NewRequest(method, e.URL+path, &buf)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if out != nil {
		json.NewDecoder(resp.Body).Decode(out)
	}
	return resp.StatusCode
}

func (e *env) wait(t *testing.T, id string, st TurnState) Turn {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		var ts Turns
		e.do(t, "GET", "/api/books/b1/turns", nil, &ts)
		for _, x := range ts.Turns {
			if x.ID == id && x.State == st {
				return x
			}
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("turn %s never reached %s", id, st)
	return Turn{}
}

const answer = "An eigenvalue is a scalar $\\lambda$ with $Tv = \\lambda v$ [p. 1].\n```steps\n{\"steps\":[{\"math\":\"2 + 2 = 4\",\"why\":\"Computed.\"}]}\n```\nHope that helps, Jack.\n"

func TestTurnSearchesComputesAndAnswers(t *testing.T) {
	e := newEnv(t)
	e.llm.Script(
		llmtest.Reply{ToolCalls: []llm.ToolCall{call("c1", "search_pages", `{"query":"eigenvalue"}`)}},
		llmtest.Reply{ToolCalls: []llm.ToolCall{call("c2", "compute", `{"expression":"2+2"}`), call("c3", "view_page", `{"page":1}`)}},
		llmtest.Reply{Text: answer},
	)
	var turn Turn
	if code := e.do(t, "POST", "/api/books/b1/turns", Question{Question: "What's an eigenvalue?", About: &About{Label: "5.A.1", Text: "Show λ is an eigenvalue."}}, &turn); code != 201 {
		t.Fatalf("ask %d", code)
	}
	got := e.wait(t, turn.ID, TurnDone)
	labels := []string{}
	for _, s := range got.Steps {
		labels = append(labels, s.Label)
	}
	if strings.Join(labels, " | ") != "Searched ‘eigenvalue’ · 1 page | Computed 2+2 = 4 | Looked at p. 1" {
		t.Fatalf("steps %v", labels)
	}
	if len(got.Answer) != 3 || got.Answer[1].Type != cards.SegmentCard || !strings.Contains(got.Answer[0].Text, "[p. 3]") {
		t.Fatalf("answer %+v", got.Answer)
	}
	if got.About != "5.A.1" {
		t.Fatalf("about %q", got.About)
	}
	if e.events.count(EventTurnDelta) == 0 || e.events.count(EventTurnCardStart) != 1 || e.events.count(EventTurnCard) != 1 {
		t.Fatalf("events %v", e.events.events)
	}
	// What the model was told: the tools' results, the page image, the
	// homework problem, and who it's talking to.
	reqs := e.llm.Requests()
	last := reqs[len(reqs)-1].Chat
	var sawResult, sawImage, sawAbout bool
	for _, m := range last.Messages {
		if m.Role == "tool" && strings.Contains(m.Content.Text(), "p. 1:\nEigenvalues") {
			sawResult = true
		}
		for _, p := range m.Content.Parts() {
			if p.Type == "image_url" {
				sawImage = true
			}
		}
		if strings.Contains(m.Content.Text(), "homework problem 5.A.1") {
			sawAbout = true
		}
	}
	if !sawResult || !sawImage || !sawAbout || !strings.Contains(last.Messages[0].Content.Text(), "talking with Jack") {
		t.Fatalf("result %v image %v about %v", sawResult, sawImage, sawAbout)
	}

	// The next turn sees this one, with citations back on printed pages.
	e.llm.Script(llmtest.Reply{Text: "Yes."})
	var next Turn
	e.do(t, "POST", "/api/books/b1/turns", Question{Question: "And again?"}, &next)
	e.wait(t, next.ID, TurnDone)
	reqs = e.llm.Requests()
	hist := reqs[len(reqs)-1].Chat.Messages
	if len(hist) != 4 || !strings.Contains(hist[2].Content.Text(), "[p. 1]") {
		t.Fatalf("history %d messages: %q", len(hist), hist[2].Content.Text())
	}
}

func TestStopKeepsThePartialAnswer(t *testing.T) {
	e := newEnv(t)
	e.llm.Script(llmtest.Reply{Text: strings.Repeat("Slowly, word by word. ", 40), Pause: 20 * time.Millisecond})
	var turn Turn
	e.do(t, "POST", "/api/books/b1/turns", Question{Question: "Go slowly"}, &turn)
	deadline := time.Now().Add(5 * time.Second)
	for e.events.count(EventTurnDelta) < 3 && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	e.do(t, "POST", "/api/turns/"+turn.ID+"/stop", nil, nil)
	got := e.wait(t, turn.ID, TurnStopped)
	time.Sleep(100 * time.Millisecond)
	got = e.wait(t, turn.ID, TurnStopped)
	if len(got.Answer) != 1 || !strings.HasPrefix(got.Answer[0].Text, "Slowly") || len(got.Answer[0].Text) > 800 {
		t.Fatalf("partial answer %+v", got.Answer)
	}
}

func TestModelOutageFailsReadablyAndClearEmpties(t *testing.T) {
	e := newEnv(t)
	e.llm.Script(llmtest.Reply{Status: 400, Text: "bad request"})
	var turn Turn
	e.do(t, "POST", "/api/books/b1/turns", Question{Question: "Hi"}, &turn)
	got := e.wait(t, turn.ID, TurnFailed)
	if !strings.HasPrefix(got.Reason, "The chat model stopped answering") {
		t.Fatalf("reason %q", got.Reason)
	}
	var er httpx.Error
	if code := e.do(t, "POST", "/api/books/b1/turns", Question{Question: "  "}, &er); code != 422 || er.Field != "question" {
		t.Fatalf("blank: %d", code)
	}
	e.cfg.cfg.ChatModel = ""
	if code := e.do(t, "POST", "/api/books/b1/turns", Question{Question: "Hi"}, &er); code != 422 || er.Code != httpx.CodeNotConfigured {
		t.Fatalf("unconfigured: %d %+v", code, er)
	}
	e.do(t, "DELETE", "/api/books/b1/turns", nil, nil)
	var ts Turns
	e.do(t, "GET", "/api/books/b1/turns", nil, &ts)
	if len(ts.Turns) != 0 || e.events.count(EventTurnsCleared) != 1 {
		t.Fatalf("after clear: %d", len(ts.Turns))
	}
}
