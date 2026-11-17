//go:build dev

package main

import (
	"net/http"

	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/runner"
	"github.com/jackt/pset/internal/step"
)

// force is the development switch's request: the next times runs of a step
// fail with a catalog error (A5 of ideas/errors-grill.md).
type force struct {
	Step  step.Name `json:"step"`
	Error string    `json:"error"`
	Times int       `json:"times"`
}

// In a dev build (`make dev`), POST /api/dev/force makes any step fail with
// any catalog error, so every state can be looked at on a real screen. A
// release has no such route.
func init() {
	devRoutes = func(mux *http.ServeMux, r *runner.Runner) {
		mux.HandleFunc("POST /api/dev/force", httpx.Take(func(_ *http.Request, in force) error {
			e, ok := errs.Lookup(in.Error)
			if !ok && in.Times > 0 {
				return errs.Gone.New("thing", "error")
			}
			r.Force(in.Step, e, in.Times)
			return nil
		}))
	}
}
