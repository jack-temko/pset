package llm

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

// hostedAt is a client whose endpoint names a real provider's host, with
// its requests redirected to a test server: shape goes by the host.
func hostedAt(t *testing.T, base string, h http.HandlerFunc) *Client {
	t.Helper()
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	target, _ := url.Parse(srv.URL)
	c := New(base, "test-key", "", "")
	c.http.Transport = roundTrip(func(r *http.Request) (*http.Response, error) {
		r.URL.Scheme, r.URL.Host = target.Scheme, target.Host
		return http.DefaultTransport.RoundTrip(r)
	})
	return c
}

type roundTrip func(*http.Request) (*http.Response, error)

func (f roundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

// TestOpenRouterShape: OpenRouter gets its reasoning object with the
// effort, full-precision hosts only, and the earlier reasoning back under
// its own name; Z.ai's fields don't go.
func TestOpenRouterShape(t *testing.T) {
	var got map[string]any
	c := hostedAt(t, "https://openrouter.ai/api/v1", func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &got)
		io.WriteString(w, `{"choices":[{"message":{"content":"ok","reasoning":"thought"}}],"usage":{"prompt_tokens":10,"completion_tokens":3,"cost":0.00002,"prompt_tokens_details":{"cached_tokens":4},"completion_tokens_details":{"reasoning_tokens":2}}}`)
	})
	reply, err := c.ChatOnceFull(context.Background(), ChatRequest{Model: "z-ai/glm-5.3-flash", ReasoningEffort: "low", Messages: []Message{
		TextMessage("user", "hi"),
		AssistantToolMessage(Reply{Reasoning: "earlier thinking", ToolCalls: []ToolCall{{ID: "1", Type: "function", Function: ToolCallFunc{Name: "compute", Arguments: "{}"}}}}),
		ToolMessage("1", "4"),
	}})
	if err != nil {
		t.Fatal(err)
	}
	if r, _ := got["reasoning"].(map[string]any); r["effort"] != "low" {
		t.Errorf("reasoning = %v, want effort low", got["reasoning"])
	}
	if _, ok := got["reasoning_effort"]; ok {
		t.Error("reasoning_effort went to OpenRouter")
	}
	if _, ok := got["thinking"]; ok {
		t.Error("Z.ai's thinking switch went to OpenRouter")
	}
	q, _ := got["provider"].(map[string]any)["quantizations"].([]any)
	if len(q) == 0 || strings.Contains(strings.ToLower(jsonOf(q)), "fp4") {
		t.Errorf("quantizations = %v, want full precision only", q)
	}
	msg := got["messages"].([]any)[1].(map[string]any)
	if msg["reasoning"] != "earlier thinking" || msg["reasoning_content"] != nil {
		t.Errorf("assistant turn = %v, want its reasoning under \"reasoning\"", msg)
	}
	if reply.Reasoning != "thought" || reply.Usage == nil || reply.Usage.Cost != 0.00002 || reply.Usage.PromptDetails.CachedTokens != 4 {
		t.Errorf("reply = %+v, usage %+v", reply, reply.Usage)
	}
}

// TestOpenRouterWithoutEffort: a call with no effort still switches
// reasoning on, so a thinking model's thoughts come back to be kept.
func TestOpenRouterWithoutEffort(t *testing.T) {
	var got map[string]any
	c := hostedAt(t, "https://openrouter.ai/api/v1", func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &got)
		io.WriteString(w, `{"choices":[{"message":{"content":"ok"}}]}`)
	})
	if _, err := c.ChatOnce(context.Background(), ChatRequest{Model: "m", Messages: []Message{TextMessage("user", "hi")}}); err != nil {
		t.Fatal(err)
	}
	if r, _ := got["reasoning"].(map[string]any); r["enabled"] != true {
		t.Errorf("reasoning = %v, want enabled", got["reasoning"])
	}
}

// TestZaiShapeUnchanged: Z.ai keeps its own fields and gets none of
// OpenRouter's.
func TestZaiShapeUnchanged(t *testing.T) {
	var got map[string]any
	c := hostedAt(t, "https://api.z.ai/api/paas/v4", func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &got)
		io.WriteString(w, `{"choices":[{"message":{"content":"ok"}}]}`)
	})
	_, err := c.ChatOnce(context.Background(), ChatRequest{Model: "glm-5.3-flash", ReasoningEffort: "max", Messages: []Message{
		TextMessage("user", "hi"),
		AssistantToolMessage(Reply{Reasoning: "earlier"}),
	}})
	if err != nil {
		t.Fatal(err)
	}
	if got["reasoning_effort"] != "max" || got["reasoning"] != nil || got["provider"] != nil {
		t.Errorf("request = %v", got)
	}
	if msg := got["messages"].([]any)[1].(map[string]any); msg["reasoning_content"] != "earlier" {
		t.Errorf("assistant turn = %v, want reasoning_content", msg)
	}
}

// TestStreamReadsOpenRouterReasoningAndUsage: OpenRouter streams its
// thinking as "reasoning" and the usage in the last chunk.
func TestStreamReadsOpenRouterReasoningAndUsage(t *testing.T) {
	c := hostedAt(t, "https://openrouter.ai/api/v1", func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, "data: {\"choices\":[{\"delta\":{\"reasoning\":\"think \"}}]}\n\n")
		io.WriteString(w, "data: {\"choices\":[{\"delta\":{\"reasoning\":\"more\"}}]}\n\n")
		io.WriteString(w, "data: {\"choices\":[{\"delta\":{\"content\":\"answer\"},\"finish_reason\":\"stop\"}]}\n\n")
		io.WriteString(w, "data: {\"choices\":[],\"usage\":{\"prompt_tokens\":5,\"completion_tokens\":7,\"cost\":0.001}}\n\n")
		io.WriteString(w, "data: [DONE]\n\n")
	})
	reply, err := c.ChatStreamFull(context.Background(), ChatRequest{Model: "m", Messages: []Message{TextMessage("user", "hi")}}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if reply.Content != "answer" || reply.Reasoning != "think more" || reply.Usage == nil || reply.Usage.CompletionTokens != 7 {
		t.Errorf("reply = %+v, usage %+v", reply, reply.Usage)
	}
}

// TestOutOfCredit: Z.ai's 429 with code 1113 and OpenRouter's 402 are an
// empty account, not a busy one, and aren't retried.
func TestOutOfCredit(t *testing.T) {
	for _, tc := range []struct {
		base, body string
		status     int
	}{
		{"https://api.z.ai/api/paas/v4", `{"error":{"code":"1113","message":"Insufficient balance or no resource package. Please recharge."}}`, 429},
		{"https://openrouter.ai/api/v1", `{"error":{"code":402,"message":"This request requires more credits"}}`, 402},
	} {
		calls := 0
		c := hostedAt(t, tc.base, func(w http.ResponseWriter, r *http.Request) {
			calls++
			w.WriteHeader(tc.status)
			io.WriteString(w, tc.body)
		})
		_, err := c.ChatOnce(context.Background(), ChatRequest{Model: "m", Messages: []Message{TextMessage("user", "hi")}})
		if trouble, _ := Classify(err); trouble != TroubleCredit {
			t.Errorf("%s: trouble = %s, want credit", tc.base, trouble)
		}
		if calls != 1 {
			t.Errorf("%s: %d calls, want 1: an empty account isn't retried", tc.base, calls)
		}
	}
	// Z.ai shedding load is still busy, and still retried.
	if !(!OutOfCredit(429, `{"error":{"code":"1302","message":"rate limit"}}`)) {
		t.Error("a plain rate limit read as out of credit")
	}
}

func jsonOf(v any) string { b, _ := json.Marshal(v); return string(b) }
