// Package httpx is the thin HTTP layer every feature's handlers share: one
// error shape, JSON in and out, and a handler adapter that turns a returned
// error into that shape. Features own their routes; this package owns how
// a route answers.
package httpx

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/errs"
)

// HandlerFunc is a handler that returns its error instead of writing it.
type HandlerFunc func(w http.ResponseWriter, r *http.Request) error

// H adapts a HandlerFunc. A returned error is resolved against the error
// catalog (internal/errs), logged and kept with an incident id, and answered
// as the catalog View with the entry's status. An error with no catalog
// entry in its chain is a bug or an outage: it answers internal.unexpected,
// so nothing internal leaks.
func H(fn HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := fn(w, r); err != nil {
			Fail(w, r, err)
		}
	}
}

// Fail answers err as H does. For a handler that has to answer before it
// returns, such as one already streaming.
func Fail(w http.ResponseWriter, r *http.Request, err error) {
	// A client that went away (a tab closed, a request cancelled) is not a
	// failure and gets no answer.
	if r.Context().Err() != nil {
		return
	}
	// A method-and-path pattern ("GET /api/books/{id}") says which route it
	// was; any other (the catch-all) says nothing, so the path is the route.
	route := r.Pattern
	if !strings.Contains(route, " ") {
		route = r.Method + " " + r.URL.Path
	}
	// A cancel while the client is still there (a shutdown) still gets an
	// answer, but it is not a failure of its own and is not kept.
	if errors.Is(err, context.Canceled) {
		v := errs.Resolve(err)
		JSON(w, v.Status, v)
		return
	}
	v := errs.Respond(r.Context(), err, errs.Where{Route: route})
	JSON(w, v.Status, v)
}

// JSON writes v with the given status.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	cleanup.Log("write the response", json.NewEncoder(w).Encode(v))
}

// Write writes a response body. A failure means the client went away, and is
// only logged.
func Write(w http.ResponseWriter, data []byte) {
	_, err := w.Write(data)
	cleanup.Log("write the response", err)
}

// OK writes v with 200, and returns nil so a handler can end on it.
func OK(w http.ResponseWriter, v any) error {
	JSON(w, http.StatusOK, v)
	return nil
}

// NoContent answers 204.
func NoContent(w http.ResponseWriter) error {
	w.WriteHeader(http.StatusNoContent)
	return nil
}

// maxBody caps a JSON request body. Uploads don't go through Decode.
const maxBody = 1 << 20

// Decode reads a JSON body into v, refusing unknown fields: a misspelt
// field is a bug on the client, and silently ignoring it hides the bug. A
// body over maxBody is refused as too large, not read as far as it goes.
func Decode(r *http.Request, v any) error {
	dec := json.NewDecoder(http.MaxBytesReader(nil, r.Body, maxBody))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			return errs.TooLarge.Wrap(err, "limit", strconv.Itoa(maxBody>>20))
		}
		return errs.InvalidJSON.Wrap(err)
	}
	return nil
}

// NotFoundAPI answers every unknown /api/ path, so the API namespace never
// falls through to the SPA's HTML.
func NotFoundAPI(w http.ResponseWriter, r *http.Request) {
	Fail(w, r, errs.NoSuchEndpoint.New())
}
