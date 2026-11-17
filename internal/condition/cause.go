package condition

import (
	"errors"
	"io/fs"
	"net/http"
	"path/filepath"
	"strings"
	"syscall"

	"modernc.org/sqlite"

	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/execx"
)

// The failures that mean a condition stopped holding, learned from what
// happened rather than checked ahead (ideas/errors-grill.md, A2). Each waits
// on the student: the work waits, and runs again once the condition holds.
// The key, credit and provider are the model client's own (llm's entries);
// these are the computer's.
var (
	// PDFReaderMissing is Poppler not installed.
	PDFReaderMissing = errs.Define(errs.Entry{
		ID:     "condition.pdf_reader",
		Kind:   errs.KindWaitingOnYou,
		Clears: string(IDPDFReader),
		What:   "PSet can't read PDFs on this computer.",
		Why:    "Poppler, the program PSet reads PDFs with, isn't installed.",
		Fix:    "Install Poppler (Settings shows how), then try again.",
		Action: errs.ActionOpenSettings,
		Status: http.StatusServiceUnavailable,
	})
	// ScanReaderMissing is Tesseract not installed.
	ScanReaderMissing = errs.Define(errs.Entry{
		ID:     "condition.scan_reader",
		Kind:   errs.KindWaitingOnYou,
		Clears: string(IDScanReader),
		What:   "PSet can't read scanned pages on this computer.",
		Why:    "Tesseract, the program PSet reads scans with, isn't installed.",
		Fix:    "Install Tesseract (Settings shows how), then try again.",
		Action: errs.ActionOpenSettings,
		Status: http.StatusServiceUnavailable,
	})
	// DataFolderRefused is the data folder missing or not writable.
	DataFolderRefused = errs.Define(errs.Entry{
		ID:     "condition.data_folder",
		Kind:   errs.KindWaitingOnYou,
		Clears: string(IDDataFolder),
		What:   "PSet can't use its data folder.",
		Why:    "The folder is missing, or PSet isn't allowed to write to it.",
		Fix:    "Check the data folder in Settings, then try again.",
		Action: errs.ActionOpenSettings,
		Status: http.StatusServiceUnavailable,
	})
	// DatabaseUnsound is the database file unopenable, read-only or damaged.
	DatabaseUnsound = errs.Define(errs.Entry{
		ID:     "condition.database",
		Kind:   errs.KindWaitingOnYou,
		Clears: string(IDDatabase),
		What:   "PSet can't open or write its database.",
		Why:    "The file may be read-only, damaged, or on a drive that went away.",
		Fix:    "Check the database in Settings, then try again.",
		Action: errs.ActionOpenSettings,
		Status: http.StatusServiceUnavailable,
	})
	// DiskFull is no room left on the disk.
	DiskFull = errs.Define(errs.Entry{
		ID:     "condition.disk_space",
		Kind:   errs.KindWaitingOnYou,
		Clears: string(IDDiskSpace),
		What:   "The disk is full.",
		Why:    "PSet needs room for pages, images and its database.",
		Fix:    "Free some space, then try again.",
		Action: errs.ActionRetry,
		Status: http.StatusInsufficientStorage,
	})
)

// SQLite's primary result codes that mean the database file, not the
// query, is the trouble (sqlite.org/rescode.html). An extended code keeps
// its primary code in the low byte. Only the driver's own error is read:
// another error with a Code method (an HTTP status) is not SQLite's.
const (
	sqliteReadOnly = 8
	sqliteIOErr    = 10
	sqliteCorrupt  = 11
	sqliteFull     = 13
	sqliteCantOpen = 14
	sqliteNotADB   = 26
)

// Cause names the condition err shows to have stopped holding, wrapped in
// its entry, or returns nil when err is not one of these. It reads the raw
// cause under any catalog entry: a full disk under "couldn't import the
// book" is still a full disk. dataDir is the data folder: only a permission
// refused under it is the folder's.
func Cause(err error, dataDir string) error {
	if err == nil {
		return nil
	}
	if e := of(err, dataDir); e != nil {
		return e.Wrap(err)
	}
	return nil
}

func of(err error, dataDir string) *errs.Entry {
	var missing *execx.NotInstalledError
	if errors.As(err, &missing) {
		if filepath.Base(missing.Name) == "tesseract" {
			return ScanReaderMissing
		}
		// pdfinfo, pdftotext, pdftoppm, pdftohtml: all Poppler.
		return PDFReaderMissing
	}
	if errors.Is(err, syscall.ENOSPC) {
		return DiskFull
	}
	var coded *sqlite.Error
	if errors.As(err, &coded) {
		switch coded.Code() & 0xff {
		case sqliteFull:
			return DiskFull
		case sqliteReadOnly, sqliteIOErr, sqliteCorrupt, sqliteCantOpen, sqliteNotADB:
			return DatabaseUnsound
		}
	}
	var path *fs.PathError
	if errors.As(err, &path) && (errors.Is(err, fs.ErrPermission) || errors.Is(err, syscall.EROFS)) && under(path.Path, dataDir) {
		return DataFolderRefused
	}
	return nil
}

// under is whether path is dataDir or inside it. A program that could not
// be started, or a file elsewhere, is not the data folder's.
func under(path, dataDir string) bool {
	if dataDir == "" || !filepath.IsAbs(path) {
		return false
	}
	rel, err := filepath.Rel(dataDir, path)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}
