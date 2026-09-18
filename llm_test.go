//go:build llm

// Live smoke tests against the real model endpoints. They cost tokens, so
// they sit behind the `llm` build tag and never run under plain
// `go test ./...`. Both skip cleanly unless the user's config exists and the
// endpoints answer. Run with: go test -tags llm ./...
package pset

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/engine"
	"github.com/jackt/pset/internal/llm"
)

// liveClient loads ~/.pset/config.json and builds a client against the real
// endpoints. It skips when no config or no key exists.
func liveClient(t *testing.T) (*llm.Client, engine.Settings) {
	t.Helper()
	home, err := os.UserHomeDir()
	if err != nil {
		t.Skipf("no home directory: %v", err)
	}
	data, err := os.ReadFile(filepath.Join(home, ".pset", "config.json"))
	if err != nil {
		t.Skipf("no ~/.pset/config.json: %v", err)
	}
	var cfg engine.Settings
	if err := json.Unmarshal(data, &cfg); err != nil {
		t.Skipf("config is not valid JSON: %v", err)
	}
	if !cfg.ChatConfigured() {
		t.Skip("no API key in the config")
	}
	return llm.New(cfg.APIBaseURL, cfg.APIKey, cfg.EmbedBaseURL, cfg.EmbedModel), cfg
}

// TestLiveEmbedding sends one embedding and skips when the local endpoint
// does not answer (e.g. ollama is not running).
func TestLiveEmbedding(t *testing.T) {
	client, cfg := liveClient(t)
	if cfg.EmbedBaseURL == "" {
		t.Skip("no embedBaseURL configured")
	}
	vectors, err := client.Embed(context.Background(), []string{"reply with the word ok"})
	if err != nil {
		t.Skipf("embed endpoint not answering: %v", err)
	}
	if len(vectors) != 1 || len(vectors[0]) == 0 {
		t.Fatalf("embeddings = %v, want one non-empty vector", vectors)
	}
}

// TestLiveChatStream streams one 1-token ask and expects the word ok.
func TestLiveChatStream(t *testing.T) {
	client, _ := liveClient(t)

	var deltas int
	text, err := client.ChatStream(context.Background(), llm.ChatRequest{
		Model:    llm.ChatModel,
		Messages: []llm.Message{llm.TextMessage("user", "Reply with the word ok.")},
	}, func(string) error {
		deltas++
		return nil
	})
	if err != nil {
		skipRateLimit(t, err)
		t.Fatalf("chat stream: %v", err)
	}
	if deltas == 0 {
		t.Error("no deltas arrived")
	}
	if !strings.Contains(strings.ToLower(text), "ok") {
		t.Errorf("reply = %q, want the word ok", text)
	}
}

// skipRateLimit keeps the smoke test green under provider rate limits.
func skipRateLimit(t *testing.T, err error) {
	t.Helper()
	var llmErr *llm.LLMError
	if errors.As(err, &llmErr) && llmErr.Status == http.StatusTooManyRequests {
		t.Skipf("rate limited: %v", err)
	}
}
