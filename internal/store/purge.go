package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

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
		gone := func(table string) string {
			return fmt.Sprintf(`DELETE FROM %s WHERE removed_at != '' AND removed_at < ?`, table)
		}
		// Parents first: their children go with them by cascade. Materials
		// last, once the work that used them has gone.
		stmts := []string{
			gone("courses"), gone("sets"), gone("questions"), gone("turns"), gone("memories"),
			gone("materials") + ` AND NOT EXISTS (SELECT 1 FROM finds f WHERE f.material_id = materials.id)
				AND NOT EXISTS (SELECT 1 FROM sets s WHERE s.sheet_id = materials.id)`,
		}
		for _, q := range stmts {
			if _, err := tx.ExecContext(ctx, q, cutoff); err != nil {
				return errs.Database.Wrap(err)
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
		return nil
	})
}
