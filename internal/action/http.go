package action

import (
	"io"
	"net/http"

	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/httpx"
)

// maxInput is the largest action input: names and ids, never a file (files
// come through their own upload route).
const maxInput = 1 << 20

// Routes mounts the catalog: the list the palette reads, the one route
// every action runs through, and Undo.
func (c *Catalog) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/actions", httpx.Reply(func(*http.Request) (List, error) {
		return List{Actions: c.Entries()}, nil
	}))
	// An action that takes nothing may be sent with no body.
	// The path value is {action}, which httpx reports with a failure, so
	// two actions' failures are two incidents.
	mux.HandleFunc("POST /api/actions/{action}", httpx.Reply(func(r *http.Request) (Done, error) {
		body, err := io.ReadAll(http.MaxBytesReader(nil, r.Body, maxInput))
		if err != nil {
			return Done{}, errs.InvalidJSON.Wrap(err)
		}
		return c.Run(r.Context(), r.PathValue("action"), body)
	}))
	mux.HandleFunc("POST /api/undo", httpx.Send(http.StatusOK, func(r *http.Request, in Undo) (Undone, error) {
		return c.Undo(r.Context(), in.Action, in.Newest)
	}))
}
