package errlog

// Group is every kept error with one id: how many, when last, and each
// incident newest first. What is the id's words as the catalog has them now.
type Group struct {
	ID    string `json:"id"`
	What  string `json:"what"`
	Count int    `json:"count"`
	// Last is the time of the newest incident, RFC 3339.
	Last      string     `json:"last"`
	Incidents []Incident `json:"incidents"`
}

// Incident is one kept error.
type Incident struct {
	Incident string `json:"incident"`
	// At is when it happened, RFC 3339.
	At string `json:"at"`
	// What is the failure in the student's words, which names what was
	// being done (the book, the question) where the entry does.
	What string `json:"what"`
	// Chain is the ids of every catalog error in the failure, outermost first.
	Chain []string `json:"chain"`
	// Route is the request or job it happened in.
	Route string `json:"route,omitempty"`
	// Detail is the Go error text, for a bug report.
	Detail string `json:"detail"`
}
