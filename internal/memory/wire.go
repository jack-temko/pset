package memory

// Kind is what a memory is about.
type Kind string

const (
	// KindBook is anything about the book: where a result lives, how it's
	// laid out.
	KindBook Kind = "book"
	// KindPreference is how the student wants answers.
	KindPreference Kind = "preference"
)

// Source is who saved a memory.
type Source string

const (
	// SourceYou is the student: the memory menu, or asked for in Ask.
	SourceYou Source = "you"
	// SourceTutor is the model, on its own judgement.
	SourceTutor Source = "tutor"
	// SourcePSet is code: the problem ranges locate records.
	SourcePSet Source = "pset"
)

// Memory is one sentence about one book. Page is a PDF page.
type Memory struct {
	ID        string `json:"id"`
	BookID    string `json:"bookId"`
	Kind      Kind   `json:"kind"`
	Text      string `json:"text"`
	Page      *int   `json:"page,omitempty"`
	Source    Source `json:"source"`
	CreatedAt string `json:"createdAt"`
}

// Memories is GET /api/books/{id}/memories, newest first.
type Memories struct {
	Memories []Memory `json:"memories"`
}

// NewMemory is POST /api/books/{id}/memories: one the student adds.
type NewMemory struct {
	Kind Kind   `json:"kind"`
	Text string `json:"text"`
	Page *int   `json:"page,omitempty"`
}

// Event types this feature publishes.
const (
	EventSaved   = "memory.saved"
	EventRemoved = "memory.removed"
)

type Saved struct {
	Memory Memory `json:"memory"`
}

type Removed struct {
	ID     string `json:"id"`
	BookID string `json:"bookId"`
}
