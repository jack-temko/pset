package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/store"
)

// fakeEmbed is a scripted embeddings endpoint: it records every request's
// input texts and can fail from a given request on.
type fakeEmbed struct {
	mu       sync.Mutex
	requests [][]string
	counter  int
	failFrom int // 1-based request index where failures start; 0 = never
}

// failAfterBatches starts failing with the request that follows the next n
// successful ones.
func (f *fakeEmbed) failAfterBatches(n int) {
	f.mu.Lock()
	f.failFrom = f.counter + n + 1
	f.mu.Unlock()
}
func (f *fakeEmbed) stopFailing() { f.mu.Lock(); f.failFrom = 0; f.mu.Unlock() }
func (f *fakeEmbed) count() int   { f.mu.Lock(); defer f.mu.Unlock(); return f.counter }
func (f *fakeEmbed) input(i int) []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.requests[i]
}

// embedVector is a deterministic 8-dimensional pseudo-embedding of a text.
func embedVector(text string) []float32 {
	h := fnv.New64a()
	h.Write([]byte(text))
	sum := h.Sum64()
	vec := make([]float32, 8)
	for i := range vec {
		vec[i] = float32((sum>>(i*8))&0xFF) / 255.0
	}
	return vec
}

func startFakeEmbed(t *testing.T, f *fakeEmbed) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Model string   `json:"model"`
			Input []string `json:"input"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		f.mu.Lock()
		f.counter++
		n := f.counter
		f.requests = append(f.requests, req.Input)
		fail := f.failFrom > 0 && n >= f.failFrom
		f.mu.Unlock()
		if fail {
			w.WriteHeader(http.StatusInternalServerError)
			io.WriteString(w, `{"error":"embed endpoint down"}`)
			return
		}
		data := make([]map[string]any, len(req.Input))
		for i, text := range req.Input {
			data[i] = map[string]any{"index": i, "embedding": embedVector(text)}
		}
		w.Write([]byte(`{"data":` + mustJSON(data) + `}`))
	}))
	t.Cleanup(srv.Close)
	return srv
}

func mustJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return string(b)
}

// fakeStreamReply is one scripted streaming reply: prose chunks, then
// optionally tool calls (emitted as argument fragments, the way providers
// stream them).
type fakeStreamReply struct {
	chunks    []string
	toolCalls []fakeToolCall
}

type fakeToolCall struct {
	id   string
	name string
	args string // a JSON object as text
}

func proseReply(chunks ...string) fakeStreamReply { return fakeStreamReply{chunks: chunks} }

func toolReply(calls ...fakeToolCall) fakeStreamReply { return fakeStreamReply{toolCalls: calls} }

func call(id, name, args string) fakeToolCall { return fakeToolCall{id: id, name: name, args: args} }

// fakeChat is a scripted chat endpoint: it records the decoded requests and
// replies to streaming requests with its scripted chunks as SSE deltas. The
// non-streaming replies (the envelope repair round) are scripted separately.
// scriptStream replaces the fixed chunks with per-request replies (the last
// repeats), so a tool round trip plays out across calls.
type fakeChat struct {
	mu           sync.Mutex
	requests     []llm.ChatRequest
	chunks       []string
	streamScript []fakeStreamReply
	streamCount  int
	onceReplies  []string
	failOnce     bool
	srv          *httptest.Server
}

func (f *fakeChat) url() string { return f.srv.URL }

func (f *fakeChat) count() int { f.mu.Lock(); defer f.mu.Unlock(); return len(f.requests) }

func (f *fakeChat) request(i int) llm.ChatRequest {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.requests[i]
}

// scriptStream installs per-streaming-request replies; the last repeats.
func (f *fakeChat) scriptStream(replies ...fakeStreamReply) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.streamScript = replies
}

// replyOnce scripts the reply of the next non-streaming request.
func (f *fakeChat) replyOnce(text string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.onceReplies = append(f.onceReplies, text)
}

// failOnceReplies makes every non-streaming request answer 500.
func (f *fakeChat) failOnceReplies() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.failOnce = true
}

func startFakeChat(t *testing.T, chunks ...string) *fakeChat {
	t.Helper()
	if len(chunks) == 0 {
		chunks = []string{"The answer ", "[p. 3]."}
	}
	f := &fakeChat{chunks: chunks}
	f.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req llm.ChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		f.mu.Lock()
		f.requests = append(f.requests, req)
		reply := "ok"
		if len(f.onceReplies) > 0 {
			reply = f.onceReplies[0]
			f.onceReplies = f.onceReplies[1:]
		}
		fail := f.failOnce
		f.mu.Unlock()

		if !req.Stream {
			if fail {
				w.WriteHeader(http.StatusInternalServerError)
				io.WriteString(w, `{"error":"endpoint down"}`)
				return
			}
			fmt.Fprintf(w, `{"choices":[{"message":{"content":%s}}]}`, mustJSON(reply))
			return
		}
		f.mu.Lock()
		stream := fakeStreamReply{chunks: chunks}
		if len(f.streamScript) > 0 {
			stream = f.streamScript[0]
			if len(f.streamScript) > 1 {
				f.streamScript = f.streamScript[1:]
			}
		}
		f.streamCount++
		f.mu.Unlock()

		w.Header().Set("Content-Type", "text/event-stream")
		for _, chunk := range stream.chunks {
			fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"content\":%s}}]}\n\n",
				mustJSON(chunk))
		}
		// Providers stream a call as fragments: the name and id arrive
		// first, the arguments in pieces. Splitting them here keeps the
		// client's accumulator honest.
		for i, tc := range stream.toolCalls {
			fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":%d,\"id\":%s,\"function\":{\"name\":%s,\"arguments\":\"\"}}]}}]}\n\n",
				i, mustJSON(tc.id), mustJSON(tc.name))
			for _, piece := range splitArgs(tc.args) {
				fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":%d,\"function\":{\"arguments\":%s}}]}}]}\n\n",
					i, mustJSON(piece))
			}
		}
		io.WriteString(w, "data: [DONE]\n\n")
	}))
	t.Cleanup(f.srv.Close)
	return f
}

// seedBookPages inserts pageCount pages of stored text for a book — the
// state of a book that was ingested or OCR'd.
func seedBookPages(t *testing.T, e *Engine, bookID string, pageCount int) {
	t.Helper()
	s, err := e.openStore(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	pages := make([]store.Page, pageCount)
	for i := range pages {
		pages[i] = store.Page{Number: i + 1, Text: fmt.Sprintf("page %d carries the brontolith fact %d", i+1, i+1)}
	}
	if err := s.InsertPages(context.Background(), bookID, pages); err != nil {
		t.Fatal(err)
	}
}

// splitArgs cuts a tool call's arguments into two fragments, so the tests
// exercise the accumulator rather than a single whole-argument delta.
func splitArgs(args string) []string {
	if len(args) < 4 {
		return []string{args}
	}
	mid := len(args) / 2
	return []string{args[:mid], args[mid:]}
}

// streamCalls reports how many streaming rounds the fake has served — one
// per model round of a tool loop.
func (f *fakeChat) streamCalls() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.streamCount
}
