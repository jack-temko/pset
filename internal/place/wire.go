package place

import "github.com/jackt/pset/internal/change"

// Group is which of the rule's three kinds of state a place is.
type Group string

const (
	// GroupWhere is where the student was.
	GroupWhere Group = "where"
	// GroupLayout is how they laid it out.
	GroupLayout Group = "layout"
	// GroupUnsent is what they had typed and not sent.
	GroupUnsent Group = "unsent"
)

// Kind is which place it is. A thing has at most one place of each kind
// (for page and zoom, one per tab and one without a tab), and each kind
// fills its own fields of Place.
type Kind string

const (
	// KindProblem is the problem a set was on (Where, owned by a set):
	// QuestionID.
	KindProblem Kind = "problem"
	// KindPage is the exact spot a material was scrolled to (Where, owned
	// by a material): Page and Down. With TabID it is that tab's own spot;
	// without, the material's last spot, which a newly opened tab starts
	// from.
	KindPage Kind = "page"
	// KindLine is how far down a guide the student had read (Where, owned
	// by a document): Block.
	KindLine Kind = "line"
	// KindSides is a course's workspace: its two sides, their tabs and the
	// split (Layout, owned by a course): Sides and Split.
	KindSides Kind = "sides"
	// KindZoom is a material's zoom (Layout, owned by a material): Zoom.
	// With TabID it is that tab's own zoom; without, the material's last
	// zoom, which a newly opened tab starts from.
	KindZoom Kind = "zoom"
	// KindAskDraft is a question typed into a course's Ask and not sent
	// (Unsent, owned by a course): Text and AboutID.
	KindAskDraft Kind = "ask_draft"
	// KindNoteDraft is a half-typed professor's note (Unsent, owned by a
	// question): Text.
	KindNoteDraft Kind = "note_draft"
	// KindNewSet is a set being added and not yet added (Unsent, owned by a
	// course): Title, Due and Text.
	KindNewSet Kind = "new_set"
)

// Place is one remembered piece of the student's place. A tab reads the
// places it needs once, when it opens, and then goes its own way; a place is
// on the change log so a new tab finds it, but Undo never moves the student
// back.
type Place struct {
	// ID is the place's id.
	ID string `json:"id"`
	// Seq is the change-log sequence of its last change.
	Seq int64 `json:"seq"`
	// OwnerKind is what kind of thing it belongs to.
	OwnerKind change.Resource `json:"ownerKind"`
	// OwnerID is the thing it belongs to; it goes when that thing goes.
	OwnerID string `json:"ownerId"`
	// Group is which of the three kinds of state it is.
	Group Group `json:"group"`
	// Kind is which place it is, which says which fields below it fills.
	Kind Kind `json:"kind"`
	// TabID is the workspace tab a page or zoom place belongs to: that tab's
	// own spot, since a material can be open in two tabs, and it goes when
	// the tab closes. Absent, the place is the material's last spot, which a
	// newly opened tab starts from (page, zoom).
	TabID string `json:"tabId,omitempty"`
	// QuestionID is the problem the set was on (problem).
	QuestionID string `json:"questionId,omitempty"`
	// Page is the PDF page at the top of the material's view, from 1 (page).
	Page int `json:"page,omitempty"`
	// Down is how far down that page the view's top was, as a fraction of
	// the page's height (page).
	Down float64 `json:"down,omitempty"`
	// Block is the index of the guide's block last in view, from 0 (line).
	Block *int `json:"block,omitempty"`
	// Sides is the workspace's sides, left then right; one when the other
	// is closed (sides).
	Sides []Side `json:"sides,omitempty"`
	// Split is the left side's share of the width, 0 to 1 (sides).
	Split float64 `json:"split,omitempty"`
	// Zoom is the material's zoom, 1 being fitted to the side's width
	// (zoom).
	Zoom float64 `json:"zoom,omitempty"`
	// Text is what was typed (ask_draft, note_draft), or a new set's lines
	// (new_set).
	Text string `json:"text,omitempty"`
	// AboutID is the problem an Ask draft's chip is about (ask_draft).
	AboutID string `json:"aboutId,omitempty"`
	// Title is a new set's title as typed (new_set).
	Title string `json:"title,omitempty"`
	// Due is a new set's due date as picked, YYYY-MM-DD (new_set).
	Due string `json:"due,omitempty"`
}

// TabKind is what a tab in the workspace holds.
type TabKind string

const (
	// TabKindSet is a problem set: the work pane.
	TabKindSet TabKind = "set"
	// TabKindMaterial is a material: the material pane.
	TabKindMaterial TabKind = "material"
	// TabKindAsk is the course's Ask.
	TabKindAsk TabKind = "ask"
)

// Side is one side of the workspace: its tabs, in order, and the one open.
type Side struct {
	// Tabs is its tabs, in order. Never null.
	Tabs []Tab `json:"tabs"`
	// Open is the id of the tab showing.
	Open string `json:"open"`
}

// Tab is one tab on a side of the workspace.
type Tab struct {
	// ID is the tab's own id, so a material open twice is two tabs.
	ID string `json:"id"`
	// Kind is what it holds.
	Kind TabKind `json:"kind"`
	// ThingID is the set or material it holds; empty for Ask.
	ThingID string `json:"thingId,omitempty"`
}

// Places is the places a tab reads when it opens: those of one thing and
// the things under it. Never null.
type Places struct {
	// Places is the list.
	Places []Place `json:"places"`
}
