package llm

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/jackt/pset/internal/errs"
)

// The entries llm owns: why a model call failed. A failed call carries its
// entry in its chain (CallError unwraps to it), so a feature that fails
// because of it wraps it in its own entry and the student is told the cause.
var (
	// KeyMissing is a call that needs a key nobody has saved.
	KeyMissing = errs.Define(errs.Entry{
		ID:     "key.missing",
		What:   "There's no OpenRouter key yet.",
		Why:    "PSet needs a key to read pages and write answers.",
		Fix:    "Add your key in Settings, under Connections.",
		Action: errs.ActionOpenSettings,
		Status: http.StatusUnprocessableEntity,
	})
	keyRefused = errs.Define(errs.Entry{
		ID:     "key.refused",
		What:   "OpenRouter refused the key.",
		Why:    "The key in Settings may be wrong, expired or deleted.",
		Fix:    "Check the key in Settings, then try again.",
		Action: errs.ActionOpenSettings,
		Status: http.StatusUnprocessableEntity,
	})
	keyOutOfCredit = errs.Define(errs.Entry{
		ID:     "key.out_of_credit",
		What:   "Your OpenRouter account is out of credit.",
		Why:    "Your OpenRouter account is out of credit, so PSet can't use a model.",
		Fix:    "Add credit on OpenRouter, then try again.",
		Action: errs.ActionRetry,
		Status: http.StatusUnprocessableEntity,
	})
	modelUnknown = errs.Define(errs.Entry{
		ID:     "model.unknown",
		What:   "OpenRouter doesn't know a model PSet uses.",
		Why:    "A model PSet relies on was renamed or removed.",
		Fix:    "Check for a PSet update.",
		Action: errs.ActionCheckUpdate,
		Status: http.StatusUnprocessableEntity,
	})
	modelBusy = errs.Define(errs.Entry{
		ID:     "model.busy",
		What:   "OpenRouter didn't answer properly.",
		Why:    "OpenRouter is busy or having trouble right now.",
		Fix:    "Try again in a minute.",
		Action: errs.ActionRetry,
		Status: http.StatusBadGateway,
	})
	modelRejected = errs.Define(errs.Entry{
		ID:     "model.rejected",
		What:   "OpenRouter turned the request down.",
		Why:    "OpenRouter refused it for a reason PSet has no name for.",
		Fix:    "Try again. If it keeps happening, copy the details and report it.",
		Action: errs.ActionRetry,
		Status: http.StatusBadGateway,
	})
	// ModelUnreachable is a call that never got an answer: no connection, or
	// no reply in time.
	ModelUnreachable = errs.Define(errs.Entry{
		ID:     "model.unreachable",
		What:   "PSet couldn't reach OpenRouter.",
		Why:    "The internet connection is down, or OpenRouter didn't answer in time.",
		Fix:    "Check the internet connection, then try again.",
		Action: errs.ActionRetry,
		Status: http.StatusBadGateway,
	})
	modelCut = errs.Define(errs.Entry{
		ID:     "model.cut",
		What:   "The model's answer stopped partway.",
		Why:    "The connection to the model dropped while it was writing.",
		Fix:    "Trying again usually works.",
		Action: errs.ActionRetry,
		Status: http.StatusBadGateway,
	})
)

// The embeddings come from Ollama on this computer, not OpenRouter, so a
// failed embedding is these and not the model.* entries.
var (
	EmbedUnreachable = errs.Define(errs.Entry{
		ID:     "embed.unreachable",
		What:   "PSet couldn't reach Ollama.",
		Why:    "Ollama searches your books, and it isn't running or isn't answering.",
		Fix:    "Settings, under Health, says how to start it.",
		Action: errs.ActionOpenSettings,
		Status: http.StatusBadGateway,
	})
	embedFailed = errs.Define(errs.Entry{
		ID:     "embed.failed",
		What:   "Ollama couldn't build the book's search.",
		Why:    "Ollama answered with an error. It may be out of memory or missing its model.",
		Fix:    "Settings, under Health, says how to check it, then try again.",
		Action: errs.ActionOpenSettings,
		Status: http.StatusBadGateway,
	})
)

// embedError says a failed embedding call in the embed.* entries. The text
// of the original stays in the chain; its OpenRouter classification does not.
func embedError(err error) error {
	var ce *CallError
	switch {
	case errors.As(err, &ce):
		return embedFailed.Wrap(fmt.Errorf("%v", err))
	case errors.Is(err, ModelUnreachable):
		return EmbedUnreachable.Wrap(fmt.Errorf("%v", err))
	}
	return err
}

// catalog is the entry a failed call's status and body mean.
func (e *CallError) catalog() *errs.Error {
	switch {
	case OutOfCredit(e.Status, e.Body):
		return keyOutOfCredit.New()
	case e.Status == http.StatusUnauthorized || e.Status == http.StatusForbidden:
		return keyRefused.New()
	case e.Status == http.StatusNotFound,
		e.Status >= 400 && e.Status < 500 && strings.Contains(strings.ToLower(e.Body), "model"):
		return modelUnknown.New()
	case e.Status == http.StatusTooManyRequests || e.Status >= 500:
		return modelBusy.New()
	}
	return modelRejected.New()
}

// Unwrap is the catalog entry the call's status and body mean, so a caller
// that returns the error gets the cause in its chain.
func (e *CallError) Unwrap() error { return e.catalog() }
