package ask

import (
	"net/http"

	"github.com/jackt/pset/internal/httpx"
)

// Routes mounts the Ask endpoints.
func (s *Service) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/books/{id}/turns", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		ts, err := s.Turns(r.Context(), r.PathValue("id"))
		if err != nil {
			return err
		}
		return httpx.OK(w, Turns{Turns: ts})
	}))
	mux.HandleFunc("POST /api/books/{id}/turns", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		var q Question
		if err := httpx.Decode(r, &q); err != nil {
			return err
		}
		t, err := s.Ask(r.Context(), r.PathValue("id"), q)
		if err != nil {
			return err
		}
		httpx.JSON(w, http.StatusCreated, t)
		return nil
	}))
	mux.HandleFunc("DELETE /api/books/{id}/turns", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		if err := s.Clear(r.Context(), r.PathValue("id")); err != nil {
			return err
		}
		return httpx.NoContent(w)
	}))
	mux.HandleFunc("POST /api/turns/{id}/stop", httpx.H(func(w http.ResponseWriter, r *http.Request) error {
		t, err := s.Stop(r.Context(), r.PathValue("id"))
		if err != nil {
			return err
		}
		return httpx.OK(w, t)
	}))
}
