package httpx

import (
	"errors"
	"fmt"
	"net/http"
)

// Legacy: the pre-catalog error. Each package moves to internal/errs in its
// own commit; this goes when the last one has.

func (e *Error) Error() string { return string(e.Code) + ": " + e.Message }

// Status is the HTTP status this error answers with.
func (e *Error) Status() int {
	if e.status != 0 {
		return e.status
	}
	switch e.Code {
	case CodeNotFound:
		return http.StatusNotFound
	case CodeForbidden:
		return http.StatusForbidden
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

// legacy answers a pre-catalog Error as itself.
func legacy(w http.ResponseWriter, err error) bool {
	var e *Error
	if !errors.As(err, &e) {
		return false
	}
	JSON(w, e.Status(), e)
	return true
}
