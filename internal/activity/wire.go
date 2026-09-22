package activity

// Kind is what the student was doing.
type Kind string

const (
	KindReading  Kind = "reading"
	KindHomework Kind = "homework"
	KindAsking   Kind = "asking"
)

// Heartbeat is POST /api/heartbeat: the workspace sends one every 30
// seconds while it's visible and the student has touched it recently.
type Heartbeat struct {
	BookID string `json:"bookId"`
	Kind   Kind   `json:"kind"`
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
