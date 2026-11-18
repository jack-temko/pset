package change

import (
	"encoding/json"

	"github.com/jackt/pset/internal/doc"
)

// Resource is a kind of thing the change log names. Every resource on the
// wire carries an id and the seq of its last change, and the page keeps
// whichever copy of a thing has the higher seq.
type Resource string

const (
	// ResourceCourse is a course: what the student is taking.
	ResourceCourse Resource = "course"
	// ResourceMaterial is a document with pages in a course: a textbook, a
	// handout, an assignment sheet.
	ResourceMaterial Resource = "material"
	// ResourceSet is a problem set: the work.
	ResourceSet Resource = "set"
	// ResourceQuestion is one problem of a set, as the student made it.
	ResourceQuestion Resource = "question"
	// ResourceFind is where PSet found a question, and its statement.
	ResourceFind Resource = "find"
	// ResourceReading is how a question's figures read, in words.
	ResourceReading Resource = "reading"
	// ResourceDocument is a guide or an Ask answer: blocks PSet writes.
	ResourceDocument Resource = "document"
	// ResourceTurn is one question asked in a course's Ask.
	ResourceTurn Resource = "turn"
	// ResourceRead is an assignment sheet being read into rows for review.
	ResourceRead Resource = "read"
	// ResourceMemory is one preference about how the student wants answers.
	ResourceMemory Resource = "memory"
	// ResourceStep is one piece of background work on a thing.
	ResourceStep Resource = "step"
	// ResourceIncident is one failure, said once, until it resolves.
	ResourceIncident Resource = "incident"
	// ResourceCondition is something PSet depends on (a key, the PDF
	// reader), and whether it holds.
	ResourceCondition Resource = "condition"
	// ResourcePlace is where the student was, how they laid it out, or what
	// they had not sent, for one thing.
	ResourcePlace Resource = "place"
)

// Op is what happened to a thing.
type Op string

const (
	// OpCreated is a new thing.
	OpCreated Op = "created"
	// OpChanged is a thing with new values.
	OpChanged Op = "changed"
	// OpRemoved is a thing the student removed: hidden, and back with Undo
	// for a week.
	OpRemoved Op = "removed"
	// OpRestored is a removed thing brought back by Undo.
	OpRestored Op = "restored"
)

// Actor is who made a change.
type Actor string

const (
	// ActorStudent is the student, through an action (or Ask running one
	// for them).
	ActorStudent Actor = "student"
	// ActorPSet is PSet's own background work: a step.
	ActorPSet Actor = "pset"
)

// Change is one row of the change log, sent as the "change" event. The page
// has one handler for it: patch the thing from After when it is there,
// otherwise read the thing again by kind and id, and keep whichever copy
// has the higher seq.
type Change struct {
	// Seq is the change's place in the log, rising by one each change. The
	// page sends the last one it saw when it reconnects, and the stream
	// replays from there.
	Seq int64 `json:"seq"`
	// Kind is what kind of thing changed.
	Kind Resource `json:"kind"`
	// ID is the thing that changed.
	ID string `json:"id"`
	// CourseID is the course the thing is in, so a screen showing another
	// course can skip it. Absent for what belongs to no course (a
	// condition).
	CourseID string `json:"courseId,omitempty"`
	// SetID is the set the thing is in, for a question, its find, reading,
	// guide and steps.
	SetID string `json:"setId,omitempty"`
	// Op is what happened to it.
	Op Op `json:"op"`
	// After is the fields the student changed, with their new values, for
	// what the student made. Absent for what PSet made: the page reads the
	// thing again.
	After json.RawMessage `json:"after,omitempty" tstype:"{ [field: string]: unknown }"`
	// Actor is who made the change.
	Actor Actor `json:"actor"`
	// Action is the id of the student's action this change belongs to, the
	// one Undo takes back as a whole ("Removed Problem set 4 and its 12
	// problems. Undo."). Absent for PSet's own work.
	Action string `json:"action,omitempty"`
}

// The events on GET /api/changes (/api/events from the cut-over). Only
// "change" is logged; the others say
// what is happening right now and are lost on a reconnect, which costs
// nothing, since the finished result arrives as a change.
const (
	// EventChange carries a Change.
	EventChange = "change"
	// EventResync says the page asked to replay from a seq the log no
	// longer holds (it keeps a week): read everything on screen again.
	EventResync = "resync"
	// EventBlockStart carries a BlockStart.
	EventBlockStart = "document.block.start"
	// EventBlockText carries a BlockText.
	EventBlockText = "document.block.text"
	// EventBlockRepairing carries a BlockRepairing.
	EventBlockRepairing = "document.block.repairing"
	// EventBlock carries a BlockDone with the finished block.
	EventBlock = "document.block"
	// EventBlockFailed carries a BlockDone with a raw block: repair could
	// not make it valid, and it is shown muted, as its source.
	EventBlockFailed = "document.block.failed"
	// EventStepActivity carries a StepActivity.
	EventStepActivity = "step.activity"
)

// BlockStart says a document's next block is being written: draw its
// skeleton.
type BlockStart struct {
	// DocumentID is the guide or answer being written.
	DocumentID string `json:"documentId"`
	// Index is the block's place in the document, from 0, so a page that
	// read the document part way through knows which blocks it already has.
	Index int `json:"index"`
	// Type is the block's type (doc's block types: "para", "step", ...).
	Type string `json:"type"`
}

// BlockText is more text for the open text block, citations already on PDF
// pages.
type BlockText struct {
	// DocumentID is the guide or answer being written.
	DocumentID string `json:"documentId"`
	// Index is the block the text belongs to.
	Index int `json:"index"`
	// Runs is the new text, to append. Never null.
	Runs []doc.Run `json:"runs"`
}

// BlockRepairing says the block being written failed its checks and is
// being repaired: the page shows "Tidying".
type BlockRepairing struct {
	// DocumentID is the guide or answer being written.
	DocumentID string `json:"documentId"`
	// Index is the block being repaired.
	Index int `json:"index"`
	// Type is the block's type.
	Type string `json:"type"`
}

// BlockDone is a finished block, in its skeleton's place.
type BlockDone struct {
	// DocumentID is the guide or answer being written.
	DocumentID string `json:"documentId"`
	// Index is the block's place in the document.
	Index int `json:"index"`
	// Block is the block itself.
	Block doc.Block `json:"block"`
}

// StepActivity is what a running step is doing right now, in a few words
// that replace the last ones: "Reading page 142", "Searching 'eigenvalue'".
type StepActivity struct {
	// StepID is the step, which the page already holds on its subject.
	StepID string `json:"stepId"`
	// Label is the words to show.
	Label string `json:"label"`
}
