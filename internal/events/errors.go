package events

import "github.com/jackt/pset/internal/errs"

var noStreaming = errs.Define(errs.Entry{
	ID:     "events.no_streaming",
	What:   "PSet can't keep this page up to date.",
	Why:    "The connection between the page and PSet can't carry live updates.",
	Fix:    "Reload the page. If it keeps happening, report it with the details.",
	Action: errs.ActionReload,
	Status: 500,
})
