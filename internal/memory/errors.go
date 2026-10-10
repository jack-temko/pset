package memory

import "github.com/jackt/pset/internal/errs"

var (
	textEmpty = errs.Define(errs.Entry{
		ID:    "memory.empty",
		What:  "Write what to remember.",
		Scope: errs.ScopeField,
	})
	textTooLong = errs.Define(errs.Entry{
		ID:    "memory.too_long",
		What:  "Keep it to a sentence or two ({max} characters at most).",
		Scope: errs.ScopeField,
	})
	memoryNotFound = errs.Define(errs.Entry{
		ID:     "memory.not_found",
		What:   "That memory isn't there.",
		Why:    "It was already forgotten, or the list is out of date.",
		Fix:    "Reload the page to see what is remembered now.",
		Action: errs.ActionReload,
		Status: 404,
	})
)
