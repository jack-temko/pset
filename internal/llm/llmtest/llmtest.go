// Package llmtest is a fake OpenAI-compatible endpoint for tests: the
// real llm client talks to it over HTTP, so a feature's integration test
// exercises the same wire code the app does, with no model anywhere.
//
// Embeddings are deterministic: a text's vector is a hash of its words, so
// texts sharing words land close together and search behaves plausibly.
// Chat replies come from a script the test writes.
package llmtest

import (
	"encoding/json"
	"hash/fnv"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackt/pset/internal/llm"
)

// Dims is the fake embedding size.
const Dims = 64

// Reply is one scripted chat answer: text, tool calls, or an HTTP error.
type Reply struct {
	Text      string
	ToolCalls []llm.ToolCall
	Status    int // non-zero answers with this status and Text as the body
	// Pause is how long to wait between streamed chunks, to test a
	// stop mid-answer.
	Pause time.Duration
}

// Request is what the server received, for assertions.
type Request struct {
	Path string
	Chat llm.ChatRequest
}

// Server is the fake endpoint.
type Server struct {
	*httptest.Server

	mu       sync.Mutex
	replies  []Reply
	fallback func(llm.ChatRequest) Reply
	requests []Request
	embedErr int
}

// New starts a server that closes with the test.
func New(t testing.TB) *Server {
	s := &Server{}
	s.Server = httptest.NewServer(http.HandlerFunc(s.serve))
	t.Cleanup(s.Close)
	return s
}

// Config is an llm.Config pointing both sides at the fake.
func (s *Server) Config() llm.Config {
	return llm.Config{
		ChatEndpoint: s.URL, APIKey: "test", ChatModel: "fake-chat",
		EmbedEndpoint: s.URL, EmbedModel: "fake-embed",
	}
}

// Script queues chat replies, answered in order.
func (s *Server) Script(r ...Reply) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.replies = append(s.replies, r...)
}

// Fallback answers any chat request the script has run out for.
func (s *Server) Fallback(fn func(llm.ChatRequest) Reply) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.fallback = fn
}

// FailEmbeddings makes every embeddings call answer status (0 to stop).
func (s *Server) FailEmbeddings(status int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.embedErr = status
}

// Requests returns every request so far.
func (s *Server) Requests() []Request {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]Request(nil), s.requests...)
}

func (s *Server) serve(w http.ResponseWriter, r *http.Request) {
	switch {
	case strings.HasSuffix(r.URL.Path, "/embeddings"):
		s.embeddings(w, r)
	case strings.HasSuffix(r.URL.Path, "/chat/completions"):
		s.chat(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (s *Server) embeddings(w http.ResponseWriter, r *http.Request) {
	var req llm.EmbedRequest
	json.NewDecoder(r.Body).Decode(&req)
	s.mu.Lock()
	s.requests = append(s.requests, Request{Path: "/embeddings"})
	status := s.embedErr
	s.mu.Unlock()
	if status != 0 {
		http.Error(w, `{"error":"embeddings failed"}`, status)
		return
	}
	type item struct {
		Index     int       `json:"index"`
		Embedding []float32 `json:"embedding"`
	}
	out := struct {
		Data []item `json:"data"`
	}{}
	for i, text := range req.Input {
		out.Data = append(out.Data, item{i, Vector(text)})
	}
	json.NewEncoder(w).Encode(out)
}

// Vector is the fake embedding of text: each word adds weight to a few
// hashed dimensions, and the result is normalized.
func Vector(text string) []float32 {
	v := make([]float64, Dims)
	for _, word := range strings.FieldsFunc(strings.ToLower(text), func(r rune) bool {
		return !(r >= 'a' && r <= 'z' || r >= '0' && r <= '9')
	}) {
		h := fnv.New64a()
		h.Write([]byte(word))
		x := h.Sum64()
		for k := range 3 {
			v[(x>>(k*16))%Dims] += 1
		}
	}
	var norm float64
	for _, x := range v {
		norm += x * x
	}
	out := make([]float32, Dims)
	if norm == 0 {
		out[0] = 1
		return out
	}
	norm = math.Sqrt(norm)
	for i, x := range v {
		out[i] = float32(x / norm)
	}
	return out
}

func (s *Server) chat(w http.ResponseWriter, r *http.Request) {
	var req llm.ChatRequest
	json.NewDecoder(r.Body).Decode(&req)
	s.mu.Lock()
	s.requests = append(s.requests, Request{Path: "/chat/completions", Chat: req})
	var reply Reply
	switch {
	case len(s.replies) > 0:
		reply, s.replies = s.replies[0], s.replies[1:]
	case s.fallback != nil:
		reply = s.fallback(req)
	default:
		reply = Reply{Text: "ok"}
	}
	s.mu.Unlock()

	if reply.Status != 0 {
		http.Error(w, reply.Text, reply.Status)
		return
	}
	if !req.Stream {
		msg := map[string]any{"role": "assistant", "content": reply.Text}
		if len(reply.ToolCalls) > 0 {
			msg["tool_calls"] = reply.ToolCalls
		}
		json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": msg}}})
		return
	}
	// Streamed: the text in a few chunks, then any tool calls, then [DONE].
	w.Header().Set("Content-Type", "text/event-stream")
	flusher, _ := w.(http.Flusher)
	send := func(delta map[string]any) {
		b, _ := json.Marshal(map[string]any{"choices": []any{map[string]any{"delta": delta}}})
		w.Write([]byte("data: " + string(b) + "\n\n"))
		if flusher != nil {
			flusher.Flush()
		}
	}
	for _, chunk := range chunks(reply.Text, 7) {
		if reply.Pause > 0 {
			select {
			case <-r.Context().Done():
				return
			case <-time.After(reply.Pause):
			}
		}
		send(map[string]any{"content": chunk})
	}
	if len(reply.ToolCalls) > 0 {
		calls := make([]map[string]any, len(reply.ToolCalls))
		for i, c := range reply.ToolCalls {
			calls[i] = map[string]any{
				"index": i, "id": c.ID, "type": "function",
				"function": map[string]any{"name": c.Function.Name, "arguments": c.Function.Arguments},
			}
		}
		send(map[string]any{"tool_calls": calls})
	}
	w.Write([]byte("data: [DONE]\n\n"))
}

// chunks splits text into pieces of about n runes, so streaming code sees
// fences and words cut mid-way, as real streams cut them.
func chunks(text string, n int) []string {
	r := []rune(text)
	var out []string
	for len(r) > 0 {
		k := min(n, len(r))
		out = append(out, string(r[:k]))
		r = r[k:]
	}
	return out
}
