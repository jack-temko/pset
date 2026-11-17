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
	notFixable = errs.Define(errs.Entry{
		ID:   "settings.not_fixable",
		What: "PSet can't fix this one itself.",
		Why:  "Fixing it needs something installed or changed outside PSet.",
		Fix:  "Follow the steps listed with the check, then check again.",
	})
	fixDataDir = errs.Define(errs.Entry{
		ID:   "settings.fix_data_dir",
		What: "Couldn't create the data folder.",
		Why:  "PSet isn't allowed to create it there, or the disk is full.",
		Fix:  "Create the folder yourself, or free up space, then check again.",
	})
	fixDatabase = errs.Define(errs.Entry{
		ID:   "settings.fix_database",
		What: "Couldn't update the database.",
		Why:  "The database can't be brought up to date, which means it is damaged or comes from a newer PSet.",
		Fix:  "Update PSet. If that doesn't help, reset PSet from this page.",
	})
	fixOllama = errs.Define(errs.Entry{
		ID:     "settings.fix_ollama",
		What:   "Ollama couldn't download {model}.",
		Why:    "Ollama isn't running, or the download was cut off.",
		Fix:    "Start Ollama and check the internet connection, then try again.",
		Action: errs.ActionRetry,
	})
)
