package activity

// Kind is what the student was doing.
type Kind string

const (
	// KindReading is time with a book open.
	KindReading Kind = "reading"
	// KindHomework is time on a homework set.
	KindHomework Kind = "homework"
	// KindAsking is time asking the tutor.
	KindAsking Kind = "asking"
)

// Stretch is POST /api/study: a stretch of study in one book at one
// kind of thing, from started to ended (RFC 3339). The workspace makes
// up its id when the stretch begins and sends it again, with a later
// end, every half-minute and once more as the tab goes. A homework
// stretch names the question that was open (QuestionID), so the time
// can be said by question; moving to another question starts a new
// stretch.
type Stretch struct {
	ID         string `json:"id"`
	BookID     string `json:"bookId"`
	Kind       Kind   `json:"kind"`
	Started    string `json:"started"`
	Ended      string `json:"ended"`
	QuestionID string `json:"questionId,omitempty"`
}

// BookMinutes is one book's share of the week.
type BookMinutes struct {
	BookID  string `json:"bookId"`
	Minutes int    `json:"minutes"`
}

// Week is GET /api/week?since=: minutes per activity, questions ticked
// done and the sets they came from, and the time split by book, most
// first.
type Week struct {
	Homework    int           `json:"homework"`
	Reading     int           `json:"reading"`
	Asking      int           `json:"asking"`
	Questions   int           `json:"questions"`
	ProblemSets int           `json:"problemSets"`
	ByBook      []BookMinutes `json:"byBook"`
}
