package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
)

// Keep is how long removed things and the log's old values are kept: a
// mistake from yesterday can still be undone (D15).
const Keep = 7 * 24 * time.Hour

// Purge deletes for good what was removed more than Keep before now, unless
// something still uses it (a removed material stays while a set's problem
// was found in it, or a set was read from it: D13), then the log older than
// that and the log of whatever is gone, since it holds the student's text.
// It is the one writer allowed to delete; its deletes log nothing, because
// each thing was announced as removed when it was hidden.
func (s *Store) Purge(ctx context.Context, now time.Time) error {
	cutoff := db.At(now.Add(-Keep))
	return s.write(ctx, purge, "", "", func(tx *sql.Tx) error {
		// Parents first: their owned children go with them by cascade.
		// Materials last, once the work that used them may have gone. Each
		// waits while anything outside it still refers to it or to
		// something inside it (the dependency map, D4).
		var stmts []string
		for _, k := range purgeOrder {
			stmts = append(stmts, purgeRemoved(k))
		}
		// Again until nothing more goes: purging one thing can free another
		// that it alone referred into (set 2's find kept set 1).
		for pass := 0; pass < maxPurgePasses; pass++ {
			var gone int64
			for _, q := range stmts {
				res, err := tx.ExecContext(ctx, q, cutoff)
				if err != nil {
					return errs.Database.Wrap(err)
				}
				n, err := res.RowsAffected()
				if err != nil {
					return errs.Database.Wrap(err)
				}
				gone += n
			}
			if gone == 0 {
				break
			}
		}
		for _, q := range []string{
			`DELETE FROM documents WHERE
				(owner_kind = 'question' AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.id = documents.owner_id))
				OR (owner_kind = 'turn' AND NOT EXISTS (SELECT 1 FROM turns t WHERE t.id = documents.owner_id))`,
		} {
			if _, err := tx.ExecContext(ctx, q); err != nil {
				return errs.Database.Wrap(err)
			}
		}
		// Steps go with their subject, and their calls with them.
		if _, err := tx.ExecContext(ctx, `DELETE FROM steps WHERE
			(subject_kind = 'question' AND NOT EXISTS (SELECT 1 FROM questions x WHERE x.id = steps.subject_id))
			OR (subject_kind = 'set' AND NOT EXISTS (SELECT 1 FROM sets x WHERE x.id = steps.subject_id))
			OR (subject_kind = 'material' AND NOT EXISTS (SELECT 1 FROM materials x WHERE x.id = steps.subject_id))
			OR (subject_kind = 'turn' AND NOT EXISTS (SELECT 1 FROM turns x WHERE x.id = steps.subject_id))
			OR (subject_kind = 'read' AND NOT EXISTS (SELECT 1 FROM reads x WHERE x.id = steps.subject_id))`); err != nil {
			return errs.Database.Wrap(err)
		}
		// Places go with their owner, and once emptied (a draft sent, a tab
		// closed).
		if _, err := tx.ExecContext(ctx, `DELETE FROM places WHERE value = '{}'
			OR (owner_kind = 'course' AND NOT EXISTS (SELECT 1 FROM courses x WHERE x.id = places.owner_id))
			OR (owner_kind = 'set' AND NOT EXISTS (SELECT 1 FROM sets x WHERE x.id = places.owner_id))
			OR (owner_kind = 'material' AND NOT EXISTS (SELECT 1 FROM materials x WHERE x.id = places.owner_id))
			OR (owner_kind = 'question' AND NOT EXISTS (SELECT 1 FROM questions x WHERE x.id = places.owner_id))
			OR (owner_kind = 'document' AND NOT EXISTS (SELECT 1 FROM documents x WHERE x.id = places.owner_id))`); err != nil {
			return errs.Database.Wrap(err)
		}
		// Incidents are kept while open, plus a week.
		if _, err := tx.ExecContext(ctx, `DELETE FROM incidents WHERE resolved_at != '' AND resolved_at < ?`, cutoff); err != nil {
			return errs.Database.Wrap(err)
		}
		// The log: everything up to the newest row older than a week, by
		// seq, so the delete is a rowid range and stamps written out of
		// order cannot leave holes; then whatever names a thing that no
		// longer exists.
		if _, err := tx.ExecContext(ctx, `DELETE FROM changes WHERE seq <= (SELECT max(seq) FROM changes WHERE at < ?)`, cutoff); err != nil {
			return errs.Database.Wrap(err)
		}
		for _, t := range Tables {
			q := fmt.Sprintf(`DELETE FROM changes WHERE kind = ? AND NOT EXISTS (SELECT 1 FROM %s WHERE id = changes.res_id)`, t.Name)
			if _, err := tx.ExecContext(ctx, q, string(t.Kind)); err != nil {
				return errs.Database.Wrap(err)
			}
		}
		// Sections a material's contents no longer has (a read again found
		// fewer).
		if _, err := tx.ExecContext(ctx, `DELETE FROM sections WHERE position < 0`); err != nil {
			return errs.Database.Wrap(err)
		}
		// An action whose changes are all gone can no longer be undone.
		if _, err := tx.ExecContext(ctx, `DELETE FROM actions WHERE NOT EXISTS (SELECT 1 FROM changes WHERE action_id = actions.id)`); err != nil {
			return errs.Database.Wrap(err)
		}
		return nil
	})
}

// maxPurgePasses bounds the purge's passes: each frees what the one before
// alone held, so a chain longer than this finishes the next day.
const maxPurgePasses = 8

// purgeOrder is the removable kinds, parents first and materials last.
var purgeOrder = []change.Resource{
	change.ResourceCourse, change.ResourceSet, change.ResourceQuestion, change.ResourceFind,
	change.ResourceReading, change.ResourceTurn, change.ResourceMemory, change.ResourceRead, change.ResourceMaterial,
}

// purgeRemoved deletes the things of kind k removed before the cutoff (the
// one argument) that nothing outside them refers to.
func purgeRemoved(k change.Resource) string {
	t := nameOf(k)
	return fmt.Sprintf(`DELETE FROM %s WHERE removed_at != '' AND removed_at < ? AND NOT %s`, t, referenced(k, t+".id"))
}
