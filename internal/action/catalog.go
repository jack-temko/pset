package action

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
	"reflect"
	"regexp"
	"slices"
	"strings"
	"sync"

	"github.com/google/uuid"

	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/condition"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/store"
)

// Def declares one action, in the package that owns it. In is its typed
// input, decoded from the request body.
type Def[In any] struct {
	// ID is dotted, as errors are: "course.rename".
	ID string
	// Name is what the palette and the button's hint call it ("Rename course").
	Name string
	// Key is its shortcut, if it has one.
	Key string
	// Needs are the conditions that must hold for it to run.
	Needs []condition.ID
	// Undoable says Undo can take it back. Costs says it starts work that
	// spends on model calls.
	Undoable, Costs bool
	// Undone is what Undo says once it is taken back, and Redone what undoing
	// that undo says. {name} is the thing's name as it is then.
	Undone, Redone string
	// Run does it. It writes once, through do.Write.
	Run func(ctx context.Context, do *Do, in In) error
	// Try is an input the catalog's test runs it with, in a world with one
	// of everything (see Seed); nil for an action that can't be tried so.
	Try func(Seed) In
}

// Seed names the one of each thing a world made for the catalog's test
// holds. Each track adds the things it brings.
type Seed struct {
	CourseID string
	// IncidentID is an open incident, a step's own.
	IncidentID string
}

// def is a declared action, its input no longer typed.
type def struct {
	entry          Entry
	input          Input
	undone, redone string
	run            func(ctx context.Context, do *Do, raw json.RawMessage) error
	try            func(Seed) json.RawMessage
}

// Catalog is every action a student can take, declared once: what the
// palette lists, what the one action route runs, and what Undo says.
type Catalog struct {
	store *store.Store
	mu    sync.RWMutex
	defs  map[string]*def
}

// New is an empty catalog over the store.
func New(s *store.Store) *Catalog {
	return &Catalog{store: s, defs: map[string]*def{}}
}

var idPattern = regexp.MustCompile(`^[a-z]+(\.[a-z_]+)+$`)

// Add declares an action. A bad or repeated id is a programming error, so
// it panics, as errs.Define does.
func Add[In any](c *Catalog, d Def[In]) {
	if !idPattern.MatchString(d.ID) {
		panic("action: bad id " + d.ID)
	}
	if d.Name == "" || d.Run == nil {
		panic("action: " + d.ID + " needs a name and a Run")
	}
	if d.Undoable && (d.Undone == "" || d.Redone == "") {
		panic("action: undoable " + d.ID + " needs its Undone and Redone sentences")
	}
	needs := slices.Clone(d.Needs)
	if needs == nil {
		needs = []condition.ID{}
	}
	in := reflect.TypeFor[In]()
	x := &def{
		input:  Input{Package: path.Base(in.PkgPath()), Name: in.Name()},
		entry:  Entry{ID: d.ID, Name: d.Name, Key: d.Key, Needs: needs, Undoable: d.Undoable, Costs: d.Costs},
		undone: d.Undone, redone: d.Redone,
		run: func(ctx context.Context, do *Do, raw json.RawMessage) error {
			var in In
			dec := json.NewDecoder(bytes.NewReader(raw))
			dec.DisallowUnknownFields()
			if err := dec.Decode(&in); err != nil {
				return errs.InvalidJSON.Wrap(err)
			}
			// One value, and nothing after it.
			if _, err := dec.Token(); !errors.Is(err, io.EOF) {
				return errs.InvalidJSON.Wrap(fmt.Errorf("more after the input: %w", err))
			}
			return d.Run(ctx, do, in)
		},
	}
	if d.Try != nil {
		x.try = func(s Seed) json.RawMessage {
			b, err := json.Marshal(d.Try(s))
			if err != nil {
				panic("action: " + d.ID + " Try: " + err.Error())
			}
			return b
		}
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, dup := c.defs[d.ID]; dup {
		panic("action: " + d.ID + " declared twice")
	}
	c.defs[d.ID] = x
}

// Input is the Go type an action takes, so its TypeScript can be named:
// Name in Package's wire.go. Name is "" for an action that takes nothing.
type Input struct {
	Package, Name string
}

// Inputs is every action's input type, by id.
func (c *Catalog) Inputs() map[string]Input {
	c.mu.RLock()
	defer c.mu.RUnlock()
	out := make(map[string]Input, len(c.defs))
	for id, d := range c.defs {
		out[id] = d.input
	}
	return out
}

// Entries is every action, sorted by id.
func (c *Catalog) Entries() []Entry {
	c.mu.RLock()
	defer c.mu.RUnlock()
	out := make([]Entry, 0, len(c.defs))
	for _, d := range c.defs {
		out = append(out, d.entry)
	}
	slices.SortFunc(out, func(a, b Entry) int { return strings.Compare(a.ID, b.ID) })
	return out
}

// Try is the input the catalog's test runs an action with, and whether it
// has one.
func (c *Catalog) Try(id string, s Seed) (json.RawMessage, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	d, ok := c.defs[id]
	if !ok || d.try == nil {
		return nil, false
	}
	return d.try(s), true
}

// What the action route refuses.
var (
	Unknown = errs.Define(errs.Entry{
		ID:     "action.unknown",
		Kind:   errs.KindOurs,
		What:   "PSet doesn't know how to do that.",
		Why:    "The page asked for an action this version of PSet doesn't have.",
		Fix:    "Reload the page.",
		Action: errs.ActionReload,
		Status: http.StatusNotFound,
	})
	Blocked = errs.Define(errs.Entry{
		ID:     "action.blocked",
		Kind:   errs.KindWaitingOnYou,
		What:   "{name} can't run yet.",
		Why:    "{why}.",
		Fix:    "{fix}.",
		Action: errs.ActionOpenSettings,
		Status: http.StatusConflict,
	})
	// wroteTwice is an action that wrote in two transactions: Undo could
	// not see what came between them (store README: one action is one
	// Write).
	wroteTwice = errs.Define(errs.Entry{
		ID:     "action.wrote_twice",
		Kind:   errs.KindOurs,
		What:   "Something went wrong inside PSet.",
		Why:    "An action tried to save its changes in two parts.",
		Status: http.StatusInternalServerError,
	})
)

// ErrUnchanged is what a Write's fn returns when it finds nothing to change
// (a rename to the name it has): nothing is written, and there is nothing to
// undo.
var ErrUnchanged = errors.New("action: nothing to change")

// One is the error of an UPDATE meant to change one thing, guarded by its
// state (`... WHERE id = ? AND removed_at = ”`): Gone when it changed
// nothing, as when another tab removed the thing first. Checked inside the
// write, so no other write slips between the check and the change.
func One(res sql.Result, err error, thing string) error {
	if err != nil {
		return errs.Database.Wrap(err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return errs.Database.Wrap(err)
	}
	if n == 0 {
		return errs.Gone.New("thing", thing)
	}
	return nil
}

// Do is one run of one action, as its Run sees it.
type Do struct {
	c        *Catalog
	id       string
	entry    string
	undoable bool
	wrote    bool
	changed  bool
	kind     change.Resource
	resID    string
}

// Changed says whether this run's Write changed anything: false before it
// writes, and after a Write whose fn found nothing to change. A Run that
// does more after its write (starting work that costs) asks this first.
func (do *Do) Changed() bool { return do.changed }

// ID is this run's action id: what Undo takes back.
func (do *Do) ID() string { return do.id }

// Write writes the action's changes as the student, in one transaction,
// and records which thing it acted on, for what Undo says and where its
// Show goes. An action writes once. One that can't be undone writes as
// PSet, outside the chain Ctrl+Z walks, so it never stands in the way of
// undoing what came before it.
func (do *Do) Write(ctx context.Context, kind change.Resource, id string, fn func(*sql.Tx) error) error {
	if do.wrote {
		return wroteTwice.New()
	}
	do.wrote = true
	who, as := change.ActorStudent, do.id
	if !do.undoable {
		who, as = change.ActorPSet, ""
	}
	err := do.c.store.Write(ctx, who, as, func(tx *sql.Tx) error {
		if err := fn(tx); err != nil {
			return err
		}
		if !do.undoable {
			// Nothing will undo it, so nothing needs its record.
			return nil
		}
		_, err := tx.ExecContext(ctx, `INSERT INTO actions (id, entry, kind, res_id, at) VALUES (?, ?, ?, ?, ?)`,
			do.id, do.entry, string(kind), id, db.Now())
		return errs.Database.Of(err)
	})
	if errors.Is(err, ErrUnchanged) {
		return nil
	}
	if err == nil {
		do.changed, do.kind, do.resID = true, kind, id
	}
	return err
}

// Run runs action id with its input, as the student: once the conditions
// it needs hold. Its reply says what it did and how far the log has got.
func (c *Catalog) Run(ctx context.Context, id string, input json.RawMessage) (Done, error) {
	c.mu.RLock()
	d, ok := c.defs[id]
	c.mu.RUnlock()
	if !ok {
		return Done{}, Unknown.New()
	}
	if err := c.blocked(ctx, d); err != nil {
		return Done{}, err
	}
	if len(input) == 0 {
		input = json.RawMessage(`{}`)
	}
	do := &Do{c: c, id: uuid.NewString(), entry: id, undoable: d.entry.Undoable}
	if err := d.run(ctx, do, input); err != nil {
		return Done{}, err
	}
	var out Done
	if do.changed {
		out.Kind, out.ID = do.kind, do.resID
		if do.undoable {
			out.Action = do.id
		}
	}
	var err error
	out.Seq, err = c.store.Latest(ctx)
	return out, err
}

// blocked is the first condition the action needs that does not hold, as
// the error it is refused with: what is missing and its fix.
func (c *Catalog) blocked(ctx context.Context, d *def) error {
	for _, need := range d.entry.Needs {
		var raw sql.NullString
		err := c.store.DB.QueryRowContext(ctx, `SELECT error FROM conditions WHERE id = ? AND holds = 0`, string(need)).Scan(&raw)
		if errors.Is(err, sql.ErrNoRows) {
			continue
		}
		if err != nil {
			return errs.Database.Wrap(err)
		}
		why := errs.View{What: "Something PSet needs isn't working", Fix: "Settings, under Health, says what"}
		if raw.Valid {
			var v errs.View
			cleanup.Log("action: read a condition's error", json.Unmarshal([]byte(raw.String), &v))
			if v.What != "" {
				why.What = v.What
			}
			if v.Fix != "" {
				why.Fix = v.Fix
			}
		}
		// The condition's own sentences, their periods the entry's.
		return Blocked.New("name", d.entry.Name, "why", strings.TrimSuffix(why.What, "."), "fix", strings.TrimSuffix(why.Fix, "."))
	}
	return nil
}

// names is where each kind of thing keeps the name Undo says it by.
var names = map[change.Resource]string{
	change.ResourceCourse:   `SELECT name FROM courses WHERE id = ?`,
	change.ResourceSet:      `SELECT title FROM sets WHERE id = ?`,
	change.ResourceMaterial: `SELECT title FROM materials WHERE id = ?`,
	change.ResourceQuestion: `SELECT CASE label WHEN '' THEN text ELSE label END FROM questions WHERE id = ?`,
}

// Undo takes action back, or with newest the student's newest action not
// yet undone (Ctrl+Z), and says what it did, without moving the student
// (C7). Undoing an undo is redo. An empty action without newest is nothing
// to undo: never the newest by accident.
func (c *Catalog) Undo(ctx context.Context, action string, newest bool) (Undone, error) {
	if newest && action != "" {
		return Undone{}, errs.InvalidJSON.Wrap(errors.New("undo: an action and newest both"))
	}
	if !newest {
		return c.undo(ctx, action)
	}
	// Ctrl+Z: the newest, and if another tab took that back a moment ago,
	// the next.
	for try := 0; ; try++ {
		n, err := c.store.Newest(ctx)
		if err != nil {
			return Undone{}, err
		}
		u, err := c.undo(ctx, n)
		if try == 0 && errors.Is(err, store.AlreadyUndone) {
			continue
		}
		return u, err
	}
}

func (c *Catalog) undo(ctx context.Context, action string) (Undone, error) {
	if action == "" {
		return Undone{}, store.NothingToUndo.New()
	}
	// The action the chain began with, and whether this is a redo: an odd
	// number of undos down from it.
	root, depth := action, 0
	for {
		var undoes string
		err := c.store.DB.QueryRowContext(ctx, `SELECT undoes FROM changes WHERE action_id = ? LIMIT 1`, root).Scan(&undoes)
		if errors.Is(err, sql.ErrNoRows) || (err == nil && undoes == "") {
			break
		}
		if err != nil {
			return Undone{}, errs.Database.Wrap(err)
		}
		root, depth = undoes, depth+1
	}
	var entry, kind, resID string
	err := c.store.DB.QueryRowContext(ctx, `SELECT entry, kind, res_id FROM actions WHERE id = ?`, root).Scan(&entry, &kind, &resID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return Undone{}, errs.Database.Wrap(err)
	}
	c.mu.RLock()
	d := c.defs[entry]
	c.mu.RUnlock()
	if d != nil && !d.entry.Undoable {
		return Undone{}, store.NotUndoable.New()
	}
	asNew := uuid.NewString()
	seq, err := c.store.Undo(ctx, action, asNew)
	if err != nil {
		return Undone{}, err
	}
	out := Undone{Action: action, Undo: asNew, Entry: entry, Kind: change.Resource(kind), ID: resID, Seq: seq}
	// What it says: the entry's own sentence, in the thing's name; plainer
	// when the action or the name can't be read.
	out.Said = "Took that back."
	if depth%2 == 1 {
		out.Said = "Did that again."
	}
	if d != nil {
		said := d.undone
		if depth%2 == 1 {
			said = d.redone
		}
		if n := c.name(ctx, out.Kind, resID); n != "" || !strings.Contains(said, "{name}") {
			out.Said = strings.ReplaceAll(said, "{name}", n)
		}
	}
	return out, nil
}

func (c *Catalog) name(ctx context.Context, kind change.Resource, id string) string {
	q, ok := names[kind]
	if !ok {
		return ""
	}
	var n string
	cleanup.Log(fmt.Sprintf("action: read %s %s's name", kind, id), c.store.DB.QueryRowContext(ctx, q, id).Scan(&n))
	return n
}
