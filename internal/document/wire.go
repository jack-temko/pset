package document

import (
	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/doc"
)

// State is whether a document's blocks are whole.
type State string

const (
	// StateWriting is being written now: the document.block events carry
	// the rest.
	StateWriting State = "writing"
	// StateDone is written whole.
	StateDone State = "done"
	// StateStopped ended before it was whole: the student stopped it, or its
	// step failed part way (the step says which). What was written stays.
	StateStopped State = "stopped"
)

// Document is a guide or an answer: blocks PSet writes, checks and repairs,
// and the page draws without parsing anything. A guide's first block is its
// hint; the rest is the walkthrough, ending in its answers.
type Document struct {
	// ID is the document's id: a question's guideId, a turn's answerId.
	ID string `json:"id"`
	// Seq is the change-log sequence of its last change.
	Seq int64 `json:"seq"`
	// OwnerKind is what it belongs to: a question (its guide) or a turn
	// (its answer).
	OwnerKind change.Resource `json:"ownerKind"`
	// OwnerID is the question or turn.
	OwnerID string `json:"ownerId"`
	// Blocks is what has been written so far, in order. Never null.
	Blocks []doc.Block `json:"blocks"`
	// State is whether the blocks are whole.
	State State `json:"state"`
	// Corrected is the index of each block the check changed after the
	// student could have read it, marked as corrected on the page. Never
	// null.
	Corrected []int `json:"corrected"`
}
