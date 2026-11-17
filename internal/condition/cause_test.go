package condition

import (
	"errors"
	"fmt"
	"io/fs"
	"syscall"
	"testing"

	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/execx"
)

// sqliteErr stands in for the driver's error, which carries its code.
type sqliteErr int

func (e sqliteErr) Error() string { return fmt.Sprintf("sqlite %d", int(e)) }
func (e sqliteErr) Code() int     { return int(e) }

func TestCauseNamesTheCondition(t *testing.T) {
	for _, c := range []struct {
		name string
		err  error
		want *errs.Entry
	}{
		{"tesseract missing", &execx.NotInstalledError{Name: "tesseract"}, ScanReaderMissing},
		{"pdftoppm missing, wrapped", errs.Disk.Wrap(fmt.Errorf("draw: %w", &execx.NotInstalledError{Name: "pdftoppm"})), PDFReaderMissing},
		{"no space", fmt.Errorf("write: %w", syscall.ENOSPC), DiskFull},
		{"database full", errs.Database.Wrap(sqliteErr(13)), DiskFull},
		{"database read-only, extended code", errs.Database.Wrap(sqliteErr(8 | 1<<8)), DatabaseUnsound},
		{"database damaged", sqliteErr(11), DatabaseUnsound},
		{"folder refused", &fs.PathError{Op: "open", Path: "/data/pages", Err: syscall.EACCES}, DataFolderRefused},
		{"read-only disk", &fs.PathError{Op: "open", Path: "/data/pages", Err: syscall.EROFS}, DataFolderRefused},
	} {
		got := Cause(c.err)
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
		sqliteErr(19), // a constraint: the query's fault, not the file's
		&fs.PathError{Op: "open", Path: "/data/pages/9.png", Err: fs.ErrNotExist},
	} {
		if got := Cause(err); got != nil {
			t.Errorf("Cause(%v) = %v, want nil", err, got)
		}
	}
}
