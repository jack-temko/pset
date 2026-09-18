package engine

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jackt/pset/internal/pdf"
	"github.com/jackt/pset/internal/store"
)

func newTestRunner(t *testing.T, e *Engine) *Runner {
	t.Helper()
	r := NewRunner(e)
	t.Cleanup(func() { e.setRunner(nil) })
	return r
}

// runPendingTasks drains the queue synchronously through the same path the
// background runner uses, without polling.
func runPendingTasks(t *testing.T, r *Runner) {
	t.Helper()
	if err := r.Drain(context.Background()); err != nil {
		t.Fatalf("drain the task queue: %v", err)
	}
}

func submitImport(t *testing.T, e *Engine, path string) *ImportSubmission {
	t.Helper()
	sub, err := e.SubmitImport(context.Background(), path)
	if err != nil {
		t.Fatalf("submit import of %s: %v", path, err)
	}
	if sub.Duplicated {
		t.Fatalf("import of %s unexpectedly duplicated", path)
	}
	return sub
}

func prepare(t *testing.T, e *Engine, r *Runner, path string) *TaskView {
	t.Helper()
	sub := submitImport(t, e, path)
	runPendingTasks(t, r)
	return taskAfter(t, e, sub.Task.ID)
}

// taskViews lists every task, for assertions about what a run created.
func taskViews(t *testing.T, e *Engine) []*TaskView {
	t.Helper()
	views, err := e.TaskViews(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return views
}

func taskAfter(t *testing.T, e *Engine, id string) *TaskView {
	t.Helper()
	v, err := e.TaskView(context.Background(), id)
	if err != nil {
		t.Fatalf("load task %s: %v", id, err)
	}
	return v
}

// phaseByKey loads one of a task's phases by its stable key.
func phaseByKey(t *testing.T, e *Engine, taskID, key string) *Phase {
	t.Helper()
	v := taskAfter(t, e, taskID)
	for _, ph := range v.Phases {
		if ph.Key == key {
			return ph
		}
	}
	t.Fatalf("task %s has no phase %q (keys: %v)", taskID, key, func() []string {
		out := []string{}
		for _, ph := range v.Phases {
			out = append(out, ph.Key)
		}
		return out
	}())
	return nil
}

// taskBook loads the book a finished task produced.
func taskBook(t *testing.T, e *Engine, v *TaskView) *store.Book {
	t.Helper()
	if v.BookID == nil {
		t.Fatalf("task %s has no book", v.ID)
	}
	s, err := store.Open(e.DBPath())
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	b, err := s.BookByID(context.Background(), *v.BookID)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func waitFor(t *testing.T, timeout time.Duration, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %s", what)
}

// seedScannedBook registers the scanned sample as an un-OCRed book without
// running the ingest pipeline, so OCR jobs can be exercised in isolation.
func seedScannedBook(t *testing.T, e *Engine) *store.Book {
	t.Helper()
	requirePoppler(t)
	m := loadManifest(t)
	path, err := filepath.Abs(filepath.Join(sampleDir, m.Scanned.File))
	if err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(data)

	s, err := e.openStore(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	book := &store.Book{
		SHA256:     hex.EncodeToString(sum[:]),
		FilePath:   path,
		FileSize:   info.Size(),
		Title:      "A Little Primer of Brontolithics",
		PageCount:  m.Scanned.Pages,
		OriginPath: path,
		Kind:       store.KindScanned,
	}
	if err := s.CreateBook(context.Background(), book); err != nil {
		t.Fatal(err)
	}
	return book
}

// seedFakeBook registers a book row without any pipeline work.
func seedFakeBook(t *testing.T, e *Engine, sha, title, kind string, pageCount int) *store.Book {
	t.Helper()
	s, err := e.openStore(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	book := &store.Book{
		SHA256:    sha,
		FilePath:  filepath.Join(t.TempDir(), sha+".pdf"),
		FileSize:  3,
		Title:     title,
		PageCount: pageCount,
		Kind:      kind,
	}
	if err := s.CreateBook(context.Background(), book); err != nil {
		t.Fatal(err)
	}
	return book
}

// --- submissions ------------------------------------------------------------

func TestSubmitImportDuplicateCreatesNoJob(t *testing.T) {
	requirePoppler(t)
	m := loadManifest(t)
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)
	ctx := context.Background()

	source := filepath.Join(sampleDir, m.Digital.File)
	first := submitImport(t, e, source)
	runPendingTasks(t, r)

	dup, err := e.SubmitImport(ctx, source)
	if err != nil {
		t.Fatalf("duplicate submit: %v", err)
	}
	if !dup.Duplicated || dup.Book == nil || dup.Task != nil {
		t.Fatalf("duplicate = %+v, want the existing book and no task", dup)
	}
	book := taskBook(t, e, taskAfter(t, e, first.Task.ID))
	if dup.Book.ID != book.ID || dup.Book.SHA256 != book.SHA256 {
		t.Errorf("duplicate book = %s/%s, want the stored book %s", dup.Book.ID, book.ID, book.ID)
	}

	views, err := e.TaskViews(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(views) != 1 {
		t.Fatalf("%d tasks recorded, want just the first preparation", len(views))
	}
}

func TestSubmitImportMissingFileAndDirectory(t *testing.T) {
	e := testEngine(t, discardLogger())

	missing := filepath.Join(t.TempDir(), "nope.pdf")
	_, err := e.SubmitImport(context.Background(), missing)
	if err == nil {
		t.Fatal("import of a missing file must fail")
	}
	if got := err.Error(); got != "file not found: "+missing {
		t.Fatalf("err = %q, want %q", got, "file not found: "+missing)
	}

	dir := t.TempDir()
	_, err = e.SubmitImport(context.Background(), dir)
	if err == nil {
		t.Fatal("import of a directory must fail")
	}
	if got := err.Error(); got != dir+" is a directory" {
		t.Fatalf("err = %q, want %q", got, dir+" is a directory")
	}
}

func TestSubmitImportWithoutPopplerFailsBeforeWriting(t *testing.T) {
	m := loadManifest(t)
	t.Setenv("PATH", t.TempDir())
	e := testEngine(t, discardLogger())

	_, err := e.SubmitImport(context.Background(), filepath.Join(sampleDir, m.Digital.File))
	if err == nil {
		t.Fatal("import without poppler must fail")
	}
	if !errors.Is(err, pdf.ErrNotInstalled) {
		t.Fatalf("err = %v, want ErrNotInstalled", err)
	}
	if !strings.Contains(err.Error(), "doctor") {
		t.Errorf("error should point at `pset doctor`, got: %v", err)
	}
	if _, statErr := os.Stat(e.DBPath()); !os.IsNotExist(statErr) {
		t.Error("failed submit must not create the database")
	}
}

func TestSubmitImportReaderUsesUploadNameAsTitleFallback(t *testing.T) {
	requirePoppler(t)
	m := loadManifest(t)
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)

	data, err := os.ReadFile(filepath.Join(sampleDir, m.Scanned.File))
	if err != nil {
		t.Fatal(err)
	}
	sub, err := e.SubmitImportReader(context.Background(), bytes.NewReader(data), "my station scan.pdf")
	if err != nil {
		t.Fatalf("submit upload: %v", err)
	}
	runPendingTasks(t, r)

	v := taskAfter(t, e, sub.Task.ID)
	if v.Status != store.TaskDone {
		t.Fatalf("job status = %q (%s), want completed", v.Status, v.Error)
	}
	book := taskBook(t, e, v)
	if book.Title != "my station scan" {
		t.Errorf("title = %q, want the cleaned upload name", book.Title)
	}
	if book.Kind != store.KindScanned {
		t.Errorf("kind = %q, want scanned", book.Kind)
	}
}

// --- ingest pipelines --------------------------------------------------------

func TestIngestDigitalSampleCompletesWithOutlineTOC(t *testing.T) {
	requirePoppler(t)
	requirePdftohtml(t)
	m := loadManifest(t)
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)

	v := prepare(t, e, r, filepath.Join(sampleDir, m.Digital.File))

	if v.Status != store.TaskDone {
		t.Fatalf("job = %q/%q, want completed", v.Status, v.Error)
	}
	if v.Kind != store.TaskPrepare {
		t.Errorf("kind = %q, want prepare", v.Kind)
	}
	// Every phase of the plan is declared and every one finishes. A phase
	// with nothing to do finishes with a note; it never vanishes, so the
	// shape a student sees is stable from the first frame.
	if len(v.Phases) != 4 {
		t.Fatalf("plan has %d phases, want 4", len(v.Phases))
	}
	for _, key := range []string{"examine", "read", "index", "search"} {
		if ph := phaseByKey(t, e, v.ID, key); ph.Status != store.PhaseDone {
			t.Errorf("phase %s = %q, want done", key, ph.Status)
		}
	}
	// The digital sample has a text layer, so the read phase has nothing to do.
	if ph := phaseByKey(t, e, v.ID, "read"); ph.Note == "" {
		t.Error("a phase with nothing to do must say why")
	}
	if ph := phaseByKey(t, e, v.ID, "index"); ph.Done != m.Digital.Pages || ph.Total != m.Digital.Pages {
		t.Errorf("index progress = %d/%d, want %d/%d", ph.Done, ph.Total, m.Digital.Pages, m.Digital.Pages)
	}
	if v.Error != "" {
		t.Errorf("error = %q, want none", v.Error)
	}
	if v.StartedAt.IsZero() || v.FinishedAt.IsZero() {
		t.Errorf("timestamps = %v/%v, want both set", v.StartedAt, v.FinishedAt)
	}

	book := taskBook(t, e, v)
	if book.Kind != store.KindDigital {
		t.Errorf("kind = %q, want digital", book.Kind)
	}
	// Readiness is derived, and a finished preparation satisfies all of it.
	r2 := readinessOf(t, e, book)
	if !r2.Ready() {
		t.Errorf("readiness = %+v, want ready after a complete preparation", r2)
	}
	if book.Title != m.Digital.Title || book.PageCount != m.Digital.Pages {
		t.Errorf("book = %q (%d pages), want %q (%d)", book.Title, book.PageCount, m.Digital.Title, m.Digital.Pages)
	}

	bs, err := e.BookSections(context.Background(), book.SHA256[:8])
	if err != nil {
		t.Fatal(err)
	}
	if len(bs.Sections) != len(m.Digital.Outline) {
		t.Fatalf("ingest stored %d sections, want the outline's %d", len(bs.Sections), len(m.Digital.Outline))
	}
	for i, h := range m.Digital.Outline {
		if bs.Sections[i].Title != h.Title || bs.Sections[i].StartPage != h.Page {
			t.Errorf("section %d = %+v, want outline entry %+v", i, bs.Sections[i], h)
		}
	}
}

func TestIngestFlatSampleInfersTOC(t *testing.T) {
	requirePoppler(t)
	requirePdftohtml(t)
	m := loadManifest(t)
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)

	v := prepare(t, e, r, filepath.Join(sampleDir, m.Flat.File))
	if v.Status != store.TaskDone {
		t.Fatalf("job = %q/%q, want completed", v.Status, v.Error)
	}
	book := taskBook(t, e, v)
	bs, err := e.BookSections(context.Background(), book.SHA256[:8])
	if err != nil {
		t.Fatal(err)
	}
	if len(bs.Sections) != len(m.Flat.Headings) {
		t.Fatalf("stored %d sections, want %d", len(bs.Sections), len(m.Flat.Headings))
	}
	want := []string{
		"Reading the Sky inferred L1 1-2",
		"Collar Maintenance inferred L1 3-3",
		"Winter Silence inferred L1 4-4",
	}
	got := sectionTuple(bs.Sections)
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("section %d = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestIngestScannedSampleRunsOCRAndPatternTOC(t *testing.T) {
	requireTesseract(t)
	m := loadManifest(t)
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)

	v := prepare(t, e, r, filepath.Join(sampleDir, m.Scanned.File))
	if v.Status != store.TaskDone {
		t.Fatalf("job = %q/%q, want completed", v.Status, v.Error)
	}
	if ph := phaseByKey(t, e, v.ID, "index"); ph.Status != store.PhaseDone {
		t.Errorf("index phase = %q, want done", ph.Status)
	}
	book := taskBook(t, e, v)
	if book.Kind != store.KindScanned {
		t.Errorf("kind = %q, want scanned", book.Kind)
	}
	if r := readinessOf(t, e, book); !r.Ready() {
		t.Fatalf("readiness = %+v, want ready", r)
	}

	bs, err := e.BookSections(context.Background(), book.SHA256[:8])
	if err != nil {
		t.Fatal(err)
	}
	wantTitles := []string{"A First Gavel", "Reading the Register", "The Families of Lake Vair", "The Oath"}
	if len(bs.Sections) != len(wantTitles) {
		t.Fatalf("pattern TOC found %d sections (%v), want the %d chapters",
			len(bs.Sections), sectionTuple(bs.Sections), len(wantTitles))
	}
	for i, title := range wantTitles {
		sec := bs.Sections[i]
		if sec.Title != title || sec.StartPage != 3+i || sec.Source != store.SourceInferred || sec.Level != 1 {
			t.Errorf("section %d = %+v, want %q at page %d", i, sec, title, 3+i)
		}
	}
}

func TestIngestScannedSampleFailsWithoutTesseract(t *testing.T) {
	requirePoppler(t)
	if _, err := exec.LookPath("tesseract"); err == nil {
		t.Skip("tesseract installed, the failure path cannot fire")
	}
	m := loadManifest(t)
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)

	v := prepare(t, e, r, filepath.Join(sampleDir, m.Scanned.File))
	if v.Status != store.TaskFailed {
		t.Fatalf("job status = %q, want failed without tesseract", v.Status)
	}
	if !strings.Contains(v.Error, "tesseract isn't installed") || !strings.Contains(v.Error, "doctor") {
		t.Errorf("error = %q, want the doctor hint", v.Error)
	}
	// A missing tool is the machine's fault, so a retry is honest.
	if v.FailKind != store.FailEnvironment {
		t.Errorf("failKind = %q, want environment", v.FailKind)
	}
	if !v.Retryable() {
		t.Error("an environment failure must offer a retry")
	}
	book := taskBook(t, e, v)
	if r := readinessOf(t, e, book); r.Ready() {
		t.Errorf("readiness = %+v, want not ready", r)
	}
}

func TestIngestNotAPDFFailsAndCleansUp(t *testing.T) {
	requirePoppler(t)
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)

	path := filepath.Join(t.TempDir(), "fake.pdf")
	if err := os.WriteFile(path, []byte("this is not a pdf at all"), 0o600); err != nil {
		t.Fatal(err)
	}
	sub := submitImport(t, e, path)
	runPendingTasks(t, r)

	v := taskAfter(t, e, sub.Task.ID)
	if v.Status != store.TaskFailed {
		t.Fatalf("job status = %q, want failed", v.Status)
	}
	if !strings.Contains(v.Error, "can't be read") || !strings.Contains(v.Error, "fake.pdf") {
		t.Fatalf("error = %q, want a clear unreadable-PDF message naming the file", v.Error)
	}
	// A corrupt file fails identically on every attempt, so no retry is
	// offered: "Try again" would be a lie.
	if v.FailKind != store.FailPermanent {
		t.Errorf("failKind = %q, want permanent", v.FailKind)
	}
	if v.Retryable() {
		t.Error("a permanent failure must not offer a retry")
	}
	if v.BookID != nil {
		t.Errorf("book id = %v, want none (no book row)", *v.BookID)
	}

	libraryDir := filepath.Join(filepath.Dir(e.DBPath()), "library")
	if entries, err := os.ReadDir(libraryDir); err != nil || len(entries) != 0 {
		t.Errorf("library = %v/%v, want empty after the failed import", entries, err)
	}
	spoolDir := filepath.Join(filepath.Dir(e.DBPath()), "spool")
	if entries, err := os.ReadDir(spoolDir); err != nil || len(entries) != 0 {
		t.Errorf("spool = %v/%v, want empty after the failed import", entries, err)
	}
}

func TestPrepareWithoutSpooledFileFails(t *testing.T) {
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)
	ctx := context.Background()

	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	task := &store.Task{Kind: store.TaskPrepare}
	if err := s.CreateTask(ctx, task); err != nil {
		t.Fatal(err)
	}
	s.Close()

	runPendingTasks(t, r)
	v := taskAfter(t, e, task.ID)
	if v.Status != store.TaskFailed || !strings.Contains(v.Error, "staged file") {
		t.Fatalf("task = %q/%q, want failed over the missing staged file", v.Status, v.Error)
	}
	// There is nothing to retry: the source is gone.
	if v.FailKind != store.FailPermanent {
		t.Errorf("failKind = %q, want permanent", v.FailKind)
	}
}

// --- runner ------------------------------------------------------------------

func TestRunnerProcessesTasksInFIFOOrder(t *testing.T) {
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
	// Raw engine: give it the required embeddings endpoint directly.
	embedSrv := startFakeEmbed(t, &fakeEmbed{})
	if err := e.SaveConfig(context.Background(), Settings{
		APIBaseURL: DefaultAPIBaseURL, EmbedBaseURL: embedSrv.URL, EmbedModel: DefaultEmbedModel,
	}); err != nil {
		t.Fatal(err)
	}
	r := newTestRunner(t, e)

	submitImport(t, e, filepath.Join(sampleDir, m.Digital.File))
	submitImport(t, e, filepath.Join(sampleDir, m.Flat.File))
	runPendingTasks(t, r)

	var started []string
	for _, ev := range events {
		if ev.Kind == EventStarted && strings.HasPrefix(ev.Message, "Examining ") {
			started = append(started, ev.Message)
		}
	}
	if len(started) != 2 {
		t.Fatalf("started events = %v, want one per preparation", started)
	}
	if !strings.Contains(started[0], "sample-digital") || !strings.Contains(started[1], "sample-flat") {
		t.Errorf("started order = %v, want FIFO (digital first)", started)
	}

	views, err := e.TaskViews(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(views) != 2 || views[0].ID < views[1].ID {
		t.Errorf("views = %+v, want both tasks newest first", views)
	}
	for _, v := range views {
		if v.Status != store.TaskDone {
			t.Errorf("job %s = %q, want completed", v.ID, v.Status)
		}
	}
}

// --- stopping and resuming ---------------------------------------------------

// seedPreparableBook registers a scanned book with a prepare task queued
// against it, for the stop and resume paths.
func seedQueuedPrepare(t *testing.T, e *Engine, book *store.Book) *store.Task {
	t.Helper()
	return seedPrepareTask(t, e, book)
}

func TestStopQueuedTaskImmediately(t *testing.T) {
	e := testEngine(t, discardLogger())
	ctx := context.Background()
	newTestRunner(t, e)

	book := seedFakeBook(t, e, "queued0000", "Queued Book", store.KindDigital, 1)
	task := seedQueuedPrepare(t, e, book)

	got, err := e.StopTask(ctx, task.ID)
	if err != nil {
		t.Fatalf("stop: %v", err)
	}
	if got.Status != store.TaskPaused || got.FinishedAt.IsZero() {
		t.Fatalf("stopped task = %q/%v, want paused with finished_at", got.Status, got.FinishedAt)
	}

	v := taskAfter(t, e, task.ID)
	if v.Status != store.TaskPaused {
		t.Errorf("view status = %q, want paused", v.Status)
	}
	// Stopping never deletes: the book is still there, just not ready.
	if _, err := e.BookStatus(ctx, book.SHA256); err != nil {
		t.Fatalf("stopping a task must not remove its book: %v", err)
	}
	// And a paused task is retryable, because there is something to resume.
	if !v.Retryable() {
		t.Error("a paused task must offer a resume")
	}
}

func TestStopSettledTaskRefused(t *testing.T) {
	requirePoppler(t)
	requirePdftohtml(t)
	m := loadManifest(t)
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)

	sub := submitImport(t, e, filepath.Join(sampleDir, m.Digital.File))
	runPendingTasks(t, r)

	_, err := e.StopTask(context.Background(), sub.Task.ID)
	var settled *TaskSettledError
	if !errors.As(err, &settled) {
		t.Fatalf("err = %v, want TaskSettledError", err)
	}
}

func TestStopUnknownTask(t *testing.T) {
	e := testEngine(t, discardLogger())
	if _, err := e.StopTask(context.Background(), "42420000-0000-0000-0000-000000000000"); !errors.Is(err, ErrTaskNotFound) {
		t.Fatalf("err = %v, want ErrTaskNotFound", err)
	}
}

// TestRunnerPausesOnShutdownAndResumes cancels the runner's context mid-read:
// the task goes back to queued at a page boundary with its pages intact, and
// a fresh runner finishes it. Losing forty minutes of reading to a restart is
// the failure this rules out.
func TestRunnerPausesOnShutdownAndResumes(t *testing.T) {
	requireTesseract(t)
	e := testEngine(t, discardLogger())
	ctx := context.Background()

	book := seedScannedBook(t, e)
	task := seedQueuedPrepare(t, e, book)

	runCtx, cancel := context.WithCancel(ctx)
	r := NewRunner(e)
	go r.Run(runCtx)

	waitFor(t, 60*time.Second, "the first page to be read", func() bool {
		v, err := e.TaskView(ctx, task.ID)
		if err != nil {
			return false
		}
		for _, ph := range v.Phases {
			if ph.Key == "read" && ph.Status == store.PhaseRunning && ph.Done >= 1 {
				return true
			}
		}
		return false
	})
	cancel()
	<-r.Done()
	if r.Err() != nil {
		t.Fatalf("runner err = %v, want a graceful pause", r.Err())
	}

	v := taskAfter(t, e, task.ID)
	if v.Status != store.TaskQueued {
		t.Fatalf("interrupted task = %q, want queued so it resumes on the next boot", v.Status)
	}
	read := phaseByKey(t, e, task.ID, "read")
	if read.Done < 1 || read.Done > book.PageCount {
		t.Errorf("read phase done = %d, want a partial count", read.Done)
	}
	if read.Status != store.PhaseWaiting {
		t.Errorf("interrupted read phase = %q, want waiting for the resume", read.Status)
	}
	if ph := phaseByKey(t, e, task.ID, "examine"); ph.Status != store.PhaseDone {
		t.Errorf("examine phase = %q, want done — finished work is never re-run", ph.Status)
	}

	stored := storedPageNumbers(t, e.DBPath(), book.ID)
	if len(stored) != read.Done {
		t.Errorf("stored pages = %v, want exactly the %d committed pages", stored, read.Done)
	}

	// A fresh runner resumes and finishes without re-reading what was done.
	r2 := newTestRunner(t, e)
	go r2.Run(ctx)
	waitFor(t, 120*time.Second, "the resumed task to finish", func() bool {
		got, err := e.TaskView(ctx, task.ID)
		return err == nil && got.Status == store.TaskDone
	})
	if ph := phaseByKey(t, e, task.ID, "read"); ph.Done != book.PageCount || ph.Total != book.PageCount {
		t.Errorf("resumed read phase = %d/%d, want %d/%d", ph.Done, ph.Total, book.PageCount, book.PageCount)
	}
}

// TestStopRunningTaskAtPageBoundary stops a running read through the public
// path: it rests between pages, keeps what it wrote, and stores nothing extra.
func TestStopRunningTaskAtPageBoundary(t *testing.T) {
	requireTesseract(t)
	e := testEngine(t, discardLogger())
	ctx := context.Background()

	book := seedScannedBook(t, e)
	task := seedQueuedPrepare(t, e, book)

	r := newTestRunner(t, e)
	go r.Run(ctx)
	waitFor(t, 60*time.Second, "the first page to be read", func() bool {
		v, err := e.TaskView(ctx, task.ID)
		if err != nil {
			return false
		}
		for _, ph := range v.Phases {
			if ph.Key == "read" && ph.Status == store.PhaseRunning && ph.Done >= 1 {
				return true
			}
		}
		return false
	})

	if _, err := e.StopTask(ctx, task.ID); err != nil {
		t.Fatalf("stop: %v", err)
	}
	waitFor(t, 60*time.Second, "the task to rest", func() bool {
		v, err := e.TaskView(ctx, task.ID)
		return err == nil && v.Status == store.TaskPaused
	})

	read := phaseByKey(t, e, task.ID, "read")
	if read.Status != store.PhaseWaiting {
		t.Errorf("stopped read phase = %q, want waiting so a retry resumes it", read.Status)
	}
	stored := storedPageNumbers(t, e.DBPath(), book.ID)
	if len(stored) != read.Done {
		t.Errorf("stored pages = %d, want the %d read before the stop", len(stored), read.Done)
	}
}

// TestOrphanedTasksAreReclaimedNotStolen pins the process lease: a task left
// running by a dead process is reclaimed, but one owned by a live runner is
// not — a second pset on the same database must not yank the first one's work.
func TestOrphanedTasksAreReclaimedNotStolen(t *testing.T) {
	e := testEngine(t, discardLogger())
	ctx := context.Background()

	book := seedFakeBook(t, e, "stuck00000", "Stuck Book", store.KindScanned, 1)
	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()

	orphan := &store.Task{Kind: store.TaskPrepare, BookID: &book.ID}
	if err := s.CreateTask(ctx, orphan); err != nil {
		t.Fatal(err)
	}
	if _, err := s.ClaimTask(ctx, orphan.ID, "a-dead-process"); err != nil {
		t.Fatal(err)
	}

	live := &store.Task{Kind: store.TaskPrepare, BookID: &book.ID}
	if err := s.CreateTask(ctx, live); err != nil {
		t.Fatal(err)
	}
	if _, err := s.ClaimTask(ctx, live.ID, "the-live-runner"); err != nil {
		t.Fatal(err)
	}

	n, err := s.ReclaimOrphanedTasks(ctx, "the-live-runner")
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("reclaimed %d tasks, want only the orphan", n)
	}
	if got, _ := s.TaskByID(ctx, orphan.ID); got.Status != store.TaskQueued {
		t.Errorf("orphan = %q, want requeued", got.Status)
	}
	if got, _ := s.TaskByID(ctx, live.ID); got.Status != store.TaskRunning {
		t.Errorf("live task = %q, want left alone", got.Status)
	}
}

func TestTaskViewsOrdering(t *testing.T) {
	requirePoppler(t)
	requirePdftohtml(t)
	m := loadManifest(t)
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)

	first := submitImport(t, e, filepath.Join(sampleDir, m.Digital.File))
	second := submitImport(t, e, filepath.Join(sampleDir, m.Flat.File))
	runPendingTasks(t, r)

	// An active (queued) task sorts before finished ones.
	book := seedFakeBook(t, e, "ordering0", "Ordering Book", store.KindDigital, 1)
	seedQueuedPrepare(t, e, book)

	views, err := e.TaskViews(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(views) != 3 {
		t.Fatalf("views = %d, want 3", len(views))
	}
	if views[0].Status != store.TaskQueued {
		t.Errorf("first view = %q, want the active task first", views[0].Status)
	}
	if views[1].ID != second.Task.ID || views[2].ID != first.Task.ID {
		t.Errorf("finished order = %s/%s, want newest first %s/%s",
			views[1].ID, views[2].ID, second.Task.ID, first.Task.ID)
	}
}

// TestHistoryPrunesItself pins that finished tasks need no clearing by hand:
// the newest are kept and older ones fall off as new ones settle.
func TestHistoryPrunesItself(t *testing.T) {
	e := testEngine(t, discardLogger())
	ctx := context.Background()
	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()

	var ids []string
	for i := 0; i < 30; i++ {
		task := &store.Task{Kind: store.TaskPrepare, Status: store.TaskDone}
		if err := s.CreateTask(ctx, task); err != nil {
			t.Fatal(err)
		}
		ids = append(ids, task.ID)
	}
	pruned, err := s.PruneFinishedTasks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(pruned) != 5 {
		t.Fatalf("pruned %d tasks, want 5 (30 settled, 25 kept)", len(pruned))
	}
	left, err := s.FinishedTasks(ctx, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(left) != 25 {
		t.Fatalf("%d finished tasks kept, want 25", len(left))
	}
	// The oldest went, the newest stayed.
	if left[0].ID != ids[len(ids)-1] {
		t.Errorf("newest kept = %s, want %s", left[0].ID, ids[len(ids)-1])
	}
}

// TestRetryRebuildsWhatDataSaysIsMissing pins the point of deriving
// readiness: a preparation that finished can still be looking at an
// incomplete book, and the retry works against the data rather than against
// the task's own record of having succeeded. Trusting the row would leave
// the book permanently unusable with no door out of it.
func TestRetryRebuildsWhatDataSaysIsMissing(t *testing.T) {
	requirePoppler(t)
	requirePdftohtml(t)
	m := loadManifest(t)
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)
	ctx := context.Background()

	v := prepare(t, e, r, filepath.Join(sampleDir, m.Digital.File))
	if v.Status != store.TaskDone {
		t.Fatalf("task = %q/%q, want done", v.Status, v.Error)
	}
	book := taskBook(t, e, v)

	// A finished task over a complete book has nothing to redo.
	if st, err := e.BookStatus(ctx, book.SHA256); err != nil {
		t.Fatal(err)
	} else if st.Task != nil && st.Task.Retryable() {
		t.Fatal("a finished task over a ready book must offer no retry")
	}
	if _, err := e.RetryTask(ctx, v.ID); err == nil {
		t.Fatal("retrying a task with nothing missing must refuse")
	}

	// Now the vectors go missing underneath it.
	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.ClearEmbeddings(ctx, book.ID); err != nil {
		t.Fatal(err)
	}
	s.Close()

	st, err := e.BookStatus(ctx, book.SHA256)
	if err != nil {
		t.Fatal(err)
	}
	if st.Readiness.Ready() {
		t.Fatal("a book whose vectors are gone must stop being ready at once")
	}
	if st.Task == nil || !st.Task.Retryable() {
		t.Fatal("an incomplete book must offer a rebuild rather than dead-ending")
	}

	// The retry reopens only the missing phase and rebuilds it.
	if _, err := e.RetryTask(ctx, v.ID); err != nil {
		t.Fatalf("retry: %v", err)
	}
	if ph := phaseByKey(t, e, v.ID, "read"); ph.Status != store.PhaseDone {
		t.Errorf("read phase = %q, want left alone — its work is still there", ph.Status)
	}
	if ph := phaseByKey(t, e, v.ID, "search"); ph.Status != store.PhaseWaiting {
		t.Errorf("search phase = %q, want reopened", ph.Status)
	}
	runPendingTasks(t, r)

	if got := readinessOf(t, e, book); !got.Ready() {
		t.Fatalf("readiness after the rebuild = %+v, want ready", got)
	}
}
