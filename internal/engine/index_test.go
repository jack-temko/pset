package engine

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"

	"github.com/go-pdf/fpdf"

	"github.com/jackt/pset/internal/pdf"
	"github.com/jackt/pset/internal/store"
)

func requirePdftohtml(t *testing.T) {
	t.Helper()
	if err := pdf.XMLAvailable(); err != nil {
		t.Skipf("pdftohtml not installed, skipping: %v", err)
	}
}

// TestIndexJobOutlinePath runs the outline path through a manual index job:
// every planted bookmark lands as a section with the manifest's title, page
// and level, in document order, with end pages bounded by the next
// same-or-shallower section.
func TestIndexJobOutlinePath(t *testing.T) {
	requirePoppler(t)
	requirePdftohtml(t)
	m := loadManifest(t)

	var events []Event
	e, err := New(Config{
		DBPath:   filepath.Join(t.TempDir(), "data", "pset.db"),
		Logger:   discardLogger(),
		Progress: func(ev Event) { events = append(events, ev) },
	})
	if err != nil {
		t.Fatal(err)
	}
	r := newTestRunner(t, e)
	ctx := context.Background()

	v := prepare(t, e, r, filepath.Join(sampleDir, m.Digital.File))
	book := taskBook(t, e, v)

	// The ingest already indexed; replace the stored sections with junk to
	// prove the manual job rewrites them from scratch.
	s, err := store.Open(e.DBPath())
	if err != nil {
		t.Fatal(err)
	}
	if err := s.CreateSections(ctx, book.ID, []store.Section{
		{Level: 1, Title: "Junk", Source: store.SourceInferred, StartPage: 1, EndPage: 1},
	}); err != nil {
		t.Fatal(err)
	}
	s.Close()

	row, err := runPhaseFor(t, e, book, "index")
	if err != nil {
		t.Fatalf("index phase: %v", err)
	}
	if row.Status != store.PhaseDone {
		t.Fatalf("index phase = %q/%q, want done", row.Status, row.Error)
	}

	if len(events) < 2 || events[0].Kind != EventStarted {
		t.Fatalf("events = %+v, want started first", events)
	}
	sawOutline := false
	for _, ev := range events {
		if ev.Kind == EventPhase && strings.Contains(ev.Message, "Read 6 outline entries") {
			sawOutline = true
		}
	}
	if !sawOutline {
		t.Errorf("events = %+v, want the outline entry count", events)
	}

	bs, err := e.BookSections(ctx, m.Digital.Title)
	if err != nil {
		t.Fatalf("book sections: %v", err)
	}
	sections := bs.Sections
	if len(sections) != len(m.Digital.Outline) {
		t.Fatalf("stored %d sections, want %d", len(sections), len(m.Digital.Outline))
	}
	for i, h := range m.Digital.Outline {
		sec := sections[i]
		if sec.SortOrder != i || sec.Title != h.Title || sec.StartPage != h.Page ||
			sec.Level != h.Level || sec.Source != store.SourceOutline {
			t.Errorf("section %d = %+v, want outline entry %+v at sort order %d", i, sec, h, i)
		}
		if sec.Title == "Junk" {
			t.Errorf("junk row survived at position %d", i)
		}
	}

	wantTuples := []string{
		"What Is Brontolithics? outline L1 3-3",
		"The Voss Register outline L2 3-3",
		"The Kettle Array outline L1 4-4",
		"Measuring a Storm outline L1 5-5",
		"Karsts and the Collar Meter outline L2 5-5",
		"Safety and Ethics outline L1 6-6",
	}
	gotTuples := sectionTuple(sections)
	for i := range wantTuples {
		if gotTuples[i] != wantTuples[i] {
			t.Errorf("section %d = %q, want %q", i, gotTuples[i], wantTuples[i])
		}
	}
}

// TestIndexJobPatternPassOnOCRBook indexes an OCR book through a manual job:
// the structure comes from the pattern pass over stored page text, with no
// external tools involved.
func TestIndexJobPatternPassOnOCRBook(t *testing.T) {
	e := testEngine(t, discardLogger())
	ctx := context.Background()

	book := seedFakeBook(t, e, "ocrbook000", "Pattern Book", store.KindScanned, 4)
	s, err := store.Open(e.DBPath())
	if err != nil {
		t.Fatal(err)
	}
	if err := s.SavePage(ctx, book.ID, store.Page{Number: 2, Text: "Chapter 1. First\nplain body text.\n"}); err != nil {
		t.Fatal(err)
	}
	if err := s.SavePage(ctx, book.ID, store.Page{Number: 3, Text: "1. Second Section\nplain body text.\n"}); err != nil {
		t.Fatal(err)
	}
	s.Close()

	row, err := runPhaseFor(t, e, book, "index")
	if err != nil {
		t.Fatalf("index phase: %v", err)
	}
	if row.Status != store.PhaseDone {
		t.Fatalf("index phase = %q/%q, want done", row.Status, row.Error)
	}

	bs, err := e.BookSections(ctx, book.SHA256)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{
		"First inferred L1 2-2",
		"Second Section inferred L1 3-4",
	}
	have := sectionTuple(bs.Sections)
	if len(have) != len(want) {
		t.Fatalf("sections = %v, want %v", have, want)
	}
	for i := range want {
		if have[i] != want[i] {
			t.Errorf("section %d = %q, want %q", i, have[i], want[i])
		}
	}
}

// TestIndexPhaseAlwaysLeavesASection pins that structure is something every
// book has: a book with nothing detectable gets one section covering the
// whole thing, rather than being called unusable over a table of contents
// nobody wrote.
func TestIndexPhaseAlwaysLeavesASection(t *testing.T) {
	e := testEngine(t, discardLogger())
	ctx := context.Background()

	book := seedFakeBook(t, e, "none00000", "Textless Book", store.KindScanned, 4)
	row, err := runPhaseFor(t, e, book, "index")
	if err != nil {
		t.Fatalf("index phase: %v", err)
	}
	if row.Status != store.PhaseDone {
		t.Fatalf("index phase = %q/%q, want done", row.Status, row.Error)
	}

	bs, err := e.BookSections(ctx, book.SHA256)
	if err != nil {
		t.Fatal(err)
	}
	if len(bs.Sections) != 1 {
		t.Fatalf("sections = %v, want one whole-book section", sectionTuple(bs.Sections))
	}
	if bs.Sections[0].StartPage != 1 || bs.Sections[0].EndPage != book.PageCount {
		t.Fatalf("whole-book section = %d-%d, want 1-%d",
			bs.Sections[0].StartPage, bs.Sections[0].EndPage, book.PageCount)
	}
	if r := readinessOf(t, e, book); r.Sections == 0 {
		t.Fatal("the index phase must never leave a book with no structure")
	}
}

func TestIndexWithoutPdftohtmlFails(t *testing.T) {
	e := testEngine(t, discardLogger())

	book := seedFakeBook(t, e, "seeded0000", "Seeded Book", store.KindDigital, 1)

	t.Setenv("PATH", t.TempDir())
	row, err := runPhaseFor(t, e, book, "index")
	if err == nil {
		t.Fatal("indexing without pdftohtml must fail")
	}
	if row.Status != store.PhaseFailed {
		t.Fatalf("index phase = %q, want failed without pdftohtml", row.Status)
	}
	// A missing tool is the machine's fault, not the book's: the UI must
	// offer a retry rather than only Remove book.
	var env *EnvironmentError
	if !errors.As(err, &env) {
		t.Fatalf("err = %v, want an EnvironmentError", err)
	}
	if !strings.Contains(row.Error, "isn't installed") || !strings.Contains(row.Error, "doctor") {
		t.Errorf("error = %q, want the doctor hint for the missing tool", row.Error)
	}
}

func TestResolveBookUnknownTarget(t *testing.T) {
	e := testEngine(t, discardLogger())
	_, err := e.BookStatus(context.Background(), "no-such-book")
	var noMatch *NoMatchError
	if !errors.As(err, &noMatch) {
		t.Fatalf("err = %v, want a NoMatchError", err)
	}
}

// TestIndexBookWithoutDetectableHeadings covers the zero-sections outcome: a
// digital book with neither bookmarks nor oversized lines stays unindexed,
// and the job records a warning instead of failing.
func TestIndexBookWithoutDetectableHeadings(t *testing.T) {
	requirePoppler(t)
	requirePdftohtml(t)

	var events []Event
	e, err := New(Config{
		DBPath:   filepath.Join(t.TempDir(), "data", "pset.db"),
		Logger:   discardLogger(),
		Progress: func(ev Event) { events = append(events, ev) },
	})
	if err != nil {
		t.Fatal(err)
	}
	r := newTestRunner(t, e)

	v := prepare(t, e, r, writeHeadinglessPDF(t))
	if v.Status != store.TaskDone {
		t.Fatalf("job = %q/%q, want completed", v.Status, v.Error)
	}
	book := taskBook(t, e, v)
	if book.Kind != store.KindDigital {
		t.Fatalf("kind = %q, want digital", book.Kind)
	}
	// One whole-book section, so the book is still ready and still usable.
	bs, err := e.BookSections(context.Background(), book.SHA256)
	if err != nil {
		t.Fatal(err)
	}
	if len(bs.Sections) != 1 || bs.Sections[0].StartPage != 1 {
		t.Fatalf("sections = %v, want one whole-book section", sectionTuple(bs.Sections))
	}

	warned := false
	for _, ev := range events {
		if ev.Kind == EventPhase && strings.Contains(ev.Message, "No outline found") {
			warned = true
		}
	}
	if !warned {
		t.Errorf("events = %+v, want the zero-sections warning", events)
	}
}

func assertUnindexed(t *testing.T, e *Engine, bookID string) {
	t.Helper()
	s, err := store.Open(e.DBPath())
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	sections, err := s.Sections(context.Background(), bookID)
	if err != nil || sections != nil {
		t.Errorf("sections = %v/%v, want none after a refused index", sections, err)
	}
}

// writeHeadinglessPDF builds a bookmark-free digital PDF whose every line
// uses the body font size, so no heading can be inferred.
func writeHeadinglessPDF(t *testing.T) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "headingless.pdf")
	f := fpdf.New("P", "pt", "A4", "")
	f.SetCompression(false)
	f.SetTitle("Uniform Prose", false)
	f.SetCreator("pset test", false)
	f.AddPage()
	f.SetFont("Helvetica", "", 11)
	f.MultiCell(0, 16, "This page carries only uniform body text at a single font size. "+
		"Every line is long, quiet, and ordinary, and nothing on it rises above the rest, "+
		"so the classifier has nothing to latch onto here. The word count stays well "+
		"above what a scan's stray stamp text would produce.", "", "L", false)
	f.AddPage()
	f.SetFont("Helvetica", "", 11)
	f.MultiCell(0, 16, "The second page keeps the word count high enough that the import "+
		"registers a real text layer instead of calling the file a scan. Quiet words of "+
		"uniform prose leave no heading for the structure pass to find, and nothing on "+
		"either page rises above the body size, which is exactly the situation this "+
		"fixture exists to exercise, page after deliberately plain and unremarkable "+
		"page of nothing but body text.", "", "L", false)
	if err := f.OutputFileAndClose(path); err != nil {
		t.Fatalf("write headingless pdf: %v", err)
	}
	return path
}
