package settings

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/jackt/pset/internal/db"
)

// Migrations: one row per saved side, as JSON. Two sides don't earn a
// column each, and a new field is then no migration at all.
func Migrations() []db.Migration {
	return []db.Migration{{Name: "settings/1", SQL: `
CREATE TABLE settings (
	key        TEXT PRIMARY KEY,
	value      TEXT NOT NULL,
	updated_at TEXT NOT NULL
);`}}
}

const (
	keyChat    = "chat"
	keyEmbed   = "embeddings"
	keyProfile = "profile"
)

// load reads a side into v, reporting whether it was ever saved.
func load(ctx context.Context, d *sql.DB, key string, v any) (bool, error) {
	var raw string
	err := d.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = ?`, key).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, json.Unmarshal([]byte(raw), v)
}

func save(ctx context.Context, d *sql.DB, key string, v any) error {
	raw, err := json.Marshal(v)
	if err != nil {
		return err
	}
	_, err = d.ExecContext(ctx, `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
		ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
		key, string(raw), db.Now())
	return err
}
