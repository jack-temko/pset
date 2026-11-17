// Package store is PSet's data for courses, materials and work, and its
// change log: one baseline schema whose logged tables announce every change
// through database triggers (ideas/backend-courses-grill.md, D11 to D15).
//
// Every write to a logged table goes through Write, which says who is
// writing and as part of which action; a write made any other way is refused
// by the table's own triggers. What the triggers log drives the event stream
// (Since, Handler), undo (Undo) and the weekly purge (Purge).
package store

import (
	"context"
	"database/sql"
	"fmt"
	"sync"

	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
)

// Store is the database and the stream of what changes in it.
type Store struct {
	DB *sql.DB

	mu   sync.Mutex
	subs map[chan struct{}]struct{}
	live map[chan Event]struct{}
}

// Open opens the database at path and applies the store's migrations.
//
// recursive_triggers is on so that a REPLACE fires the delete trigger, which
// refuses it: with it off, REPLACE over a row logs a new row and silently
// drops the old one from the log.
func Open(ctx context.Context, path string) (*Store, error) {
	d, err := db.Open(path, "recursive_triggers(1)")
	if err != nil {
		return nil, err
	}
	if err := db.Migrate(ctx, d, Migrations()); err != nil {
		cleanup.Close(d)
		return nil, err
	}
	return New(d), nil
}

// New is a store on an open, migrated database.
func New(d *sql.DB) *Store {
	return &Store{DB: d, subs: map[chan struct{}]struct{}{}, live: map[chan Event]struct{}{}}
}

// actor is who a write is attributed to: the student, PSet, or the purge,
// which alone may delete.
type actor string

const purge actor = "purge"

// Write runs fn in one transaction whose writes are attributed to who and
// belong to action: the id the student's action has, which Undo takes back
// whole. PSet's own work passes "" for action.
//
// The attribution is a row in change_ctx that lives only inside the
// transaction: inserted first and deleted last, so it never commits. The
// transaction holds the write lock from BEGIN (_txlock=immediate), so no
// other connection writes, or reads the row, while it exists. That is also
// why seq order is commit order. Nothing but this function may touch
// change_ctx: a row left behind would attribute the next stray write to
// this action (a test bans the name elsewhere).
func (s *Store) Write(ctx context.Context, who change.Actor, action string, fn func(*sql.Tx) error) error {
	switch {
	case who != change.ActorStudent && who != change.ActorPSet:
		// The purge alone deletes, and only through write.
		return errs.Data.Wrap(fmt.Errorf("store: no writer %q", who))
	case who == change.ActorStudent && action == "":
		return errs.Data.Wrap(fmt.Errorf("store: a student write needs its action's id"))
	}
	return s.write(ctx, actor(who), action, "", fn)
}

func (s *Store) write(ctx context.Context, who actor, action, undoes string, fn func(*sql.Tx) error) error {
	err := db.Tx(ctx, s.DB, func(tx *sql.Tx) error {
		// An undo sits one deeper than what it takes back.
		if _, err := tx.ExecContext(ctx, `INSERT INTO change_ctx (only, actor, action_id, undoes, depth, at)
			VALUES (1, ?, ?, ?, CASE WHEN ?3 = '' THEN 0 ELSE ifnull((SELECT max(depth) FROM changes WHERE action_id = ?3), 0) + 1 END, ?)`,
			string(who), action, undoes, db.Now()); err != nil {
			return errs.Database.Wrap(err)
		}
		if err := fn(tx); err != nil {
			return err
		}
		_, err := tx.ExecContext(ctx, `DELETE FROM change_ctx`)
		return errs.Database.Of(err)
	})
	if err == nil {
		s.wake()
	}
	return err
}
