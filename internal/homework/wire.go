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
	// StateWriting is writing its guide; the hint may already be there.
	StateWriting State = "writing"
	StateReady   State = "ready"
	StateFailed  State = "failed"
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
	Reason      string          `json:"reason,omitempty"`
	// Activity is what the guide's writer is doing right now, while it
	// writes: "Thinking…", a tool call ("Computing…"), or "Writing the
	// guide…". Empty otherwise.
	Activity string `json:"activity,omitempty"`
	// Revealed names the stages the student has lifted the veil on.
	Revealed []string `json:"revealed"`
	Done     bool     `json:"done"`
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
// revealed, done ticked or unticked, a new position in the set.
type QuestionPatch struct {
	Reveal   *string `json:"reveal,omitempty"`
	Done     *bool   `json:"done,omitempty"`
	Position *int    `json:"position,omitempty"`
}

// Retry is one of a failed question's two ways out: the PDF page it's on,
// or the question's own text, which makes it a question that isn't in
// the book.
type Retry struct {
	Page *int    `json:"page,omitempty"`
	Text *string `json:"text,omitempty"`
}

// Event types this feature publishes.
const (
	EventHomeworkChanged = "homework.changed"
	EventHomeworkRemoved = "homework.removed"
	EventQuestionChanged = "question.changed"
	EventQuestionRemoved = "question.removed"
)

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
