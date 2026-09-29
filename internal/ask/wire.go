package ask

import "github.com/jackt/pset/internal/doc"

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
	// After is how many answer blocks were written when the call ran:
	// the feed is interleaved, not stacked at the top, so each step sits
	// between the blocks it happened between.
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

// Turn is one question and its answer, a document of blocks. Answer holds
// what's been saved so far; while running, the turn.block events carry the
// rest.
type Turn struct {
	ID        string      `json:"id"`
	BookID    string      `json:"bookId"`
	Question  string      `json:"question"`
	About     string      `json:"about,omitempty"`
	Steps     []Step      `json:"steps"`
	Answer    []doc.Block `json:"answer"`
	State     TurnState   `json:"state" tstype:"'running' | 'done' | 'stopped' | 'failed'"`
	Reason    string      `json:"reason,omitempty"`
	CreatedAt string      `json:"createdAt"`
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
	EventTurnChanged = "turn.changed"
	// The blocks of an answer as they are written: a skeleton when a
	// block's type has arrived, its text as it streams, a "Tidying" label
	// while it is repaired, and the finished block in the skeleton's place.
	EventTurnBlockStart     = "turn.block.start"
	EventTurnBlockText      = "turn.block.text"
	EventTurnBlockRepairing = "turn.block.repairing"
	EventTurnBlock          = "turn.block"
	EventTurnBlockFailed    = "turn.block.failed"
	EventTurnsCleared       = "turns.cleared"
)

type TurnChanged struct {
	Turn Turn `json:"turn"`
}

// TurnBlockStart says a block is being written: draw its skeleton.
type TurnBlockStart struct {
	TurnID string `json:"turnId"`
	Type   string `json:"type"`
}

// TurnBlockText is the open text block's new runs, citations already on
// PDF pages.
type TurnBlockText struct {
	TurnID string    `json:"turnId"`
	Runs   []doc.Run `json:"runs"`
}

// TurnBlockRepairing says the block being written is being repaired.
type TurnBlockRepairing struct {
	TurnID string `json:"turnId"`
	Type   string `json:"type"`
}

// TurnBlock is a finished block, replacing the skeleton. For
// turn.block.failed it is a raw block: repair could not make it valid.
type TurnBlock struct {
	TurnID string    `json:"turnId"`
	Block  doc.Block `json:"block"`
}

type TurnsCleared struct {
	BookID string `json:"bookId"`
}
