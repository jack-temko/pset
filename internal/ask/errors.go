package ask

import (
	"net/http"

	"github.com/jackt/pset/internal/errs"
)

var (
	emptyQuestion = errs.Define(errs.Entry{
		ID:    "ask.empty_question",
		What:  "Ask something.",
		Scope: errs.ScopeField,
	})
	questionTooLong = errs.Define(errs.Entry{
		ID:    "ask.question_too_long",
		What:  "That's too long for one question.",
		Scope: errs.ScopeField,
	})
	selectionTooLong = errs.Define(errs.Entry{
		ID:    "ask.selection_too_long",
		What:  "That selection is too long to ask about. Pick a smaller piece.",
		Scope: errs.ScopeField,
	})
	turnNotFound = errs.Define(errs.Entry{
		ID:     "ask.turn_not_found",
		What:   "That question isn't in this conversation.",
		Why:    "It was cleared, or the page is out of date.",
		Fix:    "Reload the page to see the conversation as it is now.",
		Action: errs.ActionReload,
		Status: http.StatusNotFound,
	})
)
