package homework

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/color"
	"image/jpeg"
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

// ---------------------------------------------------------------- fakes

// library is a book of four pages; problem 3.36 is on PDF page 3, which
// prints as page 1 (offset 2).
type library struct{}

var pages = []string{
	"Preface",
	"Chapter 3 Circuits. Ohm's law says V = IR.",
	"Problems\n3.35 Find the current.\n3.36 Find the voltage across R2 in Figure 3.7.\n1",
	"Answers to selected problems.\n2",
}

func (library) Book(_ context.Context, id string) (Book, error) {
	if id != "b1" {
		return Book{}, httpx.NotFound("book")
	}
	return Book{ID: "b1", Title: "Circuits", PageCount: len(pages), PageOffset: 2}, nil
}

func (library) Search(_ context.Context, _, query string, k int) ([]int, error) {
	var out []int
	for i, p := range pages {
		for _, w := range strings.Fields(strings.ToLower(query)) {
			if len(w) > 3 && strings.Contains(strings.ToLower(p), w) {
				out = append(out, i+1)
				break
			}
		}
	}
	return out[:min(k, len(out))], nil
}

func (library) PageText(_ context.Context, _ string, n int) (string, error) { return pages[n-1], nil }
func (library) PageTexts(context.Context, string) ([]string, error)         { return pages, nil }
func (library) ChapterSpan(context.Context, string, int) (int, int, bool, error) {
	return 2, 4, true, nil
}

var blank = sync.OnceValue(func() []byte {
	img := image.NewGray(image.Rect(0, 0, 170, 220))
	for i := range img.Pix {
		img.Pix[i] = 255
	}
	img.Set(40, 40, color.Black)
	var b bytes.Buffer
	jpeg.Encode(&b, img, nil)
	return b.Bytes()
})

func (library) PageJPEG(context.Context, string, int, int) ([]byte, error) { return blank(), nil }

type settings struct{ cfg llm.Config }

func (s settings) LLM(context.Context) (llm.Config, error) { return s.cfg, nil }
func (settings) Name(context.Context) string               { return "Jack" }

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

func (r *recorder) all() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]string(nil), r.events...)
}

// ---------------------------------------------------------------- env

type env struct {
	*httptest.Server
	svc    *Service
	llm    *llmtest.Server
	events *recorder
	cfg    *settings
}

const guide = "## Hint\nStart from Ohm's law [p. 1].\n\n## Walkthrough\nGood work getting here, Jack.\n```steps\n{\"steps\":[{\"math\":\"V = IR\",\"why\":\"Ohm's law.\"},{\"math\":\"V = 2 \\\\cdot 3 = 6\"}]}\n```\nSo $V = 6$ volts.\n"

// fakeModel answers like a well-behaved model: it finds any problem but
// 3.99 on the first image it's shown, and writes a guide in two parts.
func fakeModel(req llm.ChatRequest) llmtest.Reply {
	sys := req.Messages[0].Content.Text()
	switch {
	case strings.Contains(sys, "You find one homework problem"):
		user := req.Messages[1].Content.Parts()
		if strings.Contains(user[0].Text, "3.99") {
			return llmtest.Reply{Text: `{"image": 0}`}
		}
		return llmtest.Reply{Text: `{"image": 1, "label": "3.36", "statement": "Find the voltage across $R_2$.",
			"question_rect": {"x": 0.1, "y": 0.2, "w": 0.8, "h": 0.2},
			"figures": [{"label": "Figure 3.7", "rect": {"x": 0.1, "y": 0.5, "w": 0.4, "h": 0.3}}]}`}
	case strings.Contains(sys, "You write the guide"):
		return llmtest.Reply{Text: guide}
	}
	return llmtest.Reply{Text: "ok"}
}

func newEnv(t *testing.T) *env {
	t.Helper()
	d, err := db.Open(filepath.Join(t.TempDir(), "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	migs := append(jobs.Migrations(), db.Migration{Name: "test/books", SQL: `CREATE TABLE books (id TEXT PRIMARY KEY)`})
	migs = append(migs, Migrations()...)
	if err := db.Migrate(context.Background(), d, migs); err != nil {
		t.Fatal(err)
	}
	d.Exec(`INSERT INTO books VALUES ('b1')`)

	e := &env{llm: llmtest.New(t), events: &recorder{}}
	e.llm.Fallback(fakeModel)
	e.cfg = &settings{cfg: e.llm.Config()}
	q := jobs.New(d, slog.New(slog.NewTextHandler(io.Discard, nil)))
	q.Lane(LaneQuestion, 2)
	e.svc = New(Config{DB: d, Events: e.events, Queue: q, Library: library{}, Settings: e.cfg})
	mux := http.NewServeMux()
	e.svc.Routes(mux)
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

func (e *env) newSet(t *testing.T) Summary {
	t.Helper()
	var h Summary
	if code := e.do(t, "POST", "/api/books/b1/homework", Input{Title: "Set 3", DueDate: "2026-09-25"}, &h); code != 201 {
		t.Fatalf("create %d", code)
	}
	return h
}

func (e *env) add(t *testing.T, set string, drafts ...Draft) []Question {
	t.Helper()
	var out Questions
	if code := e.do(t, "POST", "/api/homework/"+set+"/questions", AddQuestions{Drafts: drafts}, &out); code != 201 {
		t.Fatalf("add %d", code)
	}
	return out.Questions
}

func (e *env) wait(t *testing.T, id string, st State) Question {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		q, err := getQuestion(context.Background(), e.svc.c.DB, id)
		if err == nil && q.State == st {
			return q.Question
		}
		time.Sleep(10 * time.Millisecond)
	}
	q, _ := getQuestion(context.Background(), e.svc.c.DB, id)
	t.Fatalf("question %s: %s (%s), want %s", id, q.State, q.Reason, st)
	return Question{}
}

// ---------------------------------------------------------------- tests

func TestSetsCreateEditTurnInAndDue(t *testing.T) {
	e := newEnv(t)
	var er httpx.Error
	if code := e.do(t, "POST", "/api/books/b1/homework", Input{Title: "  "}, &er); code != 422 || er.Field != "title" {
		t.Fatalf("blank title: %d %+v", code, er)
	}
	if code := e.do(t, "POST", "/api/books/b1/homework", Input{Title: "x", DueDate: "Friday"}, &er); code != 422 || er.Field != "dueDate" {
		t.Fatalf("bad date: %d %+v", code, er)
	}
	if code := e.do(t, "POST", "/api/books/nope/homework", Input{Title: "x"}, &er); code != 404 {
		t.Fatalf("no book: %d", code)
	}
	a := e.newSet(t)
	var b Summary
	e.do(t, "POST", "/api/books/b1/homework", Input{Title: "Undated"}, &b)
	var c Summary
	e.do(t, "POST", "/api/books/b1/homework", Input{Title: "Sooner", DueDate: "2026-09-22"}, &c)

	var due List
	e.do(t, "GET", "/api/due", nil, &due)
	if len(due.Homework) != 3 || due.Homework[0].ID != c.ID || due.Homework[1].ID != a.ID || due.Homework[2].ID != b.ID {
		t.Fatalf("due order %+v", due.Homework)
	}
	yes, no := true, false
	var turned Summary
	e.do(t, "PATCH", "/api/homework/"+c.ID, Patch{TurnedIn: &yes}, &turned)
	if turned.TurnedInAt == "" {
		t.Fatal("not turned in")
	}
	e.do(t, "GET", "/api/due", nil, &due)
	if len(due.Homework) != 2 {
		t.Fatalf("turned in still due: %d", len(due.Homework))
	}
	e.do(t, "PATCH", "/api/homework/"+c.ID, Patch{TurnedIn: &no}, &turned)
	if turned.TurnedInAt != "" {
		t.Fatal("turn in wasn't undone")
	}
	empty := ""
	var cleared Summary
	e.do(t, "PATCH", "/api/homework/"+a.ID, Patch{DueDate: &empty}, &cleared)
	if cleared.DueDate != "" {
		t.Fatal("due date not cleared")
	}
}

func TestInBookQuestionIsLocatedThenGuided(t *testing.T) {
	e := newEnv(t)
	h := e.newSet(t)
	qs := e.add(t, h.ID, Draft{Text: "3.36", InBook: true}, Draft{Text: "   ", InBook: true})
	if len(qs) != 1 || qs[0].State != StatePending || qs[0].Label != "3.36" {
		t.Fatalf("added %+v", qs)
	}
	q := e.wait(t, qs[0].ID, StateReady)
	if q.Page == nil || *q.Page != 3 || q.Statement != "Find the voltage across $R_2$." || len(q.Figures) != 1 {
		t.Fatalf("located %+v", q)
	}
	if len(q.Hint) != 1 || q.Hint[0].Text != "Start from Ohm's law [p. 3]." {
		t.Fatalf("hint %+v (citation should move to PDF page 3)", q.Hint)
	}
	if len(q.Walkthrough) != 3 || q.Walkthrough[1].Type != cards.SegmentCard || q.Walkthrough[1].Kind != cards.KindSteps {
		t.Fatalf("walkthrough %+v", q.Walkthrough)
	}

	// The hint went out on its own before the question was ready.
	var sawHintFirst bool
	for _, ev := range e.events.all() {
		if strings.HasPrefix(ev, EventQuestionChanged) && strings.Contains(ev, `"state":"writing"`) && strings.Contains(ev, "Ohm") {
			sawHintFirst = true
		}
	}
	if !sawHintFirst {
		t.Fatal("no event carried the hint while the walkthrough was being written")
	}
	// A guide is written for any student: the name is Ask's, not the
	// walkthrough's. And the writer holds the same tools Ask does.
	for _, r := range e.llm.Requests() {
		if len(r.Chat.Messages) > 0 && strings.Contains(r.Chat.Messages[0].Content.Text(), "You write the guide") {
			if strings.Contains(r.Chat.Messages[0].Content.Text(), "Jack") {
				t.Fatal("the guide prompt used the student's name")
			}
			var names []string
			for _, tool := range r.Chat.Tools {
				names = append(names, tool.Function.Name)
			}
			if strings.Join(names, ",") != "search_pages,read_page,view_page,compute,solve_linear" {
				t.Fatalf("guide tools %v", names)
			}
		}
	}

	resp, err := http.Get(e.URL + "/api/questions/" + q.ID + "/figures/0")
	if err != nil || resp.StatusCode != 200 || resp.Header.Get("Content-Type") != "image/jpeg" {
		t.Fatalf("figure: %v %v", err, resp.StatusCode)
	}
	resp.Body.Close()
	resp, _ = http.Get(e.URL + "/api/homework/" + h.ID + "/worksheet")
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != 200 || !bytes.HasPrefix(body, []byte("%PDF")) {
		t.Fatalf("worksheet: %d %q", resp.StatusCode, body[:min(20, len(body))])
	}
}

func TestOffBookQuestionSkipsLocating(t *testing.T) {
	e := newEnv(t)
	h := e.newSet(t)
	qs := e.add(t, h.ID, Draft{Text: "A 2 ohm resistor carries 3 A. What is the voltage?", InBook: false})
	q := e.wait(t, qs[0].ID, StateReady)
	if q.Page != nil || q.Statement != "A 2 ohm resistor carries 3 A. What is the voltage?" {
		t.Fatalf("%+v", q)
	}
	for _, r := range e.llm.Requests() {
		if len(r.Chat.Messages) > 0 && strings.Contains(r.Chat.Messages[0].Content.Text(), "You find one homework problem") {
			t.Fatal("an off-book question was located")
		}
	}
}

func TestNotFoundThenPinnedPageThenPastedText(t *testing.T) {
	e := newEnv(t)
	h := e.newSet(t)
	qs := e.add(t, h.ID, Draft{Text: "3.99", InBook: true})
	q := e.wait(t, qs[0].ID, StateFailed)
	if !strings.HasPrefix(q.Reason, "Couldn't find 3.99 in this book.") {
		t.Fatalf("reason %q", q.Reason)
	}
	var er httpx.Error
	bad := 99
	if code := e.do(t, "POST", "/api/questions/"+q.ID+"/retry", Retry{Page: &bad}, &er); code != 422 || er.Field != "page" {
		t.Fatalf("page out of range: %d %+v", code, er)
	}
	page := 3
	e.do(t, "POST", "/api/questions/"+q.ID+"/retry", Retry{Page: &page}, nil)
	q = e.wait(t, q.ID, StateFailed)
	if !strings.Contains(q.Reason, "isn't on p. 1 either") {
		t.Fatalf("pinned reason %q", q.Reason)
	}
	text := "Find the voltage across R2 when I = 3 A."
	e.do(t, "POST", "/api/questions/"+q.ID+"/retry", Retry{Text: &text}, nil)
	q = e.wait(t, q.ID, StateReady)
	if q.InBook || q.Statement != text || q.Page != nil {
		t.Fatalf("pasted: %+v", q)
	}
	if code := e.do(t, "POST", "/api/questions/"+q.ID+"/retry", Retry{}, &er); code != 422 {
		t.Fatalf("retrying a ready question: %d", code)
	}
}

func TestIncompleteGuideFailsAfterOneMoreTry(t *testing.T) {
	e := newEnv(t)
	calls := 0
	var mu sync.Mutex
	e.llm.Fallback(func(req llm.ChatRequest) llmtest.Reply {
		if strings.Contains(req.Messages[0].Content.Text(), "You write the guide") {
			mu.Lock()
			calls++
			mu.Unlock()
			return llmtest.Reply{Text: "Here is everything at once, with no parts."}
		}
		return fakeModel(req)
	})
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "Why?", InBook: false})[0].ID, StateFailed)
	if q.Reason != "The guide came back incomplete. Try again." || calls != 2 {
		t.Fatalf("%q after %d calls", q.Reason, calls)
	}
}

func TestNoChatModelFailsReadably(t *testing.T) {
	e := newEnv(t)
	e.cfg.cfg.ChatEndpoint = ""
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "Why?", InBook: false})[0].ID, StateFailed)
	if q.Reason != "Set up a chat model in Settings, then try again." {
		t.Fatalf("%q", q.Reason)
	}
}

func TestRevealDoneReorderRemove(t *testing.T) {
	e := newEnv(t)
	h := e.newSet(t)
	qs := e.add(t, h.ID, Draft{Text: "one"}, Draft{Text: "two"}, Draft{Text: "three"})
	for _, q := range qs {
		e.wait(t, q.ID, StateReady)
	}
	stage, yes := "hint", true
	var got Question
	e.do(t, "PATCH", "/api/questions/"+qs[1].ID, QuestionPatch{Reveal: &stage, Done: &yes}, &got)
	if !got.Done || len(got.Revealed) != 1 {
		t.Fatalf("%+v", got)
	}
	var er httpx.Error
	nope := "answer"
	if code := e.do(t, "PATCH", "/api/questions/"+qs[1].ID, QuestionPatch{Reveal: &nope}, &er); code != 422 {
		t.Fatalf("bad stage %d", code)
	}
	first := 1
	e.do(t, "PATCH", "/api/questions/"+qs[2].ID, QuestionPatch{Position: &first}, nil)
	order := func() string {
		var d Detail
		e.do(t, "GET", "/api/homework/"+h.ID, nil, &d)
		var s []string
		for _, q := range d.Questions {
			s = append(s, q.Text)
		}
		return strings.Join(s, ",")
	}
	if o := order(); o != "three,one,two" {
		t.Fatalf("after move: %s", o)
	}
	e.do(t, "DELETE", "/api/questions/"+qs[0].ID, nil, nil)
	var d Detail
	e.do(t, "GET", "/api/homework/"+h.ID, nil, &d)
	if len(d.Questions) != 2 || d.Questions[1].Position != 2 || d.Homework.Done != 1 || d.Homework.Total != 2 {
		t.Fatalf("after remove: %+v", d)
	}
	n, sets, _ := e.svc.QuestionsDoneSince(context.Background(), time.Now().Add(-time.Hour))
	if n != 1 || sets != 1 {
		t.Fatalf("done since: %d %d", n, sets)
	}
	e.do(t, "DELETE", "/api/homework/"+h.ID, nil, nil)
	if code := e.do(t, "GET", "/api/homework/"+h.ID, nil, nil); code != 404 {
		t.Fatalf("deleted set: %d", code)
	}
}

func TestGuideComputesAndShowsWhatItsDoing(t *testing.T) {
	e := newEnv(t)
	var mu sync.Mutex
	round := 0
	e.llm.Fallback(func(req llm.ChatRequest) llmtest.Reply {
		if !strings.Contains(req.Messages[0].Content.Text(), "You write the guide") {
			return fakeModel(req)
		}
		mu.Lock()
		defer mu.Unlock()
		round++
		if round == 1 {
			return llmtest.Reply{Reasoning: "Let me check the arithmetic.", ToolCalls: []llm.ToolCall{
				{ID: "c1", Type: "function", Function: llm.ToolCallFunc{Name: "compute", Arguments: `{"expression":"3/8"}`}},
			}}
		}
		return llmtest.Reply{Text: guide}
	})
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "Flip three coins.", InBook: false})[0].ID, StateReady)
	if q.Activity != "" {
		t.Fatalf("activity left behind: %q", q.Activity)
	}
	var saw []string
	for _, ev := range e.events.all() {
		for _, a := range []string{"Thinking…", "Computing…", "Writing the guide…"} {
			if strings.Contains(ev, `"activity":"`+a+`"`) && (len(saw) == 0 || saw[len(saw)-1] != a) {
				saw = append(saw, a)
			}
		}
	}
	if strings.Join(saw, " > ") != "Thinking… > Computing… > Writing the guide…" {
		t.Fatalf("activity %v", saw)
	}
	// The tool's exact answer went back to the model.
	reqs := e.llm.Requests()
	var got bool
	for _, m := range reqs[len(reqs)-1].Chat.Messages {
		if m.Role == "tool" && strings.Contains(m.Content.Text(), "3/8") {
			got = true
		}
	}
	if !got {
		t.Fatal("compute's result never reached the model")
	}
}
