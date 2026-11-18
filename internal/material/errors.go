package material

import (
	"net/http"

	"github.com/jackt/pset/internal/errs"
)

// What adding and reading in a material fails with, in the student's words:
// the old library's own, where it had them.
var (
	notPDF = errs.Define(errs.Entry{
		ID:    "material.not_pdf",
		Kind:  errs.KindYourInput,
		What:  "That isn't a PDF.",
		Scope: errs.ScopeField,
	})
	duplicate = errs.Define(errs.Entry{
		ID:     "material.duplicate",
		Kind:   errs.KindCant,
		What:   "{title} is already in this course.",
		Why:    "This is the same file as a material the course already has.",
		Fix:    "Open the one the course has.",
		Status: http.StatusConflict,
	})
	uploadGone = errs.Define(errs.Entry{
		ID:     "material.upload_gone",
		Kind:   errs.KindCant,
		What:   "That upload isn't there any more.",
		Why:    "An upload is kept a day, or it was added already.",
		Fix:    "Choose the file again.",
		Status: http.StatusNotFound,
	})
	titleEmpty = errs.Define(errs.Entry{
		ID:    "material.title_empty",
		Kind:  errs.KindYourInput,
		What:  "Give it a title.",
		Scope: errs.ScopeField,
	})
	titleTooLong = errs.Define(errs.Entry{
		ID:    "material.title_too_long",
		Kind:  errs.KindYourInput,
		What:  "Keep it under {max} characters.",
		Scope: errs.ScopeField,
	})
	pdfUnreadable = errs.Define(errs.Entry{
		ID:     "material.pdf_unreadable",
		Kind:   errs.KindCant,
		What:   "This PDF can't be read.",
		Why:    "PSet couldn't open it, so it may be damaged or locked.",
		Fix:    "Try a different copy of the file.",
		Status: http.StatusUnprocessableEntity,
	})
	pdfEmpty = errs.Define(errs.Entry{
		ID:     "material.pdf_empty",
		Kind:   errs.KindCant,
		What:   "This PDF has no pages.",
		Why:    "The file opened but holds nothing to read.",
		Fix:    "Try a different copy of the file.",
		Status: http.StatusUnprocessableEntity,
	})
	pagesUnread = errs.Define(errs.Entry{
		ID:     "material.pages_unread",
		Kind:   errs.KindCant,
		What:   "Some pages couldn't be read.",
		Why:    "PSet's text reader, Tesseract, failed on {count} ({list}).",
		Fix:    "Try again, or check that Tesseract works in Settings.",
		Action: errs.ActionRetry,
		Status: http.StatusUnprocessableEntity,
	})
)
