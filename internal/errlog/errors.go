package errlog

import "github.com/jackt/pset/internal/errs"

var (
	readFailed = errs.Define(errs.Entry{
		ID:     "errors.read_failed",
		What:   "Couldn't read the list of errors.",
		Why:    "PSet's database didn't answer.",
		Fix:    "Try again. If it keeps happening, check the database in Settings.",
		Action: errs.ActionRetry,
		Status: 500,
	})
	clearFailed = errs.Define(errs.Entry{
		ID:     "errors.clear_failed",
		What:   "Couldn't clear the list of errors.",
		Why:    "PSet's database didn't answer.",
		Fix:    "Try again. If it keeps happening, check the database in Settings.",
		Action: errs.ActionRetry,
		Status: 500,
	})
)
