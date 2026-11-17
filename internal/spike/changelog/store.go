package changelog

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/jackt/pset/internal/activity"
	"github.com/jackt/pset/internal/ask"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errlog"
	"github.com/jackt/pset/internal/homework"
	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/library"
	"github.com/jackt/pset/internal/memory"
	"github.com/jackt/pset/internal/settings"
	"github.com/jackt/pset/internal/usage"
)

// Migrations is the app's list, in cmd/pset/main.go's order.
func Migrations() []db.Migration {
	var out []db.Migration
	for _, l := range [][]db.Migration{
		errlog.Migrations(), jobs.Migrations(), settings.Migrations(), usage.Migrations(),
		library.Migrations(), memory.Migrations(), homework.Migrations(), ask.Migrations(),
		activity.Migrations(),
	} {
		out = append(out, l...)
	}
	return out
}

// Options picks what a spike database logs.
type Options struct {
	Log    []Table // tables that get generated triggers
	Policy Policy
	// NoChangeLog leaves out the changes schema entirely (the baseline).
	NoChangeLog bool
}

// Open makes a fresh database in dir the way internal/db opens one, with the
// real migrations and then the spike's schema and triggers.
func Open(dir string, o Options) (*sql.DB, string, error) {
	path := filepath.Join(dir, "pset.db")
	d, err := db.Open(path)
	if err != nil {
		return nil, "", err
	}
	ctx := context.Background()
	if err := db.Migrate(ctx, d, Migrations()); err != nil {
		return nil, "", err
	}
	if o.NoChangeLog {
		// The markers still exist, so the same statements run.
		if _, err := d.Exec(`ALTER TABLE homework ADD COLUMN removed_at TEXT NOT NULL DEFAULT '';
ALTER TABLE questions ADD COLUMN removed_at TEXT NOT NULL DEFAULT '';`); err != nil {
			return nil, "", err
		}
		return d, path, nil
	}
	if _, err := d.Exec(Schema); err != nil {
		return nil, "", fmt.Errorf("schema: %w", err)
	}
	for _, t := range o.Log {
		if _, err := d.Exec(Triggers(t, o.Policy)); err != nil {
			return nil, "", fmt.Errorf("triggers for %s: %w", t.Name, err)
		}
	}
	return d, path, nil
}

// Write runs fn in a transaction whose writes are attributed to actor and
// action. The context row lives only inside the transaction: it is inserted
// first and deleted last, so it never commits, and the transaction holds the
// write lock from BEGIN (_txlock=immediate), so no other connection's write
// can see it.
func Write(ctx context.Context, d *sql.DB, actor, action string, fn func(*sql.Tx) error) error {
	return WriteUndo(ctx, d, actor, action, "", fn)
}

// WriteUndo is Write for an action that undoes another.
func WriteUndo(ctx context.Context, d *sql.DB, actor, action, undoes string, fn func(*sql.Tx) error) error {
	return db.Tx(ctx, d, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `INSERT INTO change_ctx (only, actor, action_id, undoes, at) VALUES (1, ?, ?, ?, ?)`,
			actor, action, undoes, db.Now()); err != nil {
			return fmt.Errorf("set change context: %w", err)
		}
		if err := fn(tx); err != nil {
			return err
		}
		_, err := tx.ExecContext(ctx, `DELETE FROM change_ctx`)
		return err
	})
}

// Row is one row as column name to value.
type Row map[string]any

// Rows reads every column of every row a query returns.
func Rows(q interface {
	Query(string, ...any) (*sql.Rows, error)
}, query string, args ...any) ([]Row, error) {
	rows, err := q.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cols, _ := rows.Columns()
	var out []Row
	for rows.Next() {
		vals := make([]any, len(cols))
		ptrs := make([]any, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, err
		}
		r := Row{}
		for i, c := range cols {
			if b, ok := vals[i].([]byte); ok {
				vals[i] = string(b)
			}
			r[c] = vals[i]
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// Diff lists the columns that differ between two snapshots of the same rows,
// ignoring the columns in skip.
func Diff(before, after []Row, skip ...string) []string {
	ignore := map[string]bool{}
	for _, s := range skip {
		ignore[s] = true
	}
	var out []string
	if len(before) != len(after) {
		return []string{fmt.Sprintf("row count %d != %d", len(before), len(after))}
	}
	for i := range before {
		for k, v := range before[i] {
			if ignore[k] {
				continue
			}
			if w, ok := after[i][k]; !ok || fmt.Sprint(v) != fmt.Sprint(w) || fmt.Sprintf("%T", v) != fmt.Sprintf("%T", w) {
				out = append(out, fmt.Sprintf("row %d %s: %v (%T) -> %v (%T)", i, k, short(v), v, short(after[i][k]), after[i][k]))
			}
		}
		for k := range after[i] {
			if _, ok := before[i][k]; !ok && !ignore[k] {
				out = append(out, fmt.Sprintf("row %d new column %s", i, k))
			}
		}
	}
	return out
}

func short(v any) string {
	s := fmt.Sprint(v)
	if len(s) > 120 {
		return s[:120] + "..."
	}
	return strings.ReplaceAll(s, "\n", " ")
}
