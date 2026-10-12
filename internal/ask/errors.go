package ask

import (
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
	turnFailed = errs.Define(errs.Entry{
		ID:     "ask.turn_failed",
		What:   "Couldn't answer that.",
		Why:    "Something went wrong while the tutor was answering.",
		Fix:    "Ask again.",
		Action: errs.ActionRetry,
	})
)
