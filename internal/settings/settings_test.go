package settings

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/condition"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/store"
	"github.com/jackt/pset/internal/testx"
)

type fakeDialer struct{ chatErr error }

func (f *fakeDialer) Chat(context.Context, string) error { return f.chatErr }

type fakeLibrary struct{}

func (fakeLibrary) Count(context.Context) (int, int, error) { return 3, 900, nil }

type server struct {
	*httptest.Server
	svc  *Service
	dial *fakeDialer
	dir  string
}

func newServer(t *testing.T) *server {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "pset.db")
	d, err := db.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cleanup.Close(d) })
	migs := Migrations()
	if err := db.Migrate(context.Background(), d, migs); err != nil {
		t.Fatal(err)
	}
	// The key and the name are kept in the store's database, beside it.
	storePath := filepath.Join(dir, "store.db")
	st, err := store.Open(context.Background(), storePath)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cleanup.Close(st.DB) })
	dial := &fakeDialer{}
	svc := New(Config{
		DB: d, Saved: st.DB, DataDir: dir, DBPath: path, Version: "1.2.3", Migrations: migs,
		Dialer: dial, Library: fakeLibrary{}, Keep: []string{storePath},
	})
	mux := http.NewServeMux()
	svc.Routes(mux)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return &server{srv, svc, dial, dir}
}

func (s *server) do(t *testing.T, method, path string, body, out any) int {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		testx.Check(t, json.NewEncoder(&buf).Encode(body))
	}
	req, _ := http.NewRequest(method, s.URL+path, &buf)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup.Close(resp.Body)
	if out != nil {
		testx.Check(t, json.NewDecoder(resp.Body).Decode(out))
	}
	return resp.StatusCode
}

var goodKey = KeyInput{APIKey: " sk-or-good "}

func TestFreshInstallHasNoKeyAndNamesTheModels(t *testing.T) {
	s := newServer(t)
	var got Settings
	s.do(t, "GET", "/api/settings", nil, &got)
	if got.APIKey != "" || got.Ready.Key || len(got.Models) != len(llm.Jobs) || got.Models[0].Model != llm.Writer.Model {
		t.Fatalf("got %+v", got)
	}
	cfg, _ := s.svc.LLM(context.Background())
	if cfg.ChatReady() || !cfg.EmbedReady() {
		t.Fatalf("no key, yet chat is ready, or embeddings aren't: %+v", cfg)
	}
}

func TestSaveTestsThenWrites(t *testing.T) {
	s := newServer(t)
	var res SaveResult
	if code := s.do(t, "PUT", "/api/settings", goodKey, &res); code != 200 {
		t.Fatalf("status %d", code)
	}
	if !res.Settings.Ready.Key || res.Settings.APIKey != "sk-or-good" || res.Detail != "Connected" {
		t.Fatalf("got %+v", res)
	}
	cfg, _ := s.svc.LLM(context.Background())
	want := llm.Config{ChatEndpoint: llm.OpenRouter, APIKey: "sk-or-good", ChatModel: llm.Writer.Model, EmbedEndpoint: llm.EmbedEndpoint, EmbedModel: llm.EmbedModel}
	if cfg != want {
		t.Fatalf("llm config %+v", cfg)
	}
}

func TestFailedSaveWritesNothing(t *testing.T) {
	s := newServer(t)
	s.dial.chatErr = &llm.CallError{Status: 401, Body: "unauthorized"}
	var e errs.View
	if code := s.do(t, "PUT", "/api/settings", goodKey, &e); code != 422 {
		t.Fatalf("status %d", code)
	}
	if e.ID != "settings.test_failed" || e.Chain[1] != "key.refused" || e.Field != "apiKey" || e.Fix == "" {
		t.Fatalf("error %+v", e)
	}
	var got Settings
	s.do(t, "GET", "/api/settings", nil, &got)
	if got.Ready.Key {
		t.Fatal("a failed save was written")
	}
}

func TestTestNeverWrites(t *testing.T) {
	s := newServer(t)
	var r TestResult
	s.do(t, "POST", "/api/settings/test", goodKey, &r)
	if r.Detail != "Connected" {
		t.Fatalf("detail %q", r.Detail)
	}
	var got Settings
	s.do(t, "GET", "/api/settings", nil, &got)
	if got.Ready.Key {
		t.Fatal("test wrote")
	}
}

func TestErrors(t *testing.T) {
	cases := []struct {
		name  string
		key   string
		err   error
		id    string
		cause string
	}{
		{"no key", "  ", nil, "settings.key_empty", ""},
		{"refused key", "k", &llm.CallError{Status: 403}, "settings.test_failed", "key.refused"},
		{"unknown model", "k", &llm.CallError{Status: 400, Body: `{"error":"Model not found"}`}, "settings.test_failed", "model.unknown"},
		{"server error", "k", &llm.CallError{Status: 500}, "settings.test_failed", "model.busy"},
		{"timeout", "k", context.DeadlineExceeded, "settings.test_failed", "model.unreachable"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			s := newServer(t)
			s.dial.chatErr = c.err
			var e errs.View
			s.do(t, "POST", "/api/settings/test", KeyInput{APIKey: c.key}, &e)
			if e.ID != c.id || e.Field != "apiKey" || (c.cause != "" && e.Chain[len(e.Chain)-1] != c.cause) {
				t.Fatalf("got %v on %q, want %s on the key (cause %q)", e.Chain, e.Field, c.id, c.cause)
			}
		})
	}
}

func TestResetIsAFreshInstall(t *testing.T) {
	s := newServer(t)
	s.do(t, "PUT", "/api/settings", goodKey, nil)
	testx.Check(t, os.MkdirAll(filepath.Join(s.dir, "cache", "pages"), 0o700))
	testx.Check(t, os.WriteFile(filepath.Join(s.dir, "cache", "pages", "1.jpg"), []byte("x"), 0o600))

	var counts ResetCounts
	s.do(t, "GET", "/api/reset", nil, &counts)
	if counts != (ResetCounts{3, 900}) {
		t.Fatalf("counts %+v", counts)
	}
	if code := s.do(t, "POST", "/api/reset", nil, nil); code != 204 {
		t.Fatalf("reset %d", code)
	}
	var got Settings
	s.do(t, "GET", "/api/settings", nil, &got)
	if got.Ready.Key {
		t.Fatal("settings survived reset")
	}
	if _, err := os.Stat(filepath.Join(s.dir, "cache")); !os.IsNotExist(err) {
		t.Fatal("cache survived reset")
	}
	if _, err := os.Stat(filepath.Join(s.dir, "pset.db")); err != nil {
		t.Fatal("reset removed the open database")
	}
}

// The new backend's store, open beside the old database, is not Reset's.
func TestResetLeavesTheDatabasesItIsToldToKeep(t *testing.T) {
	s := newServer(t)
	s.svc.c.Keep = []string{filepath.Join(s.dir, "store.db")}
	for _, n := range []string{"store.db", "store.db-wal", "other.db"} {
		testx.Check(t, os.WriteFile(filepath.Join(s.dir, n), []byte("x"), 0o600))
	}
	testx.Check(t, s.svc.Reset(context.Background()))
	for n, want := range map[string]bool{"store.db": true, "store.db-wal": true, "other.db": false} {
		if _, err := os.Stat(filepath.Join(s.dir, n)); (err == nil) != want {
			t.Errorf("%s kept %v, want %v", n, err == nil, want)
		}
	}
}

func TestAbout(t *testing.T) {
	s := newServer(t)
	var a About
	s.do(t, "GET", "/api/about", nil, &a)
	if a.Version != "1.2.3" || a.DataDir != s.dir {
		t.Fatalf("%+v", a)
	}
}

func TestProfileNameIsTidiedAndSurvivesUntilReset(t *testing.T) {
	s := newServer(t)
	var p Profile
	if code := s.do(t, "PUT", "/api/settings/profile", Profile{Name: "  Jack   T  "}, &p); code != 200 || p.Name != "Jack T" {
		t.Fatalf("%d %+v", code, p)
	}
	var got Settings
	s.do(t, "GET", "/api/settings", nil, &got)
	if got.Profile.Name != "Jack T" || s.svc.Name(context.Background()) != "Jack T" {
		t.Fatalf("%+v", got.Profile)
	}
	var e errs.View
	if code := s.do(t, "PUT", "/api/settings/profile", Profile{Name: strings.Repeat("x", 61)}, &e); code != 422 || e.Field != "name" || e.ID != "settings.name_too_long" {
		t.Fatalf("long name: %d %+v", code, e)
	}
	s.do(t, "POST", "/api/reset", nil, nil)
	if s.svc.Name(context.Background()) != "" {
		t.Fatal("name survived reset")
	}
}

// TestOutOfCreditPointsAtTheKey: an account with no money left is said on
// the key's field, not as an unreachable endpoint.
func TestOutOfCreditPointsAtTheKey(t *testing.T) {
	for _, le := range []*llm.CallError{
		{Status: 429, Body: `{"error":{"code":"1113","message":"Insufficient balance or no resource package. Please recharge."}}`},
		{Status: 402, Body: `{"error":{"code":402,"message":"This request requires more credits"}}`},
	} {
		v := errs.Resolve(explain(le))
		if v.Field != "apiKey" || v.Chain[len(v.Chain)-1] != "key.out_of_credit" || !strings.Contains(v.Why, "out of credit") {
			t.Errorf("%d: got %+v, want out of credit on apiKey", le.Status, v)
		}
	}
}

// Saving a key that passed its test tells the runner the key and credit
// hold again; a failed save tells it nothing.
func TestSavingAKeyHeals(t *testing.T) {
	s := newServer(t)
	var healed []condition.ID
	s.svc.c.Heal = func(_ context.Context, id condition.ID) { healed = append(healed, id) }
	s.dial.chatErr = errors.New("refused")
	s.do(t, "PUT", "/api/settings", goodKey, nil)
	if len(healed) != 0 {
		t.Fatalf("a refused key healed %v", healed)
	}
	s.dial.chatErr = nil
	s.do(t, "PUT", "/api/settings", goodKey, nil)
	if !slices.Equal(healed, []condition.ID{condition.IDKey, condition.IDCredit}) {
		t.Fatalf("saving a key healed %v, want key and credit", healed)
	}
}
