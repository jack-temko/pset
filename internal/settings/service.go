// Package settings is the Settings screen's engine: the OpenRouter key,
// the local health checks, Reset, and About.
package settings

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/llm"
)

// Dialer tries the connections for real. The live one speaks to
// OpenRouter and the local Ollama; tests swap in a fake.
type Dialer interface {
	// Chat sends a one-token request to OpenRouter with this key.
	Chat(ctx context.Context, apiKey string) error
	// Ollama lists the models the local Ollama has pulled.
	Ollama(ctx context.Context) ([]string, error)
	// Pull has the local Ollama download a model.
	Pull(ctx context.Context, model string) error
}

// Library is what Reset's dry run needs to count.
type Library interface {
	Count(ctx context.Context) (books, pages int, err error)
}

// Queue is what Reset needs from the job queue: nothing may run while
// the database is wiped.
type Queue interface {
	Pause()
	Resume()
}

// Config is what the service is built from.
type Config struct {
	DB         *sql.DB
	DataDir    string
	DBPath     string
	Version    string
	Migrations []db.Migration // every feature's, for the database check and Reset
	Dialer     Dialer
	Library    Library
	Queue      Queue
	// LookPath finds a tool; exec.LookPath unless a test says otherwise.
	LookPath func(string) (string, error)
}

// Service keeps the student's settings: the name, the keys and the health of what PSet needs.
type Service struct{ c Config }

// New builds the service.
func New(c Config) *Service { return &Service{c} }

// SetLibrary connects Reset's dry run once the library exists: the
// library is built after settings, because it reads its connections here.
func (s *Service) SetLibrary(l Library) { s.c.Library = l }

// Get returns what the page shows: the saved key, and the models PSet
// uses with it.
func (s *Service) Get(ctx context.Context) (Settings, error) {
	out := Settings{Models: models()}
	var c chatRow
	saved, err := load(ctx, s.c.DB, keyChat, &c)
	if err != nil {
		return Settings{}, err
	}
	out.APIKey, out.Ready.Key = c.APIKey, saved && c.ready()
	if _, err = load(ctx, s.c.DB, keyProfile, &out.Profile); err != nil {
		return Settings{}, err
	}
	return out, nil
}

// chatRow is the saved key. An install from before PSet chose its models
// saved an endpoint and a model with it: a key saved for anywhere but
// OpenRouter isn't one it can use.
type chatRow struct {
	Endpoint string `json:"endpoint,omitempty"`
	APIKey   string `json:"apiKey"`
}

func (c chatRow) ready() bool {
	return c.APIKey != "" && (c.Endpoint == "" || strings.TrimRight(c.Endpoint, "/") == llm.OpenRouter)
}

// models is each job and its model, for the page to say.
func models() []ModelUse {
	out := make([]ModelUse, len(llm.Jobs))
	for i, j := range llm.Jobs {
		out[i] = ModelUse{Job: j.Name, Model: j.Model}
	}
	return out
}

// maxName keeps a name a name.
const maxName = 60

// SaveProfile stores who's studying. There is nothing to test, so it
// writes straight away.
func (s *Service) SaveProfile(ctx context.Context, p Profile) (Profile, error) {
	p.Name = strings.Join(strings.Fields(p.Name), " ")
	if len([]rune(p.Name)) > maxName {
		return Profile{}, nameTooLong.New("max", strconv.Itoa(maxName)).OnField("name")
	}
	return p, save(ctx, s.c.DB, keyProfile, p)
}

// Name is what the tutor calls the student; empty when they haven't said.
func (s *Service) Name(ctx context.Context) string {
	var p Profile
	_, err := load(ctx, s.c.DB, keyProfile, &p)
	cleanup.Log("settings: read the profile", err)
	return p.Name
}

// LLM is the connections, for the features that call models: OpenRouter
// with the saved key and the Writer's model, once a key is saved, and the
// local Ollama always. Without a key the chat side is blank, so llm.Config's
// Ready methods say what can run.
func (s *Service) LLM(ctx context.Context) (llm.Config, error) {
	cur, err := s.Get(ctx)
	if err != nil {
		return llm.Config{}, err
	}
	c := llm.Config{EmbedEndpoint: llm.EmbedEndpoint, EmbedModel: llm.EmbedModel}
	if cur.Ready.Key {
		c.ChatEndpoint, c.APIKey, c.ChatModel = llm.OpenRouter, cur.APIKey, llm.Writer.Model
	}
	return c, nil
}

// probeTimeout keeps Test from hanging on a connection that opens and
// then says nothing.
const probeTimeout = 60 * time.Second

// Test tries a key and writes nothing.
func (s *Service) Test(ctx context.Context, in KeyInput) (TestResult, error) {
	ctx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()
	key := strings.TrimSpace(in.APIKey)
	if key == "" {
		return TestResult{}, keyEmpty.New().OnField("apiKey")
	}
	if err := s.c.Dialer.Chat(ctx, key); err != nil {
		return TestResult{}, explain(err)
	}
	return TestResult{Detail: "Connected"}, nil
}

// Save tests a key, and writes it only if the test passes: what's stored
// always worked when it was stored.
func (s *Service) Save(ctx context.Context, in KeyInput) (SaveResult, error) {
	r, err := s.Test(ctx, in)
	if err != nil {
		return SaveResult{}, err
	}
	if err := save(ctx, s.c.DB, keyChat, chatRow{APIKey: strings.TrimSpace(in.APIKey)}); err != nil {
		return SaveResult{}, err
	}
	cur, err := s.Get(ctx)
	return SaveResult{Settings: cur, Detail: r.Detail}, err
}

// explain turns a failed test into what to do about it: the cause is in the
// chain (a refused key, no credit, no connection), and the notice points at
// the key field.
func explain(err error) error {
	var cause *errs.Error
	if !errors.As(err, &cause) {
		var ne net.Error
		var ue *url.Error
		if errors.Is(err, context.DeadlineExceeded) || errors.As(err, &ne) || errors.As(err, &ue) {
			err = llm.ModelUnreachable.Wrap(err)
		}
	}
	return testFailed.Wrap(err).OnField("apiKey")
}

// About is the version and where the data lives.
func (s *Service) About() About { return About{Version: s.c.Version, DataDir: s.c.DataDir} }

// ResetCounts is Reset's dry run.
func (s *Service) ResetCounts(ctx context.Context) (ResetCounts, error) {
	if s.c.Library == nil {
		return ResetCounts{}, nil
	}
	b, p, err := s.c.Library.Count(ctx)
	return ResetCounts{Books: b, Pages: p}, err
}

// Reset is a fresh install: the queue pauses, every table is dropped and
// recreated, and every file in the data directory except the open
// database goes. Settings live in the database, so they go too.
func (s *Service) Reset(ctx context.Context) error {
	if s.c.Queue != nil {
		s.c.Queue.Pause()
		defer s.c.Queue.Resume()
	}
	if err := db.Wipe(ctx, s.c.DB, s.c.Migrations); err != nil {
		return fmt.Errorf("wipe database: %w", err)
	}
	entries, err := os.ReadDir(s.c.DataDir)
	if err != nil {
		return err
	}
	base := filepath.Base(s.c.DBPath)
	for _, e := range entries {
		n := e.Name()
		if n == base || n == base+"-wal" || n == base+"-shm" {
			continue
		}
		if err := os.RemoveAll(filepath.Join(s.c.DataDir, n)); err != nil {
			return err
		}
	}
	return nil
}
