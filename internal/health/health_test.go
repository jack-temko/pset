package health

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/jackt/pset/internal/action"
	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/condition"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
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
	_, err := e.c.Run(bg, "test.needs_pdf", nil)
	if !errors.Is(err, action.Blocked) {
		t.Fatalf("with Poppler missing: %v", err)
	}
	if l := errs.Resolve(err).Links[0]; l["condition"] != string(condition.IDPDFReader) || l["fixAction"] != "" {
		t.Fatalf("the refusal names %+v, want the PDF reader and no fix", l)
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
	// An action that needs it is refused with the fix to offer.
	action.Add(e.c, action.Def[struct{}]{
		ID: "test.needs_folder", Name: "Save", Needs: []condition.ID{condition.IDDataFolder},
		Run: func(context.Context, *action.Do, struct{}) error { return nil },
	})
	_, err := e.c.Run(bg, "test.needs_folder", nil)
	if l := errs.Resolve(err).Links[0]; l["condition"] != string(condition.IDDataFolder) || l["fixAction"] != fixDataFolder {
		t.Fatalf("the refusal names %+v, want the data folder and its fix", l)
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

func (e *env) write(q string, args ...any) {
	e.t.Helper()
	if err := e.s.Write(bg, change.ActorPSet, "", func(tx *sql.Tx) error {
		_, err := tx.Exec(q, args...)
		return err
	}); err != nil {
		e.t.Fatal(err)
	}
}

func (e *env) incidentState(id string) string {
	e.t.Helper()
	var state string
	if err := e.s.DB.QueryRow(`SELECT state FROM incidents WHERE id = ?`, id).Scan(&state); err != nil {
		e.t.Fatal(err)
	}
	return state
}

// A passing check heals only what it disproves: Tesseract found heals a scan
// that waited for it, but Ollama listing its model does not heal an
// embedding Ollama answered with an error, which only a real use can show.
func TestAPassingCheckHealsOnlyWhatItDisproves(t *testing.T) {
	e := newEnv(t)
	now := db.Now()
	for _, in := range []struct{ id, chain, clears string }{
		{"SCAN01", `["material.read_failed","condition.scan_reader"]`, "scan_reader"},
		{"EMBED1", `["material.search_failed","embed.failed"]`, "embeddings"},
	} {
		e.write(`INSERT INTO incidents (id, error, kind, born, state, first_at, last_at, clears)
			VALUES (?, json_object('id', 'x', 'chain', json(?)), 'waiting_on_you', 'step', 'open', ?, ?, ?)`,
			in.id, in.chain, now, now, in.clears)
		e.write(`INSERT INTO conditions (id, holds, since, error) VALUES (?, 0, ?, '{"id":"x"}')`, in.clears, now)
	}
	got := e.check()
	if s := e.incidentState("SCAN01"); s != "healed" || !got[condition.IDScanReader].Condition.Holds {
		t.Fatalf("tesseract found: the scan's incident is %s, the condition %+v", s, got[condition.IDScanReader].Condition)
	}
	if s := e.incidentState("EMBED1"); s != "open" || got[condition.IDEmbeddings].Condition.Holds {
		t.Fatalf("the model listed: Ollama's error is %s, the condition %+v", s, got[condition.IDEmbeddings].Condition)
	}
}

// Finding a condition lacking is one change, its error and fix together;
// once it holds again its fix is gone from the row, not only from the list.
func TestLackingIsOneChangeAndHoldingDropsTheFix(t *testing.T) {
	e := newEnv(t)
	e.ollama.models = nil
	e.check()
	var n int
	var fix string
	if err := e.s.DB.QueryRow(`SELECT count(*) FROM changes WHERE kind = 'condition' AND res_id = 'embeddings'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("finding the model missing logged %d changes", n)
	}
	if _, err := e.c.Run(bg, fixEmbeddings, nil); err != nil {
		t.Fatal(err)
	}
	if err := e.s.DB.QueryRow(`SELECT fix FROM conditions WHERE id = 'embeddings'`).Scan(&fix); err != nil {
		t.Fatal(err)
	}
	if fix != "" {
		t.Fatalf("a condition that holds keeps the fix %q", fix)
	}
}

// The conditions are read as kept, without running a check: what a check
// found last stands, and nothing is looked for.
func TestTheConditionsAreReadWithoutChecking(t *testing.T) {
	e := newEnv(t)
	e.missing["tesseract"] = true
	e.check()
	looked := 0
	e.svc.c.LookPath = func(string) (string, error) { looked++; return "/bin/true", nil }
	got, err := e.svc.Conditions(bg)
	if err != nil {
		t.Fatal(err)
	}
	if looked != 0 {
		t.Fatalf("reading the conditions ran %d checks", looked)
	}
	if len(got.Conditions) != len(condition.All) {
		t.Fatalf("%d conditions", len(got.Conditions))
	}
	for i, c := range got.Conditions {
		if c.ID != condition.All[i] {
			t.Fatalf("condition %d is %s", i, c.ID)
		}
		if want := c.ID != condition.IDScanReader; c.Holds != want {
			t.Fatalf("%s holds %v", c.ID, c.Holds)
		}
	}
	mux := http.NewServeMux()
	e.svc.Routes(mux)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/conditions", nil))
	if rec.Code != http.StatusOK || looked != 0 {
		t.Fatalf("GET /api/conditions answered %d after %d checks", rec.Code, looked)
	}
}

// The route lists every condition.
func TestTheRoute(t *testing.T) {
	e := newEnv(t)
	mux := http.NewServeMux()
	e.svc.Routes(mux)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/health", nil))
	var h Health
	if err := json.NewDecoder(rec.Body).Decode(&h); err != nil {
		t.Fatal(err)
	}
	if rec.Code != http.StatusOK || len(h.Checks) != len(condition.All) {
		t.Fatalf("%d, %d checks", rec.Code, len(h.Checks))
	}
}
