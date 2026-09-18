package engine

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/store"
)

// hwScriptedChat scripts non-streaming replies in request order — the
// homework pipeline makes every call through ChatOnce, so one reply per
// call: extract, then per question locate → guide.
type hwScriptedChat struct {
	mu      sync.Mutex
	reqs    []llm.ChatRequest
	replies []string
	blockAt int // 1-based request index to hold until released
	release chan struct{}
	srv     *httptest.Server
}

func (f *hwScriptedChat) request(i int) llm.ChatRequest {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.reqs[i]
}

func (f *hwScriptedChat) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.reqs)
}

func startHwChat(t *testing.T, replies ...string) *hwScriptedChat {
	t.Helper()
	f := &hwScriptedChat{replies: replies, release: make(chan struct{})}
	f.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req llm.ChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		f.mu.Lock()
		f.reqs = append(f.reqs, req)
		n := len(f.reqs)
		reply := "ok"
		if len(f.replies) > 0 {
			reply = f.replies[0]
			f.replies = f.replies[1:]
		}
		block := f.blockAt == n
		f.mu.Unlock()

		if block {
			<-f.release
		}
		w.Write([]byte(`{"choices":[{"message":{"content":` + mustJSON(reply) + `}}]}`))
	}))
	t.Cleanup(f.srv.Close)
	return f
}

// hwChatConfig points the engine at a scripted chat endpoint.
// hwChatConfig repoints the chat endpoint and keeps the embeddings settings
// the env already has. Swapping the embedding model out would invalidate the
// book's vectors — correctly, since readiness is derived per model — and the
// book would stop being a usable homework source.
func hwChatConfig(t *testing.T, e *Engine, chat *hwScriptedChat) {
	t.Helper()
	setChatConfig(t, e, chat.srv.URL, "k")
}

const hwLocateReply = `{"page": 3, "question_rect": {"x": 0.1, "y": 0.2, "w": 0.8, "h": 0.3},
 "diagrams": [{"label": "Figure 2.7", "rect": {"x": 0.2, "y": 0.5, "w": 0.3, "h": 0.2}}]}`

func hwGuideReply(answer string) string {
	return fmt.Sprintf(`{"reading": {"given": ["two blocks over a pulley", "masses $m_1$ and $m_2$"],
  "find": "the acceleration of the blocks", "figure": "the pulley is ideal and the string does not stretch"},
 "setup": "One string, one tension [p. 3].", "hints": ["draw free bodies"],
 "steps": ["$m_2 g - T = m_2 a$ [p. 3]", "add the equations"],
 "equations": [{"title": "Accel", "tex": "a = \\frac{m_2 g}{m_1+m_2}"}],
 "answer": %s}`, mustJSON(answer))
}

const hwSource = `Problem Set 4 — Chapter 2.
1. Two blocks connected over a pulley: find the acceleration.
2. A crate slides down a 30 degree incline: how far does it slide in 2 s?`

// seedHomeworkEnv ingests the digital sample and returns the engine plus
// book ready for homework submissions.
func seedHomeworkEnv(t *testing.T) (*Engine, *Runner, *store.Book) {
	t.Helper()
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)
	book := ingestDigitalSample(t, e, r)
	return e, r, book
}

func hwByID(t *testing.T, e *Engine, id string) *store.Homework {
	t.Helper()
	s, err := e.openStore(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	hw, err := s.HomeworkByID(context.Background(), id)
	if err != nil {
		t.Fatal(err)
	}
	return hw
}

func hwQuestions(t *testing.T, e *Engine, id string) []store.HomeworkQuestion {
	t.Helper()
	s, err := e.openStore(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	qs, err := s.Questions(context.Background(), id)
	if err != nil {
		t.Fatal(err)
	}
	return qs
}

func TestHomeworkGenerationEndToEnd(t *testing.T) {
	e, r, book := seedHomeworkEnv(t)
	ctx := context.Background()

	chat := startHwChat(t,
		`{"questions":[{"text":"What is a gavel?","hint":"Chapter 2"},{"text":"call sign","hint":""}]}`,
		hwLocateReply, hwGuideReply("a = 5.9 m/s²"),
		hwLocateReply, hwGuideReply("d = 5.6 m"))
	hwChatConfig(t, e, chat)

	hw, job, err := e.SubmitHomework(ctx, HomeworkCreate{
		BookSHA256: book.SHA256, Title: "Problem Set 4", SourceText: hwSource,
	})
	if err != nil {
		t.Fatalf("submit: %v", err)
	}
	runPendingTasks(t, r)

	// Job and homework settled.
	view, err := e.TaskView(ctx, job.ID)
	if err != nil {
		t.Fatal(err)
	}
	if view.Status != store.TaskDone {
		t.Fatalf("job = %s/%s, want completed", view.Status, view.Error)
	}
	got := hwByID(t, e, hw.ID)
	if got.Status != store.HomeworkReady {
		t.Fatalf("homework = %s, want ready", got.Status)
	}

	// Two questions, both ready with page, rects, diagrams, and guides.
	qs := hwQuestions(t, e, hw.ID)
	if len(qs) != 2 {
		t.Fatalf("%d questions, want 2", len(qs))
	}
	for i, q := range qs {
		if q.Status != store.QuestionReady || q.Page == nil || *q.Page != 3 || q.QuestionRect == nil {
			t.Errorf("question %d = %s page %v rect %v err %q", i, q.Status, q.Page, q.QuestionRect, q.Error)
		}
		if len(q.Diagrams) != 1 || q.Diagrams[0].Label != "Figure 2.7" {
			t.Errorf("question %d diagrams = %+v", i, q.Diagrams)
		}
		if q.Guide == nil || q.Guide.Setup == "" || len(q.Guide.Steps) != 2 || len(q.Guide.Equations) != 1 {
			t.Errorf("question %d guide = %+v", i, q.Guide)
		}
	}
	if qs[1].Guide == nil || !strings.Contains(qs[1].Guide.Answer, "5.6") {
		t.Fatalf("second guide = %+v, want the 5.6 answer", qs[1].Guide)
	}

	// The assignment's own task only reads and fans out. Each question is a
	// task of its own, because questions are independent: one failing says
	// nothing about the next, and each resumes and retries on its own.
	phases := taskAfter(t, e, job.ID).Phases
	keys := []string{}
	for _, ph := range phases {
		keys = append(keys, ph.Key)
	}
	if strings.Join(keys, ",") != "extract,queue" {
		t.Fatalf("plan = %v, want exactly [extract queue]", keys)
	}
	if extract := phaseByKey(t, e, job.ID, "extract"); extract.Status != store.PhaseDone {
		t.Fatalf("extract phase = %q, want done", extract.Status)
	}
	if queued := phaseByKey(t, e, job.ID, "queue"); queued.Status != store.PhaseDone || queued.Done != 2 {
		t.Fatalf("queue phase = %q %d/%d, want done 2/2", queued.Status, queued.Done, queued.Total)
	}

	// One question task each, and each says what it did: find it, write it.
	questionTasks := 0
	for _, v := range taskViews(t, e) {
		if v.Kind != store.TaskQuestion {
			continue
		}
		questionTasks++
		if v.Status != store.TaskDone {
			t.Errorf("question task = %s/%s, want done", v.Status, v.Error)
		}
		pkeys := []string{}
		for _, ph := range v.Phases {
			pkeys = append(pkeys, ph.Key)
		}
		if strings.Join(pkeys, ",") != "locate,guide" {
			t.Errorf("question task phases = %v, want [locate guide]", pkeys)
		}
	}
	if questionTasks != 2 {
		t.Fatalf("%d question tasks, want one per question", questionTasks)
	}

	// The extract call carried the source; locate carried page images and the
	// hint; guide carried the guide contract.
	first := chat.request(0)
	if !strings.Contains(first.Messages[1].Content.Text(), hwSource) {
		t.Error("extract request lost the source text")
	}
	locate := chat.request(1)
	locateText := locate.Messages[1].Content.Parts()[0].Text
	if !strings.Contains(locateText, "What is a gavel?") || !strings.Contains(locateText, "Chapter 2") {
		t.Errorf("locate request lost the question or hint: %.120s", locateText)
	}
	images := 0
	for _, part := range locate.Messages[1].Content.Parts() {
		if part.Type == "image_url" {
			images++
		}
	}
	if images == 0 {
		t.Error("locate request carried no page images")
	}
	if len(chat.request(2).Messages) == 0 {
		t.Error("guide request missing")
	}
}

func eventTypes(events []HomeworkEvent) []string {
	out := make([]string, len(events))
	for i, ev := range events {
		out[i] = string(ev.Type)
	}
	return out
}

func TestHomeworkQuestionFailureIsolation(t *testing.T) {
	e, r, book := seedHomeworkEnv(t)
	ctx := context.Background()

	chat := startHwChat(t,
		`{"questions":[{"text":"What is a gavel?"},{"text":"call sign"}]}`,
		hwLocateReply, hwGuideReply("ok"),
		`{"page": 0}`, // the model claims no page holds the second question
	)
	hwChatConfig(t, e, chat)

	hw, job, err := e.SubmitHomework(ctx, HomeworkCreate{BookSHA256: book.SHA256, SourceText: hwSource})
	if err != nil {
		t.Fatal(err)
	}
	runPendingTasks(t, r)

	if view, _ := e.TaskView(ctx, job.ID); view.Status != store.TaskDone {
		t.Fatalf("job = %s/%s, want completed despite one failure", view.Status, view.Error)
	}
	if got := hwByID(t, e, hw.ID); got.Status != store.HomeworkReady {
		t.Fatalf("homework = %s, want ready", got.Status)
	}
	qs := hwQuestions(t, e, hw.ID)
	if len(qs) != 2 || qs[0].Status != store.QuestionReady || qs[1].Status != store.QuestionFailed {
		t.Fatalf("statuses = %s %s, want ready + failed", qs[0].Status, qs[1].Status)
	}
	if qs[1].Error == "" || qs[1].Guide != nil {
		t.Errorf("failed question = %+v, want an error and no guide", qs[1])
	}

	// The assignment's own task still finished: one question that cannot be
	// written does not sink an assignment that is otherwise useful. The
	// failure lives on that question's task and its row.
	if queued := phaseByKey(t, e, job.ID, "queue"); queued.Status != store.PhaseDone || queued.Done != 2 {
		t.Fatalf("queue phase = %q %d/%d, want done 2/2", queued.Status, queued.Done, queued.Total)
	}

	// Repair is scoped to the stage that was wrong: relocating the broken
	// question fixes it and leaves the healthy one completely untouched.
	chat2 := startHwChat(t, hwLocateReply, hwGuideReply("retried"))
	hwChatConfig(t, e, chat2)
	page := 3
	if _, err := e.RelocateQuestion(ctx, qs[1].ID, &page, "it is in chapter 2"); err != nil {
		t.Fatalf("relocate: %v", err)
	}
	runPendingTasks(t, r)
	qs = hwQuestions(t, e, hw.ID)
	if qs[1].Status != store.QuestionReady || qs[1].Guide == nil || qs[1].Guide.Answer != "retried" {
		t.Fatalf("after the relocate = %+v", qs[1])
	}
	if qs[1].Page == nil || *qs[1].Page != page {
		t.Fatalf("relocated question page = %v, want the page the student named", qs[1].Page)
	}
	if qs[0].Status != store.QuestionReady || qs[0].Guide == nil || qs[0].Guide.Answer != "ok" {
		t.Fatalf("the healthy question was disturbed by a scoped repair: %+v", qs[0])
	}

	// A repair is a task like any other, so it survives the page that asked
	// for it: the relocate above is its own row, done, next to the two
	// question tasks generation queued.
	// Its own history: the generation attempt that failed, and the relocate
	// that fixed it. The failed one stays failed — a task records what
	// happened to it, and the repair is a separate piece of work.
	var statuses []string
	for _, v := range taskViews(t, e) {
		if v.Kind == store.TaskQuestion && v.QuestionID == qs[1].ID {
			statuses = append(statuses, v.Status)
		}
	}
	if len(statuses) != 2 {
		t.Fatalf("tasks for the repaired question = %v, want its generation and its relocate", statuses)
	}
	if !slices.Contains(statuses, store.TaskFailed) || !slices.Contains(statuses, store.TaskDone) {
		t.Fatalf("tasks for the repaired question = %v, want one failed and one done", statuses)
	}
}

func TestHomeworkCapsAndValidation(t *testing.T) {
	e, r, book := seedHomeworkEnv(t)
	ctx := context.Background()

	// Oversized source is refused at submit.
	if _, _, err := e.SubmitHomework(ctx, HomeworkCreate{
		BookSHA256: book.SHA256, SourceText: strings.Repeat("x", hwMaxSourceBytes+1),
	}); err == nil {
		t.Fatal("oversized source accepted")
	}
	// Empty source is refused.
	if _, _, err := e.SubmitHomework(ctx, HomeworkCreate{BookSHA256: book.SHA256, SourceText: "   "}); err == nil {
		t.Fatal("empty source accepted")
	}
	// Unknown book.
	if _, _, err := e.SubmitHomework(ctx, HomeworkCreate{BookSHA256: "deadbeef00", SourceText: "hi"}); err == nil {
		t.Fatal("unknown book accepted")
	}

	// An extract that over-reports is truncated to the cap.
	var many strings.Builder
	many.WriteString(`{"questions":[`)
	for i := 0; i < hwMaxQuestions+10; i++ {
		if i > 0 {
			many.WriteString(",")
		}
		fmt.Fprintf(&many, `{"text":"question %d"}`, i+1)
	}
	many.WriteString("]}")
	replies := []string{many.String()}
	for i := 0; i < hwMaxQuestions; i++ {
		replies = append(replies, hwLocateReply, hwGuideReply("ok"))
	}
	chat := startHwChat(t, replies...)
	hwChatConfig(t, e, chat)

	hw, _, err := e.SubmitHomework(ctx, HomeworkCreate{BookSHA256: book.SHA256, SourceText: hwSource})
	if err != nil {
		t.Fatal(err)
	}
	runPendingTasks(t, r)
	if qs := hwQuestions(t, e, hw.ID); len(qs) != hwMaxQuestions {
		t.Fatalf("%d questions, want the cap %d", len(qs), hwMaxQuestions)
	}
}

// TestHomeworkStopKeepsPartials pins the rule that stopping never throws
// work away. Now that each question is its own task, the unit you stop is
// one question: the ones already written stay written, the stopped one rests
// paused with its finished phase intact, and a retry resumes from there
// rather than starting the whole assignment again.
func TestHomeworkStopKeepsPartials(t *testing.T) {
	e, r, book := seedHomeworkEnv(t)
	ctx := context.Background()

	chat := startHwChat(t,
		`{"questions":[{"text":"What is a gavel?"},{"text":"call sign"},{"text":"What is a gavel?"}]}`,
		hwLocateReply, hwGuideReply("one"),
		hwLocateReply, hwGuideReply("two"),
		hwLocateReply, hwGuideReply("three"))
	// extract, then question 1's locate and guide; hold question 2's locate.
	chat.blockAt = 4
	hwChatConfig(t, e, chat)

	hw, job, err := e.SubmitHomework(ctx, HomeworkCreate{BookSHA256: book.SHA256, SourceText: hwSource})
	if err != nil {
		t.Fatal(err)
	}

	go func() { _ = r.Drain(ctx) }()

	deadline := time.Now().Add(10 * time.Second)
	for {
		if chat.count() >= 4 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("generation never reached the second question's locate")
		}
		time.Sleep(5 * time.Millisecond)
	}

	// The assignment's own task is long done: it reads and fans out, and
	// must not sit holding the worker while its questions run.
	parent := taskAfter(t, e, job.ID)
	if parent.Status != store.TaskDone {
		t.Fatalf("assignment task = %s/%s, want done once it has queued the questions", parent.Status, parent.Error)
	}

	qs := hwQuestions(t, e, hw.ID)
	stopped := questionTaskFor(t, e, qs[1].ID)
	if _, err := e.StopTask(ctx, stopped.ID); err != nil {
		t.Fatalf("stop: %v", err)
	}
	close(chat.release)

	for {
		v, err := e.TaskView(ctx, stopped.ID)
		if err != nil {
			t.Fatal(err)
		}
		if v.Status == store.TaskPaused {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("question task = %s, want paused", v.Status)
		}
		time.Sleep(5 * time.Millisecond)
	}

	if got := hwByID(t, e, hw.ID); got.Status != store.HomeworkReady {
		t.Fatalf("homework = %s, want ready — the outline exists", got.Status)
	}
	qs = hwQuestions(t, e, hw.ID)
	if qs[0].Status != store.QuestionReady || qs[0].Guide == nil || qs[0].Guide.Answer != "one" {
		t.Fatalf("question 1 lost its walkthrough to a stop on question 2: %+v", qs[0])
	}
	if qs[1].Status == store.QuestionFailed {
		t.Errorf("a stop is not a failure, but question 2 = %s (%s)", qs[1].Status, qs[1].Error)
	}

	// Nothing is left mid-flight, the finished phase stays done, and the one
	// that was interrupted is waiting again so a retry picks it straight up.
	view := taskAfter(t, e, stopped.ID)
	for _, ph := range view.Phases {
		if ph.Status == store.PhaseRunning {
			t.Errorf("phase %s still running after the stop", ph.Key)
		}
	}
	if locate := phaseByKey(t, e, stopped.ID, "locate"); locate.Status != store.PhaseDone {
		t.Errorf("locate phase = %q, want done — finished work is never re-run", locate.Status)
	}
	if guide := phaseByKey(t, e, stopped.ID, "guide"); guide.Status != store.PhaseWaiting {
		t.Errorf("guide phase = %q, want waiting so a retry resumes it", guide.Status)
	}

	// Retrying that one question finishes it, and touches nothing else.
	if _, err := e.RetryTask(ctx, stopped.ID); err != nil {
		t.Fatalf("retry: %v", err)
	}
	runPendingTasks(t, r)
	qs = hwQuestions(t, e, hw.ID)
	if qs[1].Status != store.QuestionReady || qs[1].Guide == nil {
		t.Fatalf("question 2 after the retry = %+v", qs[1])
	}
	if qs[0].Guide == nil || qs[0].Guide.Answer != "one" {
		t.Fatalf("the retry disturbed question 1: %+v", qs[0])
	}
}

// questionTaskFor finds the task working one question.
func questionTaskFor(t *testing.T, e *Engine, questionID string) *TaskView {
	t.Helper()
	for _, v := range taskViews(t, e) {
		if v.Kind == store.TaskQuestion && v.QuestionID == questionID {
			return v
		}
	}
	t.Fatalf("no task for question %s", questionID)
	return nil
}

func TestAddQuestionUndoTarget(t *testing.T) {
	e, r, book := seedHomeworkEnv(t)
	ctx := context.Background()

	chat := startHwChat(t,
		`{"questions":[{"text":"What is a gavel?"},{"text":"call sign"}]}`,
		hwLocateReply, hwGuideReply("one"),
		hwLocateReply, hwGuideReply("two"))
	hwChatConfig(t, e, chat)

	hw, _, err := e.SubmitHomework(ctx, HomeworkCreate{BookSHA256: book.SHA256, SourceText: hwSource})
	if err != nil {
		t.Fatal(err)
	}
	runPendingTasks(t, r)
	qs := hwQuestions(t, e, hw.ID)

	// The undo target for a delete: a fully-formed question POSTs back in
	// with no model call and lands at the end of the outline.
	restored, err := e.AddQuestion(ctx, hw.ID, &store.HomeworkQuestion{
		Transcription: "restored", Status: store.QuestionReady, Page: qs[0].Page,
		QuestionRect: qs[0].QuestionRect,
	})
	if err != nil {
		t.Fatalf("add: %v", err)
	}
	if restored.Position != 3 || restored.Status != store.QuestionReady {
		t.Fatalf("restored = position %d status %s", restored.Position, restored.Status)
	}
}

func questionSummaries(qs []store.HomeworkQuestion) string {
	var b strings.Builder
	for i := range qs {
		fmt.Fprintf(&b, "[%d] %s page %v | ", qs[i].Position, qs[i].Transcription, qs[i].Page)
	}
	return b.String()
}

func summary(qs []store.HomeworkQuestion) string { return questionSummaries(qs) }

func TestHomeworkPDFAndCrops(t *testing.T) {
	e, r, book := seedHomeworkEnv(t)
	ctx := context.Background()

	chat := startHwChat(t,
		`{"questions":[{"text":"What is a gavel?"}]}`,
		hwLocateReply, hwGuideReply("5.9 m/s²"))
	hwChatConfig(t, e, chat)

	due := "2026-10-03"
	hw, _, err := e.SubmitHomework(ctx, HomeworkCreate{
		BookSHA256: book.SHA256, Title: "Problem Set 4 — random walks", DueDate: &due, SourceText: hwSource,
	})
	if err != nil {
		t.Fatal(err)
	}
	runPendingTasks(t, r)
	qs := hwQuestions(t, e, hw.ID)
	if len(qs) != 1 || qs[0].QuestionRect == nil {
		t.Fatalf("outline = %+v", summary(qs))
	}

	// Question crops render as JPEGs.
	qimg, err := e.HomeworkQuestionImage(ctx, hw.ID, qs[0].ID, "question", 0)
	if err != nil {
		t.Fatalf("question image: %v", err)
	}
	if len(qimg) < 3 || string(qimg[:3]) != "\xff\xd8\xff" {
		t.Fatal("question image is not a JPEG")
	}
	dimg, err := e.HomeworkQuestionImage(ctx, hw.ID, qs[0].ID, "diagram", 0)
	if err != nil {
		t.Fatalf("diagram image: %v", err)
	}
	if len(dimg) == 0 {
		t.Fatal("empty diagram image")
	}
	if _, err := e.HomeworkQuestionImage(ctx, hw.ID, qs[0].ID, "diagram", 5); err == nil {
		t.Error("diagram index 5 accepted")
	}

	// The PDF renders the header band and the question, and pdftotext reads it.
	data, err := e.HomeworkPDF(ctx, hw.ID)
	if err != nil {
		t.Fatalf("pdf: %v", err)
	}
	if string(data[:8]) != "%PDF-1.4" {
		t.Fatalf("pdf header = %.8q", data[:8])
	}
	text := pdftotextOf(t, data)
	for _, want := range []string{"Problem Set 4", "random walks", "Due 2026-10-03", "Q1", "PSET"} {
		if !strings.Contains(text, want) {
			t.Errorf("pdf text lacks %q in:\n%.400s", want, text)
		}
	}

	// An empty homework refuses to print.
	empty, _, err := e.SubmitHomework(ctx, HomeworkCreate{BookSHA256: book.SHA256, SourceText: hwSource})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := e.HomeworkPDF(ctx, empty.ID); err == nil {
		t.Error("empty outline printed anyway")
	}
}

// pdftotextOf extracts the text layer; skipped without poppler (the ingest
// above already required it).
func pdftotextOf(t *testing.T, data []byte) string {
	t.Helper()
	return runPdftotext(t, data)
}

func TestHomeworkReadEndpoints(t *testing.T) {
	e, r, book := seedHomeworkEnv(t)
	ctx := context.Background()

	chat := startHwChat(t, `{"questions":[{"text":"What is a gavel?"}]}`, hwLocateReply, hwGuideReply("ok"))
	hwChatConfig(t, e, chat)

	hw, _, err := e.SubmitHomework(ctx, HomeworkCreate{BookSHA256: book.SHA256, SourceText: hwSource})
	if err != nil {
		t.Fatal(err)
	}
	runPendingTasks(t, r)

	refs, err := e.Homeworks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(refs) != 1 || refs[0].ID != hw.ID || refs[0].BookTitle == "" || refs[0].QuestionCount != 1 {
		t.Fatalf("homeworks = %+v", refs)
	}

	ref, questions, err := e.Homework(ctx, hw.ID)
	if err != nil {
		t.Fatal(err)
	}
	if ref.BookSHA256 != book.SHA256 || len(questions) != 1 {
		t.Fatalf("homework detail = %+v %d questions", ref, len(questions))
	}

	// Update: rename, set a due date, flip turned-in.
	due := "2026-10-03"
	updated, err := e.UpdateHomework(ctx, hw.ID, strptrEngine("Renamed"), &due, boolptrEngine(true), nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if updated.Title != "Renamed" || updated.DueDate == nil || *updated.DueDate != due || !updated.TurnedIn {
		t.Fatalf("updated = %+v", updated.Homework)
	}
	if _, err := e.UpdateHomework(ctx, hw.ID, strptrEngine("  "), nil, nil, nil, nil); err == nil {
		t.Error("blank title accepted")
	}

	// Remove returns the row for undo; move reorders.
	removed, err := e.RemoveQuestion(ctx, hw.ID, questions[0].ID)
	if err != nil {
		t.Fatal(err)
	}
	if removed.ID != questions[0].ID || !strings.Contains(removed.Transcription, "gavel") {
		t.Fatalf("removed = %+v", removed)
	}
	if qs := hwQuestions(t, e, hw.ID); len(qs) != 0 {
		t.Fatalf("outline after remove = %+v", summary(qs))
	}
}

func strptrEngine(s string) *string { return &s }
func boolptrEngine(b bool) *bool    { return &b }

// runPdftotext extracts the text layer of in-memory PDF bytes.
func runPdftotext(t *testing.T, data []byte) string {
	t.Helper()
	out := new(strings.Builder)
	cmd := exec.Command("pdftotext", "-layout", "-", "-")
	cmd.Stdin = bytes.NewReader(data)
	cmd.Stdout = out
	cmd.Stderr = new(strings.Builder)
	if err := cmd.Run(); err != nil {
		t.Fatalf("pdftotext: %v", err)
	}
	return out.String()
}

// TestHomeworkPDFHonorsPrintScales renders the sheet with both knobs off
// their defaults: the document must still compose and carry the header,
// proving the scale plumbing cannot break the layout.
func TestHomeworkPDFHonorsPrintScales(t *testing.T) {
	e, r, book := seedHomeworkEnv(t)

	chat := startHwChat(t,
		`{"questions":[{"text":"What is a gavel?"}]}`,
		hwLocateReply, hwGuideReply("5.9 m/s²"))
	hwChatConfig(t, e, chat)

	hw, _, err := e.SubmitHomework(context.Background(), HomeworkCreate{
		BookSHA256: book.SHA256, Title: "Scaled print", SourceText: hwSource,
	})
	if err != nil {
		t.Fatal(err)
	}
	runPendingTasks(t, r)

	// Scales live on the assignment, not in settings: patch them the way
	// the workspace's print controls do.
	sixty, oneFifty := 60, 150
	if _, err := e.UpdateHomework(context.Background(), hw.ID, nil, nil, nil, &sixty, &oneFifty); err != nil {
		t.Fatal(err)
	}

	data, err := e.HomeworkPDF(context.Background(), hw.ID)
	if err != nil {
		t.Fatalf("pdf: %v", err)
	}
	if string(data[:8]) != "%PDF-1.4" {
		t.Fatalf("pdf header = %.8q", data[:8])
	}
	text := pdftotextOf(t, data)
	if !strings.Contains(text, "Scaled print") {
		t.Errorf("pdf lost the title:\n%.200s", text)
	}
}

func TestHomeworkStandaloneQuestion(t *testing.T) {
	e, r, book := seedHomeworkEnv(t)
	ctx := context.Background()

	chat := startHwChat(t,
		`{"questions":[
			{"text":"What is a gavel?","hint":"Chapter 2","source":"book"},
			{"text":"In your own words, explain what a gavel is.","source":"standalone"}]}`,
		hwLocateReply, hwGuideReply("a² + b² = c²"),
		hwGuideReply("a gavel is a manufactured clap [p. 3]"))
	hwChatConfig(t, e, chat)

	hw, _, err := e.SubmitHomework(ctx, HomeworkCreate{
		BookSHA256: book.SHA256, Title: "Mixed PS", SourceText: hwSource,
	})
	if err != nil {
		t.Fatal(err)
	}
	runPendingTasks(t, r)

	// Exactly four model calls: extract; locate and guide for the book
	// question; and a guide alone for the standalone one — no locate for a
	// question that isn't in the book.
	if chat.count() != 4 {
		t.Fatalf("%d model calls, want 4", chat.count())
	}
	qs := hwQuestions(t, e, hw.ID)
	if len(qs) != 2 {
		t.Fatalf("%d questions, want 2", len(qs))
	}
	bookQ, standaloneQ := qs[0], qs[1]
	if bookQ.Standalone || bookQ.Page == nil || bookQ.QuestionRect == nil || bookQ.Status != store.QuestionReady {
		t.Fatalf("book question = %+v", bookQ)
	}
	if !standaloneQ.Standalone || standaloneQ.Page != nil || standaloneQ.QuestionRect != nil {
		t.Fatalf("standalone question pin = %+v", standaloneQ)
	}
	if standaloneQ.Status != store.QuestionReady || standaloneQ.Guide == nil || standaloneQ.Guide.Answer == "" {
		t.Fatalf("standalone question = %s guide %+v", standaloneQ.Status, standaloneQ.Guide)
	}

	// The standalone guide request carried the statement, the retrieval
	// context it may cite, and no page images.
	// Index 3: the standalone guide comes right after the book question's
	// locate and guide.
	guideReq := chat.request(3)
	guideText := guideReq.Messages[1].Content.Text()
	if !strings.Contains(guideText, "what a gavel is") {
		t.Errorf("standalone guide request lost the statement: %.80s", guideText)
	}
	if !strings.Contains(guideText, "Page 3:") {
		t.Errorf("standalone guide request lacks the retrieval context:\n%.300s", guideText)
	}
	if len(guideReq.Messages[1].Content.Parts()) != 0 {
		t.Errorf("standalone guide carried %d image parts, want none", len(guideReq.Messages[1].Content.Parts()))
	}
	if standaloneQ.Guide == nil || !strings.Contains(standaloneQ.Guide.Answer, "[p. 3]") {
		t.Errorf("standalone answer lost its grounded citation: %+v", standaloneQ.Guide)
	}

	// The printed sheet shows the standalone statement as text.
	// (The guide's citations stay in the walkthrough; the sheet prints only
	// the problem statement.)
	data, err := e.HomeworkPDF(ctx, hw.ID)
	if err != nil {
		t.Fatalf("pdf: %v", err)
	}
	if text := runPdftotext(t, data); !strings.Contains(text, "In your own words, explain what a gavel is") {
		t.Errorf("pdf lost the standalone question text:\n%.300s", text)
	}

	// Rewriting a standalone question makes no locate call: the stage that
	// was wrong is the only one that runs again.
	chat2 := startHwChat(t, "nope", "nope", hwGuideReply("recovered"))
	hwChatConfig(t, e, chat2)
	if _, err := e.RewriteQuestion(ctx, standaloneQ.ID, ""); err != nil {
		t.Fatalf("queue the rewrite: %v", err)
	}
	runPendingTasks(t, r)
	if qs := hwQuestions(t, e, hw.ID); qs[1].Status != store.QuestionFailed {
		t.Fatalf("after the failed rewrite = %s", qs[1].Status)
	}
	if _, err := e.RewriteQuestion(ctx, standaloneQ.ID, "keep it short"); err != nil {
		t.Fatalf("rewrite: %v", err)
	}
	runPendingTasks(t, r)
	if chat2.count() != 3 {
		t.Fatalf("rewrites made %d model calls, want 3 (bad guide, repair, good guide) and no locate", chat2.count())
	}
	if qs := hwQuestions(t, e, hw.ID); qs[1].Status != store.QuestionReady || qs[1].Guide.Answer != "recovered" {
		t.Fatalf("after the rewrite = %s", questionSummaries(qs))
	}
}

// TestEditQuestionTextStalesTheWalkthrough pins the invalidation rule:
// correcting a garbled transcription does not change which problem it is, so
// the location stands and only the walkthrough is marked out of date.
func TestEditQuestionTextStalesTheWalkthrough(t *testing.T) {
	e, r, book := seedHomeworkEnv(t)
	ctx := context.Background()

	chat := startHwChat(t,
		`{"questions":[{"text":"Evalute the intergal"}]}`,
		hwLocateReply, hwGuideReply("ok"))
	hwChatConfig(t, e, chat)

	hw, _, err := e.SubmitHomework(ctx, HomeworkCreate{BookSHA256: book.SHA256, SourceText: hwSource})
	if err != nil {
		t.Fatal(err)
	}
	runPendingTasks(t, r)

	qs := hwQuestions(t, e, hw.ID)
	if len(qs) != 1 || qs[0].Status != store.QuestionReady {
		t.Fatalf("setup = %s", questionSummaries(qs))
	}
	page := qs[0].Page

	before := chat.count()
	edited, err := e.EditQuestionText(ctx, qs[0].ID, "Evaluate the integral")
	if err != nil {
		t.Fatalf("edit: %v", err)
	}
	if chat.count() != before {
		t.Error("editing a question's text must not spend a model call")
	}
	if edited.Status != store.QuestionStale {
		t.Fatalf("status after the edit = %q, want stale", edited.Status)
	}
	if edited.Page == nil || page == nil || *edited.Page != *page {
		t.Fatalf("the edit moved the location: %v, want %v", edited.Page, page)
	}
	if edited.Guide == nil {
		t.Error("the old walkthrough must stay readable until it is rewritten")
	}
}

func TestPadRect(t *testing.T) {
	got := padRect(store.HomeworkRect{X: 0.5, Y: 0.4, W: 0.3, H: 0.2})
	if got.X >= 0.5 || got.Y >= 0.4 || got.W <= 0.3 || got.H <= 0.2 {
		t.Errorf("padRect grew nothing: %+v", got)
	}
	// A rect touching the page edges clamps instead of escaping it.
	got = padRect(store.HomeworkRect{X: 0, Y: 0, W: 1, H: 1})
	if got.X < 0 || got.Y < 0 || got.X+got.W > 1 || got.Y+got.H > 1 {
		t.Errorf("padRect escaped the page: %+v", got)
	}
}
