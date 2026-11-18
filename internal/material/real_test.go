package material

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackt/pset/internal/action"
	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/library"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/runner"
	"github.com/jackt/pset/internal/step"
	"github.com/jackt/pset/internal/store"
)

// TestARealPDFIsReadIn is track 4's done-when on a real file (ideas/
// backend-courses.md): a real textbook or scan is read in with poppler,
// tesseract, the local Ollama and a real model; the runner is killed part
// way and a new one resumes it; then it is searched. It costs a few cents
// and needs the eval key, so it runs only when PSET_REAL_PDF and
// PSET_EVAL_KEY are set (never the key in a real library).
//
//	PSET_REAL_PDF       the PDF to read in
//	PSET_EVAL_KEY       an OpenRouter key, for naming and the contents
//	PSET_REAL_QUERIES   searches, separated by |, each logged with its pages
//	PSET_REAL_KILL      how long the first runner runs before it is killed
//	                    (a Go duration, default 20s; 0 runs it to the end)
//	PSET_REAL_NO_EMBED  set to 1 to search by words alone, with no Ollama
//	PSET_REAL_WAIT      how long to wait for the import (a Go duration,
//	                    default 6h: a long scan on a slow machine)
//	PSET_REAL_WORKERS   pages of a scan read at once (default: half the
//	                    cores, one to four)
//	PSET_REAL_OUT       a folder to write contents.json into, the whole
//	                    contents (the log shows only the top level)
//
// Run it with -v and a -timeout above PSET_REAL_WAIT: it logs what each
// step did and how long it took, the pages read every minute, and its
// summary even when it gives up waiting; that is the measurement. It fails
// only when the import did not finish, failed, or read a page again after
// the kill.
func TestARealPDFIsReadIn(t *testing.T) {
	path, key := os.Getenv("PSET_REAL_PDF"), os.Getenv("PSET_EVAL_KEY")
	if path == "" || key == "" {
		t.Skip("set PSET_REAL_PDF and PSET_EVAL_KEY to read a real PDF in")
	}
	wait := 6 * time.Hour
	if v := os.Getenv("PSET_REAL_WAIT"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			t.Fatalf("PSET_REAL_WAIT: %v", err)
		}
		wait = d
	}
	workers := 0
	if v := os.Getenv("PSET_REAL_WORKERS"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			t.Fatalf("PSET_REAL_WORKERS: %v", err)
		}
		workers = n
	}
	kill := 20 * time.Second
	if v := os.Getenv("PSET_REAL_KILL"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			t.Fatalf("PSET_REAL_KILL: %v", err)
		}
		kill = d
	}
	dir := t.TempDir()
	s, err := store.Open(bg, filepath.Join(dir, "store.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cleanup.Close(s.DB) })
	if err := s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		_, err := tx.Exec(`INSERT INTO courses (id, name, created_at) VALUES ('c1', 'Real import', ?)`, db.Now())
		return err
	}); err != nil {
		t.Fatal(err)
	}

	// Each page's recognitions, counted, to see that a resumed import does
	// not read again what it read before the kill.
	var mu sync.Mutex
	ocrRuns := map[int]int{}
	tools := library.LiveTools()
	live := tools.OCR
	tools.OCR = func(ctx context.Context, p string, page int) (string, error) {
		text, err := live(ctx, p, page)
		if err == nil {
			mu.Lock()
			ocrRuns[page]++
			mu.Unlock()
		}
		return text, err
	}
	c := action.New(s)
	newRunner := func() *runner.Runner {
		return runner.New(s, runner.Options{
			Key:     func(context.Context) (string, error) { return key, nil },
			DataDir: dir,
		})
	}
	r := newRunner()
	cfg := Config{Store: s, Actions: c, Runner: r, DataDir: dir, Tools: tools, ChatModel: llm.Writer.Model, OCRWorkers: workers}
	if os.Getenv("PSET_REAL_NO_EMBED") != "1" {
		ollama := llm.New("", "", llm.EmbedEndpoint, llm.EmbedModel)
		cfg.Embed, cfg.EmbedModel = ollama.Embed, llm.EmbedModel
	}
	svc := New(cfg)

	run := func(r *runner.Runner) func() {
		ctx, cancel := context.WithCancel(bg)
		done := make(chan struct{})
		go func() {
			if err := r.Run(ctx); err != nil {
				t.Error(err)
			}
			close(done)
		}()
		return func() { cancel(); <-done }
	}

	began := time.Now()
	stop := run(r)
	f, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	up, err := svc.Stage(f, filepath.Base(path))
	cleanup.Close(f)
	if err != nil {
		t.Fatal(err)
	}
	in, err := json.Marshal(Add{CourseID: "c1", UploadID: up.ID})
	if err != nil {
		t.Fatal(err)
	}
	added, err := c.Run(bg, "material.add", in)
	if err != nil {
		t.Fatal(err)
	}
	id := added.ID

	// finished is whether every step is done; it fails the test on one
	// that failed.
	finished := func() bool {
		steps, err := r.Steps(bg, change.ResourceMaterial, id)
		if err != nil {
			t.Fatal(err)
		}
		all := len(steps) > 0
		for _, st := range steps {
			if st.State == step.StateFailed {
				logSteps(t, steps)
				t.Fatalf("%s failed: incident %s", st.Name, st.IncidentID)
			}
			all = all && st.State == step.StateDone
		}
		return all
	}

	if kill > 0 {
		deadline := time.Now().Add(kill)
		for time.Now().Before(deadline) && !finished() {
			time.Sleep(200 * time.Millisecond)
		}
		stop()
		mu.Lock()
		before := len(ocrRuns)
		mu.Unlock()
		steps, err := r.Steps(bg, change.ResourceMaterial, id)
		if err != nil {
			t.Fatal(err)
		}
		t.Logf("killed after %s, %d pages recognized; the steps then:", time.Since(began).Round(time.Second), before)
		logSteps(t, steps)
		r = newRunner()
		svc.c.Runner = r
		r.Add(svc.pipeline())
		stop = run(r)
	}
	defer func() { stop() }()

	t.Logf("reading %d pages at once", svc.ocrWorkers())
	// The summary is logged however the wait ends, so a run that gives up
	// still says how far it got.
	report := func() {
		m, err := svc.Get(bg, id)
		if err != nil {
			t.Error(err)
			return
		}
		logSteps(t, m.Steps)
		raw, err := json.MarshalIndent(m, "", "  ")
		if err != nil {
			t.Error(err)
			return
		}
		t.Logf("the material:\n%s", raw)
		var pages, empty int
		if err := s.DB.QueryRow(`SELECT count(*), count(*) FILTER (WHERE trim(text) = '') FROM pages WHERE material_id = ?`, id).Scan(&pages, &empty); err != nil {
			t.Error(err)
			return
		}
		t.Logf("pages: %d, of which %d have no text", pages, empty)
		var calls int
		var cost float64
		if err := s.DB.QueryRow(`SELECT count(*), ifnull(sum(cost), 0) FROM calls JOIN steps ON steps.id = calls.step_id
			WHERE steps.subject_id = ?`, id).Scan(&calls, &cost); err != nil {
			t.Error(err)
			return
		}
		t.Logf("model calls: %d, $%.4f", calls, cost)
	}

	deadline := time.Now().Add(wait)
	next := time.Now().Add(time.Minute)
	for !finished() {
		if time.Now().After(deadline) {
			report()
			t.Fatalf("not read in after %s", wait)
		}
		if time.Now().After(next) {
			next = next.Add(time.Minute)
			var read, of int
			if err := s.DB.QueryRow(`SELECT pages_read, page_count FROM materials WHERE id = ?`, id).Scan(&read, &of); err == nil {
				t.Logf("%s: %d of %d pages read", time.Since(began).Round(time.Second), read, of)
			}
		}
		time.Sleep(time.Second)
	}
	t.Logf("read in after %s (the kill and restart included)", time.Since(began).Round(time.Second))
	report()
	var pages int
	if err := s.DB.QueryRow(`SELECT count(*) FROM pages WHERE material_id = ?`, id).Scan(&pages); err != nil || pages == 0 {
		t.Fatalf("no pages were read (%v)", err)
	}

	contents, err := svc.Contents(bg, id)
	if err != nil {
		t.Fatal(err)
	}
	var top []string
	for _, e := range contents.Entries {
		top = append(top, e.Title)
	}
	t.Logf("contents, %d top-level headings: %s", len(top), strings.Join(top, " | "))
	if out := os.Getenv("PSET_REAL_OUT"); out != "" {
		raw, err := json.MarshalIndent(contents.Entries, "", "  ")
		if err != nil {
			t.Fatal(err)
		}
		file := filepath.Join(out, "contents.json")
		if err := os.WriteFile(file, raw, 0o600); err != nil {
			t.Fatal(err)
		}
		t.Logf("the whole contents: %s", file)
	}

	mu.Lock()
	for page, n := range ocrRuns {
		if n > 1 {
			t.Errorf("page %d was recognized %d times", page, n)
		}
	}
	mu.Unlock()

	for _, q := range strings.Split(os.Getenv("PSET_REAL_QUERIES"), "|") {
		if q = strings.TrimSpace(q); q == "" {
			continue
		}
		hits, err := svc.Search(bg, id, q, 5)
		if err != nil {
			t.Fatal(err)
		}
		var b strings.Builder
		for _, p := range hits {
			text, err := svc.PageText(bg, id, p)
			if err != nil {
				t.Fatal(err)
			}
			b.WriteString("\n  page " + strconv.Itoa(p) + ": " + clipLog(strings.Join(strings.Fields(text), " "), 160))
		}
		t.Logf("search %q:%s", q, b.String())
	}
}

// logSteps logs each step's state, attempts and how long it ran.
func logSteps(t *testing.T, steps []step.Step) {
	t.Helper()
	for _, st := range steps {
		took := ""
		if a, err := time.Parse(time.RFC3339Nano, st.StartedAt); err == nil {
			if b, err := time.Parse(time.RFC3339Nano, st.EndedAt); err == nil {
				took = b.Sub(a).Round(100 * time.Millisecond).String()
			}
		}
		t.Logf("  %-12s %-8s attempts %d  %s", st.Name, st.State, st.Attempts, took)
	}
}

// clipLog cuts s for the log.
func clipLog(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
