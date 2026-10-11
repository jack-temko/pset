package agent

import (
	"net/http"

	"github.com/jackt/pset/internal/errs"
)

// ErrNoAnswer is a run whose model stopped without writing anything, even
// when asked again. Trying the whole thing again usually works.
var ErrNoAnswer = errs.Define(errs.Entry{
	ID:     "agent.no_answer",
	What:   "The model stopped without writing an answer.",
	Why:    "It ended its turn with nothing written, or left a part out, even when asked again.",
	Fix:    "Trying again usually works.",
	Action: errs.ActionRetry,
	Status: http.StatusBadGateway,
})
