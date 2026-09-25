package homework

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackt/pset/internal/pagenum"
	"github.com/jackt/pset/internal/probnum"
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

	"github.com/jackt/pset/internal/agent"
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
	return Book{ID: "b1", Title: "Circuits", PageCount: len(pages), Pages: pagenum.Single(2),
		Parts: []probnum.Part{{Number: "3", Title: "3 Methods of Analysis", Start: 2, End: 4}}}, nil
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
	queue  *jobs.Queue
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
	case strings.Contains(sys, "You read the figures"):
		return llmtest.Reply{Text: "- Node A: top of $R_1$.\n- 2 A current source from B to A (its arrow points to A)."}
	case strings.Contains(sys, "several readings"):
		return llmtest.Reply{Text: "- Node A: top of $R_1$.\n- 2 A current source from A to B (its arrow points to B)."}
	case strings.Contains(sys, "You read one homework problem from pictures"):
		return llmtest.Reply{Text: `{"label": "7", "statement": "Find the general solution of $y'' + 5y' + 6y = 0$."}`}
	case strings.Contains(sys, "You write the guide"):
		return llmtest.Reply{Text: guide}
	}
	return llmtest.Reply{Text: "ok"}
}

func newEnv(t *testing.T) *env { return newEnvWith(t, nil) }

func newEnvWith(t *testing.T, mem Memory) *env {
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
	e.queue = q
	e.svc = New(Config{DB: d, Events: e.events, Queue: q, Library: library{}, Settings: e.cfg, Memory: mem})
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

func TestEveryQuestionIsFoundBeforeAnyGuideIsWritten(t *testing.T) {
	e := newEnv(t)
	// A guide holds its slot until the test lets one finish, as a slow
	// model does: the lane of two is then full of writing.
	writing, release := make(chan struct{}, 8), make(chan struct{})
	var once sync.Once
	t.Cleanup(func() { once.Do(func() { close(release) }) })
	e.llm.Fallback(func(req llm.ChatRequest) llmtest.Reply {
		if strings.Contains(req.Messages[0].Content.Text(), "You write the guide") {
			writing <- struct{}{}
			<-release
		}
		return fakeModel(req)
	})
	started := func() {
		t.Helper()
		select {
		case <-writing:
		case <-time.After(10 * time.Second):
			t.Fatal("no guide started")
		}
	}
	h := e.newSet(t)
	first := e.add(t, h.ID, Draft{Text: "3.36", InBook: true}, Draft{Text: "3.37", InBook: true}, Draft{Text: "3.38", InBook: true})
	started()
	started()
	// Two guides are being written, so all three were found first; the
	// third waits its turn, found, with its statement for the worksheet.
	states := map[State]int{}
	for _, q := range first {
		got, _ := getQuestion(context.Background(), e.svc.c.DB, q.ID)
		if got.Page == nil || got.Statement == "" {
			t.Fatalf("%s: a guide started before it was found (%s)", got.Text, got.State)
		}
		states[got.State]++
	}
	if states[StateWriting] != 2 || states[StateLocated] != 1 {
		t.Fatalf("states %v", states)
	}

	// One added now is found in the next free slot, ahead of the guide
	// that was already waiting.
	late := e.add(t, h.ID, Draft{Text: "3.40", InBook: true})[0]
	release <- struct{}{}
	started()
	if got, _ := getQuestion(context.Background(), e.svc.c.DB, late.ID); got.State != StateLocated || got.Page == nil {
		t.Fatalf("the late question is %s: a waiting guide went first", got.State)
	}

	once.Do(func() { close(release) })
	for _, q := range append(first, late) {
		e.wait(t, q.ID, StateReady)
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
	if q.Failure != FailureNotFound || !strings.Contains(q.Reason, "problem 3.99") {
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
	if q.Failure != FailureNotFound || !strings.Contains(q.Reason, "isn't on p. 1 either") {
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
	if q.Failure != FailureGeneration || !strings.Contains(q.Reason, "missing a part") || calls != 2 {
		t.Fatalf("%q after %d calls", q.Reason, calls)
	}
}

func TestNoChatModelFailsReadably(t *testing.T) {
	e := newEnv(t)
	e.cfg.cfg.ChatEndpoint = ""
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "Why?", InBook: false})[0].ID, StateFailed)
	if q.Failure != FailureSetup || !strings.Contains(q.Reason, "no chat model") {
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

// memory is a book memory in a map: the problems locate saw, and the
// walkthrough writer's notes.
type memory struct {
	mu    sync.Mutex
	seen  map[int][]Seen
	notes []agent.Note
}

func (m *memory) Notes(context.Context, string) ([]agent.Note, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]agent.Note(nil), m.notes...), nil
}

func (m *memory) Remember(_ context.Context, _ string, n agent.NewNote) (agent.Note, string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	note := agent.Note{ID: fmt.Sprintf("note%d", len(m.notes)), Kind: n.Kind, Text: n.Text, Page: n.Page, Source: "tutor"}
	m.notes = append(m.notes, note)
	return note, agent.Saved, nil
}

func (m *memory) Forget(context.Context, string, string) (agent.Note, error) {
	return agent.Note{}, nil
}

func (m *memory) ProblemsSeen(_ context.Context, _ string, chapter int) (Problems, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.seen[chapter]) == 0 {
		return Problems{}, nil
	}
	return Problems{MemoryID: "range3", Text: "Chapter 3's problems include one on p. 1.", Seen: m.seen[chapter]}, nil
}

func (m *memory) SawProblem(_ context.Context, _ string, _ pagenum.Map, chapter int, label string, page int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.seen[chapter] = append(m.seen[chapter], Seen{Label: label, Page: page})
	return nil
}

func TestMemoryFindsTheNextProblemAndKeepsTheWritersNotes(t *testing.T) {
	mem := &memory{seen: map[int][]Seen{}}
	e := newEnvWith(t, mem)
	var mu sync.Mutex
	var guideRound int
	e.llm.Fallback(func(req llm.ChatRequest) llmtest.Reply {
		if strings.Contains(req.Messages[0].Content.Text(), "You write the guide") {
			mu.Lock()
			guideRound++
			round := guideRound
			mu.Unlock()
			if round == 1 {
				return llmtest.Reply{ToolCalls: []llm.ToolCall{{ID: "1", Type: "function", Function: llm.ToolCallFunc{
					Name: "remember", Arguments: `{"kind":"book","text":"Ohm's law is stated on p. 0.","page":0}`}}}}
			}
		}
		return fakeModel(req)
	})
	h := e.newSet(t)
	first := e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0]
	q := e.wait(t, first.ID, StateReady)
	if got := mem.seen[3]; len(got) != 1 || got[0] != (Seen{Label: "3.36", Page: 3}) {
		t.Fatalf("seen %+v", got)
	}
	// The writer's save is a line under the walkthrough.
	if len(q.Memory) != 1 || q.Memory[0].Use != MemoryUseSaved || q.Memory[0].MemoryID != "note0" {
		t.Fatalf("memory lines %+v", q.Memory)
	}
	// Found by the text layer: nothing to credit memory with.
	for _, l := range q.Memory {
		if l.Use == MemoryUseFound {
			t.Fatal("an exact find credited to memory")
		}
	}

	// 3.37 isn't in the text layer at all: only memory knows where to look.
	second := e.add(t, h.ID, Draft{Text: "3.37", InBook: true})[0]
	q = e.wait(t, second.ID, StateReady)
	if q.Page == nil || *q.Page != 3 {
		t.Fatalf("located %+v", q.Page)
	}
	if len(q.Memory) == 0 || q.Memory[0].Use != MemoryUseFound || q.Memory[0].MemoryID != "range3" {
		t.Fatalf("memory lines %+v", q.Memory)
	}
}

func TestAFoundQuestionIsWrittenAgainWithoutLookingAgain(t *testing.T) {
	e := newEnv(t)
	var mu sync.Mutex
	locates, broken := 0, true
	e.llm.Fallback(func(req llm.ChatRequest) llmtest.Reply {
		mu.Lock()
		defer mu.Unlock()
		sys := req.Messages[0].Content.Text()
		if strings.Contains(sys, "You find one homework problem") {
			locates++
		}
		if strings.Contains(sys, "You write the guide") && broken {
			return llmtest.Reply{Status: 500, Text: `{"error":"down"}`}
		}
		return fakeModel(req)
	})
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID, StateFailed)
	// A 500 is the provider being down, not the problem or the settings.
	if q.Failure != FailureUnavailable || !strings.Contains(q.Reason, "Nothing is wrong with problem 3.36") {
		t.Fatalf("%s: %q", q.Failure, q.Reason)
	}
	if q.Page == nil || locates != 1 {
		t.Fatalf("page %v after %d locates", q.Page, locates)
	}
	mu.Lock()
	broken = false
	mu.Unlock()
	if code := e.do(t, "POST", "/api/questions/"+q.ID+"/retry", Retry{}, nil); code != 200 {
		t.Fatalf("retry %d", code)
	}
	q = e.wait(t, q.ID, StateReady)
	if q.Failure != "" || q.Reason != "" {
		t.Fatalf("a ready question still carries %s %q", q.Failure, q.Reason)
	}
	if locates != 1 || q.Page == nil || *q.Page != 3 {
		t.Fatalf("looked again: %d locates, page %v", locates, q.Page)
	}
}

// Every update to a question bumps its Rev by exactly one, whatever it
// touches: the client keeps the higher Rev of two snapshots, so a write
// that forgot to bump would let a stale snapshot win.
func TestEveryUpdateBumpsRev(t *testing.T) {
	ctx := context.Background()
	d, err := db.Open(filepath.Join(t.TempDir(), "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	migs := append([]db.Migration{{Name: "test/books", SQL: `CREATE TABLE books (id TEXT PRIMARY KEY)`}}, Migrations()...)
	if err := db.Migrate(ctx, d, migs); err != nil {
		t.Fatal(err)
	}
	now := db.Now()
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := d.Exec(q, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO books VALUES ('b1')`)
	exec(`INSERT INTO homework (id, book_id, title, created_at, updated_at) VALUES ('h1', 'b1', 'Set', ?, ?)`, now, now)
	for i, id := range []string{"q1", "q2", "q3"} {
		exec(`INSERT INTO questions (id, homework_id, position, text, in_book, state, created_at, updated_at)
			VALUES (?, 'h1', ?, '1.1', 1, 'pending', ?, ?)`, id, i+1, now, now)
	}
	rev := func(id string) int {
		t.Helper()
		q, err := getQuestion(ctx, d, id)
		if err != nil {
			t.Fatal(err)
		}
		return q.Rev
	}
	if rev("q1") != 0 {
		t.Fatalf("a new question starts at rev 0, got %d", rev("q1"))
	}
	// Writes that leave updated_at alone still count.
	for i, q := range []string{
		`UPDATE questions SET activity = 'Thinking…' WHERE id = 'q1'`,
		`UPDATE questions SET revealed = '["hint"]' WHERE id = 'q1'`,
		`UPDATE questions SET done_at = '2026-09-24T00:00:00Z' WHERE id = 'q1'`,
		`UPDATE questions SET state = 'ready', hint = '[]', activity = '', updated_at = '2026-09-24T00:00:01Z' WHERE id = 'q1'`,
	} {
		exec(q)
		if got := rev("q1"); got != i+1 {
			t.Fatalf("after %q: rev %d, want %d", q, got, i+1)
		}
	}
	// A shift that moves several rows bumps each of them once.
	exec(`UPDATE questions SET position = position + 1 WHERE homework_id = 'h1' AND position >= 2`)
	if rev("q2") != 1 || rev("q3") != 1 || rev("q1") != 4 {
		t.Fatalf("shift: q1 %d q2 %d q3 %d, want 4 1 1", rev("q1"), rev("q2"), rev("q3"))
	}
}
