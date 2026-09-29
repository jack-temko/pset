package memory

import (
	"net/http"

	"github.com/jackt/pset/internal/httpx"
)

// Routes mounts the memory menu's endpoints.
func (s *Service) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/books/{id}/memories", httpx.Reply(func(r *http.Request) (Memories, error) {
		ms, err := s.List(r.Context(), r.PathValue("id"))
		return Memories{Memories: ms}, err
	}))
	mux.HandleFunc("POST /api/books/{id}/memories", httpx.Send(http.StatusCreated, func(r *http.Request, n NewMemory) (Memory, error) {
		return s.Add(r.Context(), r.PathValue("id"), n)
	}))
	mux.HandleFunc("DELETE /api/memories/{id}", httpx.Act(func(r *http.Request) error {
		_, err := s.Remove(r.Context(), r.PathValue("id"))
		return err
	}))
}
