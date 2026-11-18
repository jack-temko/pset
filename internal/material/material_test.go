package material

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
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

	"github.com/jackt/pset/internal/action"
	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/execx"
	"github.com/jackt/pset/internal/library"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/llm/llmtest"
	"github.com/jackt/pset/internal/runner"
	"github.com/jackt/pset/internal/step"
	"github.com/jackt/pset/internal/store"
	"github.com/jackt/pset/internal/testx"
)

var bg = context.Background()

func needPoppler(t *testing.T) {
	t.Helper()
	for _, tool := range []string{"pdfinfo", "pdftotext", "pdftohtml", "pdftoppm"} {
		if _, err := exec.LookPath(tool); err != nil {
			t.Skip("poppler not installed")
		}
	}
}

// env is a store with one course, c1, the catalog and runner over it, a
// fake model and embedder, and a fake OCR the test can steer.
type env struct {
	t       *testing.T
	s       *store.Store
	c       *action.Catalog
	r       *runner.Runner
	svc     *Service
	model   *llmtest.Server
	mu      sync.Mutex
	ocr     func(ctx context.Context, page int) (string, error)
	ocrRuns map[int]int
	stop    func()
}

func newEnv(t *testing.T) *env {
	t.Helper()
	needPoppler(t)
	dir := t.TempDir()
	s, err := store.Open(bg, filepath.Join(dir, "store.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cleanup.Close(s.DB) })
	if err := s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		_, err := tx.Exec(`INSERT INTO courses (id, name, created_at) VALUES ('c1', 'ECE 210', ?)`, db.Now())
		return err
	}); err != nil {
		t.Fatal(err)
	}
	e := &env{t: t, s: s, model: llmtest.New(t), ocrRuns: map[int]int{}}
	// Naming and the contents read nothing unless a test says otherwise.
	e.model.Fallback(func(llm.ChatRequest) llmtest.Reply { return llmtest.Reply{Text: "{}"} })
	e.ocr = func(_ context.Context, page int) (string, error) {
		return fmt.Sprintf("Recognized text of page %d about eigenvalues and kettles.\n%d", page, page), nil
	}
	tools := library.LiveTools()
	tools.OCR = func(ctx context.Context, _ string, page int) (string, error) {
		e.mu.Lock()
		fn := e.ocr
		e.ocrRuns[page]++
		e.mu.Unlock()
		return fn(ctx, page)
	}
	e.c = action.New(s)
	e.r = runner.New(s, runner.Options{
		Key:     func(context.Context) (string, error) { return "test", nil },
		BaseURL: e.model.URL, DataDir: dir,
	})
	e.r.Backoff = []time.Duration{10 * time.Millisecond}
	embed := llm.New("", "", e.model.URL, "fake-embed")
	e.svc = New(Config{
		Store: s, Actions: e.c, Runner: e.r, DataDir: dir, Tools: tools,
		ChatModel: "fake-chat", Embed: embed.Embed, EmbedModel: "fake-embed",
	})
	return e
}

func (e *env) setOCR(fn func(context.Context, int) (string, error)) {
	e.mu.Lock()
	e.ocr = fn
	e.mu.Unlock()
}

// start runs the runner until the returned stop, which waits for it.
func (e *env) start() {
	ctx, cancel := context.WithCancel(bg)
	done := make(chan struct{})
	go func() {
		if err := e.r.Run(ctx); err != nil {
			e.t.Error(err)
		}
		close(done)
	}()
	var once sync.Once
	e.stop = func() { once.Do(func() { cancel(); <-done }) }
	e.t.Cleanup(e.stop)
}

// add stages a sample PDF and adds it to c1, returning the material's id.
func (e *env) add(sample string) string {
	e.t.Helper()
	f, err := os.Open(filepath.Join("..", "..", "testdata", sample))
	if err != nil {
		e.t.Fatal(err)
	}
	defer cleanup.Close(f)
	up, err := e.svc.Stage(f, sample)
	if err != nil {
		e.t.Fatal(err)
	}
	in, err := json.Marshal(Add{CourseID: "c1", UploadID: up.ID})
	if err != nil {
		e.t.Fatal(err)
	}
	done, err := e.c.Run(bg, "material.add", in)
	if err != nil {
		e.t.Fatal(err)
	}
	return done.ID
}

// wait polls until the material's step is in state.
func (e *env) wait(id string, name step.Name, state step.State) step.Step {
	e.t.Helper()
	deadline := time.Now().Add(20 * time.Second)
	for {
		steps, err := e.r.Steps(bg, change.ResourceMaterial, id)
		if err != nil {
			e.t.Fatal(err)
		}
		for _, st := range steps {
			if st.Name == name {
				if st.State == state {
					return st
				}
				if time.Now().After(deadline) {
					e.t.Fatalf("%s is %s, want %s", name, st.State, state)
				}
			}
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func (e *env) count(q string, args ...any) int {
	e.t.Helper()
	var n int
	if err := e.s.DB.QueryRow(q, args...).Scan(&n); err != nil {
		e.t.Fatal(err)
	}
	return n
}

// A digital PDF is read in by its five steps: its title from its metadata,
// its pages from its text layer, contents, numbering, and search over its
// words and vectors.
func TestADigitalMaterialIsReadIn(t *testing.T) {
	e := newEnv(t)
	e.start()
	id := e.add("sample-digital.pdf")
	e.wait(id, step.NameSearch, step.StateDone)
	m, err := e.svc.Get(bg, id)
	if err != nil {
		t.Fatal(err)
	}
	if m.Title != "Foundations of Brontolithics" || m.PageCount != 6 || m.Aspect <= 0 || m.Progress != nil || len(m.Steps) != 5 {
		t.Fatalf("material %+v", m)
	}
	for _, st := range m.Steps {
		if st.State != step.StateDone {
			t.Fatalf("step %s is %s", st.Name, st.State)
		}
	}
	if n := e.count(`SELECT count(*) FROM pages WHERE material_id = ?`, id); n != 6 {
		t.Fatalf("%d pages stored", n)
	}
	c, err := e.svc.Contents(bg, id)
	if err != nil || len(c.Entries) == 0 {
		t.Fatalf("contents %+v (%v)", c, err)
	}
	if n := e.count(`SELECT count(*) FROM embeddings WHERE material_id = ?`, id); n == 0 {
		t.Fatal("no page was given a vector")
	}
	hits, err := e.svc.Search(bg, id, "kettle array", 3)
	if err != nil || len(hits) == 0 {
		t.Fatalf("search %v (%v)", hits, err)
	}
	img, err := e.svc.PageImage(bg, id, 1, 600)
	if err != nil || len(img) < 100 {
		t.Fatalf("page image: %d bytes (%v)", len(img), err)
	}
	if _, err := e.svc.PageImage(bg, id, 7, 600); !errors.Is(err, errs.Gone) {
		t.Fatalf("a page past the end: %v", err)
	}
	if e.ocrCount() != 0 {
		t.Fatal("a digital material was sent to OCR")
	}
}

func (e *env) ocrCount() int {
	e.mu.Lock()
	defer e.mu.Unlock()
	n := 0
	for _, c := range e.ocrRuns {
		n += c
	}
	return n
}

// A scan's pages are recognized one by one.
func TestAScanIsRecognizedPageByPage(t *testing.T) {
	e := newEnv(t)
	e.start()
	id := e.add("sample-scanned.pdf")
	e.wait(id, step.NameSearch, step.StateDone)
	m, err := e.svc.Get(bg, id)
	if err != nil {
		t.Fatal(err)
	}
	if e.ocrCount() != m.PageCount || e.count(`SELECT pages_read FROM materials WHERE id = ?`, id) != m.PageCount {
		t.Fatalf("%d pages recognized of %d", e.ocrCount(), m.PageCount)
	}
	if text, err := e.svc.PageText(bg, id, 2); err != nil || text == "" {
		t.Fatalf("page 2's text %q (%v)", text, err)
	}
}

// A scan's pages are read several at once, as many as there are workers and
// no more, and every page is kept.
func TestAScanIsReadSeveralPagesAtOnce(t *testing.T) {
	e := newEnv(t)
	e.svc.c.OCRWorkers = 3
	var mu sync.Mutex
	var now, most int
	e.setOCR(func(_ context.Context, page int) (string, error) {
		mu.Lock()
		now++
		most = max(most, now)
		mu.Unlock()
		time.Sleep(50 * time.Millisecond)
		mu.Lock()
		now--
		mu.Unlock()
		return fmt.Sprintf("page %d text", page), nil
	})
	e.start()
	id := e.add("sample-scanned.pdf")
	e.wait(id, step.NameReadPages, step.StateDone)
	mu.Lock()
	got := most
	mu.Unlock()
	if got != 3 {
		t.Fatalf("at most %d pages were read at once, want 3", got)
	}
	if n := e.count(`SELECT count(*) FROM pages WHERE material_id = ? AND status = 'text'`, id); n != 6 {
		t.Fatalf("%d of 6 pages kept", n)
	}
}

// Killed while it reads a scan, it resumes where it stopped on the next
// start: the pages already read are not read again.
func TestReadingAScanResumesAfterAKill(t *testing.T) {
	e := newEnv(t)
	entered := make(chan struct{})
	var once sync.Once
	e.setOCR(func(ctx context.Context, page int) (string, error) {
		if page == 3 {
			once.Do(func() { close(entered) })
			<-ctx.Done() // until killed, as tesseract is
			return "", ctx.Err()
		}
		return fmt.Sprintf("page %d text", page), nil
	})
	e.start()
	id := e.add("sample-scanned.pdf")
	<-entered
	// Killed while it reads page 3: the step goes back to waiting.
	e.stop()
	e.waitState(id, step.NameReadPages, step.StateWaiting)

	e.setOCR(func(_ context.Context, page int) (string, error) { return fmt.Sprintf("page %d text", page), nil })
	e.r = runner.New(e.s, runner.Options{
		Key:     func(context.Context) (string, error) { return "test", nil },
		BaseURL: e.model.URL,
	})
	e.r.Add(e.svc.pipeline())
	e.svc.c.Runner = e.r
	e.start()
	e.wait(id, step.NameSearch, step.StateDone)
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.ocrRuns[1] != 1 || e.ocrRuns[2] != 1 {
		t.Fatalf("pages read before the kill were read again: %v", e.ocrRuns)
	}
}

// waitState is wait, reading the steps table directly: for a runner that
// has stopped.
func (e *env) waitState(id string, name step.Name, state step.State) {
	e.t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		if e.count(`SELECT count(*) FROM steps WHERE subject_id = ? AND name = ? AND state = ?`, id, name, state) == 1 {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	e.t.Fatalf("%s never became %s", name, state)
}

// A page the reader chokes on fails the step with the list; Try again reads
// only what failed.
func TestAPageThatFailsIsReadAgainAlone(t *testing.T) {
	e := newEnv(t)
	var fail sync.Map
	fail.Store(4, true)
	e.setOCR(func(_ context.Context, page int) (string, error) {
		if _, ok := fail.Load(page); ok {
			return "", errors.New("tesseract: bad page")
		}
		return fmt.Sprintf("page %d text", page), nil
	})
	e.start()
	id := e.add("sample-scanned.pdf")
	failed := e.wait(id, step.NameReadPages, step.StateFailed)
	var why string
	if err := e.s.DB.QueryRow(`SELECT json_extract(error, '$.id') FROM incidents WHERE id = ?`, failed.IncidentID).Scan(&why); err != nil || why != "material.pages_unread" {
		t.Fatalf("the failure is %q (%v)", why, err)
	}
	fail.Delete(4)
	if err := e.r.TryAgain(bg, failed.IncidentID); err != nil {
		t.Fatal(err)
	}
	e.wait(id, step.NameSearch, step.StateDone)
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.ocrRuns[4] != 2 || e.ocrRuns[1] != 1 {
		t.Fatalf("Try again read %v, want page 4 again and nothing else", e.ocrRuns)
	}
}

// With no scan reader installed, reading a scan waits on it.
func TestAScanWaitsForTheReader(t *testing.T) {
	e := newEnv(t)
	e.setOCR(func(context.Context, int) (string, error) { return "", &execx.NotInstalledError{Name: "tesseract"} })
	e.start()
	id := e.add("sample-scanned.pdf")
	deadline := time.Now().Add(10 * time.Second)
	for e.count(`SELECT count(*) FROM incidents WHERE clears = 'scan_reader' AND state = 'open'`) == 0 {
		if time.Now().After(deadline) {
			t.Fatal("reading never waited on the scan reader")
		}
		time.Sleep(10 * time.Millisecond)
	}
	if st := e.wait(id, step.NameReadPages, step.StateWaiting); st.IncidentID == "" {
		t.Fatalf("read pages is %+v", st)
	}
}

// Removing a material while it is read in pauses it; undoing the removal
// lets it carry on.
func TestRemovingAMaterialPausesItsReading(t *testing.T) {
	e := newEnv(t)
	gate := make(chan struct{})
	entered := make(chan struct{})
	var once sync.Once
	e.setOCR(func(_ context.Context, page int) (string, error) {
		once.Do(func() { close(entered) })
		select {
		case <-gate:
		case <-time.After(200 * time.Millisecond):
		}
		return fmt.Sprintf("page %d", page), nil
	})
	e.start()
	id := e.add("sample-scanned.pdf")
	<-entered
	in, err := json.Marshal(Remove{ID: id})
	if err != nil {
		t.Fatal(err)
	}
	done, err := e.c.Run(bg, "material.remove", in)
	if err != nil {
		t.Fatal(err)
	}
	e.r.Wake()
	e.wait(id, step.NameReadPages, step.StateWaiting)
	if _, err := e.c.Undo(bg, done.Action, false); err != nil {
		t.Fatal(err)
	}
	close(gate)
	e.r.Wake()
	e.wait(id, step.NameSearch, step.StateDone)
}

// With Ollama down, search waits on embeddings; everything before it is
// done.
func TestSearchWaitsForTheEmbedder(t *testing.T) {
	e := newEnv(t)
	e.model.FailEmbeddings(500)
	e.start()
	id := e.add("sample-digital.pdf")
	st := e.wait(id, step.NameSearch, step.StateWaiting)
	deadline := time.Now().Add(10 * time.Second)
	for st.IncidentID == "" && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
		st = e.wait(id, step.NameSearch, step.StateWaiting)
	}
	var clears string
	if err := e.s.DB.QueryRow(`SELECT clears FROM incidents WHERE id = ?`, st.IncidentID).Scan(&clears); err != nil || clears != "embeddings" {
		t.Fatalf("search waits on %q (%v)", clears, err)
	}
	// Words still search.
	if hits, err := e.svc.Search(bg, id, "kettle array", 3); err != nil || len(hits) == 0 {
		t.Fatalf("search by words alone: %v (%v)", hits, err)
	}
}

// The same file twice in one course is refused, naming the one it has.
func TestTheSameFileTwiceIsRefused(t *testing.T) {
	e := newEnv(t)
	first := e.add("sample-flat.pdf")
	f, err := os.Open(filepath.Join("..", "..", "testdata", "sample-flat.pdf"))
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup.Close(f)
	up, err := e.svc.Stage(f, "again.pdf")
	if err != nil {
		t.Fatal(err)
	}
	in, err := json.Marshal(Add{CourseID: "c1", UploadID: up.ID})
	if err != nil {
		t.Fatal(err)
	}
	_, err = e.c.Run(bg, "material.add", in)
	if !errors.Is(err, duplicate) || errs.Resolve(err).Ref != first {
		t.Fatalf("the same file again: %v (%+v)", err, errs.Resolve(err))
	}
	// The refused upload is kept, to add elsewhere.
	if _, err := os.Stat(e.svc.staged(up.ID)); err != nil {
		t.Fatalf("the refused upload was lost: %v", err)
	}
}

func TestAFileThatIsntAPDFIsRefused(t *testing.T) {
	e := newEnv(t)
	_, err := e.svc.Stage(stringsReader("hello"), "notes.txt")
	if !errors.Is(err, notPDF) || errs.Resolve(err).Field != "file" {
		t.Fatalf("a text file: %v", err)
	}
}

func stringsReader(s string) *strings.Reader { return strings.NewReader(s) }

// The first material that numbers its problems is the textbook; a later one
// is not, unless the first was removed.
func TestTheFirstMaterialWithProblemsIsTheTextbook(t *testing.T) {
	e := newEnv(t)
	claim := func(id string) {
		t.Helper()
		if err := e.s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error { return claimTextbook(bg, tx, id) }); err != nil {
			t.Fatal(err)
		}
	}
	textbook := func(id string) bool {
		return e.count(`SELECT textbook FROM materials WHERE id = ?`, id) == 1
	}
	if err := e.s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		for _, id := range []string{"m1", "m2", "m3"} {
			if _, err := tx.Exec(`INSERT INTO materials (id, course_id, title, added_at) VALUES (?, 'c1', ?, ?)`, id, id, db.Now()); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	claim("m1")
	claim("m2")
	if !textbook("m1") || textbook("m2") {
		t.Fatal("the second material with problems took the textbook from the first")
	}
	if err := e.s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		_, err := tx.Exec(`UPDATE materials SET removed_at = ? WHERE id = 'm1'`, db.Now())
		return err
	}); err != nil {
		t.Fatal(err)
	}
	// A removed textbook still counts until it is purged: undoing its
	// removal never leaves two.
	claim("m3")
	if textbook("m3") {
		t.Fatal("with the textbook only removed, another material took it")
	}
}

// The routes: an upload staged by multipart, then the course's list, a
// material's contents and a page image, over HTTP.
func TestTheRoutes(t *testing.T) {
	e := newEnv(t)
	e.start()
	mux := http.NewServeMux()
	e.svc.Routes(mux)
	srv := httptest.NewServer(mux)
	defer srv.Close()

	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, err := mw.CreateFormFile("file", "sample-digital.pdf")
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join("..", "..", "testdata", "sample-digital.pdf"))
	if err != nil {
		t.Fatal(err)
	}
	testx.Check(t, testx.Err(fw.Write(data)))
	cleanup.Close(mw)
	resp, err := http.Post(srv.URL+"/api/uploads", mw.FormDataContentType(), &body)
	if err != nil {
		t.Fatal(err)
	}
	var up Upload
	testx.Check(t, json.NewDecoder(resp.Body).Decode(&up))
	cleanup.Close(resp.Body)
	if resp.StatusCode != http.StatusCreated || up.ID == "" || up.Name != "sample-digital.pdf" {
		t.Fatalf("upload %d %+v", resp.StatusCode, up)
	}
	in, err := json.Marshal(Add{CourseID: "c1", UploadID: up.ID})
	if err != nil {
		t.Fatal(err)
	}
	done, err := e.c.Run(bg, "material.add", in)
	if err != nil {
		t.Fatal(err)
	}
	e.wait(done.ID, step.NameSearch, step.StateDone)

	get := func(path string, out any) *http.Response {
		t.Helper()
		resp, err := http.Get(srv.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		if out != nil {
			testx.Check(t, json.NewDecoder(resp.Body).Decode(out))
		}
		cleanup.Close(resp.Body)
		return resp
	}
	var list Materials
	get("/api/courses/c1/materials", &list)
	if len(list.Materials) != 1 || list.Materials[0].ID != done.ID || len(list.Materials[0].Steps) != 5 {
		t.Fatalf("the course's materials %+v", list)
	}
	var c Contents
	get("/api/materials/"+done.ID+"/contents", &c)
	if c.MaterialID != done.ID || len(c.Entries) == 0 {
		t.Fatalf("contents %+v", c)
	}
	img := get("/api/materials/"+done.ID+"/pages/2/image?w=600", nil)
	if img.StatusCode != http.StatusOK || img.Header.Get("Content-Type") != "image/jpeg" || img.Header.Get("Cache-Control") == "" {
		t.Fatalf("page image %d %v", img.StatusCode, img.Header)
	}
	if r := get("/api/materials/"+done.ID+"/pages/x/image", nil); r.StatusCode != http.StatusNotFound {
		t.Fatalf("a page that isn't a number: %d", r.StatusCode)
	}
}

// redo marks a material's done steps waiting, as a kill between a step's
// write and its being marked done leaves one, and waits for them to finish.
func (e *env) redo(id string, names ...step.Name) {
	e.t.Helper()
	if err := e.s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		for _, n := range names {
			if _, err := tx.Exec(`UPDATE steps SET state = 'waiting' WHERE subject_id = ? AND name = ?`, id, n); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		e.t.Fatal(err)
	}
	e.r.Wake()
	for _, n := range names {
		e.wait(id, n, step.StateDone)
	}
}

// Every step runs again safely: examine and contents write over what they
// wrote, deleting nothing, and a scan keeps the pages it read.
func TestStepsRunAgainSafely(t *testing.T) {
	e := newEnv(t)
	e.start()
	digital := e.add("sample-digital.pdf")
	scan := e.add("sample-scanned.pdf")
	e.wait(digital, step.NameSearch, step.StateDone)
	e.wait(scan, step.NameSearch, step.StateDone)
	before, err := e.svc.Contents(bg, digital)
	if err != nil {
		t.Fatal(err)
	}
	e.redo(digital, step.NameExamine, step.NameContents, step.NameNumbering, step.NameSearch)
	e.redo(scan, step.NameExamine)
	after, err := e.svc.Contents(bg, digital)
	if err != nil {
		t.Fatal(err)
	}
	if b, a := fmt.Sprint(before), fmt.Sprint(after); a != b {
		t.Fatalf("contents changed when read again:\n%s\n%s", b, a)
	}
	if n := e.count(`SELECT count(*) FROM pages WHERE material_id = ?`, digital); n != 6 {
		t.Fatalf("%d pages after examine ran again", n)
	}
	if n := e.count(`SELECT pages_read FROM materials WHERE id = ?`, scan); n != 6 {
		t.Fatalf("a scan examined again says %d pages read", n)
	}
	// Fewer sections on a read again: the extra are retired, then purged.
	if err := e.s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		return saveSections(bg, tx, digital, []library.Section{{Level: 1, Title: "Whole book", StartPage: 1, EndPage: 6}})
	}); err != nil {
		t.Fatal(err)
	}
	if c, err := e.svc.Contents(bg, digital); err != nil || len(c.Entries) != 1 || c.Entries[0].Title != "Whole book" {
		t.Fatalf("contents after fewer sections: %+v (%v)", c, err)
	}
	if err := e.s.Purge(bg, time.Now()); err != nil {
		t.Fatal(err)
	}
	if n := e.count(`SELECT count(*) FROM sections WHERE material_id = ?`, digital); n != 1 {
		t.Fatalf("%d sections after the purge, want the one", n)
	}
	// More sections, at new depths, over the ids kept: each nests under its
	// own parent.
	deeper := []library.Section{
		{Level: 1, Title: "Part I", StartPage: 1, EndPage: 4},
		{Level: 2, Title: "Chapter 1", StartPage: 1, EndPage: 2},
		{Level: 3, Title: "1.1 Kettles", StartPage: 2, EndPage: 2},
		{Level: 1, Title: "Part II", StartPage: 5, EndPage: 6},
		{Level: 2, Title: "Chapter 2", StartPage: 5, EndPage: 6},
	}
	if err := e.s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error { return saveSections(bg, tx, digital, deeper) }); err != nil {
		t.Fatal(err)
	}
	c, err := e.svc.Contents(bg, digital)
	if err != nil {
		t.Fatal(err)
	}
	if len(c.Entries) != 2 || c.Entries[0].Title != "Part I" || len(c.Entries[0].Children) != 1 ||
		c.Entries[0].Children[0].Title != "Chapter 1" || len(c.Entries[0].Children[0].Children) != 1 ||
		c.Entries[0].Children[0].Children[0].Title != "1.1 Kettles" ||
		len(c.Entries[1].Children) != 1 || c.Entries[1].Children[0].Title != "Chapter 2" {
		t.Fatalf("the deeper contents nest as %+v", c)
	}
}

// A rename holds: neither the file's own title nor the one read off its
// first pages writes over it.
func TestARenameHoldsAgainstReadingTheTitle(t *testing.T) {
	e := newEnv(t)
	e.model.Fallback(func(llm.ChatRequest) llmtest.Reply {
		return llmtest.Reply{Text: `{"title":"Foundations of Brontolithics","authors":["Voss"]}`}
	})
	id := e.add("sample-digital.pdf")
	in, err := json.Marshal(Rename{ID: id, Title: "My thunder notes"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := e.c.Run(bg, "material.rename", in); err != nil {
		t.Fatal(err)
	}
	e.start()
	e.wait(id, step.NameSearch, step.StateDone)
	if m, err := e.svc.Get(bg, id); err != nil || m.Title != "My thunder notes" {
		t.Fatalf("after reading it in, the title is %q (%v)", m.Title, err)
	}
}

// An upload id that names anything but an upload is refused before any
// file is touched.
func TestAnUploadIDIsOnlyAnUploads(t *testing.T) {
	e := newEnv(t)
	for _, id := range []string{"", "../store", "..", "a/b", `a\b`, "nope"} {
		in, err := json.Marshal(Add{CourseID: "c1", UploadID: id})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := e.c.Run(bg, "material.add", in); !errors.Is(err, uploadGone) {
			t.Errorf("upload id %q: %v", id, err)
		}
	}
}

// The sweep drops a file no material names once it is a minute old, and an
// upload once it is a day old; younger ones may be in the middle of being
// added.
func TestTheSweep(t *testing.T) {
	e := newEnv(t)
	kept := e.add("sample-flat.pdf")
	dir := e.svc.filesDir()
	old := time.Now().Add(-2 * time.Minute)
	for _, f := range []string{"orphan.pdf", "young.pdf"} {
		if err := os.WriteFile(filepath.Join(dir, f), []byte("%PDF-"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	testx.Check(t, os.Chtimes(filepath.Join(dir, "orphan.pdf"), old, old))
	testx.Check(t, os.Chtimes(e.svc.path(kept), old, old))
	f, err := os.Open(filepath.Join("..", "..", "testdata", "sample-digital.pdf"))
	if err != nil {
		t.Fatal(err)
	}
	up, err := e.svc.Stage(f, "x.pdf")
	cleanup.Close(f)
	if err != nil {
		t.Fatal(err)
	}
	stale := time.Now().Add(-25 * time.Hour)
	testx.Check(t, os.Chtimes(e.svc.staged(up.ID), stale, stale))
	testx.Check(t, e.svc.Sweep(bg))
	exists := func(p string) bool { _, err := os.Stat(p); return err == nil }
	if exists(filepath.Join(dir, "orphan.pdf")) || !exists(filepath.Join(dir, "young.pdf")) || !exists(e.svc.path(kept)) {
		t.Fatal("the sweep took the wrong files")
	}
	if exists(e.svc.staged(up.ID)) {
		t.Fatal("an upload a day old was kept")
	}
}
