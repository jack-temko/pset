package incident

import (
	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/step"
)

// Kind is the kind of failure, named by its catalog entry; how it looks and
// what clears it follow from the kind.
type Kind string

const (
	// KindPassing may pass by itself (the model is busy): not red, the step
	// says "trying again in 8 s". It becomes its real kind only when the
	// tries run out.
	KindPassing Kind = "passing"
	// KindWaitingOnYou needs something only the student can give (a key,
	// credit): one notice at the cause, and the rows waiting on it say they
	// are waiting. Clears when what it names is back.
	KindWaitingOnYou Kind = "waiting_on_you"
	// KindYourInput is the student's typing (a name already taken): one line
	// under the field. Answered, never kept as an incident.
	KindYourInput Kind = "your_input"
	// KindCant is something PSet cannot do as asked (the problem is not in
	// the book): red, with the choice to make (try a page, box it).
	KindCant Kind = "cant"
	// KindOurs is an unexpected failure: red, with Details and Copy.
	KindOurs Kind = "ours"
)

// Born is where a failure was raised.
type Born string

const (
	// BornRequest is a request the page made.
	BornRequest Born = "request"
	// BornStep is a step of background work.
	BornStep Born = "step"
	// BornPage is the page itself (a crash, a dead event stream), posted as
	// a PageReport.
	BornPage Born = "page"
)

// State is whether an incident is open, and how it was resolved.
type State string

const (
	// StateOpen is still the case: shown at its closest owner.
	StateOpen State = "open"
	// StateHealed resolved by itself once its cause was seen to be gone (a
	// call worked, a key was saved).
	StateHealed State = "healed"
	// StateTriedAgain resolved when the student tried again, or made the
	// choice it asked for, and it worked.
	StateTriedAgain State = "tried_again"
	// StateSubjectRemoved resolved because what it was about was removed.
	StateSubjectRemoved State = "subject_removed"
	// StateDismissed resolved because the student dismissed it.
	StateDismissed State = "dismissed"
)

// Incident is one failure on one subject. The same cause on the same
// subject bumps its count rather than making another. Settings lists the
// open ones, then the ones resolved in the last week.
type Incident struct {
	// ID is the six-character incident id the student can quote.
	ID string `json:"id"`
	// Seq is the change-log sequence of its last change.
	Seq int64 `json:"seq"`
	// Error is what the student is shown: what happened, why and the fix,
	// composed from the catalog in the student's words.
	Error errs.View `json:"error"`
	// Kind is the kind of failure, which decides how it looks.
	Kind Kind `json:"kind"`
	// SubjectKind is what kind of thing it is about. Absent when it is
	// about nothing in particular (the key, for every waiting step).
	SubjectKind change.Resource `json:"subjectKind,omitempty"`
	// SubjectID is the thing it is about.
	SubjectID string `json:"subjectId,omitempty"`
	// CourseID is the course the subject is in, so it is placed at the
	// closest owner on screen.
	CourseID string `json:"courseId,omitempty"`
	// SetID is the set the subject is in.
	SetID string `json:"setId,omitempty"`
	// StepID is the step that failed, when one did: Try again reruns it, and
	// Settings opens the incident onto it and its model calls.
	StepID string `json:"stepId,omitempty"`
	// Action is the id of the student's action that led to it.
	Action string `json:"action,omitempty"`
	// Born is where it was raised.
	Born Born `json:"born"`
	// Route is the request's route, or the page's address, it was raised
	// in; absent for a step.
	Route string `json:"route,omitempty"`
	// State is whether it is open, and how it was resolved.
	State State `json:"state"`
	// Count is how many times the same cause has failed on the same subject.
	Count int `json:"count"`
	// FirstAt is when it first happened (RFC 3339).
	FirstAt string `json:"firstAt"`
	// LastAt is when it last happened (RFC 3339).
	LastAt string `json:"lastAt"`
	// ResolvedAt is when it was resolved (RFC 3339); absent while open.
	ResolvedAt string `json:"resolvedAt,omitempty"`
	// Detail is the error's own text, for a bug report: never a key, a
	// prompt or an answer.
	Detail string `json:"detail"`
}

// Incidents is Settings' list: the open ones, then the ones resolved in the
// last week, newest first. Never null.
type Incidents struct {
	// Incidents is the list.
	Incidents []Incident `json:"incidents"`
}

// PageReport is what the page posts for a failure of its own (a crash, a
// rejected promise, a dead event stream), so it becomes an incident like any
// other. The reply is the Incident.
type PageReport struct {
	// Chain is the catalog ids of the failure, outermost first, from the
	// same generated catalog the server raises from. Never null.
	Chain []string `json:"chain"`
	// Links are the values each link of the chain was raised with, in the
	// chain's order. Never null.
	Links []map[string]string `json:"links"`
	// Detail is the error's own text and stack.
	Detail string `json:"detail"`
	// Route is the page's address when it failed.
	Route string `json:"route"`
	// SubjectKind is what the failing part of the page was showing, if it
	// names one thing.
	SubjectKind change.Resource `json:"subjectKind,omitempty"`
	// SubjectID is that thing.
	SubjectID string `json:"subjectId,omitempty"`
	// Action is the id of the action the page was running, if any.
	Action string `json:"action,omitempty"`
}

// Trace is an incident opened onto what led to it, for Settings: its step
// and that step's model calls, and the changes to its subject around it.
type Trace struct {
	// Incident is the incident.
	Incident Incident `json:"incident"`
	// Step is the step that failed, when one did.
	Step *step.Step `json:"step,omitempty"`
	// Calls are the step's model calls, newest first. Never null.
	Calls []Call `json:"calls"`
	// Changes are the changes to its subject from an hour before it first
	// happened, oldest first, at most 50. Never null.
	Changes []change.Change `json:"changes"`
}

// Call is one model call a step made, as a trace shows it: never its
// prompt or its answer.
type Call struct {
	// At is when it was made (RFC 3339).
	At string `json:"at"`
	// Attempt is which run of the step made it.
	Attempt int `json:"attempt"`
	// Model is the model asked; Answered the one that answered, if another.
	Model    string `json:"model"`
	Answered string `json:"answered,omitempty"`
	// Ms is how long it took.
	Ms int64 `json:"ms"`
	// Tokens and Cost are what the provider counted; absent when it said
	// nothing (a failed or stopped call).
	Tokens *int     `json:"tokens,omitempty"`
	Cost   *float64 `json:"cost,omitempty"`
	// ErrorID is the catalog id it failed with, if it did.
	ErrorID string `json:"errorId,omitempty"`
}

// The incident actions' inputs (internal/action).
type (
	// TryAgain reruns what an incident is about: its step, or, for one that
	// waits on a condition, everything waiting on it.
	TryAgain struct {
		ID string `json:"id"`
	}
	// Dismiss puts an incident away.
	Dismiss struct {
		ID string `json:"id"`
	}
)
