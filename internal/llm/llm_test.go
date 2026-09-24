package llm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func testClient(t *testing.T, chatBase, embedBase string) *Client {
	t.Helper()
	if chatBase == "" {
		chatBase = "http://unused.invalid"
	}
	if embedBase == "" {
		embedBase = "http://unused.invalid"
	}
	return New(chatBase, "test-key", embedBase, "test-embed-model")
}

func TestChatStreamAssemblesDeltas(t *testing.T) {
	var gotAuth, gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = map[string]any{"auth": r.Header.Get("Authorization")}
		data, _ := io.ReadAll(r.Body)
		json.Unmarshal(data, &gotBody)
		w.Header().Set("Content-Type", "text/event-stream")
		io.WriteString(w, "data: {\"choices\":[{\"delta\":{\"content\":\"Hel\"}}]}\n\n")
		io.WriteString(w, ": keepalive comment\n\n")
		io.WriteString(w, "data: {\"choices\":[{\"delta\":{\"content\":\"lo [p. 3]\"}}]}\n\n")
		io.WriteString(w, "data: [DONE]\n\n")
	}))
	defer srv.Close()

	var deltas []string
	client := testClient(t, srv.URL, "")
	text, err := client.ChatStream(context.Background(), ChatRequest{
		Model:    "test-model",
		Messages: []Message{TextMessage("user", "hi")},
		Stream:   true,
	}, func(d string) error {
		deltas = append(deltas, d)
		return nil
	})
	if err != nil {
		t.Fatalf("ChatStream: %v", err)
	}
	if text != "Hello [p. 3]" {
		t.Errorf("text = %q, want %q", text, "Hello [p. 3]")
	}
	if len(deltas) != 2 || deltas[0] != "Hel" {
		t.Errorf("deltas = %q, want two fragments", deltas)
	}
	if gotAuth["auth"] != "Bearer test-key" {
		t.Errorf("auth = %v", gotAuth)
	}
	if gotBody["model"] != "test-model" || gotBody["stream"] != true {
		t.Errorf("body model/stream = %v", gotBody)
	}
}

func TestChatStreamStopsOnDeltaError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, "data: {\"choices\":[{\"delta\":{\"content\":\"one\"}}]}\n\n")
		io.WriteString(w, "data: {\"choices\":[{\"delta\":{\"content\":\"two\"}}]}\n\n")
	}))
	defer srv.Close()

	client := testClient(t, srv.URL, "")
	text, err := client.ChatStream(context.Background(), ChatRequest{Model: "m"}, func(string) error {
		return io.EOF
	})
	if err == nil {
		t.Fatal("a failing delta must abort the stream")
	}
	if text != "one" {
		t.Errorf("partial text = %q, want the fragment before the abort", text)
	}
}

func TestChatStreamHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		io.WriteString(w, `{"error":"bad key"}`)
	}))
	defer srv.Close()

	client := testClient(t, srv.URL, "")
	_, err := client.ChatStream(context.Background(), ChatRequest{Model: "m"}, nil)
	llmErr, ok := err.(*LLMError)
	if !ok {
		t.Fatalf("err = %v (%T), want *LLMError", err, err)
	}
	if llmErr.Status != http.StatusUnauthorized || !strings.Contains(llmErr.Body, "bad key") {
		t.Errorf("LLMError = %+v, want status 401 and the body", llmErr)
	}
}

func TestChatOncePlainText(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			MaxTokens int `json:"max_tokens"`
			Messages  []struct {
				Content Content `json:"content"`
			} `json:"messages"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		if req.MaxTokens != 1 {
			t.Errorf("max_tokens = %d, want 1", req.MaxTokens)
		}
		if req.Messages[0].Content.parts != nil {
			t.Error("plain message content must marshal as a string, not parts")
		}
		w.Write([]byte(`{"choices":[{"message":{"content":"ok"}}]}`))
	}))
	defer srv.Close()

	client := testClient(t, srv.URL, "")
	text, err := client.ChatOnce(context.Background(), ChatRequest{
		Model:     "m",
		Messages:  []Message{TextMessage("user", "hi")},
		MaxTokens: 1,
	})
	if err != nil {
		t.Fatal(err)
	}
	if text != "ok" {
		t.Errorf("text = %q, want ok", text)
	}
}

func TestContentMarshalsBothShapes(t *testing.T) {
	plain, err := json.Marshal(TextContent("hello"))
	if err != nil || string(plain) != `"hello"` {
		t.Fatalf("plain content = %s/%v, want \"hello\"", plain, err)
	}
	multi, err := json.Marshal(PartsContent(TextPart("page 3"), ImagePart("data:image/png;base64,QUJD")))
	if err != nil {
		t.Fatal(err)
	}
	var parts []Part
	if err := json.Unmarshal(multi, &parts); err != nil {
		t.Fatalf("decode parts: %v (%s)", err, multi)
	}
	if len(parts) != 2 || parts[0].Type != "text" || parts[0].Text != "page 3" ||
		parts[1].Type != "image_url" || parts[1].ImageURL.URL != "data:image/png;base64,QUJD" {
		t.Fatalf("parts = %s, want a text part then an image part", multi)
	}

	// Decoding accepts both shapes too.
	var c Content
	if err := json.Unmarshal([]byte(`"plain"`), &c); err != nil || c.text != "plain" {
		t.Errorf("string decode = %q/%v", c.text, err)
	}
	if err := json.Unmarshal(multi, &c); err != nil || len(c.parts) != 2 {
		t.Errorf("array decode = %+v/%v", c, err)
	}
}

func TestEmbedOrdersByIndex(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req EmbedRequest
		json.NewDecoder(r.Body).Decode(&req)
		if req.Model != "test-embed-model" {
			t.Errorf("model = %q", req.Model)
		}
		if strings.Join(req.Input, "|") != "first|second" {
			t.Errorf("input = %v", req.Input)
		}
		w.Write([]byte(`{"data":[{"index":1,"embedding":[3,4]},{"index":0,"embedding":[1,2]}]}`))
	}))
	defer srv.Close()

	client := testClient(t, "", srv.URL)
	vectors, err := client.Embed(context.Background(), []string{"first", "second"})
	if err != nil {
		t.Fatal(err)
	}
	if len(vectors) != 2 || vectors[0][0] != 1 || vectors[1][0] != 3 {
		t.Fatalf("vectors = %v, want input order", vectors)
	}
}

func TestEmbedWrongVectorCount(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"data":[{"index":0,"embedding":[1]}]}`))
	}))
	defer srv.Close()

	client := testClient(t, "", srv.URL)
	if _, err := client.Embed(context.Background(), []string{"a", "b"}); err == nil {
		t.Fatal("a mismatched vector count must fail")
	}
}

func TestConfiguredPredicates(t *testing.T) {
	full := New("http://api", "key", "http://embed", "m")
	if !full.ChatConfigured() || !full.EmbedConfigured() {
		t.Error("a fully loaded client is configured")
	}
	noKey := New("http://api", "", "http://embed", "m")
	if noKey.ChatConfigured() {
		t.Error("no key means chat is unconfigured")
	}
	noEmbed := New("http://api", "key", "", "m")
	if noEmbed.EmbedConfigured() {
		t.Error("no base URL means embeddings are unconfigured")
	}
}

// TestChatStreamRetriesRateLimit: coding-plan endpoints answer 429 under
// load; the client must back off and succeed on a later attempt instead of
// surfacing the error.
func TestChatStreamRetriesRateLimit(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts < 3 {
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error":{"code":"1305","message":"temporarily overloaded"}}`))
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"ok\"}}]}\n\n"))
		w.Write([]byte("data: [DONE]\n\n"))
	}))
	defer server.Close()

	c := New(server.URL, "k", server.URL, "m")
	var got []string
	reply, err := c.ChatStream(t.Context(), ChatRequest{Model: "m"}, func(text string) error {
		got = append(got, text)
		return nil
	})
	if err != nil {
		t.Fatalf("chat stream after retries: %v", err)
	}
	if reply != "ok" || len(got) != 1 || got[0] != "ok" {
		t.Fatalf("reply = %q deltas = %v, want one ok", reply, got)
	}
	if attempts != 3 {
		t.Fatalf("attempts = %d, want 3 (two 429s then success)", attempts)
	}
}

func TestChatStreamFullAssemblesToolCalls(t *testing.T) {
	var gotTools any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		data, _ := io.ReadAll(r.Body)
		var req struct {
			Tools any `json:"tools"`
		}
		json.Unmarshal(data, &req)
		gotTools = req.Tools
		w.Header().Set("Content-Type", "text/event-stream")
		io.WriteString(w, `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"calc","arguments":"{\"expr"}}]}}]}`+"\n\n")
		io.WriteString(w, `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\":\"3/7 + 0.2\"}"}}]}}]}`+"\n\n")
		io.WriteString(w, "data: [DONE]\n\n")
	}))
	defer srv.Close()

	client := testClient(t, srv.URL, "")
	tools := []Tool{NewTool("calc", "arithmetic", json.RawMessage(`{"type":"object"}`))}
	reply, err := client.ChatStreamFull(context.Background(), ChatRequest{
		Model: "m", Messages: []Message{TextMessage("user", "hi")}, Tools: tools,
	}, nil)
	if err != nil {
		t.Fatalf("ChatStreamFull: %v", err)
	}
	if gotTools == nil {
		t.Error("tools were not sent")
	}
	if len(reply.ToolCalls) != 1 {
		t.Fatalf("tool calls = %+v, want one", reply.ToolCalls)
	}
	call := reply.ToolCalls[0]
	if call.ID != "call_1" || call.Function.Name != "calc" ||
		call.Function.Arguments != `{"expr":"3/7 + 0.2"}` {
		t.Errorf("assembled call = %+v", call)
	}
}

func TestChatOnceFullReturnsToolCalls(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, `{"choices":[{"message":{"content":null,`+
			`"tool_calls":[{"id":"c9","function":{"name":"search_book","arguments":"{\"query\":\"mesh\"}"}}]}}]}`)
	}))
	defer srv.Close()

	client := testClient(t, srv.URL, "")
	reply, err := client.ChatOnceFull(context.Background(), ChatRequest{Model: "m"})
	if err != nil {
		t.Fatal(err)
	}
	if len(reply.ToolCalls) != 1 || reply.ToolCalls[0].Function.Name != "search_book" ||
		reply.ToolCalls[0].Type != "function" {
		t.Errorf("reply = %+v", reply)
	}
	if reply.Content != "" {
		t.Errorf("content = %q, want empty", reply.Content)
	}
}

func TestClassify(t *testing.T) {
	for _, c := range []struct {
		err    error
		want   Trouble
		status int
	}{
		{fmt.Errorf("round: %w", ErrStreamCut), TroubleCut, 0},
		{&LLMError{Status: 503}, TroubleBusy, 503},
		{&LLMError{Status: 429}, TroubleBusy, 429},
		{fmt.Errorf("x: %w", &LLMError{Status: 401}), TroubleRejected, 401},
		{errors.New("dial tcp: connection refused"), TroubleBusy, 0},
	} {
		if got, st := Classify(c.err); got != c.want || st != c.status {
			t.Errorf("%v: %s %d", c.err, got, st)
		}
	}
}

func TestAStreamThatStopsWithoutFinishingIsCut(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		io.WriteString(w, "data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"Let me think about the \"}}]}\n\n")
	}))
	defer srv.Close()
	reply, err := testClient(t, srv.URL, "").ChatStreamFull(context.Background(), ChatRequest{Model: "m"}, nil)
	if !errors.Is(err, ErrStreamCut) {
		t.Fatalf("err = %v, reply %+v: every event parsed, but nothing said it was done", err, reply)
	}
}

func TestAFinishReasonEndsAStreamWithoutDone(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		io.WriteString(w, "data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"Easy.\"}}]}\n\n")
		io.WriteString(w, "data: {\"choices\":[{\"delta\":{\"content\":\"4\"},\"finish_reason\":\"stop\"}]}\n\n")
	}))
	defer srv.Close()
	reply, err := testClient(t, srv.URL, "").ChatStreamFull(context.Background(), ChatRequest{Model: "m"}, nil)
	if err != nil || reply.Content != "4" || reply.Reasoning != "Easy." {
		t.Fatalf("reply %+v, err %v", reply, err)
	}
}

func TestAStreamStoppedByUsIsNotCut(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		io.WriteString(w, "data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"Hmm\"}}]}\n\n")
		w.(http.Flusher).Flush()
		cancel()
		<-r.Context().Done()
	}))
	defer srv.Close()
	_, err := testClient(t, srv.URL, "").ChatStreamFull(ctx, ChatRequest{Model: "m"}, nil)
	if errors.Is(err, ErrStreamCut) || !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v: a shutdown isn't the endpoint dropping the answer", err)
	}
}

func TestReasoningGoesBackOnlyToZai(t *testing.T) {
	turn := AssistantToolMessage(Reply{Reasoning: "The source points right.", ToolCalls: []ToolCall{{ID: "c1", Type: "function"}}})
	req := ChatRequest{Model: "glm", Messages: []Message{TextMessage("user", "4.32"), turn}}

	for _, base := range []string{"https://api.z.ai/api/paas/v4", "https://api.z.ai/api/coding/paas/v4", "https://open.bigmodel.cn/api/paas/v4"} {
		got := New(base, "k", "", "").shape(req)
		if got.Messages[1].ReasoningContent != "The source points right." {
			t.Fatalf("%s: reasoning dropped", base)
		}
		if got.Thinking == nil || got.Thinking.Type != "enabled" || got.Thinking.ClearThinking == nil || *got.Thinking.ClearThinking {
			t.Fatalf("%s: thinking %+v, want preserved", base, got.Thinking)
		}
	}
	for _, base := range []string{"https://api.deepseek.com", "http://localhost:11434/v1", "https://notz.ai.example.com/v1"} {
		got := New(base, "k", "", "").shape(req)
		if got.Messages[1].ReasoningContent != "" || got.Thinking != nil {
			t.Fatalf("%s: sent %+v", base, got)
		}
	}
	if req.Messages[1].ReasoningContent == "" {
		t.Fatal("shape changed the caller's messages")
	}
	plain := ChatRequest{Model: "glm", Messages: []Message{TextMessage("user", "hi")}}
	if New("https://api.z.ai/api/paas/v4", "k", "", "").shape(plain).Thinking != nil {
		t.Fatal("thinking set on a conversation with no reasoning to keep")
	}
}

// A reasoning effort goes to Z.ai, which takes it, and no one else, since
// a model that doesn't think may refuse it.
func TestReasoningEffortGoesOnlyToZai(t *testing.T) {
	req := ChatRequest{Model: "glm", ReasoningEffort: "low", Messages: []Message{TextMessage("user", "hi")}}
	if got := New("https://api.z.ai/api/coding/paas/v4", "k", "", "").shape(req); got.ReasoningEffort != "low" {
		t.Fatalf("Z.ai lost the effort: %q", got.ReasoningEffort)
	}
	if got := New("https://api.openai.com/v1", "k", "", "").shape(req); got.ReasoningEffort != "" {
		t.Fatalf("sent %q to OpenAI", got.ReasoningEffort)
	}
}
