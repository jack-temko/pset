// Package db opens PSet's one SQLite database and applies the features'
// migrations. It knows no feature's tables: each feature hands in its own
// migrations, in dependency order, and this package only keeps the ledger.
package db

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

// Every connection gets these. Foreign keys are what make a book's removal
// take its homework and turns with it.
const pragmas = "_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)&_pragma=synchronous(NORMAL)"

// Open opens (creating if needed) the database at path.
func Open(path string) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, fmt.Errorf("create %s: %w", filepath.Dir(path), err)
	}
	d, err := sql.Open("sqlite", fmt.Sprintf("file:%s?%s", path, pragmas))
	if err != nil {
		return nil, err
	}
	if err := d.Ping(); err != nil {
		d.Close()
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	return d, nil
}

// Migration is one schema step. Name is unique across the app and is what
// the ledger records, so it never changes once shipped ("library/1").
type Migration struct {
	Name string
	SQL  string
}

const ledger = `CREATE TABLE IF NOT EXISTS schema_migrations (
	name       TEXT PRIMARY KEY,
	applied_at TEXT NOT NULL
)`

// Migrate applies every migration not yet in the ledger, in the order
// given, each in its own transaction.
func Migrate(ctx context.Context, d *sql.DB, migs []Migration) error {
	if _, err := d.ExecContext(ctx, ledger); err != nil {
		return err
	}
	for _, m := range migs {
		var n int
		if err := d.QueryRowContext(ctx, `SELECT count(*) FROM schema_migrations WHERE name = ?`, m.Name).Scan(&n); err != nil {
			return err
		}
		if n > 0 {
			continue
		}
		err := Tx(ctx, d, func(tx *sql.Tx) error {
			if _, err := tx.ExecContext(ctx, m.SQL); err != nil {
				return err
			}
			_, err := tx.ExecContext(ctx, `INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)`,
				m.Name, time.Now().UTC().Format(time.RFC3339))
			return err
		})
		if err != nil {
			return fmt.Errorf("migration %s: %w", m.Name, err)
		}
	}
	return nil
}

// Pending names the migrations not yet applied.
func Pending(ctx context.Context, d *sql.DB, migs []Migration) ([]string, error) {
	if _, err := d.ExecContext(ctx, ledger); err != nil {
		return nil, err
	}
	var out []string
	for _, m := range migs {
		var n int
		if err := d.QueryRowContext(ctx, `SELECT count(*) FROM schema_migrations WHERE name = ?`, m.Name).Scan(&n); err != nil {
			return nil, err
		}
		if n == 0 {
			out = append(out, m.Name)
		}
	}
	return out, nil
}

// Wipe drops every table, the ledger included, then migrates afresh: the
// database a first launch would create. Foreign keys are off while it
// drops, so the order doesn't matter.
func Wipe(ctx context.Context, d *sql.DB, migs []Migration) error {
	conn, err := d.Conn(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()
	if _, err := conn.ExecContext(ctx, `PRAGMA foreign_keys = OFF`); err != nil {
		return err
	}
	rows, err := conn.QueryContext(ctx, `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
	if err != nil {
		return err
	}
	var tables []string
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			rows.Close()
			return err
		}
		tables = append(tables, t)
	}
	rows.Close()
	for _, t := range tables {
		if _, err := conn.ExecContext(ctx, fmt.Sprintf(`DROP TABLE IF EXISTS "%s"`, t)); err != nil {
			return err
		}
	}
	if _, err := conn.ExecContext(ctx, `PRAGMA foreign_keys = ON`); err != nil {
		return err
	}
	if _, err := conn.ExecContext(ctx, `VACUUM`); err != nil {
		return err
	}
	return Migrate(ctx, d, migs)
}

// Tx runs fn in a transaction, committing when it returns nil.
func Tx(ctx context.Context, d *sql.DB, fn func(*sql.Tx) error) error {
	tx, err := d.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}

// Stamp is the one timestamp format the database stores: UTC, RFC 3339,
// with all nine digits of nanoseconds, so stamps compare correctly as
// strings (in SQL and in the client).
const Stamp = "2006-01-02T15:04:05.000000000Z07:00"

// Now is the current time as a stamp.
func Now() string { return At(time.Now()) }

// At is a time as a stamp.
func At(t time.Time) string { return t.UTC().Format(Stamp) }
