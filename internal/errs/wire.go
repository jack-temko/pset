package errs

import "encoding/json"

// Action is the one thing a notice's button does. The set is fixed; the web
// app maps each to a behaviour (web/src/api/error-actions.ts).
type Action string

const (
	// ActionNone is an error with nothing to click.
	ActionNone Action = ""
	// ActionRetry runs the failed call again.
	ActionRetry Action = "retry"
	// ActionOpenSettings goes to Settings, where the key lives.
	ActionOpenSettings Action = "open_settings"
	// ActionOpenBook opens the book the error's ref names.
	ActionOpenBook Action = "open_book"
	// ActionCheckUpdate goes to the update check in Settings.
	ActionCheckUpdate Action = "check_update"
	// ActionReload reloads the page, for an app that is out of step with its server.
	ActionReload Action = "reload"
)

// Scope is where a notice is drawn.
type Scope string

const (
	// ScopeInline is the default: the notice sits where the failure belongs.
	ScopeInline Scope = "inline"
	// ScopeScreen is a block on the whole screen (no key, server unreachable):
	// the flash banner.
	ScopeScreen Scope = "screen"
	// ScopeField is one line under a field, with no why or Details.
	ScopeField Scope = "field"
)

// View is what a student is shown, and the wire shape: composed from the
// catalog errors in a chain.
type View struct {
	ID     string `json:"id"`
	What   string `json:"what"`
	Why    string `json:"why,omitempty"`
	Fix    string `json:"fix,omitempty"`
	Action Action `json:"action,omitempty"`
	Scope  Scope  `json:"scope"`
	Field  string `json:"field,omitempty"`
	Ref    string `json:"ref,omitempty"`
	// Incident is the short id the error was kept under, when it was.
	Incident string `json:"incident,omitempty"`
	// Chain is the ids of every catalog error in the chain, outermost first.
	Chain []string `json:"chain"`

	// Status is the HTTP status; it is not sent.
	Status int `json:"-"`
	// Params are the placeholder values the chain was raised with.
	Params map[string]string `json:"-"`
}

// Stored is a view in the form a database row keeps it: the ids and params,
// not the words, so a row shows the catalog's current copy.
type Stored struct {
	Chain    []string          `json:"chain"`
	Params   map[string]string `json:"params,omitempty"`
	Incident string            `json:"incident,omitempty"`
}

// Stored is the view as a row keeps it.
func (v View) Stored() Stored {
	return Stored{Chain: v.Chain, Params: v.Params, Incident: v.Incident}
}

// Marshal is the stored view as the JSON a row keeps in its error column.
func (s Stored) Marshal() string {
	b, err := json.Marshal(s)
	if err != nil {
		return ""
	}
	return string(b)
}

// ParseStored reads what Marshal wrote. An empty column is no error (ok is
// false); a column that can't be read is the fallback view, so a damaged row
// still says something went wrong.
func ParseStored(col string) (v View, ok bool) {
	if col == "" {
		return View{}, false
	}
	var s Stored
	if err := json.Unmarshal([]byte(col), &s); err != nil {
		return Stored{}.View(), true
	}
	return s.View(), true
}

// Chain is the stored form of a fixed chain of ids, outermost first, for a
// migration that turns old text into catalog errors. It names ids, not
// entries, so a migration never changes when the catalog does.
func Chain(ids ...string) string { return Stored{Chain: ids}.Marshal() }
