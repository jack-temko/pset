package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"slices"
	"strings"
	"testing"
	"time"
)

// --- settings ------------------------------------------------------------------

func TestConfigEndpoint(t *testing.T) {
	env := newTestEnv(t)

	t.Run("defaults without a key", func(t *testing.T) {
		rec := do(t, env.handler, "GET", "/api/config", nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}
		var body map[string]any
		decode(t, rec, &body)
		if body["apiBaseURL"] == "" || body["embedBaseURL"] == "" || body["embedModel"] == "" {
			t.Errorf("config = %v, want default endpoints", body)
		}
		if body["hasAPIKey"] != false {
			t.Errorf("hasAPIKey = %v, want false", body["hasAPIKey"])
		}
		if _, ok := body["apiKey"]; ok {
			t.Errorf("config %v leaks the apiKey field", body)
		}
	})

	t.Run("put stores the key and is redacted on read", func(t *testing.T) {
		rec := do(t, env.handler, "PUT", "/api/config", map[string]string{
			"apiKey":     "sk-test-123",
			"embedModel": "nomic-embed-text",
		})
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, body %s, want 200", rec.Code, rec.Body.String())
		}
		var body map[string]any
		decode(t, rec, &body)
		if body["hasAPIKey"] != true {
			t.Errorf("hasAPIKey = %v, want true", body["hasAPIKey"])
		}
		if _, ok := body["apiKey"]; ok {
			t.Errorf("PUT response %v leaks the key", body)
		}

		rec = do(t, env.handler, "GET", "/api/config", nil)
		decode(t, rec, &body)
		if body["hasAPIKey"] != true {
			t.Errorf("hasAPIKey after save = %v, want true", body["hasAPIKey"])
		}
	})

	t.Run("an empty apiKey keeps the saved one", func(t *testing.T) {
		rec := do(t, env.handler, "PUT", "/api/config", map[string]string{"apiKey": ""})
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}
		var body map[string]any
		decode(t, rec, &body)
		if body["hasAPIKey"] != true {
			t.Errorf("hasAPIKey = %v, want still true", body["hasAPIKey"])
		}
	})

	t.Run("other fields overwrite", func(t *testing.T) {
		rec := do(t, env.handler, "PUT", "/api/config", map[string]string{"embedModel": "other-model"})
		decode(t, rec, &map[string]any{})
		rec = do(t, env.handler, "GET", "/api/config", nil)
		var body map[string]any
		decode(t, rec, &body)
		if body["embedModel"] != "other-model" {
			t.Errorf("embedModel = %v, want other-model", body["embedModel"])
		}
	})

	t.Run("invalid body", func(t *testing.T) {
		if rec := doRaw(t, env.handler, "PUT", "/api/config", "{nope"); rec.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want 400", rec.Code)
		}
	})
}

func TestConfigTestEndpoint(t *testing.T) {
	env := newTestEnv(t)

	chatOK := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]any
		json.NewDecoder(r.Body).Decode(&req)
		if req["stream"] == true {
			w.Header().Set("Content-Type", "text/event-stream")
			io.WriteString(w, "data: {\"choices\":[{\"delta\":{\"content\":\"ok\"}}]}\n\n")
			io.WriteString(w, "data: [DONE]\n\n")
			return
		}
		w.Write([]byte(`{"choices":[{"message":{"content":"ok"}}]}`))
	}))
	defer chatOK.Close()
	embedOK := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"data":[{"index":0,"embedding":[0.1,0.2]}]}`))
	}))
	defer embedOK.Close()

	// The probe accepts inline overrides, so no save is needed.
	body := map[string]any{
		"apiBaseURL":   chatOK.URL,
		"apiKey":       "k",
		"embedBaseURL": embedOK.URL,
		"embedModel":   "m",
	}
	rec := do(t, env.handler, "POST", "/api/config/test", body)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s, want 200", rec.Code, rec.Body.String())
	}
	var probe struct {
		OK    bool           `json:"ok"`
		Chat  probeJSONCheck `json:"chat"`
		Embed probeJSONCheck `json:"embed"`
	}
	decode(t, rec, &probe)
	if !probe.OK || !probe.Chat.OK || !probe.Embed.OK {
		t.Fatalf("probe = %+v, want both endpoints ok", probe)
	}

	// A dead chat endpoint fails only its own half.
	body["apiBaseURL"] = "http://127.0.0.1:1"
	rec = do(t, env.handler, "POST", "/api/config/test", body)
	decode(t, rec, &probe)
	if probe.OK || probe.Chat.OK {
		t.Errorf("probe with a dead chat endpoint = %+v, want chat failure", probe)
	}
	if !probe.Embed.OK {
		t.Errorf("embed = %+v, want ok", probe.Embed)
	}

	// Without overrides the saved settings are tested; a fresh env has no
	// key, so the chat half fails without touching the network.
	rec = do(t, env.handler, "POST", "/api/config/test", nil)
	decode(t, rec, &probe)
	if probe.Chat.OK {
		t.Errorf("saved-settings probe = %+v, want the missing key to fail chat", probe)
	}
	if rec := do(t, env.handler, "POST", "/api/config/test", map[string]string{"nope": "x"}); rec.Code != http.StatusBadRequest {
		t.Errorf("unknown fields: status = %d, want 400", rec.Code)
	}
}

type probeJSONCheck struct {
	OK     bool   `json:"ok"`
	Detail string `json:"detail"`
}

// --- ask (SSE) -------------------------------------------------------------------

type sseEvent struct {
	Type           string          `json:"type"`
	ConversationID string          `json:"conversationId"`
	Pages          []int           `json:"pages"`
	Warnings       []string        `json:"warnings"`
	Text           string          `json:"text"`
	Kind           string          `json:"kind"`
	Payload        json.RawMessage `json:"payload"`
	Raw            string          `json:"raw"`
	MessageID      string          `json:"messageId"`
	Error          string          `json:"error"`
	Stage          string          `json:"stage"`
	Note           string          `json:"note"`
	QuestionID     string          `json:"questionId"`
	ID             string          `json:"id"`
	Tool           string          `json:"tool"`
	Args           json.RawMessage `json:"args"`
	OK             bool            `json:"ok"`
	Summary        string          `json:"summary"`
	Question       json.RawMessage `json:"question"`
}

// parseSSE splits a recorded body into its data events.
func parseSSE(t *testing.T, body string) []sseEvent {
	t.Helper()
	var out []sseEvent
	for _, chunk := range strings.Split(body, "\n\n") {
		chunk = strings.TrimSpace(chunk)
		if chunk == "" {
			continue
		}
		if !strings.HasPrefix(chunk, "data: ") {
			t.Fatalf("event %q is not a data line", chunk)
		}
		var ev sseEvent
		if err := json.Unmarshal([]byte(strings.TrimPrefix(chunk, "data: ")), &ev); err != nil {
			t.Fatalf("decode event %q: %v", chunk, err)
		}
		out = append(out, ev)
	}
	return out
}

// streamingChatFake serves an OpenAI-shaped streaming endpoint. fail makes
// every request answer 500.
func streamingChatFake(t *testing.T, chunks []string, fail bool) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if fail {
			w.WriteHeader(http.StatusInternalServerError)
			io.WriteString(w, `{"error":"model exploded"}`)
			return
		}
		var req struct {
			Stream   bool `json:"stream"`
			Messages []struct {
				Role    string `json:"role"`
				Content any    `json:"content"`
			} `json:"messages"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		if !req.Stream {
			w.Write([]byte(`{"choices":[{"message":{"content":"ok"}}]}`))
			return
		}
		// The ask must attach page images and page text.
		raw, _ := json.Marshal(req.Messages)
		if !strings.Contains(string(raw), "image_url") || !strings.Contains(string(raw), "data:image/jpeg;base64,") {
			t.Errorf("request carried no page images: %s", raw)
		}
		if !strings.Contains(string(raw), "Table of contents:") {
			t.Errorf("request carried no TOC: %s", raw)
		}
		w.Header().Set("Content-Type", "text/event-stream")
		for _, chunk := range chunks {
			fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"content\":%s}}]}\n\n", mustJSONString(chunk))
		}
		io.WriteString(w, "data: [DONE]\n\n")
	}))
	t.Cleanup(srv.Close)
	return srv
}

func mustJSONString(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}

// seedAskEnv imports the digital sample and points the chat settings at a
// fake endpoint, returning the resolved book sha.
func seedAskEnv(t *testing.T, chat *httptest.Server) (env *testEnv, sha string) {
	t.Helper()
	env = newTestEnv(t)
	requirePoppler(t)
	book := env.importSample("sample-digital.pdf")
	if !book.Ready {
		t.Fatalf("book = %+v, want ready after the import", book.Readiness)
	}
	rec := do(t, env.handler, "GET", "/api/books", nil)
	var books struct {
		Books []apiBook `json:"books"`
	}
	decode(t, rec, &books)
	sha = books.Books[0].SHA256

	rec = do(t, env.handler, "PUT", "/api/config", map[string]string{
		"apiBaseURL":   chat.URL,
		"apiKey":       "test-key",
		"embedBaseURL": fakeEmbedServer(t),
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("config put: status = %d", rec.Code)
	}
	return env, sha
}

func TestAskSSE(t *testing.T) {
	chat := streamingChatFake(t, []string{"A gavel is a manufactured clap, ", "see [p. 3]."}, false)
	env, sha := seedAskEnv(t, chat)

	rec := do(t, env.handler, "POST", "/api/books/"+sha[:8]+"/ask",
		map[string]any{"question": "What is a gavel?", "conversationId": nil})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s, want 200", rec.Code, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); ct != "text/event-stream" {
		t.Errorf("content-type = %q, want text/event-stream", ct)
	}
	if cc := rec.Header().Get("Cache-Control"); cc != "no-cache" {
		t.Errorf("cache-control = %q, want no-cache", cc)
	}

	events := parseSSE(t, rec.Body.String())
	if len(events) < 3 {
		t.Fatalf("%d events, want meta + deltas + done: %+v", len(events), events)
	}
	meta := events[0]
	if meta.Type != "meta" || meta.ConversationID == "" {
		t.Fatalf("first event = %+v, want meta with a conversation id", meta)
	}
	if len(meta.Pages) == 0 || meta.Pages[0] != 3 {
		t.Errorf("meta pages = %v, want page 3 (the gavel fact) first", meta.Pages)
	}
	if len(meta.Warnings) != 0 {
		t.Errorf("meta warnings = %v, want none", meta.Warnings)
	}
	last := events[len(events)-1]
	if last.Type != "done" || last.MessageID == "" {
		t.Fatalf("last event = %+v, want done with a message id", last)
	}

	var text strings.Builder
	for _, ev := range events[1 : len(events)-1] {
		if ev.Type != "delta" {
			t.Fatalf("middle event = %+v, want deltas", ev)
		}
		text.WriteString(ev.Text)
	}
	if text.String() != "A gavel is a manufactured clap, see [p. 3]." {
		t.Errorf("assembled text = %q", text.String())
	}

	// The exchange is persisted in a titled conversation.
	rec = do(t, env.handler, "GET", "/api/books/"+sha[:8]+"/conversations", nil)
	var list struct {
		Conversations []struct {
			ID           string `json:"id"`
			Title        string `json:"title"`
			MessageCount int    `json:"messageCount"`
		} `json:"conversations"`
	}
	decode(t, rec, &list)
	if len(list.Conversations) != 1 {
		t.Fatalf("conversations = %+v, want one", list)
	}
	conv := list.Conversations[0]
	if conv.Title != "What is a gavel?" || conv.MessageCount != 2 {
		t.Errorf("conversation = %+v, want the question as title with 2 messages", conv)
	}

	rec = do(t, env.handler, "GET", "/api/books/"+sha[:8]+"/conversations/"+conv.ID, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("conversation status = %d, want 200", rec.Code)
	}
	var detail struct {
		Conversation struct {
			ID string `json:"id"`
		} `json:"conversation"`
		Messages []struct {
			Role      string `json:"role"`
			Content   string `json:"content"`
			Citations []int  `json:"citations"`
		} `json:"messages"`
	}
	decode(t, rec, &detail)
	if detail.Conversation.ID != conv.ID || len(detail.Messages) != 2 {
		t.Fatalf("detail = %+v, want the conversation with both messages", detail)
	}
	if detail.Messages[0].Role != "user" || detail.Messages[0].Content != "What is a gavel?" {
		t.Errorf("user message = %+v", detail.Messages[0])
	}
	// Citations are no longer extracted from prose: the pages a thread
	// consulted come from retrieval and the tool calls, and the prose says
	// (p. 3) as prose. New messages store none.
	if detail.Messages[1].Role != "assistant" || len(detail.Messages[1].Citations) != 0 {
		t.Errorf("assistant message = %+v, want no stored citations", detail.Messages[1])
	}

	t.Run("delete removes the thread", func(t *testing.T) {
		rec := do(t, env.handler, "DELETE", "/api/books/"+sha[:8]+"/conversations/"+conv.ID, nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("delete status = %d, want 200", rec.Code)
		}
		if rec = do(t, env.handler, "GET", "/api/books/"+sha[:8]+"/conversations/"+conv.ID, nil); rec.Code != http.StatusNotFound {
			t.Errorf("get after delete: status = %d, want 404", rec.Code)
		}
		if rec = do(t, env.handler, "DELETE", "/api/books/"+sha[:8]+"/conversations/"+conv.ID, nil); rec.Code != http.StatusNotFound {
			t.Errorf("delete again: status = %d, want 404", rec.Code)
		}
	})
}

// TestAskSSEEnvelopeEvents pins the typed envelope wire contract: the event
// sequence for a valid envelope and the segment list the messages endpoint
// returns.
// TestAskPageWire pins the page anchor on the wire: a positive page reaches
// the engine (the anchored page leads the meta pages), a negative one is
// refused before the stream, and a bad type is a JSON-level 400.
func TestAskPageWire(t *testing.T) {
	chat := streamingChatFake(t, []string{"An answer [p. 3]."}, false)
	env, sha := seedAskEnv(t, chat)

	// A page the reader was on leads the context even when retrieval ranks
	// it lower than the gavel page.
	rec := do(t, env.handler, "POST", "/api/books/"+sha[:8]+"/ask",
		map[string]any{"question": "What is a gavel?", "page": 6})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s, want 200", rec.Code, rec.Body.String())
	}
	events := parseSSE(t, rec.Body.String())
	if len(events) == 0 || events[0].Type != "meta" {
		t.Fatalf("first event = %+v, want meta", events)
	}
	if len(events[0].Pages) == 0 || events[0].Pages[0] != 6 {
		t.Errorf("meta pages = %v, want the anchored page 6 first", events[0].Pages)
	}

	// A negative page is refused before anything streams.
	rec = do(t, env.handler, "POST", "/api/books/"+sha[:8]+"/ask",
		map[string]any{"question": "hi", "page": -2})
	if rec.Code != http.StatusBadRequest {
		t.Errorf("negative page: status = %d, want 400", rec.Code)
	}
	if rec = doRaw(t, env.handler, "POST", "/api/books/"+sha[:8]+"/ask", `{"question":"hi","page":"six"}`); rec.Code != http.StatusBadRequest {
		t.Errorf("page as string: status = %d, want 400", rec.Code)
	}
}

func TestAskSSEEnvelopeEvents(t *testing.T) {
	chat := streamingChatFake(t, []string{
		"Bayes' theorem [p. 3].\n",
		"```equation\n",
		`{"title":"Bayes","equations":["P(A\\mid B) = 1"],"note":"see [p. 12]"}` + "\n",
		"```\n",
		"Done [p. 4].",
	}, false)
	env, sha := seedAskEnv(t, chat)

	rec := do(t, env.handler, "POST", "/api/books/"+sha[:8]+"/ask",
		map[string]any{"question": "What is Bayes' theorem?", "conversationId": nil})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s, want 200", rec.Code, rec.Body.String())
	}
	events := parseSSE(t, rec.Body.String())
	want := []string{"meta", "delta", "envelope-start", "envelope", "delta", "done"}
	if len(events) != len(want) {
		t.Fatalf("%d events, want %v: %+v", len(events), want, events)
	}
	for i := range want {
		if events[i].Type != want[i] {
			t.Fatalf("event %d = %q, want %q", i, events[i].Type, want[i])
		}
	}
	if events[1].Text != "Bayes' theorem [p. 3].\n" {
		t.Errorf("delta = %q", events[1].Text)
	}
	if events[2].Kind != "equation" {
		t.Errorf("envelope-start kind = %q", events[2].Kind)
	}
	var payload map[string]any
	if err := json.Unmarshal(events[3].Payload, &payload); err != nil {
		t.Fatalf("envelope payload %s: %v", events[3].Payload, err)
	}
	if events[3].Kind != "equation" || payload["title"] != "Bayes" {
		t.Errorf("envelope event = %q %s", events[3].Kind, events[3].Payload)
	}
	if events[4].Text != "Done [p. 4]." {
		t.Errorf("last delta = %q", events[4].Text)
	}
	if events[5].MessageID == "" {
		t.Error("done carries no message id")
	}

	// The messages endpoint returns the ordered segment list.
	convID := events[0].ConversationID
	rec = do(t, env.handler, "GET", "/api/conversations/"+convID, nil)
	var detail struct {
		Messages []struct {
			Role     string `json:"role"`
			Content  string `json:"content"`
			Segments []struct {
				Type    string          `json:"type"`
				Text    string          `json:"text"`
				Kind    string          `json:"kind"`
				Payload json.RawMessage `json:"payload"`
			} `json:"segments"`
			Citations []int `json:"citations"`
		} `json:"messages"`
	}
	decode(t, rec, &detail)
	if len(detail.Messages) != 2 {
		t.Fatalf("%d messages, want 2", len(detail.Messages))
	}
	segs := detail.Messages[1].Segments
	if len(segs) != 3 || segs[0].Type != "prose" || segs[0].Text != "Bayes' theorem [p. 3].\n" ||
		segs[1].Type != "envelope" || segs[1].Kind != "equation" ||
		segs[2].Type != "prose" || segs[2].Text != "Done [p. 4]." {
		t.Fatalf("segments = %+v", segs)
	}
	var stored map[string]any
	if err := json.Unmarshal(segs[1].Payload, &stored); err != nil {
		t.Fatalf("stored payload %s: %v", segs[1].Payload, err)
	}
	if stored["title"] != "Bayes" {
		t.Errorf("stored payload = %s", segs[1].Payload)
	}
	if len(detail.Messages[1].Citations) != 0 {
		t.Errorf("citations = %v, want none stored", detail.Messages[1].Citations)
	}
}

// TestAskSSEEnvelopeFailed pins the degrade wire contract: an unrepairable
// payload surfaces as envelope-repairing then envelope-failed, the ask still
// completes, and the stored answer keeps the raw text as a code segment.
func TestAskSSEEnvelopeFailed(t *testing.T) {
	chat := streamingChatFake(t, []string{
		"Careful.\n",
		"```note\n",
		`{"title":"X","body":[]}` + "\n",
		"```\n",
	}, false)
	env, sha := seedAskEnv(t, chat)

	rec := do(t, env.handler, "POST", "/api/books/"+sha[:8]+"/ask",
		map[string]any{"question": "What is a gavel?", "conversationId": nil})
	events := parseSSE(t, rec.Body.String())
	want := []string{"meta", "delta", "envelope-start", "envelope-repairing", "envelope-failed", "done"}
	if len(events) != len(want) {
		t.Fatalf("%d events, want %v: %+v", len(events), want, events)
	}
	for i := range want {
		if events[i].Type != want[i] {
			t.Fatalf("event %d = %q, want %q", i, events[i].Type, want[i])
		}
	}
	if events[2].Kind != "note" {
		t.Errorf("envelope-start kind = %q, want note", events[2].Kind)
	}
	if events[3].Kind != "note" {
		t.Errorf("envelope-repairing kind = %q, want note", events[3].Kind)
	}
	if events[4].Kind != "note" || events[4].Raw != `{"title":"X","body":[]}` {
		t.Errorf("envelope-failed = %q %q, want the raw payload", events[4].Kind, events[4].Raw)
	}
	if events[5].MessageID == "" {
		t.Error("a degraded envelope must not fail the ask")
	}

	convID := events[0].ConversationID
	rec = do(t, env.handler, "GET", "/api/conversations/"+convID, nil)
	var detail struct {
		Messages []struct {
			Segments []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"segments"`
		} `json:"messages"`
	}
	decode(t, rec, &detail)
	segs := detail.Messages[1].Segments
	if len(segs) != 2 || segs[0].Type != "prose" || segs[1].Type != "code" ||
		segs[1].Text != `{"title":"X","body":[]}` {
		t.Fatalf("segments = %+v, want prose plus the degraded code segment", segs)
	}
}

func equalPageLists(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestAskSSEContinuesConversation(t *testing.T) {
	chat := streamingChatFake(t, []string{"second reply [p. 4]"}, false)
	env, sha := seedAskEnv(t, chat)

	rec := do(t, env.handler, "POST", "/api/books/"+sha[:8]+"/ask", map[string]any{"question": "What is a gavel?"})
	events := parseSSE(t, rec.Body.String())
	convID := events[0].ConversationID

	rec = do(t, env.handler, "POST", "/api/books/"+sha[:8]+"/ask",
		map[string]any{"question": "call sign", "conversationId": convID})
	events = parseSSE(t, rec.Body.String())
	if events[0].Type != "meta" || events[0].ConversationID != convID {
		t.Fatalf("meta = %+v, want the same conversation", events[0])
	}
	if len(events[0].Pages) == 0 || events[0].Pages[0] != 4 {
		t.Errorf("meta pages = %v, want page 4 (the call-sign fact) first", events[0].Pages)
	}

	rec = do(t, env.handler, "GET", "/api/books/"+sha[:8]+"/conversations/"+convID, nil)
	var detail struct {
		Messages []struct {
			Role string `json:"role"`
		} `json:"messages"`
	}
	decode(t, rec, &detail)
	if len(detail.Messages) != 4 {
		t.Errorf("%d messages, want 4 after the follow-up", len(detail.Messages))
	}
}

func TestAskJSONErrorsBeforeStream(t *testing.T) {
	env := newTestEnv(t)

	// Unknown book.
	rec := do(t, env.handler, "POST", "/api/books/deadbeef00/ask", map[string]string{"question": "hi"})
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("content-type = %q, want JSON for a pre-stream error", ct)
	}

	// Missing question.
	if rec = do(t, env.handler, "POST", "/api/books/deadbeef00/ask", map[string]string{"question": "  "}); rec.Code != http.StatusBadRequest {
		t.Errorf("empty question: status = %d, want 400", rec.Code)
	}
	if rec = doRaw(t, env.handler, "POST", "/api/books/deadbeef00/ask", "{bad"); rec.Code != http.StatusBadRequest {
		t.Errorf("bad body: status = %d, want 400", rec.Code)
	}

	// Unconfigured chat connection.
	requirePoppler(t)
	if book := env.importSample("sample-digital.pdf"); !book.Ready {
		t.Fatalf("book = %+v, want ready", book.Readiness)
	}
	rec = do(t, env.handler, "GET", "/api/books", nil)
	var books struct {
		Books []apiBook `json:"books"`
	}
	decode(t, rec, &books)
	sha := books.Books[0].SHA256

	rec = do(t, env.handler, "POST", "/api/books/"+sha[:8]+"/ask", map[string]string{"question": "hi"})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("unconfigured ask: status = %d, want 400", rec.Code)
	}
	var body apiError
	decode(t, rec, &body)
	if !strings.Contains(body.Error, "chat model connection") {
		t.Errorf("error = %q, want the unconfigured hint", body.Error)
	}
}

func TestAskSSEMidStreamError(t *testing.T) {
	chat := streamingChatFake(t, nil, true) // every model request fails
	env, sha := seedAskEnv(t, chat)

	rec := do(t, env.handler, "POST", "/api/books/"+sha[:8]+"/ask", map[string]string{"question": "What is a gavel?"})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 — the stream has started", rec.Code)
	}
	events := parseSSE(t, rec.Body.String())
	if events[0].Type != "meta" {
		t.Fatalf("first event = %+v, want meta", events[0])
	}
	last := events[len(events)-1]
	if last.Type != "error" || last.Error == "" {
		t.Fatalf("last event = %+v, want an error event", last)
	}
	for _, ev := range events[1:] {
		if ev.Type == "done" {
			t.Fatal("a failed ask must not end with done")
		}
	}
}

// --- page images -------------------------------------------------------------------

func TestPageImageEndpoint(t *testing.T) {
	env := newTestEnv(t)
	requirePoppler(t)
	if _, err := exec.LookPath("pdftoppm"); err != nil {
		t.Skipf("pdftoppm not installed: %v", err)
	}
	if book := env.importSample("sample-digital.pdf"); !book.Ready {
		t.Fatalf("book = %+v, want ready", book.Readiness)
	}
	rec := do(t, env.handler, "GET", "/api/books", nil)
	var books struct {
		Books []apiBook `json:"books"`
	}
	decode(t, rec, &books)
	sha := books.Books[0].SHA256

	rec = do(t, env.handler, "GET", "/api/books/"+sha[:8]+"/pages/3/image", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "image/jpeg" {
		t.Errorf("content-type = %q, want image/jpeg", ct)
	}
	if cc := rec.Header().Get("Cache-Control"); cc == "" {
		t.Error("no cache header on the image")
	}
	body := rec.Body.Bytes()
	if len(body) < 3 || string(body[:3]) != "\xff\xd8\xff" {
		t.Errorf("body is not a JPEG (%d bytes)", len(body))
	}

	if rec = do(t, env.handler, "GET", "/api/books/"+sha[:8]+"/pages/999/image", nil); rec.Code != http.StatusNotFound {
		t.Errorf("missing page: status = %d, want 404", rec.Code)
	}
	if rec = do(t, env.handler, "GET", "/api/books/"+sha[:8]+"/pages/0/image", nil); rec.Code != http.StatusBadRequest {
		t.Errorf("page 0: status = %d, want 400", rec.Code)
	}
	if rec = do(t, env.handler, "GET", "/api/books/deadbeef00/pages/1/image", nil); rec.Code != http.StatusNotFound {
		t.Errorf("unknown book: status = %d, want 404", rec.Code)
	}
}

// TestGlobalConversationEndpoints pins the book-less conversation surface:
// every thread is listed across books and addressable by id alone, so
// /ask?c=<uuid> links work without naming a book.
func TestGlobalConversationEndpoints(t *testing.T) {
	chat := streamingChatFake(t, []string{"A gavel is a manufactured clap, see [p. 3]."}, false)
	env, sha := seedAskEnv(t, chat)

	rec := do(t, env.handler, "POST", "/api/books/"+sha[:8]+"/ask",
		map[string]any{"question": "What is a gavel?", "conversationId": nil})
	if rec.Code != http.StatusOK {
		t.Fatalf("ask status = %d, want 200", rec.Code)
	}
	events := parseSSE(t, rec.Body.String())
	convID := events[0].ConversationID

	rec = do(t, env.handler, "GET", "/api/conversations", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("global list status = %d, body %s", rec.Code, rec.Body.String())
	}
	var list struct {
		Conversations []struct {
			ID         string `json:"id"`
			BookID     string `json:"bookId"`
			BookSHA256 string `json:"bookSha256"`
			BookTitle  string `json:"bookTitle"`
		} `json:"conversations"`
	}
	decode(t, rec, &list)
	if len(list.Conversations) != 1 {
		t.Fatalf("global conversations = %+v, want the one thread", list.Conversations)
	}
	conv := list.Conversations[0]
	if conv.ID != convID || conv.BookSHA256 != sha || conv.BookTitle == "" || conv.BookID == "" {
		t.Errorf("global conversation = %+v, want book identity filled", conv)
	}

	rec = do(t, env.handler, "GET", "/api/conversations/"+convID, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("global detail status = %d, want 200", rec.Code)
	}
	var detail struct {
		Conversation struct {
			ID         string `json:"id"`
			BookSHA256 string `json:"bookSha256"`
		} `json:"conversation"`
		Messages []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"messages"`
	}
	decode(t, rec, &detail)
	if detail.Conversation.ID != convID || detail.Conversation.BookSHA256 != sha {
		t.Errorf("detail conversation = %+v, want the same thread with its book", detail.Conversation)
	}
	if len(detail.Messages) != 2 || detail.Messages[0].Role != "user" {
		t.Errorf("detail messages = %+v, want user then assistant", detail.Messages)
	}

	if rec = do(t, env.handler, "GET", "/api/conversations/ffffffff-ffff-ffff-ffff-ffffffffffff", nil); rec.Code != http.StatusNotFound {
		t.Errorf("unknown conversation: status = %d, want 404", rec.Code)
	}
}

// TestConversationUpdateEndpoint pins the rename/pin wire contract: the
// PATCH response carries the ref variant with pinned and lastActivityAt,
// and both list endpoints echo the new fields.
func TestConversationUpdateEndpoint(t *testing.T) {
	chat := streamingChatFake(t, []string{"A gavel is a manufactured clap, see [p. 3]."}, false)
	env, sha := seedAskEnv(t, chat)

	rec := do(t, env.handler, "POST", "/api/books/"+sha[:8]+"/ask",
		map[string]any{"question": "What is a gavel?", "conversationId": nil})
	events := parseSSE(t, rec.Body.String())
	convID := events[0].ConversationID

	rec = do(t, env.handler, "PATCH", "/api/conversations/"+convID,
		map[string]any{"title": "  Gavels  ", "pinned": true})
	if rec.Code != http.StatusOK {
		t.Fatalf("patch status = %d, body %s, want 200", rec.Code, rec.Body.String())
	}
	var body struct {
		Conversation struct {
			ID             string    `json:"id"`
			Title          string    `json:"title"`
			Pinned         bool      `json:"pinned"`
			MessageCount   int       `json:"messageCount"`
			CreatedAt      time.Time `json:"createdAt"`
			LastActivityAt time.Time `json:"lastActivityAt"`
			BookID         string    `json:"bookId"`
			BookSHA256     string    `json:"bookSha256"`
			BookTitle      string    `json:"bookTitle"`
		} `json:"conversation"`
	}
	decode(t, rec, &body)
	conv := body.Conversation
	if conv.ID != convID || conv.Title != "Gavels" || !conv.Pinned || conv.MessageCount != 2 {
		t.Errorf("conversation = %+v, want the trimmed rename + pin", conv)
	}
	if conv.BookSHA256 != sha || conv.BookID == "" || conv.BookTitle == "" {
		t.Errorf("conversation = %+v, want the book fields filled", conv)
	}
	if conv.LastActivityAt.Before(conv.CreatedAt) || conv.LastActivityAt.IsZero() {
		t.Errorf("lastActivityAt = %v, want it at or after createdAt %v", conv.LastActivityAt, conv.CreatedAt)
	}

	// A pin alone round-trips and keeps the rename.
	rec = do(t, env.handler, "PATCH", "/api/conversations/"+convID, map[string]any{"pinned": false})
	if rec.Code != http.StatusOK {
		t.Fatalf("unpin status = %d, want 200", rec.Code)
	}
	decode(t, rec, &body)
	if body.Conversation.Pinned || body.Conversation.Title != "Gavels" {
		t.Errorf("conversation = %+v, want unpinned with the rename kept", body.Conversation)
	}

	var list struct {
		Conversations []map[string]any `json:"conversations"`
	}
	for _, target := range []string{"/api/conversations", "/api/books/" + sha[:8] + "/conversations"} {
		rec = do(t, env.handler, "GET", target, nil)
		decode(t, rec, &list)
		if len(list.Conversations) != 1 {
			t.Fatalf("GET %s = %v, want the one thread", target, list.Conversations)
		}
		for _, field := range []string{"pinned", "lastActivityAt"} {
			if _, ok := list.Conversations[0][field]; !ok {
				t.Errorf("GET %s row %v lacks %s", target, list.Conversations[0], field)
			}
		}
	}

	patch := func(body any) *httptest.ResponseRecorder {
		return do(t, env.handler, "PATCH", "/api/conversations/"+convID, body)
	}
	if rec := patch(map[string]any{}); rec.Code != http.StatusBadRequest {
		t.Errorf("nothing to update: status = %d, want 400", rec.Code)
	}
	if rec := patch(map[string]any{"title": "   "}); rec.Code != http.StatusBadRequest {
		t.Errorf("blank title: status = %d, want 400", rec.Code)
	}
	if rec := patch(map[string]any{"title": strings.Repeat("g", 121)}); rec.Code != http.StatusBadRequest {
		t.Errorf("oversized title: status = %d, want 400", rec.Code)
	}
	if rec := patch(map[string]any{"pinnd": true}); rec.Code != http.StatusBadRequest {
		t.Errorf("unknown field: status = %d, want 400", rec.Code)
	}
	if rec := doRaw(t, env.handler, "PATCH", "/api/conversations/"+convID, "{bad"); rec.Code != http.StatusBadRequest {
		t.Errorf("bad JSON: status = %d, want 400", rec.Code)
	}
	if rec := do(t, env.handler, "PATCH", "/api/conversations/ffffffff-ffff-ffff-ffff-ffffffffffff",
		map[string]any{"pinned": true}); rec.Code != http.StatusNotFound {
		t.Errorf("unknown id: status = %d, want 404", rec.Code)
	}
}

// TestAskSSEToolEvents: the ask stream gained the tool cards and nothing
// else. The vocabulary is the homework chat's, so one client reducer folds
// both.
func TestAskSSEToolEvents(t *testing.T) {
	var round int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Stream bool `json:"stream"`
			Tools  []struct {
				Function struct {
					Name string `json:"name"`
				} `json:"function"`
			} `json:"tools"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		if !req.Stream {
			w.Write([]byte(`{"choices":[{"message":{"content":"ok"}}]}`))
			return
		}
		names := make([]string, 0, len(req.Tools))
		for _, tool := range req.Tools {
			names = append(names, tool.Function.Name)
		}
		if !slices.Contains(names, "calc") {
			t.Errorf("ask offered no calc tool: %v", names)
		}
		if slices.Contains(names, "add_understanding_note") {
			t.Errorf("ask offered the homework-only note tool: %v", names)
		}
		w.Header().Set("Content-Type", "text/event-stream")
		round++
		if round == 1 {
			io.WriteString(w, `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"t1","function":{"name":"calc","arguments":"{\"expression\":\"2+2\"}"}}]}}]}`+"\n\n")
		} else {
			fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"content\":%s}}]}\n\n", mustJSONString("It is 4 (p. 3).\n"))
		}
		io.WriteString(w, "data: [DONE]\n\n")
	}))
	t.Cleanup(srv.Close)

	env, sha := seedAskEnv(t, srv)
	rec := do(t, env.handler, "POST", "/api/books/"+sha[:8]+"/ask", map[string]any{"question": "what is 2+2?"})
	if rec.Code != http.StatusOK {
		t.Fatalf("ask status = %d, body %s", rec.Code, rec.Body.String())
	}
	events := parseSSE(t, rec.Body.String())
	types := make([]string, len(events))
	for i, ev := range events {
		types[i] = ev.Type
	}
	want := []string{"meta", "tool-start", "tool-result", "delta", "done"}
	if strings.Join(types, ",") != strings.Join(want, ",") {
		t.Fatalf("event types = %v, want %v", types, want)
	}
	if events[1].Tool != "calc" || events[1].ID != "t1" {
		t.Errorf("tool-start = %+v", events[1])
	}
	if !events[2].OK || events[2].Summary != "4" {
		t.Errorf("tool-result = %+v, want the computed 4", events[2])
	}

	// The card is part of the stored answer, so a reloaded thread shows it.
	rec = do(t, env.handler, "GET", "/api/conversations/"+events[0].ConversationID, nil)
	var detail struct {
		Messages []struct {
			Segments []struct {
				Type string `json:"type"`
				Kind string `json:"kind"`
			} `json:"segments"`
		} `json:"messages"`
	}
	decode(t, rec, &detail)
	segs := detail.Messages[1].Segments
	if len(segs) != 2 || segs[0].Type != "tool" || segs[0].Kind != "calc" || segs[1].Type != "prose" {
		t.Fatalf("stored segments = %+v, want the card then the prose", segs)
	}
}
