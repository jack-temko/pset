package ask

import (
	"net/http"

	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/usage"
)

// Routes mounts the Ask endpoints.
func (s *Service) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/books/{id}/turns", httpx.Reply(func(r *http.Request) (Turns, error) {
		ts, err := s.Turns(r.Context(), r.PathValue("id"))
		return Turns{Turns: ts}, err
	}))
	mux.HandleFunc("POST /api/books/{id}/turns", httpx.Send(http.StatusCreated, func(r *http.Request, q Question) (Turn, error) {
		return s.Ask(r.Context(), r.PathValue("id"), q)
	}))
	mux.HandleFunc("DELETE /api/books/{id}/turns", httpx.Act(func(r *http.Request) error {
		return s.Clear(r.Context(), r.PathValue("id"))
	}))
	mux.HandleFunc("GET /api/turns/{id}/usage", httpx.Reply(func(r *http.Request) (*usage.Detail, error) {
		calls, err := usage.Calls(r.Context(), s.c.DB, usage.SubjectTurn, r.PathValue("id"))
		return usage.Build(calls, nil, 0), err
	}))
	mux.HandleFunc("POST /api/turns/{id}/stop", httpx.Reply(func(r *http.Request) (Turn, error) {
		return s.Stop(r.Context(), r.PathValue("id"))
	}))
}
