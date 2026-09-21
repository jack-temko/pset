// Package httpx is the thin HTTP layer every feature's handlers share: one
// error shape, JSON in and out, and a handler adapter that turns a returned
// error into that shape. Features own their routes; this package owns how
// a route answers.
package httpx

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
)

func (e *Error) Error() string { return string(e.Code) + ": " + e.Message }

// Status is the HTTP status this error answers with.
func (e *Error) Status() int {
	if e.status != 0 {
		return e.status
	}
	switch e.Code {
	case CodeNotFound:
		return http.StatusNotFound
	case CodeDuplicateBook, CodeBusy:
		return http.StatusConflict
	case CodeInternal:
		return http.StatusInternalServerError
	default:
		return http.StatusUnprocessableEntity
	}
}

// Errorf builds an Error.
func Errorf(code Code, format string, args ...any) *Error {
	return &Error{Code: code, Message: fmt.Sprintf(format, args...)}
}

// OnField returns a copy of e that points at a field.
func (e *Error) OnField(field string) *Error {
	c := *e
	c.Field = field
	return &c
}

// About returns a copy of e that points at a resource.
func (e *Error) About(id string) *Error {
	c := *e
	c.ID = id
	return &c
}

// NotFound is the common case.
func NotFound(what string) *Error { return Errorf(CodeNotFound, "That %s doesn't exist.", what) }

// Invalid is a request that can't be acted on as sent.
func Invalid(field, format string, args ...any) *Error {
	return Errorf(CodeInvalid, format, args...).OnField(field)
}

// HandlerFunc is a handler that returns its error instead of writing it.
type HandlerFunc func(w http.ResponseWriter, r *http.Request) error

// Logger receives unexpected errors. Set once at startup.
var Logger = slog.Default()

// H adapts a HandlerFunc. An *Error answers as itself; anything else is a
// bug or an outage, logged in full and answered with a generic message.
func H(fn HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		err := fn(w, r)
		if err == nil {
			return
		}
		var e *Error
		if !errors.As(err, &e) {
			Logger.Error("request failed", "method", r.Method, "path", r.URL.Path, "err", err)
			e = Errorf(CodeInternal, "Something went wrong. The details are in the log.")
		}
		JSON(w, e.Status(), e)
	}
}

// JSON writes v with the given status.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
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
// field is a bug on the client, and silently ignoring it hides the bug.
func Decode(r *http.Request, v any) error {
	dec := json.NewDecoder(io.LimitReader(r.Body, maxBody))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return Errorf(CodeInvalid, "The request couldn't be read: %v", err)
	}
	return nil
}

// NotFoundAPI answers every unknown /api/ path, so the API namespace never
// falls through to the SPA's HTML.
func NotFoundAPI(w http.ResponseWriter, r *http.Request) {
	JSON(w, http.StatusNotFound, Errorf(CodeNotFound, "No such endpoint: %s %s", r.Method, r.URL.Path))
}
