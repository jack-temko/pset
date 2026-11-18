package health

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/jackt/pset/internal/action"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/condition"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/runner"
	"github.com/jackt/pset/internal/store"
)

var bg = context.Background()

// fakeOllama is an Ollama that is running, or not, with some models.
type fakeOllama struct {
	models []string
	down   bool
}

func (f *fakeOllama) Models(context.Context) ([]string, error) {
	if f.down {
		return nil, errors.New("connection refused")
	}
	return f.models, nil
}

func (f *fakeOllama) Pull(_ context.Context, m string) error {
	f.models = append(f.models, m+":latest")
	return nil
}

type env struct {
	t       *testing.T
	s       *store.Store
	c       *action.Catalog
	svc     *Service
	ollama  *fakeOllama
	missing map[string]bool
	dir     string
}

// newEnv is the checks on a fresh store, with a runner to keep what they
// find, every program installed and Ollama running with the search model.
func newEnv(t *testing.T) *env {
	t.Helper()
	dir := t.TempDir()
	s, err := store.Open(bg, filepath.Join(dir, "store.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cleanup.Close(s.DB) })
	e := &env{t: t, s: s, c: action.New(s), ollama: &fakeOllama{models: []string{llm.EmbedModel + ":latest"}}, missing: map[string]bool{}, dir: dir}
	r := runner.New(s, runner.Options{DataDir: dir})
	e.svc = New(Config{
		Store: s, Actions: e.c, Conditions: r, DataDir: dir, Ollama: e.ollama,
		LookPath: func(bin string) (string, error) {
			if e.missing[bin] {
				return "", errors.New("not found")
			}
			return "/bin/true", nil
		},
	})
	return e
}

func (e *env) check() map[condition.ID]Check {
	e.t.Helper()
	h, err := e.svc.Check(bg)
	if err != nil {
		e.t.Fatal(err)
	}
	if len(h.Checks) != len(condition.All) {
		e.t.Fatalf("%d checks, want every condition", len(h.Checks))
	}
	out := map[condition.ID]Check{}
	for i, c := range h.Checks {
		if c.Condition.ID != condition.All[i] {
			e.t.Fatalf("check %d is %s, want %s", i, c.Condition.ID, condition.All[i])
		}
		out[c.Condition.ID] = c
	}
	return out
}

func (e *env) changes() int {
	e.t.Helper()
	var n int
	if err := e.s.DB.QueryRow(`SELECT count(*) FROM changes`).Scan(&n); err != nil {
		e.t.Fatal(err)
	}
	return n
}

// What a check finds is kept as its condition: what is missing says why and
// its fix, and a condition PSet only learns from calls holds until a call
// says otherwise. Checking again finds the same and writes nothing.
func TestTheChecksKeepWhatTheyFind(t *testing.T) {
	e := newEnv(t)
	e.missing["tesseract"] = true
	e.ollama.models = []string{"llama3:latest"}
	got := e.check()

	if c := got[condition.IDPDFReader]; !c.Condition.Holds || c.Detail == "" || c.Name != "Poppler" {
		t.Fatalf("poppler, installed: %+v", c)
	}
	scan := got[condition.IDScanReader]
	if scan.Condition.Holds || scan.Condition.Error == nil || scan.Condition.Error.ID != condition.ScanReaderMissing.ID || scan.Condition.Fix != "" {
		t.Fatalf("tesseract, missing: %+v", scan)
	}
	emb := got[condition.IDEmbeddings]
	if emb.Condition.Holds || emb.Condition.Error == nil || emb.Condition.Error.ID != EmbedModelMissing.ID || emb.Condition.Fix != fixEmbeddings {
		t.Fatalf("ollama without the model: %+v", emb)
	}
	if c := got[condition.IDKey]; !c.Condition.Holds || c.Detail != "" {
		t.Fatalf("the key, never checked: %+v", c)
	}
	if c := got[condition.IDDataFolder]; !c.Condition.Holds || c.Condition.Fix != "" {
		t.Fatalf("the data folder, there: %+v", c)
	}

	before := e.changes()
	e.check()
	if after := e.changes(); after != before {
		t.Fatalf("checking again wrote %d changes", after-before)
	}
}

// A condition a check finds missing refuses the actions that need it before
// the student tries; once a check finds it back, they run.
func TestAMissingReaderBlocksUntilItIsBack(t *testing.T) {
	e := newEnv(t)
	action.Add(e.c, action.Def[struct{}]{
		ID: "test.needs_pdf", Name: "Read a PDF", Needs: []condition.ID{condition.IDPDFReader},
		Run: func(context.Context, *action.Do, struct{}) error { return nil },
	})
	e.missing["pdftoppm"] = true
	e.check()
	if _, err := e.c.Run(bg, "test.needs_pdf", nil); !errors.Is(err, action.Blocked) {
		t.Fatalf("with Poppler missing: %v", err)
	}
	e.missing["pdftoppm"] = false
	if c := e.check()[condition.IDPDFReader]; !c.Condition.Holds || c.Condition.Error != nil {
		t.Fatalf("Poppler back: %+v", c)
	}
	if _, err := e.c.Run(bg, "test.needs_pdf", nil); err != nil {
		t.Fatalf("with Poppler back: %v", err)
	}
}

// Each fix PSet can make is an action, named on its condition: running it
// fixes the thing, and the condition holds again.
func TestTheFixesAreActions(t *testing.T) {
	e := newEnv(t)
	e.svc.c.DataDir = filepath.Join(e.dir, "gone")
	e.ollama.models = nil
	got := e.check()
	if c := got[condition.IDDataFolder]; c.Condition.Holds || c.Condition.Fix != fixDataFolder {
		t.Fatalf("a missing data folder: %+v", c)
	}
	for _, id := range []string{got[condition.IDDataFolder].Condition.Fix, got[condition.IDEmbeddings].Condition.Fix} {
		if _, err := e.c.Run(bg, id, nil); err != nil {
			t.Fatalf("%s: %v", id, err)
		}
	}
	if _, err := os.Stat(e.svc.c.DataDir); err != nil {
		t.Fatal("the fix made no data folder")
	}
	held, err := e.svc.read(bg)
	if err != nil {
		t.Fatal(err)
	}
	for _, id := range []condition.ID{condition.IDDataFolder, condition.IDEmbeddings} {
		if !held[id].Holds || held[id].Fix != "" {
			t.Fatalf("%s after its fix: %+v", id, held[id])
		}
	}
}

// Ollama not running can't be fixed from PSet: it says how to start it, with
// no fix, as the embedder's own failure does.
func TestOllamaDownHasNoFix(t *testing.T) {
	e := newEnv(t)
	e.ollama.down = true
	c := e.check()[condition.IDEmbeddings]
	if c.Condition.Holds || c.Condition.Fix != "" || c.Condition.Error == nil || c.Condition.Error.ID != llm.EmbedUnreachable.ID {
		t.Fatalf("ollama down: %+v", c)
	}
}
