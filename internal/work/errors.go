package work

import "github.com/jackt/pset/internal/errs"

// What the student's typing is refused for, said under the field: the old
// homework's words, under the work's ids.
var (
	titleEmpty = errs.Define(errs.Entry{
		ID:    "work.title_empty",
		Kind:  errs.KindYourInput,
		What:  "Give it a title.",
		Scope: errs.ScopeField,
	})
	titleTooLong = errs.Define(errs.Entry{
		ID:    "work.title_too_long",
		Kind:  errs.KindYourInput,
		What:  "Keep the title under {max} characters.",
		Scope: errs.ScopeField,
	})
	badDueDate = errs.Define(errs.Entry{
		ID:    "work.bad_due_date",
		Kind:  errs.KindYourInput,
		What:  "That isn't a date.",
		Scope: errs.ScopeField,
	})
	draftTooLong = errs.Define(errs.Entry{
		ID:    "work.draft_too_long",
		Kind:  errs.KindYourInput,
		What:  "Keep each question under {max} characters.",
		Scope: errs.ScopeField,
	})
	noDrafts = errs.Define(errs.Entry{
		ID:    "work.no_drafts",
		Kind:  errs.KindYourInput,
		What:  "Write at least one question.",
		Scope: errs.ScopeField,
	})
	tooManyDrafts = errs.Define(errs.Entry{
		ID:    "work.too_many_drafts",
		Kind:  errs.KindYourInput,
		What:  "That's more than {max} questions at once. Add them in smaller batches.",
		Scope: errs.ScopeField,
	})
	badReveal = errs.Define(errs.Entry{
		ID:    "work.bad_reveal",
		Kind:  errs.KindYourInput,
		What:  "There's no help step called {stage}.",
		Scope: errs.ScopeField,
	})
	noteTooLong = errs.Define(errs.Entry{
		ID:    "work.note_too_long",
		Kind:  errs.KindYourInput,
		What:  "Keep each note under {max} characters.",
		Scope: errs.ScopeField,
	})
	tooManyNotes = errs.Define(errs.Entry{
		ID:    "work.too_many_notes",
		Kind:  errs.KindYourInput,
		What:  "Keep it to {max} notes.",
		Scope: errs.ScopeField,
	})
	pdfUnreadable = errs.Define(errs.Entry{
		ID:   "work.pdf_unreadable",
		What: "That PDF couldn't be read.",
		Why:  "PSet couldn't get any text or pages out of it.",
		Fix:  "Upload a clearer copy of the sheet.",
	})
	replyUnreadable = errs.Define(errs.Entry{
		ID:     "work.reply_unreadable",
		What:   "Couldn't make out the assignment's homework.",
		Why:    "The model's answer wasn't in a form PSet could read.",
		Fix:    "Try again.",
		Action: errs.ActionRetry,
	})
	noHomeworkFound = errs.Define(errs.Entry{
		ID:   "work.no_homework_found",
		What: "Didn't find any homework in it.",
		Why:  "The model read it and found no problems to do.",
		Fix:  "If the homework is there, upload just the pages with it.",
	})
	noGroups = errs.Define(errs.Entry{
		ID:    "work.no_groups",
		Kind:  errs.KindYourInput,
		What:  "Pick at least one due date to add.",
		Scope: errs.ScopeField,
	})
	nothingToAdd = errs.Define(errs.Entry{
		ID:    "work.nothing_to_add",
		Kind:  errs.KindYourInput,
		What:  "There's nothing left to add or change in those.",
		Scope: errs.ScopeField,
	})
)
