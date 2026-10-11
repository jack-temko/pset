// Package errs is PSet's error catalog. Every error a student can see has an
// Entry: a dotted id, what happened, why, how to fix it and at most one
// typed action. Each package declares the entries for the causes it detects
// in its own errors.go, as unexported package vars (so the unused linter
// flags a dead one), and raises them with New or Wrap. Resolve reads a
// returned error chain and composes what the student sees; Report also logs
// it and keeps it for the Settings errors list.
//
// Composition (design: ideas/error-catalog-grill.md, D5): the what comes
// from the outermost catalog error in the chain, the why and fix from the
// deepest one that has them. A chain with no catalog error is
// internal.unexpected.
//
// A cause raised in more than one package belongs to the lowest package
// that detects it (llm owns key.* and model.*, errs owns internal.* and
// request.*); the others wrap it and never declare it again.
package errs

import (
	"path/filepath"
	"regexp"
	"runtime"
	"slices"
	"strings"
	"sync"
)

// Entry is one row of the catalog. The text may hold {name} placeholders,
// filled from the params an error is raised with.
type Entry struct {
	ID     string
	What   string
	Why    string
	Fix    string
	Action Action
	// Status is the HTTP status the error answers with. Zero inherits the
	// next entry down the chain, and then 422.
	Status int
	// Scope is Inline when empty.
	Scope Scope
	// Owner is the package that declared the entry, filled in by Define.
	Owner string
}

var idPattern = regexp.MustCompile(`^[a-z]+(\.[a-z_]+)+$`)

var (
	mu       sync.Mutex
	registry = map[string]*Entry{}
)

// Define adds an entry to the catalog and returns it. It panics on a
// duplicate or malformed id, at start-up, so a bad entry never ships.
func Define(e Entry) *Entry {
	if !idPattern.MatchString(e.ID) {
		panic("errs: bad error id " + e.ID)
	}
	if e.What == "" {
		panic("errs: " + e.ID + " has no what")
	}
	if e.Scope == "" {
		e.Scope = ScopeInline
	}
	if _, file, _, ok := runtime.Caller(1); ok {
		e.Owner = filepath.Base(filepath.Dir(file))
	}
	mu.Lock()
	defer mu.Unlock()
	if _, dup := registry[e.ID]; dup {
		panic("errs: duplicate error id " + e.ID)
	}
	registry[e.ID] = &e
	return &e
}

// All is every entry, sorted by id.
func All() []*Entry {
	mu.Lock()
	defer mu.Unlock()
	out := make([]*Entry, 0, len(registry))
	for _, e := range registry {
		out = append(out, e)
	}
	slices.SortFunc(out, func(a, b *Entry) int { return strings.Compare(a.ID, b.ID) })
	return out
}

// Lookup finds an entry by id.
func Lookup(id string) (*Entry, bool) {
	mu.Lock()
	defer mu.Unlock()
	e, ok := registry[id]
	return e, ok
}

// Error makes an Entry an error, so errors.Is(err, entry) asks whether a
// chain holds that entry. Raise it with New or Wrap, not by returning the
// entry itself.
func (e *Entry) Error() string { return e.ID }

// Error is an Entry raised: its params, the cause it wraps, and the field
// or resource it points at.
type Error struct {
	entry  *Entry
	params map[string]string
	cause  error
	field  string
	ref    string
}

// New raises the entry. Params are name, value pairs for its placeholders.
func (e *Entry) New(params ...string) *Error {
	return &Error{entry: e, params: pairs(e.ID, params)}
}

// Wrap raises the entry because of cause, which stays in the chain.
func (e *Entry) Wrap(cause error, params ...string) *Error {
	return &Error{entry: e, params: pairs(e.ID, params), cause: cause}
}

// Of is Wrap for a result that may be no error at all: a nil cause is nil,
// so `return errs.Database.Of(rows.Err())` is safe at the end of a function.
func (e *Entry) Of(cause error, params ...string) error {
	if cause == nil {
		return nil
	}
	return e.Wrap(cause, params...)
}

func pairs(id string, kv []string) map[string]string {
	if len(kv)%2 != 0 {
		panic("errs: " + id + " params are name, value pairs")
	}
	if len(kv) == 0 {
		return nil
	}
	m := make(map[string]string, len(kv)/2)
	for i := 0; i < len(kv); i += 2 {
		m[kv[i]] = kv[i+1]
	}
	return m
}

// OnField returns a copy of e that points at an input.
func (e *Error) OnField(field string) *Error {
	c := *e
	c.field = field
	return &c
}

// About returns a copy of e that points at a resource, by id (the book that
// is already on the shelf).
func (e *Error) About(ref string) *Error {
	c := *e
	c.ref = ref
	return &c
}

// Entry is the catalog entry this error raises.
func (e *Error) Entry() *Entry { return e.entry }

// Error is lowercase and without a period, for logs: the id, then the cause.
func (e *Error) Error() string {
	if e.cause == nil {
		return e.entry.ID
	}
	return e.entry.ID + ": " + e.cause.Error()
}

// Unwrap lets errors.Is and errors.As see the cause.
func (e *Error) Unwrap() error { return e.cause }

// Is matches the entry itself, so errors.Is(err, entry) works.
func (e *Error) Is(target error) bool {
	t, ok := target.(*Entry)
	return ok && t == e.entry
}

// fill puts params into a text's {name} placeholders. A placeholder with no
// param is left as written, which a test of the catalog catches.
func fill(text string, params map[string]string) string {
	if !strings.Contains(text, "{") {
		return text
	}
	for k, v := range params {
		text = strings.ReplaceAll(text, "{"+k+"}", v)
	}
	return text
}

// catalogChain is every catalog error in err's chain, outermost first.
func catalogChain(err error) []*Error {
	var out []*Error
	var walk func(error)
	walk = func(err error) {
		for err != nil {
			//nolint:errorlint // this is the walk itself: one link at a time, so each catalog error is found
			switch e := err.(type) {
			case *Error:
				out = append(out, e)
			case *Entry:
				// An entry returned as it is, with nothing to fill in.
				out = append(out, &Error{entry: e})
			}
			//nolint:errorlint // the same walk: a joined error's links are its Unwrap() []error
			switch u := err.(type) {
			case interface{ Unwrap() []error }:
				for _, c := range u.Unwrap() {
					walk(c)
				}
				return
			case interface{ Unwrap() error }:
				err = u.Unwrap()
			default:
				return
			}
		}
	}
	walk(err)
	return out
}

// Resolve composes what a student sees from err's chain (D5).
func Resolve(err error) View {
	chain := catalogChain(err)
	if len(chain) == 0 {
		return resolve([]*Error{Unexpected.New()})
	}
	return resolve(chain)
}

func resolve(chain []*Error) View {
	outer := chain[0]
	v := View{
		ID:    outer.entry.ID,
		What:  fill(outer.entry.What, outer.params),
		Scope: outer.entry.Scope,
		Chain: make([]string, len(chain)),
	}
	for i, e := range chain {
		v.Chain[i] = e.entry.ID
		if e.entry.Status != 0 && v.Status == 0 {
			v.Status = e.entry.Status
		}
		if e.field != "" && v.Field == "" {
			v.Field = e.field
		}
		if e.ref != "" && v.Ref == "" {
			v.Ref = e.ref
		}
		for k, p := range e.params {
			if v.Params == nil {
				v.Params = map[string]string{}
			}
			v.Params[k] = p
		}
	}
	// The deepest entry that has a why gives the why; the same for the fix
	// and the action. The fix lives where the cause is known.
	for i := len(chain) - 1; i >= 0; i-- {
		e := chain[i]
		if v.Why == "" && e.entry.Why != "" {
			v.Why = fill(e.entry.Why, e.params)
		}
		if v.Fix == "" && e.entry.Fix != "" {
			v.Fix = fill(e.entry.Fix, e.params)
		}
		if v.Action == ActionNone && e.entry.Action != ActionNone {
			v.Action = e.entry.Action
		}
	}
	if v.Status == 0 {
		v.Status = 422
	}
	return v
}

// View rebuilds the view from the catalog. An id the catalog no longer has
// is skipped; none left is internal.unexpected.
func (s Stored) View() View {
	var chain []*Error
	for _, id := range s.Chain {
		if e, ok := Lookup(id); ok {
			chain = append(chain, &Error{entry: e, params: s.Params})
		}
	}
	if len(chain) == 0 {
		chain = []*Error{Unexpected.New()}
	}
	v := resolve(chain)
	v.Incident = s.Incident
	return v
}

// OfID is the view of one entry by id with the params its text needs, for
// rows that kept only an id.
func OfID(id string, params ...string) View {
	return Stored{Chain: []string{id}, Params: pairs(id, params)}.View()
}
