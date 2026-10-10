package homework

import (
	"net/http"

	"github.com/jackt/pset/internal/errs"
)

// Not found: a set, a question, an assignment read, a figure. Each is its
// own entry because each is found somewhere else.
var (
	setNotFound = errs.Define(errs.Entry{
		ID:     "homework.set_not_found",
		What:   "That homework set isn't there.",
		Why:    "It was removed, or the page is out of date.",
		Fix:    "Go back to the book's homework list.",
		Status: http.StatusNotFound,
	})
	questionNotFound = errs.Define(errs.Entry{
		ID:     "homework.question_not_found",
		What:   "That question isn't there.",
		Why:    "It was removed, or the page is out of date.",
		Fix:    "Go back to the set's list of questions.",
		Status: http.StatusNotFound,
	})
	assignmentNotFound = errs.Define(errs.Entry{
		ID:     "homework.assignment_not_found",
		What:   "That assignment isn't there.",
		Why:    "It was dismissed, or the page is out of date.",
		Fix:    "Add the assignment again.",
		Status: http.StatusNotFound,
	})
	figureNotFound = errs.Define(errs.Entry{
		ID:     "homework.figure_not_found",
		What:   "That figure isn't there.",
		Why:    "The question has no figure, or it was removed.",
		Fix:    "Reload the page to see the question as it is now.",
		Action: errs.ActionReload,
		Status: http.StatusNotFound,
	})
)

// A set and its questions, as typed.
var (
	titleEmpty = errs.Define(errs.Entry{
		ID:    "homework.title_empty",
		What:  "Give it a title.",
		Scope: errs.ScopeField,
	})
	titleTooLong = errs.Define(errs.Entry{
		ID:    "homework.title_too_long",
		What:  "Keep the title under {max} characters.",
		Scope: errs.ScopeField,
	})
	badDueDate = errs.Define(errs.Entry{
		ID:    "homework.bad_due_date",
		What:  "That isn't a date.",
		Scope: errs.ScopeField,
	})
	draftTooLong = errs.Define(errs.Entry{
		ID:    "homework.draft_too_long",
		What:  "One of these is too long for a single question.",
		Scope: errs.ScopeField,
	})
	noDrafts = errs.Define(errs.Entry{
		ID:    "homework.no_drafts",
		What:  "Write at least one question.",
		Scope: errs.ScopeField,
	})
	tooManyDrafts = errs.Define(errs.Entry{
		ID:    "homework.too_many_drafts",
		What:  "That's more than {max} questions at once. Add them in smaller batches.",
		Scope: errs.ScopeField,
	})
	badStage = errs.Define(errs.Entry{
		ID:    "homework.bad_stage",
		What:  "There's no stage called {stage}.",
		Scope: errs.ScopeField,
	})
	badPosition = errs.Define(errs.Entry{
		ID:    "homework.bad_position",
		What:  "Position {to} is outside the set (1 to {n}).",
		Scope: errs.ScopeField,
	})
	textTooLong = errs.Define(errs.Entry{
		ID:    "homework.text_too_long",
		What:  "That's too long for a single question.",
		Scope: errs.ScopeField,
	})
	noPageForQuestion = errs.Define(errs.Entry{
		ID:    "homework.no_page_for_question",
		What:  "This question isn't in the book, so it has no page.",
		Scope: errs.ScopeField,
	})
	pageOutside = errs.Define(errs.Entry{
		ID:    "homework.page_outside",
		What:  "The book doesn't have that page.",
		Scope: errs.ScopeField,
	})
	noteTooLong = errs.Define(errs.Entry{
		ID:    "homework.note_too_long",
		What:  "Keep each note under {max} characters.",
		Scope: errs.ScopeField,
	})
	tooManyNotes = errs.Define(errs.Entry{
		ID:    "homework.too_many_notes",
		What:  "Keep it to {max} notes.",
		Scope: errs.ScopeField,
	})
)

// What the student may do to a question depends on its state; the page is
// out of date when it offers what no longer applies.
var (
	questionNotFailed = errs.Define(errs.Entry{
		ID:     "homework.not_failed",
		What:   "Only a question that failed can be tried again.",
		Why:    "This question isn't in a failed state, so the page is out of date.",
		Fix:    "Reload the page to see where the question stands.",
		Action: errs.ActionReload,
	})
	guideExists = errs.Define(errs.Entry{
		ID:     "homework.guide_exists",
		What:   "This question already has a guide, or is being written.",
		Why:    "A guide was started for it a moment ago, so the page is out of date.",
		Fix:    "Reload the page to see the guide.",
		Action: errs.ActionReload,
	})
	readBusy = errs.Define(errs.Entry{
		ID:     "homework.read_busy",
		What:   "That assignment is already read, or being read.",
		Why:    "It isn't in a failed state, so there is nothing to try again.",
		Fix:    "Reload the page to see where it stands.",
		Action: errs.ActionReload,
	})
)

// Figure readings.
var (
	noFigure = errs.Define(errs.Entry{
		ID:    "homework.no_figure",
		What:  "This question has no figure to read.",
		Scope: errs.ScopeField,
	})
	figureBusy = errs.Define(errs.Entry{
		ID:    "homework.figure_busy",
		What:  "Its figure is still being read.",
		Scope: errs.ScopeField,
	})
	readingLineTooLong = errs.Define(errs.Entry{
		ID:    "homework.reading_line_too_long",
		What:  "Keep each line under {max} characters.",
		Scope: errs.ScopeField,
	})
	readingEmpty = errs.Define(errs.Entry{
		ID:    "homework.reading_empty",
		What:  "Write at least one line.",
		Scope: errs.ScopeField,
	})
	readingTooLong = errs.Define(errs.Entry{
		ID:    "homework.reading_too_long",
		What:  "Keep it to {max} lines.",
		Scope: errs.ScopeField,
	})
)

// Boxes drawn on the page around a problem.
var (
	noBoxes = errs.Define(errs.Entry{
		ID:    "homework.no_boxes",
		What:  "Draw a box around the problem first.",
		Scope: errs.ScopeField,
	})
	tooManyBoxes = errs.Define(errs.Entry{
		ID:    "homework.too_many_boxes",
		What:  "That's more than {max} boxes for one problem.",
		Scope: errs.ScopeField,
	})
	boxOffBook = errs.Define(errs.Entry{
		ID:    "homework.box_off_book",
		What:  "A box is on a page the book doesn't have.",
		Scope: errs.ScopeField,
	})
	boxOffPage = errs.Define(errs.Entry{
		ID:    "homework.box_off_page",
		What:  "A box runs off its page.",
		Scope: errs.ScopeField,
	})
	boxKindMixed = errs.Define(errs.Entry{
		ID:    "homework.box_kind_mixed",
		What:  "A box is either the problem's words or a figure.",
		Scope: errs.ScopeField,
	})
	boxNoText = errs.Define(errs.Entry{
		ID:    "homework.box_no_text",
		What:  "Box the problem's words too, not only its figure.",
		Scope: errs.ScopeField,
	})
)

// Reading an assignment: what is given, and what comes back.
var (
	noSource = errs.Define(errs.Entry{
		ID:    "homework.no_source",
		What:  "Give a file, a web page's address, or the assignment's text.",
		Scope: errs.ScopeField,
	})
	tooManyLines = errs.Define(errs.Entry{
		ID:    "homework.too_many_lines",
		What:  "That's more than {max} lines at once.",
		Scope: errs.ScopeField,
	})
	noGroups = errs.Define(errs.Entry{
		ID:    "homework.no_groups",
		What:  "Pick at least one due date to add.",
		Scope: errs.ScopeField,
	})
	nothingToAdd = errs.Define(errs.Entry{
		ID:    "homework.nothing_to_add",
		What:  "There's nothing left to add or change in those.",
		Scope: errs.ScopeField,
	})
	pdfUnreadable = errs.Define(errs.Entry{
		ID:    "homework.pdf_unreadable",
		What:  "That PDF couldn't be read.",
		Scope: errs.ScopeField,
	})
	fileTooBig = errs.Define(errs.Entry{
		ID:    "homework.file_too_big",
		What:  "That file is too big for an assignment.",
		Scope: errs.ScopeField,
	})
	fileKindRefused = errs.Define(errs.Entry{
		ID:    "homework.file_kind",
		What:  "Send a PDF, a photo, or a text file.",
		Scope: errs.ScopeField,
	})
	badURL = errs.Define(errs.Entry{
		ID:    "homework.bad_url",
		What:  "That isn't a web page's address.",
		Scope: errs.ScopeField,
	})
	pageUnreachable = errs.Define(errs.Entry{
		ID:    "homework.page_unreachable",
		What:  "Couldn't reach that page.",
		Scope: errs.ScopeField,
	})
	pageRefused = errs.Define(errs.Entry{
		ID:    "homework.page_refused",
		What:  "That page answered {status}. A page behind a login can be pasted or photographed instead.",
		Scope: errs.ScopeField,
	})
	pageUnreadable = errs.Define(errs.Entry{
		ID:    "homework.page_unreadable",
		What:  "Couldn't read that page.",
		Scope: errs.ScopeField,
	})
	pageEmpty = errs.Define(errs.Entry{
		ID:    "homework.page_empty",
		What:  "That page has no text to read.",
		Scope: errs.ScopeField,
	})
	readFailed = errs.Define(errs.Entry{
		ID:     "homework.read_failed",
		What:   "Couldn't read the assignment.",
		Why:    "Something went wrong while PSet was reading it.",
		Fix:    "Try again, or paste just the part with the problems.",
		Action: errs.ActionRetry,
	})
	replyUnreadable = errs.Define(errs.Entry{
		ID:     "homework.reply_unreadable",
		What:   "Couldn't make out the assignment's homework.",
		Why:    "The model's answer wasn't in a form PSet could read.",
		Fix:    "Try again, or paste just the part with the problems.",
		Action: errs.ActionRetry,
	})
	noHomeworkFound = errs.Define(errs.Entry{
		ID:   "homework.no_homework_found",
		What: "Didn't find any homework in it.",
		Why:  "The model read it and found no problems to do.",
		Fix:  "If the homework is there, paste just that part.",
	})
	emptyWorksheet = errs.Define(errs.Entry{
		ID:     "homework.empty_worksheet",
		What:   "There is nothing to print yet.",
		Why:    "A worksheet needs at least one question.",
		Fix:    "Add a question before printing the worksheet.",
		Status: http.StatusUnprocessableEntity,
	})
)
