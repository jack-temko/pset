package main

import (
	"context"
	"database/sql"
	"io"
	"log/slog"
	"net"
	"path/filepath"
	"testing"

	"github.com/jackt/pset/internal/db"
)

// A second copy on a taken port must leave the first copy's jobs alone:
// starting the queue put every running job back to queued, and the copy
// then started them again, before it found the port busy.
func TestBusyPortLeavesRunningJobsAlone(t *testing.T) {
	dir := t.TempDir()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	busy, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer busy.Close()
	addr := busy.Addr().String()

	// The first attempt makes the database; then a job is running in it, as
	// the first copy would have it.
	if err := serve(addr, dir, false, log); err == nil {
		t.Fatal("serve listened on a taken port")
	}
	d, err := db.Open(filepath.Join(dir, "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	if _, err := d.ExecContext(context.Background(), `INSERT INTO jobs (id, kind, lane, state, created_at, updated_at) VALUES ('j1', 'import', 'import', 'running', '', '')`); err != nil {
		t.Fatal(err)
	}

	for range 500 {
		if err := serve(addr, dir, false, log); err == nil {
			t.Fatal("serve listened on a taken port")
		}
	}
	var state string
	if err := d.QueryRowContext(context.Background(), `SELECT state FROM jobs WHERE id = 'j1'`).Scan(&state); err != nil && err != sql.ErrNoRows {
		t.Fatal(err)
	}
	if state != "running" {
		t.Errorf("the running job is %q after copies that never got the port; want running", state)
	}
}
