package memory

// Source is who saved a memory.
type Source string

const (
	// SourceYou is the student: the memory menu, or asked for in Ask.
	SourceYou Source = "you"
	// SourceTutor is the model, on its own judgement. Nothing saves as it
	// now, but the preferences it saved before stay.
	SourceTutor Source = "tutor"
)

// Memory is one preference about one book: a sentence on how the student
// wants answers.
type Memory struct {
	ID        string `json:"id"`
	BookID    string `json:"bookId"`
	Text      string `json:"text"`
	Source    Source `json:"source"`
	CreatedAt string `json:"createdAt"`
}

// Memories is GET /api/books/{id}/memories, newest first.
type Memories struct {
	Memories []Memory `json:"memories"`
}

// NewMemory is POST /api/books/{id}/memories: one the student adds.
type NewMemory struct {
	Text string `json:"text"`
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
