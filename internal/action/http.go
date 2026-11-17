package action

import (
	"encoding/json"
	"net/http"

	"github.com/jackt/pset/internal/httpx"
)

// Routes mounts the catalog: the list the palette reads, the one route
// every action runs through, and Undo.
func (c *Catalog) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/actions", httpx.Reply(func(*http.Request) (List, error) {
		return List{Actions: c.Entries()}, nil
	}))
	mux.HandleFunc("POST /api/actions/{id}", httpx.Send(http.StatusOK, func(r *http.Request, in json.RawMessage) (Done, error) {
		return c.Run(r.Context(), r.PathValue("id"), in)
	}))
	mux.HandleFunc("POST /api/undo", httpx.Send(http.StatusOK, func(r *http.Request, in Undo) (Undone, error) {
		return c.Undo(r.Context(), in.Action)
	}))
}
