package condition

import (
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"path/filepath"
	"syscall"
	"testing"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/execx"
	"github.com/jackt/pset/internal/testx"
)

// coded is an error with a Code method that is not SQLite's: an HTTP
// status whose low byte reads as SQLITE_FULL (525) or SQLITE_CANTOPEN (526).
type coded int

func (e coded) Error() string { return fmt.Sprintf("status %d", int(e)) }
func (e coded) Code() int     { return int(e) }

// readOnly is the driver's own error for a write to a read-only database.
func readOnly(t *testing.T) error {
	t.Helper()
	path := filepath.Join(t.TempDir(), "ro.db")
	d, err := db.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	testx.Check(t, testx.Err(d.Exec(`CREATE TABLE t (x)`)))
	cleanup.Close(d)
	ro, err := sql.Open("sqlite", "file:"+path+"?mode=ro")
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup.Close(ro)
	_, err = ro.Exec(`INSERT INTO t VALUES (1)`)
	if err == nil {
		t.Fatal("a read-only database took a write")
	}
	return err
}

func TestCauseNamesTheCondition(t *testing.T) {
	const data = "/data"
	for _, c := range []struct {
		name string
		err  error
		want *errs.Entry
	}{
		{"tesseract missing", &execx.NotInstalledError{Name: "tesseract"}, ScanReaderMissing},
		{"pdftoppm missing, wrapped", errs.Disk.Wrap(fmt.Errorf("draw: %w", &execx.NotInstalledError{Name: "pdftoppm"})), PDFReaderMissing},
		{"no space", fmt.Errorf("write: %w", syscall.ENOSPC), DiskFull},
		{"database read-only", errs.Database.Wrap(readOnly(t)), DatabaseUnsound},
		{"folder refused", &fs.PathError{Op: "open", Path: "/data/pages", Err: syscall.EACCES}, DataFolderRefused},
		{"read-only disk", &fs.PathError{Op: "open", Path: "/data/pages", Err: syscall.EROFS}, DataFolderRefused},
	} {
		got := Cause(c.err, data)
		if !errors.Is(got, c.want) {
			t.Errorf("%s: %v, want %s", c.name, got, c.want.ID)
		}
		if kind, clears := errs.KindOf(got); kind != errs.KindWaitingOnYou || clears != c.want.Clears {
			t.Errorf("%s: kind %s clears %q, want waiting on %s", c.name, kind, clears, c.want.Clears)
		}
	}
	for _, err := range []error{
		nil,
		errors.New("plain"),
		coded(525),
		coded(526),
		&fs.PathError{Op: "open", Path: "/data/pages/9.png", Err: fs.ErrNotExist},
		// Not the data folder: a program that would not start, a file elsewhere.
		&fs.PathError{Op: "fork/exec", Path: "/usr/bin/pdftoppm", Err: syscall.EACCES},
		&fs.PathError{Op: "open", Path: "/home/me/book.pdf", Err: syscall.EACCES},
		&fs.PathError{Op: "open", Path: "/database/x", Err: syscall.EACCES},
	} {
		if got := Cause(err, data); got != nil {
			t.Errorf("Cause(%v) = %v, want nil", err, got)
		}
	}
}
