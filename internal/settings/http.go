package settings

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/llm"
)

// Routes mounts the Settings endpoints.
func (s *Service) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/settings", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		v, err := s.Get(r.Context())
		if err != nil {
			return err
		}
		return httpx.OK(w, v)
	}))
	mux.HandleFunc("PUT /api/settings", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		var in KeyInput
		if err := httpx.Decode(r, &in); err != nil {
			return err
		}
		v, err := s.Save(r.Context(), in)
		if err != nil {
			return err
		}
		return httpx.OK(w, v)
	}))
	mux.HandleFunc("PUT /api/settings/profile", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		var p Profile
		if err := httpx.Decode(r, &p); err != nil {
			return err
		}
		v, err := s.SaveProfile(r.Context(), p)
		if err != nil {
			return err
		}
		return httpx.OK(w, v)
	}))
	mux.HandleFunc("POST /api/settings/test", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		var in KeyInput
		if err := httpx.Decode(r, &in); err != nil {
			return err
		}
		v, err := s.Test(r.Context(), in)
		if err != nil {
			return err
		}
		return httpx.OK(w, v)
	}))
	mux.HandleFunc("GET /api/health", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		return httpx.OK(w, s.Health(r.Context()))
	}))
	mux.HandleFunc("POST /api/health/{check}/fix", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		v, err := s.Fix(r.Context(), r.PathValue("check"))
		if err != nil {
			return err
		}
		return httpx.OK(w, v)
	}))
	mux.HandleFunc("GET /api/reset", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		v, err := s.ResetCounts(r.Context())
		if err != nil {
			return err
		}
		return httpx.OK(w, v)
	}))
	mux.HandleFunc("POST /api/reset", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		if err := s.Reset(r.Context()); err != nil {
			return err
		}
		return httpx.NoContent(w)
	}))
	mux.HandleFunc("GET /api/about", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		return httpx.OK(w, s.About())
	}))
}

// LiveDialer dials OpenRouter and the local Ollama.
type LiveDialer struct{}

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

func (LiveDialer) Ollama(ctx context.Context) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, ollamaAPI+"/tags", nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
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
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("ollama answered %d: %s", resp.StatusCode, strings.TrimSpace(string(msg)))
	}
	return nil
}
