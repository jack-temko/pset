package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
)

// ErrSchemaMismatch marks a database written by an incompatible build.
var ErrSchemaMismatch = errors.New("incompatible database schema")

type migration struct {
	version    int
	statements []string
}

// migrations is append-only: never edit an applied migration, add a new entry.
// The stack was reset to a single schema before release; a database from an
// older pre-release build is refused by Migrate, not half-understood. A
// database from this stack migrates forward in place, entry by entry.
var migrations = []migration{
	{
		version: 2,
		statements: []string{
			`CREATE TABLE books (
				id          TEXT    PRIMARY KEY,
				sha256      TEXT    NOT NULL UNIQUE,
				file_path   TEXT    NOT NULL,
				file_size   INTEGER NOT NULL,
				title       TEXT    NOT NULL DEFAULT '',
				author      TEXT    NOT NULL DEFAULT '',
				subject     TEXT    NOT NULL DEFAULT '',
				page_count  INTEGER NOT NULL DEFAULT 0,
				pdf_version TEXT    NOT NULL DEFAULT '',
				page_width  REAL    NOT NULL DEFAULT 0,
				page_height REAL    NOT NULL DEFAULT 0,
				origin_path TEXT    NOT NULL DEFAULT '',
				kind        TEXT    NOT NULL DEFAULT 'scanned',
				ready       INTEGER NOT NULL DEFAULT 0,
				created_at  TEXT    NOT NULL,
				updated_at  TEXT    NOT NULL
			)`,
			`CREATE TABLE pages (
				id          TEXT PRIMARY KEY,
				book_id     TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
				page_number INTEGER NOT NULL,
				text        TEXT NOT NULL,
				ocr_status  TEXT NOT NULL DEFAULT 'text',
				error       TEXT NOT NULL DEFAULT '',
				UNIQUE(book_id, page_number)
			)`,
			`CREATE VIRTUAL TABLE pages_fts USING fts5(book_id UNINDEXED, page_number UNINDEXED, text)`,
			`CREATE TRIGGER pages_fts_insert AFTER INSERT ON pages BEGIN
				INSERT INTO pages_fts (book_id, page_number, text) VALUES (new.book_id, new.page_number, new.text);
			END`,
			`CREATE TRIGGER pages_fts_delete AFTER DELETE ON pages BEGIN
				DELETE FROM pages_fts WHERE book_id = old.book_id AND page_number = old.page_number;
			END`,
			`CREATE TABLE sections (
				id         TEXT PRIMARY KEY,
				book_id    TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
				sort_order INTEGER NOT NULL,
				level      INTEGER NOT NULL,
				title      TEXT NOT NULL,
				source     TEXT NOT NULL,
				start_page INTEGER NOT NULL,
				end_page   INTEGER NOT NULL,
				UNIQUE(book_id, sort_order)
			)`,
			`CREATE INDEX sections_book_start ON sections(book_id, start_page)`,
			`CREATE TABLE embeddings (
				id          TEXT PRIMARY KEY,
				book_id     TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
				page_number INTEGER NOT NULL,
				model       TEXT NOT NULL,
				vector      BLOB NOT NULL,
				UNIQUE(book_id, page_number)
			)`,
			`CREATE TABLE homeworks (
				id          TEXT PRIMARY KEY,
				book_id     TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
				title       TEXT NOT NULL DEFAULT '',
				due_date    TEXT,
				status      TEXT NOT NULL DEFAULT 'generating',
				turned_in   INTEGER NOT NULL DEFAULT 0,
				source_text TEXT NOT NULL DEFAULT '',
				created_at  TEXT NOT NULL,
				updated_at  TEXT NOT NULL
			)`,
			`CREATE INDEX homeworks_book ON homeworks(book_id, updated_at)`,
			`CREATE TABLE homework_questions (
				id            TEXT PRIMARY KEY,
				homework_id   TEXT NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
				position      INTEGER NOT NULL,
				page          INTEGER,
				status        TEXT NOT NULL DEFAULT 'pending',
				error         TEXT,
				question_rect TEXT,
				transcription TEXT NOT NULL DEFAULT '',
				diagrams      TEXT NOT NULL DEFAULT '[]',
				guide         TEXT,
				standalone    INTEGER NOT NULL DEFAULT 0,
				created_at    TEXT NOT NULL,
				updated_at    TEXT NOT NULL,
				UNIQUE(homework_id, position)
			)`,
			`CREATE TABLE tasks (
				id          TEXT PRIMARY KEY,
				kind        TEXT NOT NULL,
				book_id     TEXT NULL REFERENCES books(id) ON DELETE SET NULL,
				homework_id TEXT NULL REFERENCES homeworks(id) ON DELETE SET NULL,
				status      TEXT NOT NULL DEFAULT 'queued',
				fail_kind   TEXT NOT NULL DEFAULT '',
				error       TEXT NOT NULL DEFAULT '',
				owner       TEXT NOT NULL DEFAULT '',
				created_at  TEXT NOT NULL,
				started_at  TEXT,
				finished_at TEXT
			)`,
			`CREATE INDEX tasks_status_id ON tasks(status, id)`,
			`CREATE TABLE conversations (
				id         TEXT PRIMARY KEY,
				book_id    TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
				title      TEXT NOT NULL DEFAULT '',
				pinned     INTEGER NOT NULL DEFAULT 0,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)`,
			`CREATE TABLE messages (
				id              TEXT PRIMARY KEY,
				conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
				role            TEXT NOT NULL,
				content         TEXT NOT NULL,
				citations       TEXT,
				segments        TEXT,
				created_at      TEXT NOT NULL
			)`,
			`CREATE INDEX messages_conversation ON messages(conversation_id, id)`,
			`CREATE TABLE phases (
				id          TEXT PRIMARY KEY,
				task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
				seq         INTEGER NOT NULL,
				key         TEXT NOT NULL,
				name        TEXT NOT NULL,
				status      TEXT NOT NULL DEFAULT 'waiting',
				done        INTEGER NOT NULL DEFAULT 0,
				total       INTEGER NOT NULL DEFAULT 0,
				note        TEXT NOT NULL DEFAULT '',
				error       TEXT NOT NULL DEFAULT '',
				rate        REAL NOT NULL DEFAULT 0,
				created_at  TEXT NOT NULL,
				started_at  TEXT NULL,
				finished_at TEXT NULL,
				UNIQUE (task_id, key)
			)`,
			`CREATE INDEX idx_phases_task ON phases(task_id)`,
			`CREATE TABLE book_facts (
				id         TEXT PRIMARY KEY,
				book_id    TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
				key        TEXT NOT NULL,
				value      TEXT NOT NULL,
				source     TEXT NOT NULL DEFAULT 'learned',
				hits       INTEGER NOT NULL DEFAULT 1,
				updated_at TEXT NOT NULL,
				UNIQUE (book_id, key)
			)`,
			`CREATE INDEX idx_book_facts_book ON book_facts(book_id)`,
		},
	},
	{
		// One vector per page became one vector per page per model: a book
		// can hold its embeddings in more than one space, and readers pick
		// the space they are comparing in. Existing rows already satisfy the
		// wider key, so the rebuild is a straight copy.
		version: 3,
		statements: []string{
			`CREATE TABLE embeddings_v3 (
				id          TEXT PRIMARY KEY,
				book_id     TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
				page_number INTEGER NOT NULL,
				model       TEXT NOT NULL,
				vector      BLOB NOT NULL,
				UNIQUE(book_id, page_number, model)
			)`,
			`INSERT INTO embeddings_v3 (id, book_id, page_number, model, vector)
				SELECT id, book_id, page_number, model, vector FROM embeddings`,
			`DROP TABLE embeddings`,
			`ALTER TABLE embeddings_v3 RENAME TO embeddings`,
		},
	},
	{
		version: 4,
		statements: []string{
			// Per-assignment print scales, percent of the template's
			// designed layout. Existing rows read as the default.
			`ALTER TABLE homeworks ADD COLUMN question_scale INTEGER NOT NULL DEFAULT 100`,
			`ALTER TABLE homeworks ADD COLUMN figure_scale INTEGER NOT NULL DEFAULT 100`,
		},
	},
	{
		// The unified chat: a homework owns at most one conversation, its
		// messages remember which question was active, and questions carry
		// the durable "understanding" notes the chat writes.
		version: 5,
		statements: []string{
			`ALTER TABLE conversations ADD COLUMN homework_id TEXT NULL REFERENCES homeworks(id) ON DELETE CASCADE`,
			`CREATE UNIQUE INDEX conversations_homework ON conversations(homework_id) WHERE homework_id IS NOT NULL`,
			`ALTER TABLE messages ADD COLUMN question_id TEXT NULL`,
			`ALTER TABLE homework_questions ADD COLUMN understanding_notes TEXT NOT NULL DEFAULT '[]'`,
		},
	},
	{
		// Questions become tasks of their own: one per question, so each is
		// independently resumable, retryable and visible. params carries the
		// phases that task should run (a rewrite skips locating) and the
		// page or note a repair was given.
		version: 6,
		statements: []string{
			`ALTER TABLE tasks ADD COLUMN question_id TEXT NULL`,
			`ALTER TABLE tasks ADD COLUMN params TEXT NOT NULL DEFAULT '{}'`,
			`CREATE INDEX tasks_question ON tasks(question_id) WHERE question_id IS NOT NULL`,
		},
	},
}

func LatestVersion() int { return migrations[len(migrations)-1].version }

const createMigrationsTable = `CREATE TABLE IF NOT EXISTS schema_migrations (
	version    INTEGER PRIMARY KEY,
	applied_at TEXT NOT NULL
)`

// Migrate is idempotent; safe to run on every open. A database from before
// the stack's first entry comes from an incompatible pre-release build and
// is refused rather than half-understood; anything from this stack moves
// forward entry by entry.
func (s *Store) Migrate(ctx context.Context) error {
	if _, err := s.db.ExecContext(ctx, createMigrationsTable); err != nil {
		return fmt.Errorf("ensure schema_migrations: %w", err)
	}
	current, err := s.Version(ctx)
	if err != nil {
		return err
	}
	if current > 0 && current < migrations[0].version {
		return fmt.Errorf("%w: database schema is v%d, but this build speaks v%d — pset's storage changed; remove the database and re-import (your PDFs are safe in the library folder)",
			ErrSchemaMismatch, current, LatestVersion())
	}
	if current > LatestVersion() {
		return fmt.Errorf("%w: database schema is v%d, but this build speaks v%d — the schema was reset before release, so the database must be removed or replaced (see --db)",
			ErrSchemaMismatch, current, LatestVersion())
	}
	for _, m := range migrations {
		if m.version <= current {
			continue
		}
		if err := s.apply(ctx, m); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) apply(ctx context.Context, m migration) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin migration %d: %w", m.version, err)
	}
	defer tx.Rollback()

	for _, stmt := range m.statements {
		if _, err := tx.ExecContext(ctx, stmt); err != nil {
			return fmt.Errorf("migration %d: %w", m.version, err)
		}
	}
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`,
		m.version, time.Now().UTC().Format(time.RFC3339)); err != nil {
		return fmt.Errorf("record migration %d: %w", m.version, err)
	}
	return tx.Commit()
}

// Version returns 0 for an uninitialised database.
func (s *Store) Version(ctx context.Context) (int, error) {
	var v int
	err := s.ro().QueryRowContext(ctx,
		`SELECT COALESCE(MAX(version), 0) FROM schema_migrations`).Scan(&v)
	if err != nil {
		if isNoSuchTable(err) {
			return 0, nil
		}
		return 0, fmt.Errorf("read schema version: %w", err)
	}
	return v, nil
}

func isNoSuchTable(err error) bool {
	return err != nil && strings.Contains(err.Error(), "no such table")
}
