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

// Why an import failed. importFailed is the outer entry of every failed
// book, named by its title; the cause under it says why.
var (
	importFailed = errs.Define(errs.Entry{
		ID:     "import.failed",
		What:   "Couldn't prepare {title}.",
		Why:    "Something went wrong while PSet was preparing it.",
		Fix:    "Try again.",
		Action: errs.ActionRetry,
	})
	importStopped = errs.Define(errs.Entry{
		ID:     "import.stopped",
		What:   "{title} was stopped.",
		Why:    "You stopped it before it finished.",
		Fix:    "Try again to carry on where it left off.",
		Action: errs.ActionRetry,
	})
	importCancelled = errs.Define(errs.Entry{
		ID:     "import.cancelled",
		What:   "{title} was cancelled before it started.",
		Why:    "You stopped it before PSet began.",
		Fix:    "Try again to start it.",
		Action: errs.ActionRetry,
	})
	pdfUnreadable = errs.Define(errs.Entry{
		ID:   "import.pdf_unreadable",
		What: "This PDF can't be read.",
		Why:  "PSet couldn't open it, so it may be damaged or locked.",
		Fix:  "Try a different copy of the file.",
	})
	pdfEmpty = errs.Define(errs.Entry{
		ID:   "import.pdf_empty",
		What: "This PDF has no pages.",
		Why:  "The file opened but holds nothing to read.",
		Fix:  "Try a different copy of the file.",
	})
	pagesUnread = errs.Define(errs.Entry{
		ID:     "import.pages_unread",
		What:   "Some pages couldn't be read.",
		Why:    "PSet's text reader, Tesseract, failed on {count} ({list}).",
		Fix:    "Try again, or check that Tesseract works in Settings.",
		Action: errs.ActionRetry,
	})
)
