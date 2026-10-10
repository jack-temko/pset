package library

import (
	"net/http"

	"github.com/jackt/pset/internal/errs"
)

var (
	notPDF = errs.Define(errs.Entry{
		ID:    "library.not_pdf",
		What:  "That isn't a PDF.",
		Scope: errs.ScopeField,
	})
	bookDuplicate = errs.Define(errs.Entry{
		ID:     "book.duplicate",
		What:   "{title} is already on your shelf.",
		Why:    "This is the same file as a book you already added.",
		Fix:    "Open the one on your shelf.",
		Action: errs.ActionOpenBook,
		Status: http.StatusConflict,
	})
	pageNotFound = errs.Define(errs.Entry{
		ID:     "library.page_not_found",
		What:   "That page isn't in this book.",
		Why:    "The page number is past the end of the book, or isn't a number.",
		Fix:    "Go to a page inside the book.",
		Status: http.StatusNotFound,
	})
	titleEmpty = errs.Define(errs.Entry{
		ID:    "library.title_empty",
		What:  "A book needs a title.",
		Scope: errs.ScopeField,
	})
	badCover = errs.Define(errs.Entry{
		ID:    "library.bad_cover",
		What:  "That isn't one of the cover colours.",
		Scope: errs.ScopeField,
	})
	ollamaDown = errs.Define(errs.Entry{
		ID:     "library.no_ollama",
		What:   "PSet can't reach Ollama.",
		Why:    "Ollama searches your books, and it isn't answering.",
		Fix:    "Settings, under Health, says how to start it.",
		Action: errs.ActionOpenSettings,
		Status: http.StatusUnprocessableEntity,
	})
	notFailed = errs.Define(errs.Entry{
		ID:     "library.not_failed",
		What:   "Only a book that failed to import can be tried again.",
		Why:    "This book isn't in a failed state, so the page is out of date.",
		Fix:    "Reload the page to see where the book stands.",
		Action: errs.ActionReload,
	})
	runsEmpty = errs.Define(errs.Entry{
		ID:    "library.runs_empty",
		What:  "Say where printed page 1 is.",
		Scope: errs.ScopeField,
	})
	runOutside = errs.Define(errs.Entry{
		ID:    "library.run_outside",
		What:  "Each PDF page has to be inside the book: 1 to {max}.",
		Scope: errs.ScopeField,
	})
	runBadOffset = errs.Define(errs.Entry{
		ID:    "library.run_bad_offset",
		What:  "PDF page {from} can't be printed as page {printed}.",
		Scope: errs.ScopeField,
	})
	badProblemForm = errs.Define(errs.Entry{
		ID:    "library.bad_problem_form",
		What:  "That isn't a way of numbering problems.",
		Scope: errs.ScopeField,
	})
	badProblemWhere = errs.Define(errs.Entry{
		ID:    "library.bad_problem_where",
		What:  "Problems sit after each section or at each chapter's end.",
		Scope: errs.ScopeField,
	})
)
