package main

import (
	"context"
	"database/sql"
	"io"
	"log/slog"
	"net"
	"path/filepath"
	"testing"

	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/store"
)

// A second copy on a taken port must leave the first copy's steps alone:
// starting the runner puts every running step back to waiting, and the copy
// would then start them again, before it found the port busy.
func TestBusyPortLeavesRunningStepsAlone(t *testing.T) {
	dir := t.TempDir()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	busy, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup.Close(busy)
	addr := busy.Addr().String()

	// The first attempt makes the store; then a step is running in it, as
	// the first copy would have it.
	if err := serve(addr, dir, false, log); err == nil {
		t.Fatal("serve listened on a taken port")
	}
	s, err := store.Open(context.Background(), filepath.Join(dir, "store.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup.Close(s.DB)
	err = s.Write(context.Background(), change.ActorPSet, "", func(tx *sql.Tx) error {
		_, err := tx.Exec(`INSERT INTO steps (id, subject_kind, subject_id, name, position, state, created_at) VALUES ('st1', 'set', 's1', 'rank', 0, 'running', '')`)
		return err
	})
	if err != nil {
		t.Fatal(err)
	}

	for range 500 {
		if err := serve(addr, dir, false, log); err == nil {
			t.Fatal("serve listened on a taken port")
		}
	}
	var state string
	if err := s.DB.QueryRowContext(context.Background(), `SELECT state FROM steps WHERE id = 'st1'`).Scan(&state); err != nil && err != sql.ErrNoRows {
		t.Fatal(err)
	}
	if state != "running" {
		t.Errorf("the running step is %q after copies that never got the port; want running", state)
	}
}
