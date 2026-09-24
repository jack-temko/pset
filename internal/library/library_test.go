package library

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"maps"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-pdf/fpdf"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/llm/llmtest"
)

// ---------------------------------------------------------------- fixtures

// fixturePDF is a small digital textbook: front matter, then chapters with
// an outline, body text, and printed page numbers in the foot.
func fixturePDF(t *testing.T, front, body int, title string) []byte {
	t.Helper()
	f := fpdf.New("P", "pt", "Letter", "")
	f.SetTitle(title, true)
	f.SetAuthor("A. Author", true)
	f.SetFont("Helvetica", "", 11)
	for i := range front {
		f.AddPage()
		f.Text(72, 100, fmt.Sprintf("Preface page %d. This book is about linear maps and their spaces.", i+1))
	}
	topics := []string{"eigenvalues of operators", "inner products and norms", "determinants of matrices"}
	for p := 1; p <= body; p++ {
		f.AddPage()
		if (p-1)%4 == 0 {
			ch := (p-1)/4 + 1
			f.Bookmark(fmt.Sprintf("Chapter %d", ch), 0, 0)
			f.Bookmark(fmt.Sprintf("%d.1 First ideas", ch), 1, 0)
		}
		topic := topics[p%len(topics)]
		for l := range 8 {
			f.Text(72, float64(120+l*16), fmt.Sprintf("Line %d discusses %s in some depth, with an example.", l, topic))
		}
		f.Text(300, 760, fmt.Sprint(p))
	}
	var buf bytes.Buffer
	if err := f.Output(&buf); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

// scannedPDF has pages with no text layer at all.
func scannedPDF(t *testing.T, pages int) []byte {
	t.Helper()
	f := fpdf.New("P", "pt", "Letter", "")
	for range pages {
		f.AddPage()
		f.Rect(100, 100, 200, 200, "F")
	}
	var buf bytes.Buffer
	f.Output(&buf)
	return buf.Bytes()
}

type models struct{ cfg llm.Config }

func (m *models) LLM(context.Context) (llm.Config, error) { return m.cfg, nil }

type recorder struct {
	mu     sync.Mutex
	events []string
}

func (r *recorder) Publish(typ string, data any) {
	b, _ := json.Marshal(data)
	r.mu.Lock()
	r.events = append(r.events, typ+" "+string(b))
	r.mu.Unlock()
}

func (r *recorder) has(prefix, contains string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, e := range r.events {
		if strings.HasPrefix(e, prefix) && strings.Contains(e, contains) {
			return true
		}
	}
	return false
}

type env struct {
	*httptest.Server
	svc    *Service
	models *models
	events *recorder
	queue  *jobs.Queue
	llm    *llmtest.Server
	dir    string
	ocr    func(page int) (string, error)
	mu     sync.Mutex
}

func needPoppler(t *testing.T) {
	for _, tool := range []string{"pdfinfo", "pdftotext", "pdftohtml", "pdftoppm"} {
		if _, err := exec.LookPath(tool); err != nil {
			t.Skip("poppler not installed")
		}
	}
}

func newEnv(t *testing.T) *env {
	t.Helper()
	needPoppler(t)
	dir := t.TempDir()
	d, err := db.Open(filepath.Join(dir, "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	if err := db.Migrate(context.Background(), d, append(jobs.Migrations(), Migrations()...)); err != nil {
		t.Fatal(err)
	}
	e := &env{llm: llmtest.New(t), events: &recorder{}, dir: dir}
	e.models = &models{cfg: e.llm.Config()}
	e.queue = jobs.New(d, slog.New(slog.NewTextHandler(io.Discard, nil)))
	e.queue.Lane(LaneImport, 1)
	tools := LiveTools()
	tools.OCR = func(ctx context.Context, path string, page int) (string, error) {
		e.mu.Lock()
		fn := e.ocr
		e.mu.Unlock()
		return fn(page)
	}
	e.ocr = func(page int) (string, error) {
		return fmt.Sprintf("Recognized text of page %d about eigenvalues.\n%d", page, page), nil
	}
	e.svc = New(Config{DB: d, DataDir: dir, Events: e.events, Queue: e.queue, Models: e.models, Tools: tools})
	mux := http.NewServeMux()
	e.svc.Routes(mux)
	e.Server = httptest.NewServer(mux)
	t.Cleanup(e.Close)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { e.queue.Run(ctx); close(done) }()
	t.Cleanup(func() { cancel(); <-done })
	return e
}

func (e *env) setOCR(fn func(int) (string, error)) {
	e.mu.Lock()
	e.ocr = fn
	e.mu.Unlock()
}

func (e *env) upload(t *testing.T, name string, data []byte, out any) int {
	t.Helper()
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, _ := mw.CreateFormFile("file", name)
	fw.Write(data)
	mw.Close()
	resp, err := http.Post(e.URL+"/api/books", mw.FormDataContentType(), &body)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	json.NewDecoder(resp.Body).Decode(out)
	return resp.StatusCode
}

func (e *env) do(t *testing.T, method, path string, body, out any) int {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		json.NewEncoder(&buf).Encode(body)
	}
	req, _ := http.NewRequest(method, e.URL+path, &buf)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if out != nil {
		json.NewDecoder(resp.Body).Decode(out)
	}
	return resp.StatusCode
}

func (e *env) waitFor(t *testing.T, id string, kind State) Book {
	t.Helper()
	deadline := time.Now().Add(20 * time.Second)
	var b Book
	for time.Now().Before(deadline) {
		e.do(t, "GET", "/api/books/"+id, nil, &b)
		if b.State.Kind == kind {
			return b
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("book %s: state %+v, want %s", id, b.State, kind)
	return b
}

// ---------------------------------------------------------------- tests

func TestDigitalBookImportsToReady(t *testing.T) {
	e := newEnv(t)
	var up BookChanged
	if code := e.upload(t, "linear_algebra-notes.pdf", fixturePDF(t, 3, 12, "Linear Maps"), &up); code != 201 {
		t.Fatalf("upload %d", code)
	}
	if up.Book.State.Kind != StateQueued || up.Book.Title != "linear algebra notes" {
		t.Fatalf("queued book %+v", up.Book)
	}
	b := e.waitFor(t, up.Book.ID, StateReady)
	if b.Title != "Linear Maps" || b.Author != "A. Author" || b.PageCount != 15 {
		t.Fatalf("metadata not applied: %+v", b)
	}
	if b.PageOffset != 3 {
		t.Fatalf("offset = %d, want 3", b.PageOffset)
	}
	if b.Aspect < 1.2 || b.Aspect > 1.4 {
		t.Fatalf("aspect %v", b.Aspect)
	}

	var c Contents
	e.do(t, "GET", "/api/books/"+b.ID+"/contents", nil, &c)
	if len(c.Chapters) != 3 || c.Chapters[0].Title != "Chapter 1" || c.Chapters[0].Page != 4 ||
		len(c.Chapters[0].Sections) != 1 || c.Chapters[1].Page != 8 {
		t.Fatalf("contents %+v", c)
	}

	hits, err := e.svc.Search(context.Background(), b.ID, "determinants of matrices", 3)
	if err != nil || len(hits) == 0 {
		t.Fatalf("search: %v %v", hits, err)
	}
	if text, _ := e.svc.PageText(context.Background(), b.ID, hits[0]); !strings.Contains(text, "determinants") {
		t.Fatalf("top hit p.%d: %q", hits[0], text)
	}
	if !e.events.has(EventBookChanged, `"kind":"ready"`) || !e.events.has(EventBookChanged, `"phase":"search"`) {
		t.Fatalf("events %v", e.events.events)
	}
}

func TestDuplicateAndNotAPDFAreRefused(t *testing.T) {
	e := newEnv(t)
	pdf := fixturePDF(t, 0, 4, "Dup")
	var first BookChanged
	e.upload(t, "a.pdf", pdf, &first)
	var er httpx.Error
	if code := e.upload(t, "b.pdf", pdf, &er); code != 409 || er.Code != httpx.CodeDuplicateBook || er.ID != first.Book.ID {
		t.Fatalf("duplicate: %d %+v", code, er)
	}
	if code := e.upload(t, "notes.pdf", []byte("hello, not a pdf"), &er); code != 422 || er.Field != "file" {
		t.Fatalf("not a pdf: %d %+v", code, er)
	}
	var list Books
	e.do(t, "GET", "/api/books", nil, &list)
	if len(list.Books) != 1 {
		t.Fatalf("books %d", len(list.Books))
	}
}

func TestUploadRefusedWithoutEmbeddings(t *testing.T) {
	e := newEnv(t)
	e.models.cfg = llm.Config{}
	var er httpx.Error
	if code := e.upload(t, "a.pdf", fixturePDF(t, 0, 2, "X"), &er); code != 422 || er.Code != httpx.CodeNotConfigured {
		t.Fatalf("%d %+v", code, er)
	}
}

func TestScannedBookFailsOnUnreadPagesThenRetries(t *testing.T) {
	e := newEnv(t)
	e.setOCR(func(p int) (string, error) {
		if p == 3 {
			return "", errors.New("tesseract crashed")
		}
		return fmt.Sprintf("CHAPTER %d\nWords about eigenvalues on this page.", p), nil
	})
	var up BookChanged
	e.upload(t, "scan.pdf", scannedPDF(t, 5), &up)
	b := e.waitFor(t, up.Book.ID, StateFailed)
	if !strings.Contains(b.State.Reason, "1 page couldn't be read (p. 3)") {
		t.Fatalf("reason %q", b.State.Reason)
	}

	var calls []int
	e.setOCR(func(p int) (string, error) {
		calls = append(calls, p)
		return "Now readable.", nil
	})
	e.do(t, "POST", "/api/books/"+b.ID+"/retry", nil, nil)
	e.waitFor(t, b.ID, StateReady)
	if len(calls) != 1 || calls[0] != 3 {
		t.Fatalf("retry re-read %v, want only page 3", calls)
	}
}

func TestEmbeddingFailureIsAReadableReason(t *testing.T) {
	e := newEnv(t)
	e.llm.FailEmbeddings(400)
	var up BookChanged
	e.upload(t, "a.pdf", fixturePDF(t, 0, 4, "E"), &up)
	b := e.waitFor(t, up.Book.ID, StateFailed)
	if !strings.Contains(b.State.Reason, "embeddings server stopped answering") {
		t.Fatalf("reason %q", b.State.Reason)
	}
	e.llm.FailEmbeddings(0)
	e.do(t, "POST", "/api/books/"+b.ID+"/retry", nil, nil)
	e.waitFor(t, b.ID, StateReady)
}

func TestStopQueuedThenRetry(t *testing.T) {
	e := newEnv(t)
	// Hold the lane with a slow scanned book so the next one stays queued.
	release := make(chan struct{})
	e.setOCR(func(p int) (string, error) { <-release; return "text", nil })
	var first, second BookChanged
	e.upload(t, "slow.pdf", scannedPDF(t, 2), &first)
	e.upload(t, "next.pdf", fixturePDF(t, 0, 3, "Next"), &second)
	e.waitFor(t, first.Book.ID, StatePreparing)

	var stopped Book
	e.do(t, "POST", "/api/books/"+second.Book.ID+"/stop", nil, &stopped)
	if stopped.State.Kind != StateFailed || stopped.State.Reason != "Cancelled before it started." {
		t.Fatalf("stopped %+v", stopped.State)
	}
	e.do(t, "POST", "/api/books/"+first.Book.ID+"/stop", nil, nil)
	close(release)
	if b := e.waitFor(t, first.Book.ID, StateFailed); b.State.Reason != "Stopped." {
		t.Fatalf("running stop: %+v", b.State)
	}
	e.do(t, "POST", "/api/books/"+second.Book.ID+"/retry", nil, nil)
	e.waitFor(t, second.Book.ID, StateReady)
}

// slowOCR reads a page in a few milliseconds and counts how often each
// page was read. Like Tesseract, it finishes the page it's on even when
// its job is interrupted.
func (e *env) slowOCR() (reads func() map[int]int) {
	var mu sync.Mutex
	count := map[int]int{}
	e.setOCR(func(p int) (string, error) {
		time.Sleep(5 * time.Millisecond)
		mu.Lock()
		count[p]++
		mu.Unlock()
		return fmt.Sprintf("Recognized text of page %d about eigenvalues.", p), nil
	})
	return func() map[int]int {
		mu.Lock()
		defer mu.Unlock()
		return maps.Clone(count)
	}
}

// waitRead waits until a scan has read at least n pages.
func (e *env) waitRead(t *testing.T, id string, n int) {
	t.Helper()
	deadline := time.Now().Add(20 * time.Second)
	for time.Now().Before(deadline) {
		var b Book
		e.do(t, "GET", "/api/books/"+id, nil, &b)
		if b.State.Phase == PhaseRead && b.State.Done != nil && *b.State.Done >= n {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("book %s never read %d pages", id, n)
}

func TestADigitalBookGoesAheadOfAScansReading(t *testing.T) {
	e := newEnv(t)
	reads := e.slowOCR()
	const pages = 60
	var scan, digital BookChanged
	e.upload(t, "scan.pdf", scannedPDF(t, pages), &scan)
	e.waitRead(t, scan.Book.ID, 3)

	e.upload(t, "notes.pdf", fixturePDF(t, 0, 8, "Notes"), &digital)
	d := e.waitFor(t, digital.Book.ID, StateReady)
	var mid Book
	e.do(t, "GET", "/api/books/"+scan.Book.ID, nil, &mid)
	if mid.State.Kind == StateReady || len(reads()) >= pages {
		t.Fatalf("the digital book waited for the scan: %+v, %d pages read", mid.State, len(reads()))
	}
	if d.Kind != KindDigital || mid.Kind != KindScanned {
		t.Fatalf("kinds %q, %q", d.Kind, mid.Kind)
	}
	// While it stepped aside, the scan was queued with what it had read.
	if !e.events.has(EventBookChanged, `"kind":"queued","phase":"read","done":`) {
		t.Fatal("the interrupted scan forgot its count")
	}

	e.waitFor(t, scan.Book.ID, StateReady)
	twice := 0
	for p := 1; p <= pages; p++ {
		switch n := reads()[p]; {
		case n == 0:
			t.Fatalf("page %d never read", p)
		case n > 1:
			twice++
		}
	}
	// Only the page it was on when interrupted is read again.
	if twice > 1 {
		t.Fatalf("%d pages read twice", twice)
	}
}

func TestAnInterruptedScanKeepsItsPagesThroughStopAndRetry(t *testing.T) {
	e := newEnv(t)
	reads := e.slowOCR()
	const pages = 40
	var up BookChanged
	e.upload(t, "scan.pdf", scannedPDF(t, pages), &up)
	e.waitRead(t, up.Book.ID, 5)

	// Pause interrupts it the way a shutdown does.
	e.queue.Pause()
	var b Book
	e.do(t, "GET", "/api/books/"+up.Book.ID, nil, &b)
	if b.State.Kind != StateQueued || b.State.Phase != PhaseRead || b.State.Done == nil || *b.State.Done < 5 || *b.State.Total != pages {
		t.Fatalf("interrupted: %+v", b.State)
	}
	// It has begun, so stopping it is Stopped, not Cancelled.
	var stopped Book
	e.do(t, "POST", "/api/books/"+b.ID+"/stop", nil, &stopped)
	if stopped.State.Reason != "Stopped." {
		t.Fatalf("stop: %+v", stopped.State)
	}
	e.queue.Resume()
	e.do(t, "POST", "/api/books/"+b.ID+"/retry", nil, nil)
	e.waitFor(t, b.ID, StateReady)
	for p, n := range reads() {
		if n > 2 {
			t.Fatalf("page %d read %d times", p, n)
		}
	}
	if len(reads()) != pages {
		t.Fatalf("%d of %d pages read", len(reads()), pages)
	}
}

func TestEditRemoveAndScans(t *testing.T) {
	e := newEnv(t)
	var up BookChanged
	e.upload(t, "a.pdf", fixturePDF(t, 2, 6, "Scans"), &up)
	b := e.waitFor(t, up.Book.ID, StateReady)

	var er httpx.Error
	if code := e.do(t, "PATCH", "/api/books/"+b.ID, map[string]any{"pageOffset": 99}, &er); code != 422 || er.Field != "pageOffset" {
		t.Fatalf("offset out of range: %d %+v", code, er)
	}
	if code := e.do(t, "PATCH", "/api/books/"+b.ID, map[string]any{"title": "  "}, &er); code != 422 || er.Field != "title" {
		t.Fatalf("blank title: %d %+v", code, er)
	}
	var edited Book
	e.do(t, "PATCH", "/api/books/"+b.ID, map[string]any{"title": "My Notes", "pageOffset": 1}, &edited)
	if edited.Title != "My Notes" || edited.PageOffset != 1 {
		t.Fatalf("edited %+v", edited)
	}

	resp, err := http.Get(e.URL + "/api/books/" + b.ID + "/pages/2/image?w=500")
	if err != nil {
		t.Fatal(err)
	}
	img, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != 200 || !bytes.HasPrefix(img, []byte{0xFF, 0xD8}) || !strings.Contains(resp.Header.Get("Cache-Control"), "immutable") {
		t.Fatalf("scan: %d %d bytes %q", resp.StatusCode, len(img), resp.Header.Get("Cache-Control"))
	}
	if _, err := os.Stat(filepath.Join(e.dir, "cache", "pages", b.ID, "2-600.jpg")); err != nil {
		t.Fatal("scan not cached at its bucket")
	}
	if code := e.do(t, "GET", "/api/books/"+b.ID+"/pages/99/image", nil, nil); code != 404 {
		t.Fatalf("missing page: %d", code)
	}

	if code := e.do(t, "DELETE", "/api/books/"+b.ID, nil, nil); code != 204 {
		t.Fatalf("remove %d", code)
	}
	if code := e.do(t, "GET", "/api/books/"+b.ID, nil, nil); code != 404 {
		t.Fatalf("after remove %d", code)
	}
	if _, err := os.Stat(e.svc.PDFPath(b.ID)); !os.IsNotExist(err) {
		t.Fatal("file survived removal")
	}
	if !e.events.has(EventBookRemoved, b.ID) {
		t.Fatal("no removal event")
	}
	books, pages, _ := e.svc.Count(context.Background())
	if books != 0 || pages != 0 {
		t.Fatalf("count %d %d", books, pages)
	}
}

func TestBuildContents(t *testing.T) {
	c := buildContents([]section{
		{Level: 1, Title: "Part I", StartPage: 1},
		{Level: 2, Title: "Ch 1", StartPage: 2},
		{Level: 3, Title: "1.1", StartPage: 3},
		{Level: 2, Title: "Ch 2", StartPage: 9},
	})
	if len(c.Chapters) != 1 || len(c.Chapters[0].Sections) != 2 {
		t.Fatalf("%+v", c)
	}
	if c := buildContents([]section{{Level: 1, Title: "Whole book", StartPage: 1}}); len(c.Chapters) != 0 {
		t.Fatalf("fallback section made a rail: %+v", c)
	}
}

func TestFilenameTitleAndMetaTitle(t *testing.T) {
	for in, want := range map[string]string{
		"linear_algebra-done.right.pdf": "linear algebra done right",
		"/tmp/x/Strang+4e.PDF":          "Strang 4e",
		".pdf":                          "Untitled",
	} {
		if got := filenameTitle(in); got != want {
			t.Errorf("filenameTitle(%q) = %q, want %q", in, got, want)
		}
	}
	for in, want := range map[string]string{
		"Linear Algebra":            "Linear Algebra",
		"Microsoft Word - ch1.docx": "",
		"main.pdf":                  "",
		" ":                         "",
	} {
		if got := metaTitle(in); got != want {
			t.Errorf("metaTitle(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestChapterSpan(t *testing.T) {
	secs := []section{
		{Level: 1, Title: "Preface", StartPage: 3, EndPage: 8},
		{Level: 1, Title: "Chapter 1: Experiments", StartPage: 19, EndPage: 52},
		{Level: 1, Title: "3 · Linear Maps", StartPage: 51, EndPage: 130},
		{Level: 1, Title: "Chapter 12 Markov Chains", StartPage: 400, EndPage: 450},
	}
	for n, want := range map[int][2]int{1: {19, 52}, 3: {51, 130}, 12: {400, 450}} {
		a, b, ok := chapterSpan(secs, n)
		if !ok || a != want[0] || b != want[1] {
			t.Errorf("chapter %d: %d-%d %v", n, a, b, ok)
		}
	}
	if _, _, ok := chapterSpan(secs, 2); ok {
		t.Error("chapter 2 isn't in the contents")
	}
}
