package engine

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/pdf"
	"github.com/jackt/pset/internal/store"
)

const sampleDir = "../../testdata"

type sampleFact struct {
	ID   string `json:"id"`
	Text string `json:"text"`
	Page int    `json:"page"`
}

type sampleHeading struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Page  int    `json:"page"`
	Level int    `json:"level"`
}

type sampleBook struct {
	File     string          `json:"file"`
	SHA256   string          `json:"sha256"`
	Pages    int             `json:"pages"`
	Title    string          `json:"title"`
	Author   string          `json:"author"`
	Subject  string          `json:"subject"`
	Facts    []sampleFact    `json:"facts"`
	Outline  []sampleHeading `json:"outline"`
	Headings []sampleHeading `json:"headings"`
}

type sampleManifest struct {
	Digital sampleBook `json:"digital"`
	Scanned sampleBook `json:"scanned"`
	Flat    sampleBook `json:"flat"`
}

func loadManifest(t *testing.T) sampleManifest {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(sampleDir, "manifest.json"))
	if err != nil {
		t.Fatalf("read manifest: %v", err)
	}
	var m sampleManifest
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("parse manifest: %v", err)
	}
	return m
}

func requirePoppler(t *testing.T) {
	t.Helper()
	if err := pdf.Available(); err != nil {
		t.Skipf("poppler not installed, skipping: %v", err)
	}
}

func testEngine(t *testing.T, logger *slog.Logger) *Engine {
	t.Helper()
	e, err := New(Config{
		DBPath: filepath.Join(t.TempDir(), "data", "pset.db"),
		Logger: logger,
	})
	if err != nil {
		t.Fatal(err)
	}
	// Embeddings are a platform requirement: every test engine gets a
	// scripted endpoint so ingests run their semantic phase. Tests that
	// need chat replace APIBaseURL via SaveConfig and keep this embed URL.
	srv := startFakeEmbed(t, &fakeEmbed{})
	if err := e.SaveConfig(context.Background(), Settings{
		APIBaseURL:   DefaultAPIBaseURL,
		EmbedBaseURL: srv.URL,
		EmbedModel:   DefaultEmbedModel,
	}); err != nil {
		t.Fatal(err)
	}
	return e
}

// setChatConfig repoints the chat endpoint while keeping the scripted
// embeddings endpoint testEngine installed — chat and embed are configured
// independently, and settings save as one unit.
func setChatConfig(t *testing.T, e *Engine, baseURL, key string) {
	t.Helper()
	ctx := context.Background()
	cfg, err := e.Config(ctx)
	if err != nil {
		t.Fatal(err)
	}
	cfg.APIBaseURL = baseURL
	cfg.APIKey = key
	if err := e.SaveConfig(ctx, cfg); err != nil {
		t.Fatal(err)
	}
}

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func normalize(s string) string { return strings.Join(strings.Fields(s), " ") }

func TestIngestDigitalSampleStoresBookAndPages(t *testing.T) {
	requirePoppler(t)
	m := loadManifest(t)
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)

	v := prepare(t, e, r, filepath.Join(sampleDir, m.Digital.File))
	if v.Status != store.TaskDone {
		t.Fatalf("job = %q/%q, want completed", v.Status, v.Error)
	}
	book := taskBook(t, e, v)

	if book.Title != m.Digital.Title || book.Author != m.Digital.Author || book.Subject != m.Digital.Subject {
		t.Errorf("metadata = %q / %q / %q, want %q / %q / %q",
			book.Title, book.Author, book.Subject, m.Digital.Title, m.Digital.Author, m.Digital.Subject)
	}
	if book.PageCount != m.Digital.Pages {
		t.Errorf("page count = %d, want %d", book.PageCount, m.Digital.Pages)
	}
	if book.PageWidth <= 0 || book.PageHeight <= 0 {
		t.Errorf("page size = %v x %v, want positive dimensions", book.PageWidth, book.PageHeight)
	}
	if !strings.HasSuffix(book.OriginPath, m.Digital.File) {
		t.Errorf("origin path = %q, want the imported file", book.OriginPath)
	}

	data, err := os.ReadFile(book.FilePath)
	if err != nil {
		t.Fatalf("library copy: %v", err)
	}
	sum := sha256.Sum256(data)
	if got := hex.EncodeToString(sum[:]); got != book.SHA256 || got != m.Digital.SHA256 {
		t.Errorf("library copy sha = %s, want %s", got, m.Digital.SHA256)
	}

	s, err := store.Open(e.DBPath())
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	pages, err := s.Pages(context.Background(), book.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(pages) != m.Digital.Pages {
		t.Fatalf("stored %d pages, want %d", len(pages), m.Digital.Pages)
	}
	for _, f := range m.Digital.Facts {
		pageText := normalize(pages[f.Page-1].Text)
		if !strings.Contains(pageText, normalize(f.Text)) {
			t.Errorf("fact %s not found verbatim on page %d", f.ID, f.Page)
		}
	}
}

func TestDuplicateIngestChangesNothing(t *testing.T) {
	requirePoppler(t)
	m := loadManifest(t)
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)
	ctx := context.Background()

	source := filepath.Join(sampleDir, m.Digital.File)
	sub := submitImport(t, e, source)
	runPendingTasks(t, r)
	book := taskBook(t, e, taskAfter(t, e, sub.Task.ID))

	dup, err := e.SubmitImport(ctx, source)
	if err != nil {
		t.Fatalf("duplicate import: %v", err)
	}
	if !dup.Duplicated || dup.Book.ID != book.ID {
		t.Fatalf("duplicate = %+v, want the stored book", dup)
	}

	entries, err := os.ReadDir(filepath.Dir(book.FilePath))
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Fatalf("library holds %d files, want 1", len(entries))
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
	if len(pages) != m.Digital.Pages {
		t.Fatalf("duplicate import changed page count to %d", len(pages))
	}
}

func TestIngestScannedSampleRegistersWithoutTextLayer(t *testing.T) {
	requirePoppler(t)
	if _, err := exec.LookPath("tesseract"); err == nil {
		t.Skip("tesseract installed — the ingest would OCR the sample, skipping the raw none-state check")
	}
	m := loadManifest(t)
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)

	v := prepare(t, e, r, filepath.Join(sampleDir, m.Scanned.File))
	if v.Status != store.TaskFailed {
		t.Fatalf("job = %q, want failed (no tesseract to OCR with)", v.Status)
	}
	book := taskBook(t, e, v)
	if book.Kind != store.KindScanned {
		t.Errorf("kind = %q, want %q", book.Kind, store.KindScanned)
	}
	if r := readinessOf(t, e, book); r.Ready() {
		t.Errorf("readiness = %+v, want not ready — the pages were never read", r)
	}
	if book.Title != "sample scanned" {
		t.Errorf("fallback title = %q, want %q", book.Title, "sample scanned")
	}
	if book.Author != "" {
		t.Errorf("author = %q, want empty (the scan carries no metadata)", book.Author)
	}
	if book.PageCount != m.Scanned.Pages {
		t.Errorf("page count = %d, want %d", book.PageCount, m.Scanned.Pages)
	}

	s, err := store.Open(e.DBPath())
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	pages, err := s.Pages(context.Background(), book.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(pages) != 0 {
		t.Fatalf("scanned ingest stored %d pages, want 0", len(pages))
	}
}

func TestClassifyBook(t *testing.T) {
	words := func(n int) string {
		return strings.TrimSuffix(strings.Repeat("word ", n), " ")
	}
	pages := func(wordsPerPage ...int) []string {
		out := make([]string, len(wordsPerPage))
		for i, n := range wordsPerPage {
			out[i] = words(n)
		}
		return out
	}
	cases := []struct {
		name  string
		pages []string
		want  string
	}{
		{"pure scan", pages(0, 0, 0, 0), store.KindScanned},
		{"scan with a text-y cover", pages(15, 0, 0, 0, 0, 0), store.KindScanned},
		// The corner the word guard exists for: every page carries a stamp's
		// worth of text, but there is no book in it.
		{"small scan past the ratio", pages(12, 12), store.KindScanned},
		{"mostly-scan hybrid", pages(20, 20, 20, 0, 0, 0, 0, 0, 0, 0), store.KindScanned},
		{"small digital book", pages(40, 40, 40, 40), store.KindDigital},
		{"no pages at all", nil, store.KindScanned},
	}
	for _, tc := range cases {
		if got := classifyBook(tc.pages); got != tc.want {
			t.Errorf("%s: classifyBook = %q, want %q", tc.name, got, tc.want)
		}
	}
}

func TestFilenameTitle(t *testing.T) {
	cases := map[string]string{
		"stewart-calculus-8e.pdf":  "stewart calculus 8e",
		"A_Primer.of.Bugs.PDF":     "A Primer of Bugs",
		"plain.pdf":                "plain",
		" spaced - out _ name.pdf": "spaced out name",
	}
	for in, want := range cases {
		if got := filenameTitle(in); got != want {
			t.Errorf("filenameTitle(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestIngestDeveloperLogsAreDebugOnly(t *testing.T) {
	requirePoppler(t)
	m := loadManifest(t)

	debugBuf := &bytes.Buffer{}
	debugLogger := slog.New(slog.NewTextHandler(debugBuf, &slog.HandlerOptions{Level: slog.LevelDebug}))
	infoBuf := &bytes.Buffer{}
	infoLogger := slog.New(slog.NewTextHandler(infoBuf, &slog.HandlerOptions{Level: slog.LevelInfo}))

	source := filepath.Join(sampleDir, m.Digital.File)
	e1 := testEngine(t, debugLogger)
	prepare(t, e1, newTestRunner(t, e1), source)
	e2 := testEngine(t, infoLogger)
	prepare(t, e2, newTestRunner(t, e2), source)

	for _, stage := range []string{"import enqueued", "storing book", "read metadata", "copied into library", "extracted text", "stored book"} {
		if !strings.Contains(debugBuf.String(), stage) {
			t.Errorf("verbose log missing stage %q", stage)
		}
		if strings.Contains(infoBuf.String(), stage) {
			t.Errorf("developer stage %q leaked below --verbose", stage)
		}
	}
}

func TestIngestProgressEvents(t *testing.T) {
	requirePoppler(t)
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

	sub := submitImport(t, e, filepath.Join(sampleDir, m.Digital.File))
	if len(events) != 0 {
		t.Fatalf("submit events = %+v, want none until the job runs", events)
	}
	runPendingTasks(t, r)
	if v := taskAfter(t, e, sub.Task.ID); v.Status != store.TaskDone {
		t.Fatalf("job = %q/%q, want completed", v.Status, v.Error)
	}
	if events[0].Kind != EventStarted || !strings.Contains(events[0].Message, "sample-digital") {
		t.Fatalf("first event = %+v, want a started event naming the file", events[0])
	}

	copies := 0
	for _, ev := range events {
		if ev.Kind == EventPhase && ev.Message == "Copied into library" {
			copies++
		}
	}
	if copies != 1 {
		t.Errorf("got %d %q events, want 1", copies, "Copied into library")
	}

	// A duplicate submit enqueues nothing and emits nothing.
	events = nil
	if _, err := e.SubmitImport(context.Background(), filepath.Join(sampleDir, m.Digital.File)); err != nil {
		t.Fatal(err)
	}
	if len(events) != 0 {
		t.Errorf("duplicate import events = %+v, want none", events)
	}
}
