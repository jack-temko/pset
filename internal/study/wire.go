package study

// Kind is what a stretch of study was.
type Kind string

const (
	// KindReading is reading a material.
	KindReading Kind = "reading"
	// KindHomework is working a set's problems.
	KindHomework Kind = "homework"
	// KindAsking is asking in a course's Ask.
	KindAsking Kind = "asking"
)

// Stretch is a stretch of study as the page sends it, every half-minute and
// once more as it ends: the same id again only moves its end on.
type Stretch struct {
	// ID is the page's own name for the stretch.
	ID string `json:"id"`
	// CourseID is the course it was in.
	CourseID string `json:"courseId"`
	// Kind is what it was.
	Kind Kind `json:"kind"`
	// Started and Ended are RFC 3339 times. An end past the server's clock
	// is clamped to it, and a stretch to six hours.
	Started string `json:"started"`
	Ended   string `json:"ended"`
	// QuestionID is the problem a homework stretch was on, if one was open.
	QuestionID string `json:"questionId,omitempty"`
}

// CourseMinutes is a course's minutes in the week.
type CourseMinutes struct {
	CourseID string `json:"courseId"`
	Minutes  int    `json:"minutes"`
}

// Week is the time spent since the start of the student's week, in minutes:
// by kind, and by course, the most first. Stretches that overlap count once,
// so the parts can differ by a minute from the whole.
type Week struct {
	Homework int `json:"homework"`
	Reading  int `json:"reading"`
	Asking   int `json:"asking"`
	// Total is all the time, every kind's stretches together, an overlap
	// once (reading in one tab while asking in another): never the parts
	// added up.
	Total int `json:"total"`
	// ByCourse never holds a course with no minutes. Never null.
	ByCourse []CourseMinutes `json:"byCourse"`
}
