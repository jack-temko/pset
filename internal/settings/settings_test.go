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

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/llm"
)

type fakeDialer struct {
	chatErr  error
	embedErr error
}

func (f fakeDialer) Chat(context.Context, ChatConnection) error { return f.chatErr }
func (f fakeDialer) Embed(context.Context, EmbedConnection) (int, error) {
	return 768, f.embedErr
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
	t.Cleanup(func() { d.Close() })
	migs := Migrations()
	if err := db.Migrate(context.Background(), d, migs); err != nil {
		t.Fatal(err)
	}
	dial := &fakeDialer{}
	svc := New(Config{
		DB: d, DataDir: dir, DBPath: path, Version: "1.2.3", Migrations: migs,
		Dialer: dialerFunc{dial}, Library: fakeLibrary{},
		LookPath: func(string) (string, error) { return "", errors.New("missing") },
	})
	mux := http.NewServeMux()
	svc.Routes(mux)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return &server{srv, svc, dial, dir}
}

// dialerFunc reads the fake through a pointer, so a test can change its
// answers after the server is built.
type dialerFunc struct{ f *fakeDialer }

func (d dialerFunc) Chat(ctx context.Context, c ChatConnection) error { return d.f.Chat(ctx, c) }
func (d dialerFunc) Embed(ctx context.Context, c EmbedConnection) (int, error) {
	return d.f.Embed(ctx, c)
}

func (s *server) do(t *testing.T, method, path string, body, out any) int {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		json.NewEncoder(&buf).Encode(body)
	}
	req, _ := http.NewRequest(method, s.URL+path, &buf)
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

var goodChat = ChatConnection{Endpoint: "https://example.test/v1", APIKey: "k", Model: "m"}

func TestFreshInstallShowsDefaultsNotReady(t *testing.T) {
	s := newServer(t)
	var got Settings
	s.do(t, "GET", "/api/settings", nil, &got)
	if got.Chat != DefaultChat || got.Embeddings != DefaultEmbed || got.Ready.Chat || got.Ready.Embeddings {
		t.Fatalf("got %+v", got)
	}
	cfg, _ := s.svc.LLM(context.Background())
	if cfg.ChatReady() || cfg.EmbedReady() {
		t.Fatalf("defaults leaked into LLM config: %+v", cfg)
	}
}

func TestSaveTestsThenWrites(t *testing.T) {
	s := newServer(t)
	var res SaveResult
	if code := s.do(t, "PUT", "/api/settings", ConnectionInput{Chat: &goodChat}, &res); code != 200 {
		t.Fatalf("status %d", code)
	}
	if !res.Settings.Ready.Chat || res.Settings.Chat != goodChat || res.Detail != "Connected" {
		t.Fatalf("got %+v", res)
	}
	cfg, _ := s.svc.LLM(context.Background())
	if cfg != (llm.Config{ChatEndpoint: goodChat.Endpoint, APIKey: "k", ChatModel: "m"}) {
		t.Fatalf("llm config %+v", cfg)
	}
}

func TestFailedSaveWritesNothingAndNamesTheField(t *testing.T) {
	s := newServer(t)
	s.dial.chatErr = &llm.LLMError{Status: 401, Body: "unauthorized"}
	var e httpx.Error
	if code := s.do(t, "PUT", "/api/settings", ConnectionInput{Chat: &goodChat}, &e); code != 422 {
		t.Fatalf("status %d", code)
	}
	if e.Code != httpx.CodeBadKey || e.Field != "apiKey" {
		t.Fatalf("error %+v", e)
	}
	var got Settings
	s.do(t, "GET", "/api/settings", nil, &got)
	if got.Ready.Chat {
		t.Fatal("a failed save was written")
	}
}

func TestTestNeverWrites(t *testing.T) {
	s := newServer(t)
	var r TestResult
	s.do(t, "POST", "/api/settings/test", ConnectionInput{Embeddings: &EmbedConnection{"http://x/v1", "e"}}, &r)
	if r.Detail != "Connected · 768 dimensions" {
		t.Fatalf("detail %q", r.Detail)
	}
	var got Settings
	s.do(t, "GET", "/api/settings", nil, &got)
	if got.Ready.Embeddings {
		t.Fatal("test wrote")
	}
}

func TestOneSideAtATime(t *testing.T) {
	s := newServer(t)
	var e httpx.Error
	code := s.do(t, "POST", "/api/settings/test", ConnectionInput{Chat: &goodChat, Embeddings: &EmbedConnection{"http://x", "e"}}, &e)
	if code != 422 || e.Code != httpx.CodeInvalid {
		t.Fatalf("%d %+v", code, e)
	}
}

func TestFieldErrors(t *testing.T) {
	cases := []struct {
		name  string
		in    ChatConnection
		err   error
		code  httpx.Code
		field string
	}{
		{"not a url", ChatConnection{"api.z.ai", "k", "m"}, nil, httpx.CodeInvalid, "endpoint"},
		{"no model", ChatConnection{"https://x", "k", " "}, nil, httpx.CodeInvalid, "model"},
		{"refused key", goodChat, &llm.LLMError{Status: 403}, httpx.CodeBadKey, "apiKey"},
		{"unknown model", goodChat, &llm.LLMError{Status: 400, Body: `{"error":"Model not found"}`}, httpx.CodeBadModel, "model"},
		{"wrong path", goodChat, &llm.LLMError{Status: 404, Body: "not found"}, httpx.CodeUnreachable, "endpoint"},
		{"server error", goodChat, &llm.LLMError{Status: 500}, httpx.CodeUnreachable, "endpoint"},
		{"timeout", goodChat, context.DeadlineExceeded, httpx.CodeUnreachable, "endpoint"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			s := newServer(t)
			s.dial.chatErr = c.err
			in := c.in
			var e httpx.Error
			s.do(t, "POST", "/api/settings/test", ConnectionInput{Chat: &in}, &e)
			if e.Code != c.code || e.Field != c.field {
				t.Fatalf("got %s on %q, want %s on %q (%s)", e.Code, e.Field, c.code, c.field, e.Message)
			}
		})
	}
}

// A 401 with no key typed isn't a refused key; the copy must not accuse
// one.
func TestEmptyKeyGetsItsOwnWords(t *testing.T) {
	s := newServer(t)
	s.dial.chatErr = &llm.LLMError{Status: 401, Body: "unauthorized"}
	keyless := goodChat
	keyless.APIKey = ""
	var e httpx.Error
	s.do(t, "POST", "/api/settings/test", ConnectionInput{Chat: &keyless}, &e)
	if e.Code != httpx.CodeBadKey || e.Field != "apiKey" || e.Message != "This endpoint wants an API key and none is set (401)." {
		t.Fatalf("empty key: %+v (%s)", e, e.Message)
	}
	s.do(t, "POST", "/api/settings/test", ConnectionInput{Chat: &goodChat}, &e)
	if e.Code != httpx.CodeBadKey || e.Field != "apiKey" || e.Message != "The endpoint refused this key (401)" {
		t.Fatalf("typed key: %+v (%s)", e, e.Message)
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
	if len(h.Checks) != 4 {
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

func TestResetIsAFreshInstall(t *testing.T) {
	s := newServer(t)
	s.do(t, "PUT", "/api/settings", ConnectionInput{Chat: &goodChat}, nil)
	os.MkdirAll(filepath.Join(s.dir, "cache", "pages"), 0o700)
	os.WriteFile(filepath.Join(s.dir, "cache", "pages", "1.jpg"), []byte("x"), 0o600)

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
	if got.Ready.Chat {
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
