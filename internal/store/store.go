package store

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

// newID returns a UUIDv7 string: unique, and time-ordered so `ORDER BY id`
// stays a stable insertion order for queues and listings.
func newID() string { return uuid.Must(uuid.NewV7()).String() }

// dbtx is the query surface shared by *sql.DB and *sql.Tx, so a transaction
// can drive the same store methods.
type dbtx interface {
	Exec(query string, args ...any) (sql.Result, error)
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error)
}

type Store struct {
	conn  *sql.DB // writer: owns the lifecycle, and serialises every write
	reads *sql.DB // reader pool; nil on a transactional view
	db    dbtx    // writes go through here (*sql.DB or a tx view)
	path  string
}

// pragmas are shared by both handles. WAL is what makes the reader pool worth
// having: readers see the last committed snapshot instead of queueing behind
// whatever the writer is in the middle of.
const pragmas = "_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)&_pragma=synchronous(NORMAL)"

// readerConns is how many reads may run at once. A long import writes steadily
// for minutes; without a reader pool every page view, retrieval and task
// snapshot in the app queues behind it on the single writer.
const readerConns = 4

func Open(path string) (*Store, error) {
	// One connection serialises writes and avoids SQLITE_BUSY between them.
	conn, err := openDB(path, pragmas, 1)
	if err != nil {
		return nil, err
	}
	// Readers are a separate pool, and query_only makes the split enforceable
	// rather than a convention: a write that strays onto a read path fails
	// here instead of quietly competing with the writer.
	reads, err := openDB(path, pragmas+"&_pragma=query_only(true)", readerConns)
	if err != nil {
		conn.Close()
		return nil, err
	}
	return &Store{conn: conn, reads: reads, db: conn, path: path}, nil
}

func openDB(path, params string, maxConns int) (*sql.DB, error) {
	db, err := sql.Open("sqlite", fmt.Sprintf("file:%s?%s", path, params))
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	db.SetMaxOpenConns(maxConns)
	db.SetMaxIdleConns(maxConns)
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping %s: %w", path, err)
	}
	return db, nil
}

// ro is the handle reads go through: the reader pool normally, and the
// transaction itself on a tx view — a transaction has to see its own
// uncommitted writes, which a separate connection never could.
func (s *Store) ro() dbtx {
	if s.reads != nil {
		return s.reads
	}
	return s.db
}

// Close shuts both handles; the writer's error is the one that matters, but
// the reader pool is never left behind holding file locks.
func (s *Store) Close() error {
	rerr := s.reads.Close()
	if err := s.conn.Close(); err != nil {
		return err
	}
	return rerr
}

func (s *Store) Path() string { return s.path }

func (s *Store) Ping(ctx context.Context) error {
	if err := s.conn.PingContext(ctx); err != nil {
		return err
	}
	return s.reads.PingContext(ctx)
}

func (s *Store) QuickCheck(ctx context.Context) (string, error) {
	var verdict string
	if err := s.ro().QueryRowContext(ctx, "PRAGMA quick_check").Scan(&verdict); err != nil {
		return "", fmt.Errorf("quick_check: %w", err)
	}
	return verdict, nil
}
