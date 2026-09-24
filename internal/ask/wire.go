package ask

import "github.com/jackt/pset/internal/cards"

// TurnState is where a turn is.
type TurnState string

const (
	TurnRunning TurnState = "running"
	TurnDone    TurnState = "done"
	TurnStopped TurnState = "stopped"
	TurnFailed  TurnState = "failed"
)

// Step is one tool call on the feed: present tense while it runs
// ("Searching 'eigenvalue'…"), past tense with its count when done.
type Step struct {
	Label   string `json:"label"`
	Running bool   `json:"running"`
	// After is how many answer segments were written when the call ran:
	// the feed is interleaved, not stacked at the top, so each step sits
	// between the paragraphs it happened between.
	After int `json:"after"`
	// MemoryID is the memory a remember step saved, for its Undo.
	MemoryID string `json:"memoryId,omitempty"`
}

// About is the homework question a turn was asked about: the label the
// chip shows, and its text for the model.
type About struct {
	Label string `json:"label"`
	Text  string `json:"text"`
}

// Turn is one question and its answer. Answer holds what's been saved so
// far; while running, turn.delta and the card events carry the rest.
type Turn struct {
	ID        string          `json:"id"`
	BookID    string          `json:"bookId"`
	Question  string          `json:"question"`
	About     string          `json:"about,omitempty"`
	Steps     []Step          `json:"steps"`
	Answer    []cards.Segment `json:"answer"`
	State     TurnState       `json:"state" tstype:"'running' | 'done' | 'stopped' | 'failed'"`
	Reason    string          `json:"reason,omitempty"`
	CreatedAt string          `json:"createdAt"`
	// UpdatedAt orders copies of the turn: a reply that arrives after a
	// newer event must not win.
	UpdatedAt string `json:"updatedAt"`
}

type Turns struct {
	Turns []Turn `json:"turns"`
}

// Question is POST /api/books/{id}/turns.
type Question struct {
	Question string `json:"question"`
	About    *About `json:"about,omitempty"`
}

// Event types this feature publishes.
const (
	EventTurnChanged   = "turn.changed"
	EventTurnDelta     = "turn.delta"
	EventTurnCardStart = "turn.card.start"
	EventTurnRepairing = "turn.card.repairing"
	EventTurnCard      = "turn.card"
	EventTurnsCleared  = "turns.cleared"
)

type TurnChanged struct {
	Turn Turn `json:"turn"`
}

// TurnDelta is prose as it streams, citations already on PDF pages.
type TurnDelta struct {
	TurnID string `json:"turnId"`
	Text   string `json:"text"`
}

// TurnCardStart says a card is being written: draw its skeleton.
type TurnCardStart struct {
	TurnID string     `json:"turnId"`
	Kind   cards.Kind `json:"kind"`
}

// TurnCard is a finished card (valid or raw), replacing the skeleton.
type TurnCard struct {
	TurnID  string        `json:"turnId"`
	Segment cards.Segment `json:"segment"`
}

type TurnsCleared struct {
	BookID string `json:"bookId"`
}
