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
)
