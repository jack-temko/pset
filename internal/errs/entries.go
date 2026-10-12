package errs

import "net/http"

// The entries errs owns: what is true of any failure, and of any request.

// Unexpected is the fallback: a failure with no catalog error anywhere in
// its chain.
var Unexpected = Define(Entry{
	ID:     "internal.unexpected",
	What:   "Something went wrong inside PSet.",
	Why:    "PSet hit a problem it has no name for.",
	Fix:    "Try again. If it keeps happening, copy the details and report it.",
	Action: ActionRetry,
	Status: http.StatusInternalServerError,
})

// The request errors are the generic ones every route can answer.
var (
	// InvalidJSON is a body that is not the JSON the route reads.
	InvalidJSON = Define(Entry{
		ID:     "request.invalid_json",
		What:   "PSet couldn't read what was sent.",
		Why:    "The page and PSet's server are out of step, which happens after an update.",
		Fix:    "Reload the page and try again.",
		Action: ActionReload,
		Status: http.StatusBadRequest,
	})
	// TooLarge is a JSON body over the limit.
	TooLarge = Define(Entry{
		ID:     "request.too_large",
		What:   "That's too much to send in one request.",
		Why:    "A single request is limited to {limit} MB.",
		Fix:    "Send it in smaller pieces.",
		Status: http.StatusRequestEntityTooLarge,
	})
	// NoSuchEndpoint is an /api/ path nothing serves.
	NoSuchEndpoint = Define(Entry{
		ID:     "request.not_found",
		What:   "PSet's server doesn't have what the page asked for.",
		Why:    "The page and the server are out of step, which happens after an update.",
		Fix:    "Reload the page.",
		Action: ActionReload,
		Status: http.StatusNotFound,
	})
	// NotLocal is a request addressed to a name that is not this computer.
	NotLocal = Define(Entry{
		ID:     "request.not_local",
		What:   "PSet refused that request.",
		Why:    "PSet answers only requests addressed to this computer, as localhost.",
		Fix:    "Open PSet at http://localhost and try again.",
		Status: http.StatusForbidden,
	})
	// ForeignOrigin is a change asked for by a page that is not PSet's own.
	ForeignOrigin = Define(Entry{
		ID:     "request.foreign_origin",
		What:   "PSet refused that change.",
		Why:    "PSet takes changes only from its own page.",
		Fix:    "Make the change from PSet's own page.",
		Status: http.StatusForbidden,
	})
	// Unreachable is the server not answering at all. It is raised in the
	// web app, where the failure is seen; it is declared here so the catalog,
	// the generated types and the docs hold it with the rest.
	Unreachable = Define(Entry{
		ID:     "request.unreachable",
		What:   "PSet can't reach its server.",
		Why:    "The server may have stopped, or the computer went to sleep.",
		Fix:    "Start PSet again, then try again.",
		Action: ActionRetry,
		Scope:  ScopeScreen,
	})
)

// BookNotFound is a book that isn't on the shelf. It is here because the
// library, the tutor, memory and time all answer it, and none of them is
// below the others.
var BookNotFound = Define(Entry{
	ID:     "book.not_found",
	What:   "That book isn't on your shelf.",
	Why:    "It was removed, or the link is out of date.",
	Fix:    "Go back to your shelf and open it from there.",
	Status: http.StatusNotFound,
})

// The three ways PSet's own machinery fails under any feature: its
// database, its files, and the shape of its own data. A package wraps what
// it gets from sql, os or encoding in one of these before it leaves the
// package (wrapcheck), so a failure always names a cause; the feature's own
// entry goes around it.
var (
	// Database is the database failing.
	Database = Define(Entry{
		ID:     "internal.database",
		What:   "PSet's database didn't answer.",
		Why:    "Reading or writing its data failed.",
		Fix:    "Try again. If it keeps happening, check the database in Settings.",
		Action: ActionRetry,
		Status: http.StatusInternalServerError,
	})
	// Disk is a file that could not be read or written.
	Disk = Define(Entry{
		ID:     "internal.disk",
		What:   "PSet couldn't read or write a file.",
		Why:    "The disk may be full, or PSet isn't allowed to use that folder.",
		Fix:    "Free some space or check the folder's permissions, then try again.",
		Action: ActionRetry,
		Status: http.StatusInternalServerError,
	})
	// Data is a value PSet could not encode, decode or parse.
	Data = Define(Entry{
		ID:     "internal.data",
		What:   "PSet couldn't make sense of some of its own data.",
		Why:    "A stored or sent value wasn't in the form PSet expects.",
		Fix:    "Try again. If it keeps happening, copy the details and report it.",
		Action: ActionRetry,
		Status: http.StatusInternalServerError,
	})
)

// The two answers a request gets when the page is behind the server: it names
// something that is gone, or asks for what the thing's state no longer
// allows. Both are the page being out of date, and say so the same way.
var (
	// Gone is a thing a request names that isn't there.
	Gone = Define(Entry{
		ID:     "request.gone",
		What:   "That {thing} isn't there.",
		Why:    "It was removed, or the page is out of date.",
		Fix:    "Reload the page to see what is there now.",
		Action: ActionReload,
		Status: http.StatusNotFound,
	})
	// Stale is a request for what the thing's state no longer allows.
	Stale = Define(Entry{
		ID:     "request.stale",
		What:   "That {thing} has moved on.",
		Why:    "It isn't in the state this needs, so the page is out of date.",
		Fix:    "Reload the page to see where it stands.",
		Action: ActionReload,
	})
)
