package engine

import (
	"errors"
	"fmt"
	"io/fs"
	"strings"

	"github.com/jackt/pset/internal/ocr"
	"github.com/jackt/pset/internal/store"
)

// UserError separates what the user should read (Message) from the full
// error chain, which adapters can dump in verbose mode via Unwrap. Sentinels
// stay checkable with errors.Is through the chain.
type UserError struct {
	Message string
	Err     error
}

func (e *UserError) Error() string { return e.Message }

func (e *UserError) Unwrap() error { return e.Err }

func userf(err error, format string, args ...any) *UserError {
	return &UserError{Message: fmt.Sprintf(format, args...), Err: err}
}

// accessError describes a failed stat in user terms instead of the
// duplicated "stat X: stat X: ..." a raw PathError produces.
func accessError(path string, err error) error {
	switch {
	case errors.Is(err, fs.ErrNotExist):
		return userf(err, "file not found: %s", path)
	case errors.Is(err, fs.ErrPermission):
		return userf(err, "permission denied: %s", path)
	default:
		return userf(err, "cannot access %s", path)
	}
}

// NoMatchError reports a resolver target that matched no book.
type NoMatchError struct {
	Target string
}

func (e *NoMatchError) Error() string { return fmt.Sprintf("no book matches %q", e.Target) }

// AmbiguousError reports a resolver target that matched several books.
type AmbiguousError struct {
	Target string
	Titles []string
}

func (e *AmbiguousError) Error() string {
	return fmt.Sprintf("%q is ambiguous — matches %d books: %s", e.Target, len(e.Titles), strings.Join(e.Titles, ", "))
}

// TextLayerError reports a refusal that hinges on the PDF's own text layer:
// OCR refuses a book that already has one, indexing refuses a book whose PDF
// has none. Problem carries the operation-specific sentence for the title.
type TextLayerError struct {
	Title   string
	Problem string
}

func (e *TextLayerError) Error() string {
	return fmt.Sprintf("%q %s", e.Title, e.Problem)
}

// ErrNoPage reports a request for a page that has no stored row.
var ErrNoPage = errors.New("page not stored")

// ErrTaskNotFound reports a task id that has no row; the store's ErrNotFound
// re-exported so adapters can map it without importing the store.
var ErrTaskNotFound = store.ErrNotFound

// TaskSettledError reports a stop request against a task that is already
// resting — there is nothing running to stop.
type TaskSettledError struct {
	ID     string
	Status string
}

func (e *TaskSettledError) Error() string {
	return fmt.Sprintf("task %s is already %s", e.ID, e.Status)
}

// TaskActiveError reports a retry request against a task that is still
// queued or running — there is nothing to resume yet.
type TaskActiveError struct {
	ID     string
	Status string
}

func (e *TaskActiveError) Error() string {
	return fmt.Sprintf("task %s is still %s — wait for it to finish first", e.ID, e.Status)
}

// PermanentError marks a failure that a retry cannot fix: the PDF is
// encrypted, corrupt, or empty. The adapter offers no Try again for it.
type PermanentError struct {
	Message string
	Err     error
}

func (e *PermanentError) Error() string { return e.Message }

func (e *PermanentError) Unwrap() error { return e.Err }

func permanentf(err error, format string, args ...any) *PermanentError {
	return &PermanentError{Message: fmt.Sprintf(format, args...), Err: err}
}

// EnvironmentError marks a failure the machine causes rather than the input:
// a missing tool, a full disk. A retry works once the machine is fixed.
type EnvironmentError struct {
	Message string
	Err     error
}

func (e *EnvironmentError) Error() string { return e.Message }

func (e *EnvironmentError) Unwrap() error { return e.Err }

// failureKind classifies a task failure for display. The engine decides;
// adapters render what they are told and never parse error text.
func failureKind(err error) string {
	var perm *PermanentError
	if errors.As(err, &perm) {
		return store.FailPermanent
	}
	var env *EnvironmentError
	if errors.As(err, &env) {
		return store.FailEnvironment
	}
	if errors.Is(err, ocr.ErrNotInstalled) {
		return store.FailEnvironment
	}
	return store.FailTransient
}

// notNeeded ends a phase as done with a note: the work turned out to be
// unnecessary (a book that already has a text layer, pages that already
// carry vectors). It is not a fourth outcome — the phase finished.
type notNeeded struct {
	reason string
}

func (e *notNeeded) Error() string { return e.reason }

// userMessage renders an error as its user-facing sentence: typed user
// errors speak for themselves, anything else is a generic retryable line.
func userMessage(err error) string {
	var user *UserError
	if errors.As(err, &user) {
		return user.Message
	}
	return "the model request failed — retry this question"
}

// ResetBlockedError reports a reset attempted while tasks are still queued
// or running.
type ResetBlockedError struct {
	Active int
}

func (e *ResetBlockedError) Error() string {
	return fmt.Sprintf("%d tasks are still queued or running — stop them and wait before resetting", e.Active)
}

// EmbedUnconfiguredError reports preparation attempted with no embeddings
// endpoint. Preparation needs one for its last phase, so it is refused at
// the door rather than discovered forty minutes into OCR.
type EmbedUnconfiguredError struct{}

func (e *EmbedUnconfiguredError) Error() string {
	return "pset needs a model connection before it can prepare books — add the API key under Settings"
}

// LLMUnconfiguredError reports an ask attempted while the chat connection is
// not set up (no API base URL or no key). The adapter maps it to 400.
type LLMUnconfiguredError struct{}

func (e *LLMUnconfiguredError) Error() string {
	return "asking needs a chat model connection — add the API key under Settings"
}

// taskStopped ends a pipeline early. Stopping keeps the work either way:
// a student's stop rests the task as paused, a process shutdown returns it
// to the queue so it resumes on the next boot. Status is what to persist.
type taskStopped struct {
	status string
}

func (e *taskStopped) Error() string {
	return fmt.Sprintf("task stopped (%s)", e.status)
}
