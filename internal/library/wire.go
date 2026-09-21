package library

// State is where a book is on its way to the shelf.
type State string

const (
	StateQueued    State = "queued"
	StatePreparing State = "preparing"
	StateReady     State = "ready"
	StateFailed    State = "failed"
)

// Phase is one of the four named steps of preparing a book.
type Phase string

const (
	PhaseExamine Phase = "examine"
	PhaseRead    Phase = "read"
	PhaseIndex   Phase = "index"
	PhaseSearch  Phase = "search"
)

// BookState is a book's import state. Phase is set while preparing; Done
// and Total only where the phase can count (reading and search); Reason
// only when failed, in words written for the student.
type BookState struct {
	Kind   State  `json:"kind"`
	Phase  Phase  `json:"phase,omitempty"`
	Done   *int   `json:"done,omitempty"`
	Total  *int   `json:"total,omitempty"`
	Reason string `json:"reason,omitempty"`
}

// Book is a book as every screen sees it. SHA256 picks the cover's cloth
// colour; PageOffset turns a PDF page into the printed one (PDF = printed
// + offset). Page numbers on the wire are always PDF pages.
type Book struct {
	ID         string `json:"id"`
	SHA256     string `json:"sha256"`
	Title      string `json:"title"`
	Author     string `json:"author"`
	PageCount  int    `json:"pageCount"`
	PageOffset int    `json:"pageOffset"`
	// Aspect is page height over width, so a scan holds its box before the
	// image arrives.
	Aspect float64   `json:"aspect"`
	State  BookState `json:"state"`
	// AddedAt is when it was put on the shelf (RFC 3339).
	AddedAt string `json:"addedAt"`
}

// Books is GET /api/books.
type Books struct {
	Books []Book `json:"books"`
}

// BookPatch is PATCH /api/books/{id}: any subset of the three.
type BookPatch struct {
	Title      *string `json:"title,omitempty"`
	Author     *string `json:"author,omitempty"`
	PageOffset *int    `json:"pageOffset,omitempty"`
}

// ContentsSection is a section of a chapter, at its PDF page.
type ContentsSection struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Page  int    `json:"page"`
}

// ContentsChapter is a top-level entry and the sections under it.
type ContentsChapter struct {
	ID       string            `json:"id"`
	Title    string            `json:"title"`
	Page     int               `json:"page"`
	Sections []ContentsSection `json:"sections"`
}

// Contents is GET /api/books/{id}/contents. Empty when the book's
// structure couldn't be read, and then the workspace has no rail.
type Contents struct {
	Chapters []ContentsChapter `json:"chapters"`
}

// Event types this feature publishes.
const (
	EventBookChanged = "book.changed"
	EventBookRemoved = "book.removed"
)

// BookChanged carries the whole book, so the client patches it in place.
type BookChanged struct {
	Book Book `json:"book"`
}

type BookRemoved struct {
	ID string `json:"id"`
}
