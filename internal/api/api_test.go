package api

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jackt/pset/internal/engine"
)

func TestHealth(t *testing.T) {
	env := newTestEnvWithoutRunner(t)
	rec := do(t, env.handler, "GET", "/api/health", nil)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("content-type = %q, want application/json", ct)
	}
	var body struct {
		Status           string `json:"status"`
		Version          string `json:"version"`
		DatabasePath     string `json:"databasePath"`
		LibraryDirectory string `json:"libraryDirectory"`
	}
	decode(t, rec, &body)
	if body.Status != "ok" || body.Version != "test" {
		t.Errorf("body = %+v, want status ok and version test", body)
	}
	// The paths follow the engine's --db, not the tilde defaults: the
	// settings page renders these verbatim.
	if want := env.engine.DBPath(); body.DatabasePath != want {
		t.Errorf("databasePath = %q, want %q", body.DatabasePath, want)
	}
	if want := env.engine.LibraryDir(); body.LibraryDirectory != want {
		t.Errorf("libraryDirectory = %q, want %q", body.LibraryDirectory, want)
	}
}

func TestUnknownAPIRouteIsJSON(t *testing.T) {
	rec := do(t, newTestServer(t), "GET", "/api/nope", nil)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("content-type = %q, want application/json", ct)
	}
}

// --- helpers -----------------------------------------------------------------

const sampleDir = "../../testdata"

func samplePath(name string) string { return filepath.Join(sampleDir, name) }

type testEnv struct {
	t       *testing.T
	handler http.Handler
	engine  *engine.Engine
	runner  *engine.Runner
	started bool
}

func newEnv(t *testing.T, startRunner bool) *testEnv {
	t.Helper()
	dir, err := os.MkdirTemp(t.TempDir(), "env-")
	if err != nil {
		t.Fatal(err)
	}
	eng, err := engine.New(engine.Config{DBPath: filepath.Join(dir, "data", "pset.db")})
	if err != nil {
		t.Fatal(err)
	}
	// Embeddings are a platform requirement: the env's engine gets a fake
	// endpoint so imports and asks run their semantic halves.
	if err := eng.SaveConfig(context.Background(), engine.Settings{
		APIBaseURL:   engine.DefaultAPIBaseURL,
		EmbedBaseURL: fakeEmbedServer(t),
		EmbedModel:   engine.DefaultEmbedModel,
	}); err != nil {
		t.Fatal(err)
	}
	env := &testEnv{t: t, handler: New("test", eng).Handler(), engine: eng, started: startRunner}
	env.runner = engine.NewRunner(eng)
	if startRunner {
		ctx, cancel := context.WithCancel(t.Context())
		go env.runner.Run(ctx)
		t.Cleanup(func() { cancel(); <-env.runner.Done() })
	}
	return env
}

func newTestEnv(t *testing.T) *testEnv {
	t.Helper()
	return newEnv(t, true)
}

func newTestEnvWithoutRunner(t *testing.T) *testEnv {
	t.Helper()
	return newEnv(t, false)
}

func newTestServer(t *testing.T) http.Handler {
	t.Helper()
	return newTestEnv(t).handler
}

// fakeEmbedServer answers embeddings requests with fixed vectors — the
// endpoint the platform requires, scripted for tests.
func fakeEmbedServer(t *testing.T) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Input []string `json:"input"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		data := make([]map[string]any, len(req.Input))
		for i := range req.Input {
			data[i] = map[string]any{"index": i, "embedding": []float32{0.1, 0.2, 0.3, 0.4}}
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"data": data})
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

func requirePoppler(t *testing.T) {
	t.Helper()
	for _, tool := range []string{"pdfinfo", "pdftotext"} {
		if _, err := exec.LookPath(tool); err != nil {
			t.Skipf("%s not installed, skipping: %v", tool, err)
		}
	}
}

func requireTesseract(t *testing.T) {
	t.Helper()
	if _, err := exec.LookPath("tesseract"); err != nil {
		t.Skipf("tesseract not installed, skipping: %v", err)
	}
}

func requirePdftohtml(t *testing.T) {
	t.Helper()
	if _, err := exec.LookPath("pdftohtml"); err != nil {
		t.Skipf("pdftohtml not installed, skipping: %v", err)
	}
}

// do performs a request with an optional JSON body and returns the recorder.
func do(t *testing.T, h http.Handler, method, target string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var raw string
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		raw = string(b)
	}
	return doRaw(t, h, method, target, raw)
}

func doRaw(t *testing.T, h http.Handler, method, target, body string) *httptest.ResponseRecorder {
	t.Helper()
	var rd io.Reader
	if body != "" {
		rd = strings.NewReader(body)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(method, target, rd))
	return rec
}

// doUpload posts a multipart form with one file part.
func doUpload(t *testing.T, h http.Handler, field, filename string, data []byte) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	fw, err := w.CreateFormFile(field, filename)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := fw.Write(data); err != nil {
		t.Fatal(err)
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("POST", "/api/import", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func decode(t *testing.T, rec *httptest.ResponseRecorder, v any) {
	t.Helper()
	if err := json.Unmarshal(rec.Body.Bytes(), v); err != nil {
		t.Fatalf("decode body %q: %v", rec.Body.String(), err)
	}
}

type apiBook struct {
	SHA256      string          `json:"sha256"`
	Title       string          `json:"title"`
	Author      string          `json:"author"`
	Subject     string          `json:"subject"`
	PageCount   int             `json:"pageCount"`
	Ready       bool            `json:"ready"`
	Readiness   apiReadiness    `json:"readiness"`
	FailedPages []apiFailedPage `json:"failedPages"`
	Task        *apiTask        `json:"task"`
	Kind        string          `json:"kind"`
	PDFVersion  string          `json:"pdfVersion"`
	PageWidth   float64         `json:"pageWidth"`
	PageHeight  float64         `json:"pageHeight"`
	FileSize    int64           `json:"fileSize"`
	OriginPath  string          `json:"originPath"`
	LibraryPath string          `json:"libraryPath"`
	ImportedAt  time.Time       `json:"importedAt"`
}

type apiSection struct {
	SortOrder int    `json:"sortOrder"`
	Level     int    `json:"level"`
	Title     string `json:"title"`
	Source    string `json:"source"`
	StartPage int    `json:"startPage"`
	EndPage   int    `json:"endPage"`
}

type apiReadiness struct {
	PagesStored int    `json:"pagesStored"`
	PagesFailed int    `json:"pagesFailed"`
	Sections    int    `json:"sections"`
	Vectors     int    `json:"vectors"`
	Missing     string `json:"missing"`
}

type apiFailedPage struct {
	Page  int    `json:"page"`
	Error string `json:"error"`
}

type apiPhase struct {
	ID         string     `json:"id"`
	TaskID     string     `json:"taskId"`
	Key        string     `json:"key"`
	Name       string     `json:"name"`
	Status     string     `json:"status"`
	Done       int        `json:"done"`
	Total      int        `json:"total"`
	Note       string     `json:"note"`
	Error      *string    `json:"error"`
	EtaSeconds *float64   `json:"etaSeconds"`
	CreatedAt  time.Time  `json:"createdAt"`
	StartedAt  *time.Time `json:"startedAt"`
	FinishedAt *time.Time `json:"finishedAt"`
}

type apiTask struct {
	ID         string     `json:"id"`
	Kind       string     `json:"kind"`
	Status     string     `json:"status"`
	BookID     *string    `json:"bookId"`
	HomeworkID *string    `json:"homeworkId"`
	Title      string     `json:"title"`
	Phases     []apiPhase `json:"phases"`
	FailKind   *string    `json:"failKind"`
	Retryable  bool       `json:"retryable"`
	Error      *string    `json:"error"`
	CreatedAt  time.Time  `json:"createdAt"`
	StartedAt  *time.Time `json:"startedAt"`
	FinishedAt *time.Time `json:"finishedAt"`
}

// phase returns the task's phase with the given key.
func (j apiTask) phase(t *testing.T, key string) apiPhase {
	t.Helper()
	for _, ph := range j.Phases {
		if ph.Key == key {
			return ph
		}
	}
	t.Fatalf("task %s has no phase %q (keys: %v)", j.ID, key, j.phaseKeys())
	return apiPhase{}
}

func (j apiTask) phaseKeys() []string {
	out := make([]string, 0, len(j.Phases))
	for _, ph := range j.Phases {
		out = append(out, ph.Key)
	}
	return out
}

// engineSettingsWithoutEmbed is a connection with chat but no embeddings
// endpoint — the fresh-install shape the import preflight refuses.
func engineSettingsWithoutEmbed() engine.Settings {
	return engine.Settings{APIBaseURL: engine.DefaultAPIBaseURL, APIKey: "k", EmbedModel: engine.DefaultEmbedModel}
}

// apiError is the shape every failed request answers with.
type apiError struct {
	Error string `json:"error"`
}
