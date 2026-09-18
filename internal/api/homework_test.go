package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// --- fakes -----------------------------------------------------------------------

// hwChatFake scripts the non-streaming homework calls (extract, locate,
// guide, commands) in request order.
type hwChatFake struct {
	srv     *httptest.Server
	replies []string
	streams []hwStreamReply
}

func startHwChatFake(t *testing.T, replies ...string) *hwChatFake {
	t.Helper()
	f := &hwChatFake{replies: replies}
	f.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Stream bool `json:"stream"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		if req.Stream {
			writeStream(w, f.nextStream())
			return
		}
		reply := "ok"
		if len(f.replies) > 0 {
			reply = f.replies[0]
			f.replies = f.replies[1:]
		}
		w.Write([]byte(`{"choices":[{"message":{"content":` + mustJSONString(reply) + `}}]}`))
	}))
	t.Cleanup(f.srv.Close)
	return f
}

// hwStreamReply is one scripted streaming turn: prose chunks, then any tool
// calls the model asks for. The homework chat's fake plays these in order,
// so a tool round trip is two entries — the call, then the prose that uses
// its result.
type hwStreamReply struct {
	chunks []string
	tools  []hwToolCall
}

type hwToolCall struct {
	id, name, args string
}

// scriptStream installs the streaming turns; the last one repeats.
func (f *hwChatFake) scriptStream(replies ...hwStreamReply) {
	f.streams = replies
}

// nextStream pops the next scripted streaming turn, repeating the last.
func (f *hwChatFake) nextStream() hwStreamReply {
	if len(f.streams) == 0 {
		return hwStreamReply{chunks: []string{"ok"}}
	}
	next := f.streams[0]
	if len(f.streams) > 1 {
		f.streams = f.streams[1:]
	}
	return next
}

// writeStream serves one scripted turn in the provider's wire shape: content
// deltas, then tool-call fragments carrying their arguments.
func writeStream(w http.ResponseWriter, reply hwStreamReply) {
	w.Header().Set("Content-Type", "text/event-stream")
	for _, chunk := range reply.chunks {
		fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"content\":%s}}]}\n\n", mustJSONString(chunk))
	}
	for i, call := range reply.tools {
		fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":%d,\"id\":%s,\"function\":{\"name\":%s,\"arguments\":%s}}]}}]}\n\n",
			i, mustJSONString(call.id), mustJSONString(call.name), mustJSONString(call.args))
	}
	io.WriteString(w, "data: [DONE]\n\n")
}

// seedHomeworkEnv imports the sample, points chat at the fake, and returns
// the env plus the book sha.
func seedHomeworkEnv(t *testing.T, chat *hwChatFake) (*testEnv, string) {
	t.Helper()
	requirePoppler(t)
	env := newTestEnv(t)
	book := env.importSample("sample-digital.pdf")
	if !book.Ready {
		t.Fatalf("book = %+v, want ready after the import", book.Readiness)
	}
	rec := do(t, env.handler, "GET", "/api/books", nil)
	var books struct {
		Books []apiBook `json:"books"`
	}
	decode(t, rec, &books)
	sha := books.Books[0].SHA256

	rec = do(t, env.handler, "PUT", "/api/config", map[string]string{
		"apiBaseURL": chat.srv.URL, "apiKey": "k", "embedBaseURL": "",
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("config put: %d", rec.Code)
	}
	return env, sha
}

// waitQuestionsWritten polls until every question has settled. The
// assignment goes "ready" as soon as its outline exists — each question is
// then its own task, filling in one at a time — so a test that wants
// walkthroughs has to wait for the questions, not for the assignment.
func waitQuestionsWritten(t *testing.T, env *testEnv, id string) []map[string]any {
	t.Helper()
	deadline := time.Now().Add(20 * time.Second)
	for {
		rec := do(t, env.handler, "GET", "/api/homework/"+id, nil)
		var body struct {
			Questions []map[string]any `json:"questions"`
		}
		if rec.Code == http.StatusOK {
			decode(t, rec, &body)
			settled := len(body.Questions) > 0
			for _, q := range body.Questions {
				switch q["status"] {
				case "pending", "locating", "writing":
					settled = false
				}
			}
			if settled {
				return body.Questions
			}
		}
		if time.Now().After(deadline) {
			t.Fatalf("homework %s never finished its questions (last body %s)", id, rec.Body.String())
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// waitHomeworkReady polls until the assignment leaves generating.
func waitHomeworkReady(t *testing.T, env *testEnv, id string) map[string]any {
	t.Helper()
	deadline := time.Now().Add(15 * time.Second)
	for {
		rec := do(t, env.handler, "GET", "/api/homework/"+id, nil)
		if rec.Code == http.StatusOK {
			var body struct {
				Homework map[string]any `json:"homework"`
			}
			decode(t, rec, &body)
			if body.Homework["status"] == "ready" {
				return body.Homework
			}
		}
		if time.Now().After(deadline) {
			t.Fatalf("homework %s never became ready (last body %s)", id, rec.Body.String())
		}
		time.Sleep(10 * time.Millisecond)
	}
}

const hwAPILocate = `{"page": 3, "question_rect": {"x": 0.1, "y": 0.2, "w": 0.8, "h": 0.3}, "diagrams": []}`

// hwAPICheck is the self-check round that accepts a pin. Locating is two
// calls: the second reads the region that was chosen and confirms it is the
// problem that was asked for.
const hwAPICheck = `{"matches": true}`
const hwAPIGuide = `{"reading":{"given":["g"],"find":"f","figure":"fig"},"setup":"s [p. 3]","hints":["h"],"steps":["st"],"equations":[{"title":"t","tex":"x=1"}],"answer":"a"}`

// --- tests -------------------------------------------------------------------------

func TestHomeworkEndpoints(t *testing.T) {
	chat := startHwChatFake(t,
		`{"questions":[{"text":"What is a gavel?"}]}`,
		hwAPILocate, hwAPICheck, hwAPIGuide)
	env, sha := seedHomeworkEnv(t, chat)

	// Create: 202 with a homework job.
	rec := do(t, env.handler, "POST", "/api/homework", map[string]any{
		"bookSha256": sha, "title": "Problem Set 4", "dueDate": "2026-10-03",
		"sourceText": "Problem Set 4 — Chapter 2.\n1. What is a gavel?",
	})
	if rec.Code != http.StatusAccepted {
		t.Fatalf("create status = %d, body %s, want 202", rec.Code, rec.Body.String())
	}
	var created struct {
		Homework struct {
			ID         string `json:"id"`
			Title      string `json:"title"`
			Status     string `json:"status"`
			DueDate    string `json:"dueDate"`
			BookSHA256 string `json:"bookSha256"`
			BookTitle  string `json:"bookTitle"`
		} `json:"homework"`
		Task apiTask `json:"task"`
	}
	decode(t, rec, &created)
	hwID := created.Homework.ID
	if hwID == "" || created.Homework.Status != "generating" || created.Homework.DueDate != "2026-10-03" ||
		created.Homework.BookSHA256 != sha || created.Task.Kind != "homework" {
		t.Fatalf("created = %+v task %+v", created.Homework, created.Task)
	}

	// Create validation.
	if rec = do(t, env.handler, "POST", "/api/homework", map[string]any{"bookSha256": sha, "sourceText": "  "}); rec.Code != http.StatusBadRequest {
		t.Errorf("empty source: status = %d, want 400", rec.Code)
	}
	if rec = do(t, env.handler, "POST", "/api/homework", map[string]any{"nope": true}); rec.Code != http.StatusBadRequest {
		t.Errorf("unknown field: status = %d, want 400", rec.Code)
	}
	if rec = do(t, env.handler, "POST", "/api/homework", map[string]any{"bookSha256": "deadbeef00", "sourceText": "x"}); rec.Code != http.StatusNotFound {
		t.Errorf("unknown book: status = %d, want 404", rec.Code)
	}

	// Wait for the job to settle, then read the outline.
	hw := waitHomeworkReady(t, env, hwID)
	waitQuestionsWritten(t, env, hwID)
	if hw["title"] != "Problem Set 4" {
		t.Errorf("homework = %v", hw)
	}

	rec = do(t, env.handler, "GET", "/api/homework/"+hwID, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("get status = %d", rec.Code)
	}
	var detail struct {
		Homework  map[string]any `json:"homework"`
		Questions []struct {
			ID           string           `json:"id"`
			Position     int              `json:"position"`
			Page         int              `json:"page"`
			Status       string           `json:"status"`
			Standalone   bool             `json:"standalone"`
			QuestionRect map[string]any   `json:"questionRect"`
			Guide        map[string]any   `json:"guide"`
			Diagrams     []map[string]any `json:"diagrams"`
		} `json:"questions"`
	}
	decode(t, rec, &detail)
	if len(detail.Questions) != 1 {
		t.Fatalf("questions = %+v, want one", detail.Questions)
	}
	q := detail.Questions[0]
	if q.Status != "ready" || q.Page != 3 || q.QuestionRect == nil || q.Guide == nil {
		t.Fatalf("question = %+v", q)
	}
	if q.Standalone {
		t.Error("book question flagged standalone")
	}

	// The list carries counts and book identity.
	rec = do(t, env.handler, "GET", "/api/homework", nil)
	var list struct {
		Homeworks []struct {
			ID            string `json:"id"`
			QuestionCount int    `json:"questionCount"`
			BookTitle     string `json:"bookTitle"`
		} `json:"homeworks"`
	}
	decode(t, rec, &list)
	if len(list.Homeworks) != 1 || list.Homeworks[0].ID != hwID ||
		list.Homeworks[0].QuestionCount != 1 || list.Homeworks[0].BookTitle == "" {
		t.Fatalf("list = %+v", list.Homeworks)
	}

	// Patch: rename, clear due, mark turned in.
	rec = do(t, env.handler, "PATCH", "/api/homework/"+hwID,
		map[string]any{"title": "Renamed", "dueDate": "", "turnedIn": true})
	if rec.Code != http.StatusOK {
		t.Fatalf("patch status = %d, body %s", rec.Code, rec.Body.String())
	}
	var patched struct {
		Homework struct {
			Title         string `json:"title"`
			DueDate       string `json:"dueDate"`
			TurnedIn      bool   `json:"turnedIn"`
			QuestionScale int    `json:"questionScale"`
			FigureScale   int    `json:"figureScale"`
		} `json:"homework"`
	}
	decode(t, rec, &patched)
	if patched.Homework.Title != "Renamed" || patched.Homework.DueDate != "" || !patched.Homework.TurnedIn {
		t.Fatalf("patched = %+v", patched.Homework)
	}
	// Print scales patch and read back clamped.
	rec = do(t, env.handler, "PATCH", "/api/homework/"+hwID,
		map[string]any{"questionScale": 60, "figureScale": 150})
	if rec.Code != http.StatusOK {
		t.Fatalf("scale patch status = %d, body %s", rec.Code, rec.Body.String())
	}
	decode(t, rec, &patched)
	if patched.Homework.QuestionScale != 60 || patched.Homework.FigureScale != 150 {
		t.Fatalf("scales = %v/%v, want 60/150", patched.Homework.QuestionScale, patched.Homework.FigureScale)
	}
	rec = do(t, env.handler, "PATCH", "/api/homework/"+hwID,
		map[string]any{"questionScale": 9999, "figureScale": 1})
	decode(t, rec, &patched)
	if patched.Homework.QuestionScale != 100 || patched.Homework.FigureScale != 50 {
		t.Fatalf("clamped scales = %v/%v, want 100/50", patched.Homework.QuestionScale, patched.Homework.FigureScale)
	}
	if rec = do(t, env.handler, "PATCH", "/api/homework/"+hwID, map[string]any{"nope": 1}); rec.Code != http.StatusBadRequest {
		t.Errorf("unknown patch field: status = %d, want 400", rec.Code)
	}

	// Question image: a real JPEG crop.
	rec = do(t, env.handler, "GET", fmt.Sprintf("/api/homework/%s/questions/%s/image?variant=question", hwID, q.ID), nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("image status = %d, body %s", rec.Code, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); ct != "image/jpeg" {
		t.Errorf("image content-type = %q", ct)
	}
	if body := rec.Body.Bytes(); len(body) < 3 || string(body[:3]) != "\xff\xd8\xff" {
		t.Error("image is not a JPEG")
	}
	if rec = do(t, env.handler, "GET", fmt.Sprintf("/api/homework/%s/questions/%s/image?variant=diagram&n=0", hwID, q.ID), nil); rec.Code != http.StatusNotFound {
		t.Errorf("missing diagram: status = %d, want 404", rec.Code)
	}

	// PDF: the deterministic template.
	rec = do(t, env.handler, "GET", "/api/homework/"+hwID+"/pdf", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("pdf status = %d, body %s", rec.Code, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/pdf" {
		t.Errorf("pdf content-type = %q", ct)
	}
	if body := rec.Body.Bytes(); len(body) < 8 || string(body[:8]) != "%PDF-1.4" {
		t.Error("pdf body is not a PDF")
	}

	// The dedicated homework event stream is gone; progress lives on /api/events.
	if rec = do(t, env.handler, "GET", "/api/homework/"+hwID+"/events", nil); rec.Code != http.StatusNotFound {
		t.Errorf("homework events: status = %d, want 404", rec.Code)
	}

	// Delete question returns the row; recreate puts it back (undo).
	rec = do(t, env.handler, "DELETE", fmt.Sprintf("/api/homework/%s/questions/%s", hwID, q.ID), nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("question delete status = %d", rec.Code)
	}
	var removed struct {
		Question struct {
			ID            string         `json:"id"`
			Transcription string         `json:"transcription"`
			QuestionRect  map[string]any `json:"questionRect"`
			Guide         map[string]any `json:"guide"`
		} `json:"question"`
	}
	decode(t, rec, &removed)
	if removed.Question.ID != q.ID || removed.Question.QuestionRect == nil || removed.Question.Guide == nil {
		t.Fatalf("removed = %+v, want the full row for undo", removed.Question)
	}

	rec = do(t, env.handler, "POST", fmt.Sprintf("/api/homework/%s/questions", hwID), map[string]any{
		"transcription": removed.Question.Transcription,
		"page":          3,
		"questionRect":  removed.Question.QuestionRect,
		"guide":         removed.Question.Guide,
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("question create status = %d, body %s", rec.Code, rec.Body.String())
	}
	var added struct {
		Question struct {
			ID       string `json:"id"`
			Position int    `json:"position"`
			Status   string `json:"status"`
		} `json:"question"`
	}
	decode(t, rec, &added)
	if added.Question.Position != 1 || added.Question.Status != "ready" {
		t.Fatalf("added = %+v", added.Question)
	}

	// A standalone question round-trips through the create endpoint.
	rec = do(t, env.handler, "POST", fmt.Sprintf("/api/homework/%s/questions", hwID), map[string]any{
		"transcription": "Define entropy in your own words.",
		"standalone":    true,
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("standalone create status = %d, body %s", rec.Code, rec.Body.String())
	}
	var standaloneAdded struct {
		Question struct {
			ID         string `json:"id"`
			Standalone bool   `json:"standalone"`
			Page       *int   `json:"page"`
		} `json:"question"`
	}
	decode(t, rec, &standaloneAdded)
	if !standaloneAdded.Question.Standalone || standaloneAdded.Question.Page != nil {
		t.Fatalf("standalone question = %+v", standaloneAdded.Question)
	}
	if rec = do(t, env.handler, "DELETE",
		fmt.Sprintf("/api/homework/%s/questions/%s", hwID, standaloneAdded.Question.ID), nil); rec.Code != http.StatusOK {
		t.Errorf("standalone delete: status = %d", rec.Code)
	}

	// Move 1 → end.
	rec = do(t, env.handler, "PATCH", fmt.Sprintf("/api/homework/%s/questions/%s", hwID, added.Question.ID),
		map[string]any{"position": 1})
	if rec.Code != http.StatusOK {
		t.Fatalf("move status = %d, body %s", rec.Code, rec.Body.String())
	}
	if rec = do(t, env.handler, "PATCH", fmt.Sprintf("/api/homework/%s/questions/%s", hwID, added.Question.ID),
		map[string]any{"position": 99}); rec.Code != http.StatusOK {
		t.Errorf("clamped move: status = %d, want 200", rec.Code)
	}

	// Delete the homework.
	if rec = do(t, env.handler, "DELETE", "/api/homework/"+hwID, nil); rec.Code != http.StatusOK {
		t.Errorf("delete status = %d", rec.Code)
	}
	if rec = do(t, env.handler, "GET", "/api/homework/"+hwID, nil); rec.Code != http.StatusNotFound {
		t.Errorf("get after delete: status = %d, want 404", rec.Code)
	}
}

// seedTwoQuestionHomework creates a ready assignment with two located,
// written questions and returns its id and their ids in order.
func seedTwoQuestionHomework(t *testing.T, env *testEnv, chat *hwChatFake, sha string) (string, []string) {
	t.Helper()
	rec := do(t, env.handler, "POST", "/api/homework", map[string]any{
		"bookSha256": sha, "sourceText": "1. What is a gavel?\n2. call sign",
	})
	if rec.Code != http.StatusAccepted {
		t.Fatalf("create = %d, body %s", rec.Code, rec.Body.String())
	}
	var created struct {
		Homework struct {
			ID string `json:"id"`
		} `json:"homework"`
	}
	decode(t, rec, &created)
	hwID := created.Homework.ID
	waitHomeworkReady(t, env, hwID)
	waitQuestionsWritten(t, env, hwID)

	rec = do(t, env.handler, "GET", "/api/homework/"+hwID, nil)
	var detail struct {
		Questions []struct {
			ID string `json:"id"`
		} `json:"questions"`
	}
	decode(t, rec, &detail)
	ids := make([]string, 0, len(detail.Questions))
	for _, q := range detail.Questions {
		ids = append(ids, q.ID)
	}
	return hwID, ids
}

// TestHomeworkChatSSE pins the chat's wire contract: the event order of one
// turn that runs tools, the question row a pinned note pushes out, and the
// history the workspace restores itself from.
func TestHomeworkChatSSE(t *testing.T) {
	chat := startHwChatFake(t,
		`{"questions":[{"text":"What is a gavel?"},{"text":"call sign"}]}`,
		hwAPILocate, hwAPICheck, hwAPIGuide, hwAPILocate, hwAPICheck, hwAPIGuide)
	env, sha := seedHomeworkEnv(t, chat)
	hwID, qids := seedTwoQuestionHomework(t, env, chat, sha)

	// One turn: the model checks a number, pins the student's correction,
	// then answers in prose.
	chat.scriptStream(
		hwStreamReply{tools: []hwToolCall{
			{id: "c1", name: "calc", args: `{"expression":"7/3"}`},
			{id: "c2", name: "add_understanding_note", args: `{"note":"the 2A source points up"}`},
		}},
		hwStreamReply{chunks: []string{"Noted. ", "The walkthrough is out of date."}},
	)
	rec := do(t, env.handler, "POST", "/api/homework/"+hwID+"/chat",
		map[string]any{"message": "the 2A source points up", "questionId": qids[0]})
	if rec.Code != http.StatusOK {
		t.Fatalf("chat status = %d, body %s", rec.Code, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); ct != "text/event-stream" {
		t.Errorf("content type = %q, want text/event-stream", ct)
	}
	events := parseSSE(t, rec.Body.String())
	types := make([]string, len(events))
	for i, ev := range events {
		types[i] = ev.Type
	}
	// The splitter is line-buffered, so the two prose chunks of the final
	// round settle into one delta.
	want := []string{"meta", "tool-start", "tool-result", "tool-start", "question", "tool-result", "delta", "done"}
	if strings.Join(types, ",") != strings.Join(want, ",") {
		t.Fatalf("event types = %v,\nwant %v", types, want)
	}
	if events[0].ConversationID == "" || events[0].QuestionID != qids[0] {
		t.Errorf("meta = %+v, want the conversation and the active question", events[0])
	}
	if events[2].Tool != "calc" || !events[2].OK || !strings.HasPrefix(events[2].Summary, "7/3") {
		t.Errorf("calc card = %+v, want the exact fraction back", events[2])
	}
	if events[len(events)-1].MessageID == "" {
		t.Error("done carried no message id")
	}

	// The pinned note rode out on a question event and stuck to the row.
	var pinned struct {
		ID                 string `json:"id"`
		Status             string `json:"status"`
		UnderstandingNotes []struct {
			Note string `json:"note"`
		} `json:"understandingNotes"`
	}
	if err := json.Unmarshal(events[4].Question, &pinned); err != nil {
		t.Fatalf("decode question event: %v", err)
	}
	if pinned.ID != qids[0] || pinned.Status != "stale" || len(pinned.UnderstandingNotes) != 1 {
		t.Fatalf("question event = %+v, want Q1 stale with one note", pinned)
	}
	rec = do(t, env.handler, "GET", "/api/homework/"+hwID, nil)
	var detail struct {
		Questions []struct {
			Status             string `json:"status"`
			UnderstandingNotes []struct {
				Note string `json:"note"`
			} `json:"understandingNotes"`
		} `json:"questions"`
	}
	decode(t, rec, &detail)
	if detail.Questions[0].Status != "stale" || detail.Questions[0].UnderstandingNotes[0].Note != "the 2A source points up" {
		t.Fatalf("Q1 after the note = %+v", detail.Questions[0])
	}
	if detail.Questions[1].Status != "ready" {
		t.Errorf("Q2 was disturbed: %+v", detail.Questions[1])
	}

	// History restores the whole turn, tool cards and all, and remembers
	// which question each message was about.
	rec = do(t, env.handler, "GET", "/api/homework/"+hwID+"/chat", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("history status = %d", rec.Code)
	}
	var history struct {
		Conversation *struct {
			ID string `json:"id"`
		} `json:"conversation"`
		Messages []struct {
			Role       string `json:"role"`
			Content    string `json:"content"`
			QuestionID string `json:"questionId"`
			Segments   []struct {
				Type string `json:"type"`
				Kind string `json:"kind"`
				Text string `json:"text"`
			} `json:"segments"`
		} `json:"messages"`
	}
	decode(t, rec, &history)
	if history.Conversation == nil || history.Conversation.ID != events[0].ConversationID {
		t.Fatalf("history conversation = %+v, want the one the stream named", history.Conversation)
	}
	if len(history.Messages) != 2 {
		t.Fatalf("%d history messages, want the turn's two", len(history.Messages))
	}
	if history.Messages[0].Role != "user" || history.Messages[0].QuestionID != qids[0] {
		t.Errorf("user message = %+v, want it anchored to Q1", history.Messages[0])
	}
	kinds := make([]string, 0, len(history.Messages[1].Segments))
	for _, seg := range history.Messages[1].Segments {
		kinds = append(kinds, seg.Type+":"+seg.Kind)
	}
	if strings.Join(kinds, ",") != "tool:calc,tool:add_understanding_note,prose:" {
		t.Fatalf("assistant segments = %v, want the cards then the prose", kinds)
	}

	// The chat is one conversation per assignment, and it is not an ask
	// thread: the ask history rail never lists it.
	rec = do(t, env.handler, "POST", "/api/homework/"+hwID+"/chat", map[string]any{"message": "and now?"})
	if rec.Code != http.StatusOK {
		t.Fatalf("second turn = %d, body %s", rec.Code, rec.Body.String())
	}
	second := parseSSE(t, rec.Body.String())
	if second[0].ConversationID != events[0].ConversationID {
		t.Errorf("second turn opened a new conversation %q", second[0].ConversationID)
	}
	rec = do(t, env.handler, "GET", "/api/conversations", nil)
	var rail struct {
		Conversations []struct {
			ID string `json:"id"`
		} `json:"conversations"`
	}
	decode(t, rec, &rail)
	for _, c := range rail.Conversations {
		if c.ID == events[0].ConversationID {
			t.Fatalf("the homework chat is listed as an ask thread: %+v", rail.Conversations)
		}
	}

	// Guards.
	if rec = do(t, env.handler, "POST", "/api/homework/"+hwID+"/chat", map[string]any{"message": " "}); rec.Code != http.StatusBadRequest {
		t.Errorf("empty message: status = %d, want 400", rec.Code)
	}
	if rec = do(t, env.handler, "POST", "/api/homework/nope/chat", map[string]any{"message": "hi"}); rec.Code != http.StatusNotFound {
		t.Errorf("unknown homework: status = %d, want 404", rec.Code)
	}
	if rec = do(t, env.handler, "GET", "/api/homework/nope/chat", nil); rec.Code != http.StatusNotFound {
		t.Errorf("unknown homework history: status = %d, want 404", rec.Code)
	}
}

// TestHomeworkChatHistoryEmpty: an assignment nobody has chatted about has a
// chat, it is simply empty — the workspace must not have to treat that as an
// error on first load.
func TestHomeworkChatHistoryEmpty(t *testing.T) {
	chat := startHwChatFake(t,
		`{"questions":[{"text":"What is a gavel?"}]}`, hwAPILocate, hwAPICheck, hwAPIGuide)
	env, sha := seedHomeworkEnv(t, chat)
	rec := do(t, env.handler, "POST", "/api/homework", map[string]any{
		"bookSha256": sha, "sourceText": "1. What is a gavel?",
	})
	var created struct {
		Homework struct {
			ID string `json:"id"`
		} `json:"homework"`
	}
	decode(t, rec, &created)
	waitHomeworkReady(t, env, created.Homework.ID)
	waitQuestionsWritten(t, env, created.Homework.ID)

	rec = do(t, env.handler, "GET", "/api/homework/"+created.Homework.ID+"/chat", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body.String())
	}
	var body struct {
		Conversation *json.RawMessage  `json:"conversation"`
		Messages     []json.RawMessage `json:"messages"`
	}
	decode(t, rec, &body)
	if body.Conversation != nil && string(*body.Conversation) != "null" {
		t.Errorf("conversation = %s, want null before the first message", *body.Conversation)
	}
	if len(body.Messages) != 0 {
		t.Errorf("%d messages, want none", len(body.Messages))
	}
}

func TestHomeworkQuestionRepair(t *testing.T) {
	chat := startHwChatFake(t,
		`{"questions":[{"text":"What is a gavel?"},{"text":"call sign"}]}`,
		hwAPILocate, hwAPICheck, hwAPIGuide,
		`{"page": 0}`)
	env, sha := seedHomeworkEnv(t, chat)

	rec := do(t, env.handler, "POST", "/api/homework", map[string]any{
		"bookSha256": sha, "sourceText": "1. What is a gavel?\n2. call sign",
	})
	var created struct {
		Homework struct {
			ID string `json:"id"`
		} `json:"homework"`
		Task apiTask `json:"task"`
	}
	decode(t, rec, &created)
	hwID := created.Homework.ID
	waitHomeworkReady(t, env, hwID)
	waitQuestionsWritten(t, env, hwID)

	rec = do(t, env.handler, "GET", "/api/homework/"+hwID, nil)
	var detail struct {
		Questions []struct {
			ID     string `json:"id"`
			Status string `json:"status"`
			Error  string `json:"error"`
		} `json:"questions"`
	}
	decode(t, rec, &detail)
	if detail.Questions[0].Status != "ready" || detail.Questions[1].Status != "failed" {
		t.Fatalf("statuses = %+v", detail.Questions)
	}
	failedID := detail.Questions[1].ID

	// The assignment's own task only reads and fans out; the walkthroughs
	// are its questions' tasks, one each.
	task := env.getTask(created.Task.ID)
	if task.Status != "done" {
		t.Fatalf("task = %q/%v, want done despite one broken question", task.Status, task.Error)
	}
	keys := make([]string, 0, len(task.Phases))
	for _, ph := range task.Phases {
		keys = append(keys, ph.Key)
	}
	if strings.Join(keys, ",") != "extract,queue" {
		t.Fatalf("assignment phases = %v, want [extract queue]", keys)
	}
	if queued := task.phase(t, "queue"); queued.Status != "done" || queued.Done != 2 {
		t.Fatalf("queue phase = %q %d/%d, want done 2/2", queued.Status, queued.Done, queued.Total)
	}
	// One task per question, each with the phases it actually ran.
	questionTasks := 0
	for _, tk := range env.tasks() {
		if tk.Kind == "question" {
			questionTasks++
		}
	}
	if questionTasks != 2 {
		t.Fatalf("%d question tasks, want one per question", questionTasks)
	}

	// Repair is scoped to the stage that was wrong, and it is a task: it
	// survives the page that asked for it, and it is stoppable and
	// retryable like anything else. A silent JSON POST here was the Q3 bug.
	if rec = do(t, env.handler, "POST", "/api/homework/"+hwID+"/questions/nope/relocate", map[string]any{}); rec.Code == http.StatusOK {
		t.Error("relocating an unknown question must not succeed")
	}
	chat.replies = []string{hwAPILocate, hwAPICheck, hwAPIGuide}
	rec = do(t, env.handler, "POST", "/api/homework/"+hwID+"/questions/"+failedID+"/relocate",
		map[string]any{"page": 3, "note": "it is in chapter 2"})
	if rec.Code != http.StatusAccepted {
		t.Fatalf("relocate status = %d, body %s", rec.Code, rec.Body.String())
	}
	var queuedRepair struct {
		Task     apiTask `json:"task"`
		Question struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		} `json:"question"`
	}
	decode(t, rec, &queuedRepair)
	if queuedRepair.Task.Kind != "question" {
		t.Fatalf("relocate answered with %+v, want a question task", queuedRepair.Task)
	}
	// The row is marked the moment the task is queued, so the outline never
	// looks idle between the click and the runner picking it up. Which of
	// the working states it is by the time the response is written is a
	// race with the runner, and not the point.
	if queuedRepair.Question.ID != failedID {
		t.Fatalf("relocate answered about %s, want %s", queuedRepair.Question.ID, failedID)
	}
	switch queuedRepair.Question.Status {
	case "pending", "locating", "writing":
	default:
		t.Fatalf("relocate question = %+v, want it showing as working", queuedRepair.Question)
	}

	written := waitQuestionsWritten(t, env, hwID)
	if written[1]["status"] != "ready" {
		t.Fatalf("after the relocate = %+v", written[1])
	}
	if written[0]["status"] != "ready" {
		t.Fatalf("scoped repair disturbed the healthy question: %+v", written[0])
	}
	if page, _ := written[1]["page"].(float64); int(page) != 3 {
		t.Errorf("relocated question page = %v, want the page the student named", written[1]["page"])
	}

	// Rewriting is the same shape, and skips the search: the question is
	// already in the right place.
	chat.replies = []string{hwAPIGuide}
	rec = do(t, env.handler, "POST", "/api/homework/"+hwID+"/questions/"+failedID+"/rewrite",
		map[string]any{"note": "use the free-body diagram"})
	if rec.Code != http.StatusAccepted {
		t.Fatalf("rewrite status = %d, body %s", rec.Code, rec.Body.String())
	}
	decode(t, rec, &queuedRepair)
	rewriteTask := env.getTask(queuedRepair.Task.ID)
	rkeys := make([]string, 0, len(rewriteTask.Phases))
	for _, ph := range rewriteTask.Phases {
		rkeys = append(rkeys, ph.Key)
	}
	if strings.Join(rkeys, ",") != "guide" {
		t.Fatalf("rewrite phases = %v, want the guide alone", rkeys)
	}
	waitQuestionsWritten(t, env, hwID)

	// A rewrite whose model output never parses fails that question's task
	// and says so on the question's own row — where the repair doors are.
	chat.replies = []string{`not json at all`, `still not json`}
	rec = do(t, env.handler, "POST", "/api/homework/"+hwID+"/questions/"+failedID+"/rewrite", map[string]any{})
	if rec.Code != http.StatusAccepted {
		t.Fatalf("rewrite status = %d, body %s", rec.Code, rec.Body.String())
	}
	decode(t, rec, &queuedRepair)
	broken := waitQuestionsWritten(t, env, hwID)
	if broken[1]["status"] != "failed" {
		t.Fatalf("after the bad rewrite = %+v, want failed", broken[1])
	}
	failedTask := env.getTask(queuedRepair.Task.ID)
	if failedTask.Status != "failed" || failedTask.Error == nil || *failedTask.Error == "" {
		t.Fatalf("rewrite task = %q, want a failed task carrying the reason", failedTask.Status)
	}
}
