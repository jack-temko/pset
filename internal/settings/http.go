package settings

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/llm"
)

// Routes mounts the Settings endpoints.
func (s *Service) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/settings", httpx.Reply(func(r *http.Request) (Settings, error) {
		return s.Get(r.Context())
	}))
	mux.HandleFunc("PUT /api/settings", httpx.Send(http.StatusOK, func(r *http.Request, in KeyInput) (SaveResult, error) {
		return s.Save(r.Context(), in)
	}))
	mux.HandleFunc("PUT /api/settings/profile", httpx.Send(http.StatusOK, func(r *http.Request, p Profile) (Profile, error) {
		return s.SaveProfile(r.Context(), p)
	}))
	mux.HandleFunc("POST /api/settings/test", httpx.Send(http.StatusOK, func(r *http.Request, in KeyInput) (TestResult, error) {
		return s.Test(r.Context(), in)
	}))
	mux.HandleFunc("GET /api/health", httpx.Reply(func(r *http.Request) (Health, error) {
		return s.Health(r.Context()), nil
	}))
	mux.HandleFunc("POST /api/health/{check}/fix", httpx.Reply(func(r *http.Request) (HealthCheck, error) {
		return s.Fix(r.Context(), r.PathValue("check"))
	}))
	mux.HandleFunc("GET /api/reset", httpx.Reply(func(r *http.Request) (ResetCounts, error) {
		return s.ResetCounts(r.Context())
	}))
	mux.HandleFunc("POST /api/reset", httpx.Act(func(r *http.Request) error {
		return s.Reset(r.Context())
	}))
	mux.HandleFunc("GET /api/about", httpx.Reply(func(_ *http.Request) (About, error) {
		return s.About(), nil
	}))
}

// LiveDialer dials OpenRouter and the local Ollama.
type LiveDialer struct{}

// Chat checks an OpenRouter key with a one-word request.
func (LiveDialer) Chat(ctx context.Context, apiKey string) error {
	client := llm.Open(llm.Config{ChatEndpoint: llm.OpenRouter, APIKey: apiKey, ChatModel: llm.Writer.Model})
	_, err := client.ChatOnce(ctx, llm.ChatRequest{
		Model:     llm.Writer.Model,
		Messages:  []llm.Message{llm.TextMessage("user", "Reply with the word ok.")},
		MaxTokens: 1,
	})
	return err
}

// ollamaAPI is Ollama's own API, beside the OpenAI-shaped one PSet embeds
// with: it says which models are pulled, and pulls one.
var ollamaAPI = strings.TrimSuffix(llm.EmbedEndpoint, "/v1") + "/api"

// Ollama lists the models the local Ollama has.
func (LiveDialer) Ollama(ctx context.Context) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, ollamaAPI+"/tags", nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer cleanup.Close(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama answered %d", resp.StatusCode)
	}
	var tags struct {
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tags); err != nil {
		return nil, err
	}
	out := make([]string, len(tags.Models))
	for i, m := range tags.Models {
		out[i] = m.Name
	}
	return out, nil
}

// Pull asks the local Ollama to download a model.
func (LiveDialer) Pull(ctx context.Context, model string) error {
	body, _ := json.Marshal(map[string]any{"model": model, "stream": false})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, ollamaAPI+"/pull", bytes.NewReader(body))
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer cleanup.Close(resp.Body)
	if resp.StatusCode != http.StatusOK {
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("ollama answered %d: %s", resp.StatusCode, strings.TrimSpace(string(msg)))
	}
	return nil
}
