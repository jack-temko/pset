package turn

import "github.com/jackt/pset/internal/step"

// Turn is one question asked in a course's Ask and its answer. The answer is
// a document, read by AnswerID, which fills in block by block as it is
// written.
type Turn struct {
	// ID is the turn's id.
	ID string `json:"id"`
	// Seq is the change-log sequence of its last change.
	Seq int64 `json:"seq"`
	// CourseID is the course whose conversation it is in.
	CourseID string `json:"courseId"`
	// Question is what the student asked, as typed.
	Question string `json:"question"`
	// About is what it was asked about (a problem, a selected line), the
	// chip on the question; absent for a plain question.
	About *About `json:"about,omitempty"`
	// Images are pictures the student pasted or dropped with the question
	// (their working, a figure). Never null.
	Images []Image `json:"images"`
	// AnswerID is the answer's document.
	AnswerID string `json:"answerId"`
	// Tools is what Ask did while answering, in order, each placed after the
	// block it followed: folded into one quiet row per run ("Searched twice,
	// read 3 pages"). The one running now is the answer step's activity
	// line. Never null.
	Tools []ToolUse `json:"tools"`
	// Remembered is each preference Ask saved while answering, shown as a
	// quiet row with Undo and Edit. Never null.
	Remembered []Remembered `json:"remembered"`
	// Steps is its one step, answer. Never null.
	Steps []step.Step `json:"steps"`
	// CreatedAt is when it was asked (RFC 3339), for the day dividers.
	CreatedAt string `json:"createdAt"`
	// RemovedAt is when the student cleared it (RFC 3339): hidden, and back
	// with Undo for a week. Absent while it is there.
	RemovedAt string `json:"removedAt,omitempty"`
}

// About is what a question was asked about: the chip the student attached.
type About struct {
	// QuestionID is the problem it is about, when it is about one.
	QuestionID string `json:"questionId,omitempty"`
	// Label is what the chip says ("About 4.62").
	Label string `json:"label"`
	// Text is what it quotes: the problem, or the selected line.
	Text string `json:"text"`
}

// Image is a picture sent with a question, served by its id.
type Image struct {
	// ID is the image's id.
	ID string `json:"id"`
	// Ratio is its height over its width, so its thumbnail holds its box.
	Ratio float64 `json:"ratio"`
}

// ToolUse is one thing Ask did while answering: a search, a page read, a
// computation.
type ToolUse struct {
	// Tool is which tool it used ("search", "read_pages", "compute",
	// "remember"), for its icon on the timeline.
	Tool string `json:"tool"`
	// Label is what it did, in the past tense ("Searched 'eigenvalue'").
	Label string `json:"label"`
	// After is how many answer blocks were written when it ran, so it sits
	// between the blocks it happened between.
	After int `json:"after"`
}

// Remembered is a preference Ask saved during a turn.
type Remembered struct {
	// MemoryID is the memory saved, for Undo and Edit.
	MemoryID string `json:"memoryId"`
	// Text is what was kept, as it was saved ("you use V_0 for node
	// voltages").
	Text string `json:"text"`
}

// Turns is a course's whole conversation, oldest first. Never null.
type Turns struct {
	// Turns is every turn not cleared.
	Turns []Turn `json:"turns"`
}
