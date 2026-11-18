package settings

import (
	"context"
	"net/http"

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

// LiveDialer dials OpenRouter.
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
