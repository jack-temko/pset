package step

import (
	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/usage"
)

// State is where a step is.
type State string

const (
	// StateWaiting is waiting its turn, or waiting on a cause the student
	// can clear (no key, no credit): then IncidentID names it, and the step
	// runs again by itself once the cause is gone.
	StateWaiting State = "waiting"
	// StateRunning is running now.
	StateRunning State = "running"
	// StateRetrying failed in a way that may pass (the model is busy) and
	// runs again at RetryAt: "trying again in 8 s".
	StateRetrying State = "retrying"
	// StateDone finished; its output is on its own resource (a find, a
	// reading, a document).
	StateDone State = "done"
	// StateFailed failed for good; IncidentID says why and what to do.
	StateFailed State = "failed"
	// StateOutOfDate finished, but something it was made from has changed
	// since (a note, a corrected reading). Nothing is spent until the
	// student asks: one Rewrite button.
	StateOutOfDate State = "out_of_date"
	// StateNotAsked is a step PSet does not run until it is asked for: a
	// guide beyond the three PSet writes ahead.
	StateNotAsked State = "not_asked"
)

// Name is which step it is. Each kind of subject has its own steps, in
// order.
type Name string

// The steps of each kind of subject, in order.
const (
	// A material's steps.

	// NameExamine looks at the file: its pages, its title, whether it has
	// text.
	NameExamine Name = "examine"
	// NameReadPages reads the text of every page, recognizing a scan's; it
	// resumes where it stopped.
	NameReadPages Name = "read_pages"
	// NameContents finds the contents and its sections.
	NameContents Name = "contents"
	// NameNumbering works out how the material numbers its problems and
	// pages.
	NameNumbering Name = "numbering"
	// NameSearch makes the pages searchable.
	NameSearch Name = "search"

	// An assignment read's one step.

	// NameRead reads an assignment sheet into rows for review.
	NameRead Name = "read"

	// A question's steps, in order.

	// NameFind finds the problem in the course's materials.
	NameFind Name = "find"
	// NameFigures reads its figures into words; only for a problem with
	// figures.
	NameFigures Name = "figures"
	// NameGuide writes its guide: the hint and the walkthrough.
	NameGuide Name = "guide"
	// NameCheck checks the guide by solving the problem apart, beside the
	// guide.
	NameCheck Name = "check"

	// A set's one step.

	// NameRank ranks its problems by difficulty, once nothing is left to
	// find.
	NameRank Name = "rank"

	// An Ask turn's one step.

	// NameAnswer writes the answer.
	NameAnswer Name = "answer"
)

// Step is one piece of background work on one thing, as the screen shows
// it: "Find done, figures running, guide waiting". A thing carries its
// steps, in order.
type Step struct {
	// ID is the step's own id, which activity lines and incidents name.
	ID string `json:"id"`
	// Seq is the change-log sequence of the step's last change.
	Seq int64 `json:"seq"`
	// SubjectKind is what kind of thing the step works on: a material, a
	// read, a question, a set or a turn.
	SubjectKind change.Resource `json:"subjectKind"`
	// SubjectID is the thing it works on.
	SubjectID string `json:"subjectId"`
	// Name is which step it is.
	Name Name `json:"name"`
	// State is where it is.
	State State `json:"state"`
	// Attempts is how many times it has run, counting retries: so a second
	// failure can say it is one ("Still couldn't find 4.62, 2nd try").
	Attempts int `json:"attempts"`
	// RetryAt is when a retrying step runs again (RFC 3339).
	RetryAt string `json:"retryAt,omitempty"`
	// IncidentID is the open incident it failed or waits on, if any. The
	// incident says why once, at its closest owner; the step only says it
	// is waiting or failed.
	IncidentID string `json:"incidentId,omitempty"`
	// StartedAt is when its latest run began (RFC 3339).
	StartedAt string `json:"startedAt,omitempty"`
	// EndedAt is when its latest run ended (RFC 3339).
	EndedAt string `json:"endedAt,omitempty"`
	// TypicalSeconds is how long this step usually takes here, from the
	// student's own finished steps of the same name, so a waiting or
	// running step can say "about 20 s". Absent until there are some.
	TypicalSeconds int `json:"typicalSeconds,omitempty"`
	// Usage is what its model calls spent, across every run; absent until
	// it has made one.
	Usage *usage.Usage `json:"usage,omitempty"`
}
