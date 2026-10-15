// Package cleanup closes, removes and reports the things a function is done
// with, where a failure can't change what the function returns: it is logged
// instead of dropped. A failure that does change the result (closing a file
// that was written, say) is not cleanup: return it.
package cleanup

import (
	"database/sql"
	"errors"
	"io"
	"io/fs"
	"log/slog"
	"os"
)

// Close closes c, for a deferred close of something only read: rows, a
// response body, a file opened for reading.
func Close(c io.Closer) {
	if err := c.Close(); err != nil {
		slog.Warn("cleanup: close", "err", err)
	}
}

// Remove deletes a file that is no longer needed, such as a temp file. One
// already gone is fine.
func Remove(path string) {
	if err := os.Remove(path); err != nil && !errors.Is(err, fs.ErrNotExist) {
		slog.Warn("cleanup: remove", "path", path, "err", err)
	}
}

// RemoveAll deletes a directory that is no longer needed.
func RemoveAll(path string) {
	if err := os.RemoveAll(path); err != nil {
		slog.Warn("cleanup: remove all", "path", path, "err", err)
	}
}

// Log reports a failed step whose error nothing can act on, such as a wasted
// event or a write to a client that left.
func Log(what string, err error) {
	if err != nil {
		slog.Warn(what, "err", err)
	}
}

// Rollback is a deferred rollback: after a commit it does nothing.
func Rollback(tx *sql.Tx) {
	if err := tx.Rollback(); err != nil && !errors.Is(err, sql.ErrTxDone) {
		slog.Warn("cleanup: roll back", "err", err)
	}
}
