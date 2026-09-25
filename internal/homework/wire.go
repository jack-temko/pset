package homework

import "github.com/jackt/pset/internal/cards"

// Summary is a homework set as lists show it. DueDate is a calendar date
// (YYYY-MM-DD) or empty; the client turns it into words ("Friday"), since
// it knows what today is. TurnedInAt is RFC 3339, empty until turned in.
type Summary struct {
	ID         string `json:"id"`
	BookID     string `json:"bookId"`
	Title      string `json:"title"`
	DueDate    string `json:"dueDate"`
	TurnedInAt string `json:"turnedInAt"`
	Total      int    `json:"total"`
	Done       int    `json:"done"`
	CreatedAt  string `json:"createdAt"`
}

// List is a book's sets, or the due list across books.
type List struct {
	Homework []Summary `json:"homework"`
}

// Input creates a set: a title (required) and an optional due date.
type Input struct {
	Title   string `json:"title"`
	DueDate string `json:"dueDate"`
}

// Patch edits a set. An empty DueDate clears it; TurnedIn is the
// undoable fact.
type Patch struct {
	Title    *string `json:"title,omitempty"`
	DueDate  *string `json:"dueDate,omitempty"`
	TurnedIn *bool   `json:"turnedIn,omitempty"`
}

// State is where a question is.
type State string

const (
	// StatePending is added and waiting its turn.
	StatePending State = "pending"
	// StateLocating is finding it in the book.
	StateLocating State = "locating"
	// StateLocated is found and waiting its turn to be written: its
	// statement, page and figures are there, its guide isn't yet.
	StateLocated State = "located"
	// StateReading is reading its figures into words, which its guide is
	// written from. A question without figures skips it.
	StateReading State = "reading"
	// StateWriting is writing its guide; the hint may already be there.
	StateWriting State = "writing"
	StateReady   State = "ready"
	StateFailed  State = "failed"
)

// Failure is what kind of failure a failed question had.
type Failure string

const (
	// FailureNotFound: locate couldn't find it. Give the page, or paste it.
	FailureNotFound Failure = "not_found"
	// FailureGeneration: the guide didn't finish (cut off, missing a part).
	// Try again.
	FailureGeneration Failure = "generation"
	// FailureUnavailable: the provider didn't answer or was busy. Try
	// again later.
	FailureUnavailable Failure = "unavailable"
	// FailureSetup: there's no chat model, or the provider refused it.
	// Fix it in Settings.
	FailureSetup Failure = "setup"
)

// Figure is a figure the question refers to, cropped from its page and
// served at /api/questions/{id}/figures/{index}.
type Figure struct {
	Label string `json:"label"`
}

// Question is one problem in a set. Text is what the student typed;
// Statement is the problem as the book states it (markdown with $math$),
// or the typed text for one that isn't in the book. Page is a PDF page.
// Hint and Walkthrough fill in as they're written.
type Question struct {
	ID          string          `json:"id"`
	HomeworkID  string          `json:"homeworkId"`
	Position    int             `json:"position"`
	Text        string          `json:"text"`
	InBook      bool            `json:"inBook"`
	Label       string          `json:"label"`
	Statement   string          `json:"statement"`
	Page        *int            `json:"page,omitempty"`
	Figures     []Figure        `json:"figures"`
	Hint        []cards.Segment `json:"hint"`
	Walkthrough []cards.Segment `json:"walkthrough"`
	State       State           `json:"state"`
	// Failure is what kind of failure a failed question had, which picks
	// its ways out; Reason says what happened, in a sentence.
	Failure Failure `json:"failure,omitempty"`
	Reason  string  `json:"reason,omitempty"`
	// Activity is what the guide's writer is doing right now, while it
	// writes: "Thinking…", a tool call ("Computing…"), or "Writing the
	// guide…". Empty otherwise.
	Activity string `json:"activity,omitempty"`
	// Reading is how its figures read, one fact a line ("Node A: top of
	// the 4 Ω, …", "2 A current source from A to B"): the guide is
	// written from it, and the student can correct it. Empty for a
	// question without figures, or one found before readings.
	Reading []string `json:"reading"`
	// ReadingEdited is true once the student has corrected the reading.
	ReadingEdited bool `json:"readingEdited"`
	// Notes are the professor's instructions for the problem ("do c",
	// "no PSpice or MultiSim", "for 500 packets"), which the guide
	// follows over the book.
	Notes []string `json:"notes"`
	// Boxes are what the student drew around the problem on the scan,
	// when they showed where it is rather than having it found.
	Boxes []Box `json:"boxes"`
	// Memory is what writing this guide did with the book's memory: what
	// it saved, and a remembered range that found the problem.
	Memory []MemoryLine `json:"memory"`
	// Revealed names the stages the student has lifted the veil on.
	Revealed []string `json:"revealed"`
	Done     bool     `json:"done"`
	// UpdatedAt is when its state (or its statement, or a stage) last
	// changed: while it waits, when the wait began.
	UpdatedAt string `json:"updatedAt"`
	// Rev goes up by one with every change to the question, whatever
	// changed. Of two snapshots of one question, the higher Rev is newer:
	// the client keeps it, whichever arrives last.
	Rev int `json:"rev"`
}

// MemoryUse is what a guide did with a memory.
type MemoryUse string

const (
	MemoryUseSaved   MemoryUse = "saved"
	MemoryUseUpdated MemoryUse = "updated"
	MemoryUseFound   MemoryUse = "found"
)

// MemoryLine is one line under a walkthrough: a memory the writer saved
// or updated (with Undo), or one locate found the problem by. Page is a
// PDF page.
type MemoryLine struct {
	MemoryID string    `json:"memoryId"`
	Use      MemoryUse `json:"use"`
	Text     string    `json:"text"`
	Page     *int      `json:"page,omitempty"`
}

// Detail is GET /api/homework/{id}.
type Detail struct {
	Homework  Summary    `json:"homework"`
	Questions []Question `json:"questions"`
}

// Draft is one row of the Add questions dialog.
type Draft struct {
	Text   string `json:"text"`
	InBook bool   `json:"inBook"`
}

type AddQuestions struct {
	Drafts []Draft `json:"drafts"`
}

type Questions struct {
	Questions []Question `json:"questions"`
}

// QuestionPatch is what the walkthrough changes directly: a stage
// revealed, done ticked or unticked, a new position in the set. Reading
// corrects how the figures read, and Reread reads them again; either
// writes the guide again, from the new reading.
type QuestionPatch struct {
	Reveal   *string   `json:"reveal,omitempty"`
	Done     *bool     `json:"done,omitempty"`
	Position *int      `json:"position,omitempty"`
	Reading  *[]string `json:"reading,omitempty"`
	// Notes replaces the professor's instructions, and writes the guide
	// again when there is one.
	Notes  *[]string `json:"notes,omitempty"`
	Reread bool      `json:"reread,omitempty"`
}

// BoxKind is what a box around a problem holds.
type BoxKind string

const (
	// BoxKindText is the problem's words, read in order as its statement.
	BoxKindText BoxKind = "text"
	// BoxKindFigure is one of its figures.
	BoxKindFigure BoxKind = "figure"
)

// Box is a rectangle the student drew around part of a problem on the
// scan: its PDF page, and where on it as fractions of the page (y from
// the top).
type Box struct {
	Page int     `json:"page"`
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	W    float64 `json:"w"`
	H    float64 `json:"h"`
	Kind BoxKind `json:"kind"`
}

// Boxes is POST /api/homework/{id}/boxed (a new question) and POST
// /api/questions/{id}/boxes (where a question is, shown).
type Boxes struct {
	Boxes []Box `json:"boxes"`
}

// Retry is one of a failed question's two ways out: the PDF page it's on,
// or the question's own text, which makes it a question that isn't in
// the book.
type Retry struct {
	Page *int    `json:"page,omitempty"`
	Text *string `json:"text,omitempty"`
}

// RowKind is what a line of an assignment is.
type RowKind string

const (
	// RowKindBook is problems from the textbook, as the professor wrote
	// the line: "2.1: 1, 4, 6 (do c, 6 pts each)".
	RowKindBook RowKind = "book"
	// RowKindOwn is a problem the professor wrote out in full.
	RowKindOwn RowKind = "own"
	// RowKindOther is anything that isn't a problem to hand in: reading,
	// quizzes, notes.
	RowKindOther RowKind = "other"
)

// AssignmentRow is one line of an assignment, as read out for review.
type AssignmentRow struct {
	Kind RowKind `json:"kind"`
	Text string  `json:"text"`
	// Labels are the questions a book line becomes, in the book's
	// numbering ("2.1 #1", "2.1 #4"); none when it couldn't be read as a
	// reference, which Unread says.
	Labels []string `json:"labels"`
	Unread bool     `json:"unread,omitempty"`
	// Notes are the professor's instructions the line carries.
	Notes []string `json:"notes"`
	// Present is which of its labels the set it updates already has: all
	// of them, and the line is in; some, and adding it adds the rest.
	Present []string `json:"present"`
	// Added is true when the set it updates already has the line: every
	// label, or, for a line not from the book, its text.
	Added bool `json:"added,omitempty"`
	// Changed is each problem the set has whose professor's instructions
	// the document now gives differently.
	Changed []NotesChange `json:"changed"`
}

// AssignmentGroup is everything due on one date.
type AssignmentGroup struct {
	// Due is a calendar date (YYYY-MM-DD), or empty.
	Due   string          `json:"due"`
	Title string          `json:"title"`
	Rows  []AssignmentRow `json:"rows"`
	// Imported is true when a set from this source already has this due
	// date: a page checked again offers only what's new.
	Imported bool `json:"imported,omitempty"`
	// SetID is the set this date updates: the one made from it before,
	// or the one the student is updating.
	SetID string `json:"setId,omitempty"`
	// Gone is what that set has that the document doesn't list: offered
	// for removal, never removed unasked.
	Gone []SetQuestion `json:"gone"`
}

// Assignment is a document read out into due dates and lines, for the
// student to review before anything is added.
type Assignment struct {
	// Source is where it came from: a web page's URL, a file's name, or
	// "pasted".
	Source string            `json:"source"`
	Title  string            `json:"title"`
	Groups []AssignmentGroup `json:"groups"`
}

// NotesChange is a problem whose professor's instructions a document
// gives differently from its set.
type NotesChange struct {
	QuestionID string   `json:"questionId"`
	Label      string   `json:"label"`
	Was        []string `json:"was"`
	Now        []string `json:"now"`
}

// SetQuestion names a question in a set.
type SetQuestion struct {
	QuestionID string `json:"questionId"`
	Label      string `json:"label"`
}

// AssignmentText is POST /api/books/{id}/assignments/read with a web
// page or pasted text; a file comes as a multipart upload instead, with
// setId as a form field.
type AssignmentText struct {
	URL  string `json:"url,omitempty"`
	Text string `json:"text,omitempty"`
	// SetID reads the document as an update to that set: new problems,
	// changed instructions, and what it no longer lists.
	SetID string `json:"setId,omitempty"`
}

// ImportGroup is one set to make, or, with SetID, one to add to: its
// title, due date and questions.
type ImportGroup struct {
	Title string  `json:"title"`
	Due   string  `json:"due"`
	Rows  []Draft `json:"rows"`
	// SetID updates that set instead of making one: the rows are added,
	// skipping what it already has; Notes are rewritten and Remove taken
	// out.
	SetID  string        `json:"setId,omitempty"`
	Notes  []NotesUpdate `json:"notes,omitempty"`
	Remove []string      `json:"remove,omitempty"`
}

// NotesUpdate is a question's new professor's instructions.
type NotesUpdate struct {
	QuestionID string   `json:"questionId"`
	Notes      []string `json:"notes"`
}

// AssignmentImport is POST /api/books/{id}/assignments: the groups the
// student kept, each becoming a set, and the read they came from, which
// is done with once they're in.
type AssignmentImport struct {
	ReadID string        `json:"readId,omitempty"`
	Source string        `json:"source"`
	Groups []ImportGroup `json:"groups"`
}

// ReadState is where reading an assignment stands.
type ReadState string

const (
	ReadStateReading ReadState = "reading"
	ReadStateReady   ReadState = "ready"
	ReadStateFailed  ReadState = "failed"
)

// AssignmentRead is an assignment being read in the background, or read
// and waiting for its review, until it's imported or dismissed.
type AssignmentRead struct {
	ID     string `json:"id"`
	BookID string `json:"bookId"`
	Source string `json:"source"`
	// SetID is the set it was read to update, if it was.
	SetID string    `json:"setId,omitempty"`
	State ReadState `json:"state"`
	// Error says why it couldn't be read, when it failed.
	Error string `json:"error,omitempty"`
	// Assignment is what was read, once it's ready, marked against the
	// sets already made from the same source.
	Assignment *Assignment `json:"assignment,omitempty"`
	CreatedAt  string      `json:"createdAt"`
	// UpdatedAt is when it started reading, or finished.
	UpdatedAt string `json:"updatedAt"`
}

// AssignmentReads is GET /api/books/{id}/assignments/reads.
type AssignmentReads struct {
	Reads []AssignmentRead `json:"reads"`
}

// AssignmentSource is where the book's assignments were last read from,
// for checking again.
type AssignmentSource struct {
	URL string `json:"url"`
}

// Event types this feature publishes.
const (
	EventHomeworkChanged = "homework.changed"
	EventHomeworkRemoved = "homework.removed"
	EventQuestionChanged = "question.changed"
	EventQuestionRemoved = "question.removed"
	EventReadChanged     = "assignment.changed"
	EventReadRemoved     = "assignment.removed"
)

type ReadChanged struct {
	Read AssignmentRead `json:"read"`
}

type ReadRemoved struct {
	ID     string `json:"id"`
	BookID string `json:"bookId"`
}

type HomeworkChanged struct {
	Homework Summary `json:"homework"`
}

type HomeworkRemoved struct {
	ID     string `json:"id"`
	BookID string `json:"bookId"`
}

type QuestionChanged struct {
	Question Question `json:"question"`
}

type QuestionRemoved struct {
	ID         string `json:"id"`
	HomeworkID string `json:"homeworkId"`
}
