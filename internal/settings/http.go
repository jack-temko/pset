package settings

import (
	"context"
	"net/http"

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
		var in ConnectionInput
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
		var in ConnectionInput
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

// LiveDialer dials the real endpoints.
type LiveDialer struct{}

func (LiveDialer) Chat(ctx context.Context, c ChatConnection) error {
	client := llm.Open(llm.Config{ChatEndpoint: c.Endpoint, APIKey: c.APIKey, ChatModel: c.Model})
	_, err := client.ChatOnce(ctx, llm.ChatRequest{
		Model:     c.Model,
		Messages:  []llm.Message{llm.TextMessage("user", "Reply with the word ok.")},
		MaxTokens: 1,
	})
	return err
}

func (LiveDialer) Embed(ctx context.Context, c EmbedConnection) (int, error) {
	client := llm.Open(llm.Config{EmbedEndpoint: c.Endpoint, EmbedModel: c.Model})
	v, err := client.Embed(ctx, []string{"probe"})
	if err != nil {
		return 0, err
	}
	return len(v[0]), nil
}
