package action

import (
	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/condition"
)

// Entry is one action as the page receives it from the catalog: what the
// palette lists, the key it answers to, and why it is blocked when it is.
type Entry struct {
	// ID is the action's dotted id ("question.done", "set.rename",
	// "material.add").
	ID string `json:"id"`
	// Name is what the palette and the button's hint call it ("Mark done").
	Name string `json:"name"`
	// Key is its shortcut ("d", "ctrl+z"), a single key when the cursor is
	// not in a text box; absent when it has none.
	Key string `json:"key,omitempty"`
	// Needs is the conditions that must hold for it to run: while one does
	// not, the action says so and offers its fix. Never null.
	Needs []condition.ID `json:"needs"`
	// Undoable is true when its changes can be written back by Undo.
	Undoable bool `json:"undoable"`
	// Costs is true when it starts work that spends on model calls. Ask runs
	// only actions that are undoable and cost nothing, and proposes the
	// rest with a button.
	Costs bool `json:"costs"`
}

// List is every action in the catalog, sorted by id: what the palette
// lists. Never null.
type List struct {
	Actions []Entry `json:"actions"`
}

// Done is the action route's reply: the action's id, for its Undo, and
// what it acted on.
type Done struct {
	// Action is the id Undo takes it back by; absent when there is nothing to
	// take back (it changed nothing, or can't be undone).
	Action string `json:"action,omitempty"`
	// Kind and ID are the thing it acted on, when it names one.
	Kind change.Resource `json:"kind,omitempty"`
	ID   string          `json:"id,omitempty"`
	// Seq is how far the change log had got once it was done, so the page
	// knows when its copies have caught up.
	Seq int64 `json:"seq"`
}

// Undo is the undo call (Ctrl+Z, or the Undo on "Removed Problem set 4.
// Undo."): it writes an action's old values back.
type Undo struct {
	// Action is the id of the action to take back, as the change log named
	// it. Absent for Ctrl+Z: the student's newest action not yet undone.
	Action string `json:"action,omitempty"`
}

// Undone is the undo call's reply: what was taken back, said where the
// student is without moving them ("Renamed back to Problem set 4. Show.").
type Undone struct {
	// Action is the id of the action taken back.
	Action string `json:"action"`
	// Undo is this undo's own id: undoing it is redo.
	Undo string `json:"undo"`
	// Entry is its catalog id ("set.rename").
	Entry string `json:"entry"`
	// Said is the sentence to show.
	Said string `json:"said"`
	// Kind is what kind of thing Show goes to.
	Kind change.Resource `json:"kind"`
	// ID is the thing Show goes to.
	ID string `json:"id"`
	// Seq is the change-log sequence of the undo's last write, so the page
	// knows when its copies have caught up.
	Seq int64 `json:"seq"`
}
