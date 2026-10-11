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
	"strings"
	"testing"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/testx"
)

type fakeDialer struct {
	chatErr   error
	ollama    []string
	ollamaErr error
	pulled    string
}

func (f *fakeDialer) Chat(context.Context, string) error { return f.chatErr }
func (f *fakeDialer) Ollama(context.Context) ([]string, error) {
	return f.ollama, f.ollamaErr
}
func (f *fakeDialer) Pull(_ context.Context, m string) error {
	f.pulled = m
	f.ollama = append(f.ollama, m+":latest")
	return nil
}

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
	dial := &fakeDialer{}
	svc := New(Config{
		DB: d, DataDir: dir, DBPath: path, Version: "1.2.3", Migrations: migs,
		Dialer: dial, Library: fakeLibrary{},
		LookPath: func(string) (string, error) { return "", errors.New("missing") },
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

// A key saved before PSet chose its models, for an endpoint other than
// OpenRouter, isn't one it can use.
func TestAKeyForAnotherEndpointIsntReady(t *testing.T) {
	s := newServer(t)
	for endpoint, want := range map[string]bool{"https://openrouter.ai/api/v1/": true, "http://localhost:11434/v1": false} {
		testx.Check(t, save(context.Background(), s.svc.c.DB, keyChat, map[string]string{"endpoint": endpoint, "apiKey": "k", "model": "m"}))
		var got Settings
		s.do(t, "GET", "/api/settings", nil, &got)
		if got.Ready.Key != want {
			t.Errorf("%s: ready %v, want %v", endpoint, got.Ready.Key, want)
		}
	}
}

func TestFailedSaveWritesNothing(t *testing.T) {
	s := newServer(t)
	s.dial.chatErr = &llm.CallError{Status: 401, Body: "unauthorized"}
	var e httpx.Error
	if code := s.do(t, "PUT", "/api/settings", goodKey, &e); code != 422 {
		t.Fatalf("status %d", code)
	}
	if e.Code != httpx.CodeBadKey || e.Field != "apiKey" {
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
		code  httpx.Code
		field string
	}{
		{"no key", "  ", nil, httpx.CodeInvalid, "apiKey"},
		{"refused key", "k", &llm.CallError{Status: 403}, httpx.CodeBadKey, "apiKey"},
		{"unknown model", "k", &llm.CallError{Status: 400, Body: `{"error":"Model not found"}`}, httpx.CodeBadModel, ""},
		{"server error", "k", &llm.CallError{Status: 500}, httpx.CodeUnreachable, ""},
		{"timeout", "k", context.DeadlineExceeded, httpx.CodeUnreachable, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			s := newServer(t)
			s.dial.chatErr = c.err
			var e httpx.Error
			s.do(t, "POST", "/api/settings/test", KeyInput{APIKey: c.key}, &e)
			if e.Code != c.code || e.Field != c.field {
				t.Fatalf("got %s on %q, want %s on %q (%s)", e.Code, e.Field, c.code, c.field, e.Message)
			}
		})
	}
}

func TestHealthAndFix(t *testing.T) {
	s := newServer(t)
	var h Health
	s.do(t, "GET", "/api/health", nil, &h)
	byID := map[string]HealthCheck{}
	for _, c := range h.Checks {
		byID[c.ID] = c
	}
	if len(h.Checks) != 5 {
		t.Fatalf("checks %+v", h.Checks)
	}
	if dd := byID["data_dir"]; !dd.OK {
		t.Fatalf("data dir: %+v", dd)
	}
	if !byID["database"].OK {
		t.Fatalf("database %+v", byID["database"])
	}
	if p := byID["poppler"]; p.OK || p.Fixable {
		t.Fatalf("missing tool: %+v", p)
	}
	// Fixing a check that passes is a no-op that answers the check.
	var fixed HealthCheck
	if code := s.do(t, "POST", "/api/health/data_dir/fix", nil, &fixed); code != 200 || !fixed.OK {
		t.Fatalf("fix: %d %+v", code, fixed)
	}
	var e httpx.Error
	s.svc.c.Migrations = append(s.svc.c.Migrations, db.Migration{Name: "settings/99", SQL: `CREATE TABLE extra (x)`})
	s.do(t, "GET", "/api/health", nil, &h)
	if h.Checks[1].OK || !h.Checks[1].Fixable {
		t.Fatalf("pending migration not reported: %+v", h.Checks[1])
	}
	if code := s.do(t, "POST", "/api/health/database/fix", nil, &fixed); code != 200 || !fixed.OK {
		t.Fatalf("database fix: %d %+v", code, fixed)
	}
	if code := s.do(t, "POST", "/api/health/poppler/fix", nil, &e); code != 422 {
		t.Fatalf("unfixable fix: %d", code)
	}
	if code := s.do(t, "POST", "/api/health/nope/fix", nil, &e); code != 404 {
		t.Fatalf("unknown check: %d", code)
	}
}

// Ollama down can't be fixed from here; Ollama without the model can,
// by pulling it.
func TestOllamaCheck(t *testing.T) {
	s := newServer(t)
	check := func() HealthCheck {
		var h Health
		s.do(t, "GET", "/api/health", nil, &h)
		return h.Checks[len(h.Checks)-1]
	}
	s.dial.ollamaErr = errors.New("connection refused")
	if c := check(); c.ID != "ollama" || c.OK || c.Fixable || !strings.Contains(c.Detail, "not running") {
		t.Fatalf("down: %+v", c)
	}
	s.dial.ollamaErr, s.dial.ollama = nil, []string{"llama3:latest"}
	if c := check(); c.OK || !c.Fixable {
		t.Fatalf("no model: %+v", c)
	}
	var fixed HealthCheck
	if code := s.do(t, "POST", "/api/health/ollama/fix", nil, &fixed); code != 200 || !fixed.OK || s.dial.pulled != llm.EmbedModel {
		t.Fatalf("fix: %d %+v, pulled %q", code, fixed, s.dial.pulled)
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
	var e httpx.Error
	if code := s.do(t, "PUT", "/api/settings/profile", Profile{Name: strings.Repeat("x", 61)}, &e); code != 422 || e.Field != "name" {
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
		var he *httpx.Error
		if !errors.As(explain(le), &he) || he.Field != "apiKey" || !strings.Contains(he.Message, "out of credit") {
			t.Errorf("%d: got %+v, want out of credit on apiKey", le.Status, he)
		}
	}
}
