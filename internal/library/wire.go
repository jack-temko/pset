package library

import "github.com/jackt/pset/internal/pagenum"

// State is where a book is on its way to the shelf.
type State string

const (
	StateQueued    State = "queued"
	StatePreparing State = "preparing"
	StateReady     State = "ready"
	StateFailed    State = "failed"
)

// Phase is one of the five named steps of preparing a book.
type Phase string

const (
	PhaseExamine  Phase = "examine"
	PhaseRead     Phase = "read"
	PhaseContents Phase = "contents"
	PhaseIndex    Phase = "index"
	PhaseSearch   Phase = "search"
)

// Cover is a book's cloth colour: one of six, the --cover-* tokens in
// web/src/index.css. Picked when the book is added, kept, and changeable
// in the Book dialog (covers.go).
type Cover string

const (
	CoverIndigo Cover = "indigo"
	CoverTeal   Cover = "teal"
	CoverAmber  Cover = "amber"
	CoverRose   Cover = "rose"
	CoverViolet Cover = "violet"
	CoverSlate  Cover = "slate"
)

// BookState is a book's import state. Phase is set while preparing; Done
// and Total only where the phase can count (reading and search), and on a
// queued scan whose reading was interrupted, as the pages it has read;
// Reason only when failed, in words written for the student.
type BookState struct {
	Kind   State  `json:"kind"`
	Phase  Phase  `json:"phase,omitempty"`
	Done   *int   `json:"done,omitempty"`
	Total  *int   `json:"total,omitempty"`
	Reason string `json:"reason,omitempty"`
}

// Kind is what examining a book found: a digital book has a text layer,
// a scanned one is read page by page with OCR.
type Kind string

const (
	// KindUnknown is a book not examined yet.
	KindUnknown Kind = ""
	KindDigital Kind = "digital"
	KindScanned Kind = "scanned"
)

// Book is a book as every screen sees it. Cover is its cloth colour;
// PageRuns is how its printed numbers run (PDF page = printed page +
// offset, run by run), never empty. Page numbers on the wire are always
// PDF pages.
type Book struct {
	ID        string        `json:"id"`
	SHA256    string        `json:"sha256"`
	Title     string        `json:"title"`
	Author    string        `json:"author"`
	PageCount int           `json:"pageCount"`
	PageRuns  []pagenum.Run `json:"pageRuns"`
	Cover     Cover         `json:"cover"`
	// Aspect is page height over width, so a scan holds its box before the
	// image arrives.
	Aspect float64 `json:"aspect"`
	// Kind orders queued imports: books not yet examined, then digital
	// ones, then scans.
	Kind  Kind      `json:"kind"`
	State BookState `json:"state"`
	// AddedAt is when it was put on the shelf (RFC 3339).
	AddedAt string `json:"addedAt"`
	// UpdatedAt orders copies of the book: a reply that arrives after a
	// newer event must not win.
	UpdatedAt string `json:"updatedAt"`
}

// Books is GET /api/books.
type Books struct {
	Books []Book `json:"books"`
}

// BookPatch is PATCH /api/books/{id}: any subset of the four. PageRuns
// replaces the book's numbering whole.
type BookPatch struct {
	Title    *string       `json:"title,omitempty"`
	Author   *string       `json:"author,omitempty"`
	PageRuns []pagenum.Run `json:"pageRuns,omitempty"`
	Cover    *Cover        `json:"cover,omitempty"`
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
