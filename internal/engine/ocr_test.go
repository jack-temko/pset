package engine

import (
	"context"
	"errors"
	"os/exec"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/store"
)

func requireTesseract(t *testing.T) {
	t.Helper()
	if _, err := exec.LookPath("tesseract"); err != nil {
		t.Skipf("tesseract not installed, skipping: %v", err)
	}
}

// ocrNormalize maps OCR-confusable characters to a shared bucket on both
// sides of an assertion (tesseract reads 0 as @/Q, 1 as l, etc.), then
// collapses whitespace.
func ocrNormalize(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(s) {
		switch r {
		case '0', 'o', '@', 'q':
			r = 'o'
		case '1', 'l', 'i', '|':
			r = 'l'
		case '5', 's':
			r = 's'
		case '2', 'z':
			r = 'z'
		case '8', 'b':
			r = 'b'
		}
		b.WriteRune(r)
	}
	return strings.Join(strings.Fields(b.String()), " ")
}

func storedPageCount(t *testing.T, dbPath, sha string) int {
	t.Helper()
	s, err := store.Open(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	b, err := s.BookBySHA256(context.Background(), sha)
	if err != nil {
		t.Fatal(err)
	}
	pages, err := s.Pages(context.Background(), b.ID)
	if err != nil {
		t.Fatal(err)
	}
	return len(pages)
}

// TestReadPhaseScannedSample runs the read phase over the seeded scanned
// book and checks every planted fact lands on its manifest page (tesseract
// is deterministic; the scan was built to be legible).
func TestReadPhaseScannedSample(t *testing.T) {
	requireTesseract(t)
	e := testEngine(t, discardLogger())
	ctx := context.Background()

	book := seedScannedBook(t, e)
	row, err := runPhaseFor(t, e, book, "read")
	if err != nil {
		t.Fatalf("read phase: %v", err)
	}
	if row.Status != store.PhaseDone || row.Done != book.PageCount || row.Total != book.PageCount {
		t.Fatalf("read phase = %q %d/%d, want done %d/%d",
			row.Status, row.Done, row.Total, book.PageCount, book.PageCount)
	}
	if got := storedPageCount(t, e.DBPath(), book.SHA256); got != book.PageCount {
		t.Fatalf("stored %d pages, want %d", got, book.PageCount)
	}

	s, err := store.Open(e.DBPath())
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	pages, err := s.Pages(ctx, book.ID)
	if err != nil {
		t.Fatal(err)
	}
	m := loadManifest(t)
	for _, f := range m.Scanned.Facts {
		pageText := ocrNormalize(pages[f.Page-1].Text)
		if !strings.Contains(pageText, ocrNormalize(f.Text)) {
			t.Errorf("fact %s not found on page %d (modulo OCR confusables)", f.ID, f.Page)
		}
	}

	// Every page carries an outcome, and none of them failed.
	if r := readinessOf(t, e, book); r.PagesFailed != 0 || r.PagesStored != book.PageCount {
		t.Fatalf("readiness = %+v, want every page stored and none failed", r)
	}

	// A second run finds every page settled and does nothing.
	row2, err := runPhaseFor(t, e, book, "read")
	if err != nil {
		t.Fatalf("second read phase: %v", err)
	}
	if row2.Status != store.PhaseDone {
		t.Fatalf("second run = %q, want a done no-op", row2.Status)
	}
}

func TestReadPhaseResumesPartiallyStoredBook(t *testing.T) {
	requireTesseract(t)
	e := testEngine(t, discardLogger())
	ctx := context.Background()

	book := seedScannedBook(t, e)
	// Simulate an interrupted run: pages 1 and 2 stored, 3..6 missing.
	s, err := store.Open(e.DBPath())
	if err != nil {
		t.Fatal(err)
	}
	for _, n := range []int{1, 2} {
		if err := s.SavePage(ctx, book.ID, store.Page{Number: n, Text: "preexisting"}); err != nil {
			t.Fatal(err)
		}
	}
	if err := s.Close(); err != nil {
		t.Fatal(err)
	}

	row, err := runPhaseFor(t, e, book, "read")
	if err != nil {
		t.Fatalf("read phase: %v", err)
	}
	if row.Done != book.PageCount || row.Total != book.PageCount {
		t.Errorf("read phase = %d/%d, want %d/%d (2 kept + 4 read)", row.Done, row.Total, book.PageCount, book.PageCount)
	}
	if got := storedPageCount(t, e.DBPath(), book.SHA256); got != book.PageCount {
		t.Fatalf("stored %d pages after resume, want %d", got, book.PageCount)
	}

	s2, err := store.Open(e.DBPath())
	if err != nil {
		t.Fatal(err)
	}
	defer s2.Close()
	first, err := s2.Page(ctx, book.ID, 1)
	if err != nil {
		t.Fatal(err)
	}
	if first.Text != "preexisting" {
		t.Errorf("resume overwrote a stored page: %q", first.Text)
	}
}

// TestReadPhaseSkipsDigitalBook pins that a book read from its own text
// layer finishes the read phase with a note rather than a fourth outcome.
func TestReadPhaseSkipsDigitalBook(t *testing.T) {
	e := testEngine(t, discardLogger())
	book := seedFakeBook(t, e, "digital1", "A Digital Book", store.KindDigital, 3)

	row, err := runPhaseFor(t, e, book, "read")
	if err != nil {
		t.Fatalf("read phase of a digital book: %v", err)
	}
	if row.Status != store.PhaseDone {
		t.Fatalf("read phase = %q, want done", row.Status)
	}
	if row.Note == "" {
		t.Error("a phase with nothing to do must say why")
	}
}

// TestReadPhaseRecordsFailedPages pins the blank/failed distinction: a page
// whose tools error keeps a row so coverage stays complete, is visible as a
// failure, and blocks readiness until it is recovered.
func TestReadPhaseRecordsFailedPages(t *testing.T) {
	e := testEngine(t, discardLogger())
	ctx := context.Background()
	// A scanned book whose file does not exist: every page fails to
	// rasterize, which is exactly the tool-level failure being pinned.
	book := seedFakeBook(t, e, "broken1", "A Broken Scan", store.KindScanned, 2)
	requireTesseract(t)

	row, err := runPhaseFor(t, e, book, "read")
	if err == nil {
		t.Fatal("a book whose pages all fail must fail its phase")
	}
	if row.Status != store.PhaseFailed {
		t.Fatalf("read phase = %q, want failed", row.Status)
	}
	var env *EnvironmentError
	if !errors.As(err, &env) {
		t.Fatalf("err = %v, want an EnvironmentError so the UI offers a retry", err)
	}

	r := readinessOf(t, e, book)
	if r.PagesStored != book.PageCount {
		t.Fatalf("pages stored = %d, want %d — every page gets a row", r.PagesStored, book.PageCount)
	}
	if r.PagesFailed != book.PageCount {
		t.Fatalf("pages failed = %d, want %d", r.PagesFailed, book.PageCount)
	}
	if r.Ready() {
		t.Fatal("a book with unreadable pages must not be ready")
	}

	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	failed, err := s.FailedPages(ctx, book.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(failed) != book.PageCount {
		t.Fatalf("failed pages = %d, want %d", len(failed), book.PageCount)
	}
	for _, p := range failed {
		if p.Error == "" {
			t.Errorf("page %d failed with no reason recorded", p.Number)
		}
	}
}
