package settings

import (
	"github.com/jackt/pset/internal/errs"
)

var (
	nameTooLong = errs.Define(errs.Entry{
		ID:    "settings.name_too_long",
		What:  "Keep it under {max} characters.",
		Scope: errs.ScopeField,
	})
	keyEmpty = errs.Define(errs.Entry{
		ID:    "settings.key_empty",
		What:  "Paste your OpenRouter key first.",
		Scope: errs.ScopeField,
	})
	testFailed = errs.Define(errs.Entry{
		ID:     "settings.test_failed",
		What:   "Couldn't connect with that key.",
		Why:    "PSet couldn't finish the test.",
		Fix:    "Try again in a minute.",
		Action: errs.ActionRetry,
	})
)
