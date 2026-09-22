package memory

import (
	"net/http"

	"github.com/jackt/pset/internal/httpx"
)

// Routes mounts the memory menu's endpoints.
func (s *Service) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/books/{id}/memories", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		ms, err := s.List(r.Context(), r.PathValue("id"))
		if err != nil {
			return err
		}
		return httpx.OK(w, Memories{Memories: ms})
	}))
	mux.HandleFunc("POST /api/books/{id}/memories", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		var n NewMemory
		if err := httpx.Decode(r, &n); err != nil {
			return err
		}
		m, err := s.Add(r.Context(), r.PathValue("id"), n)
		if err != nil {
			return err
		}
		httpx.JSON(w, http.StatusCreated, m)
		return nil
	}))
	mux.HandleFunc("DELETE /api/memories/{id}", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		if _, err := s.Remove(r.Context(), r.PathValue("id")); err != nil {
			return err
		}
		return httpx.NoContent(w)
	}))
}
