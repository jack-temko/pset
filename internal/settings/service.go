// Package settings is the Settings screen's engine: the OpenRouter key, the
// student's name, Reset, and About. The health checks are internal/health.
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
	"github.com/jackt/pset/internal/condition"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/llm"
)

// Dialer tries a key for real. The live one speaks to OpenRouter; tests
// swap in a fake.
type Dialer interface {
	// Chat sends a one-token request to OpenRouter with this key.
	Chat(ctx context.Context, apiKey string) error
}

// Library is what Reset's dry run needs to count.
type Library interface {
	Count(ctx context.Context) (books, pages int, err error)
}

// Config is what the service is built from.
type Config struct {
	// DB is the old database, which Reset wipes until the cut-over (track 9
	// of ideas/backend-courses.md moves Reset onto the store).
	DB *sql.DB
	// Saved is the store's database, where the key and the name are kept
	// (its settings table).
	Saved      *sql.DB
	DataDir    string
	DBPath     string
	Version    string
	Migrations []db.Migration // every feature's, for the database check and Reset
	Dialer     Dialer
	Library    Library
	// Keep names other databases in the data directory that Reset leaves
	// alone: the new backend's store, open beside this one until it takes
	// Reset over (track 7 of ideas/backend-courses.md).
	Keep []string
	// Heal, when set, is told a condition holds again: a key was saved. The step runner runs what waited on it.
	Heal func(ctx context.Context, condition condition.ID)
}

// heal tells the runner each condition holds again.
func (s *Service) heal(ctx context.Context, ids ...condition.ID) {
	if s.c.Heal == nil {
		return
	}
	for _, id := range ids {
		s.c.Heal(ctx, id)
	}
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
	saved, err := load(ctx, s.c.Saved, keyChat, &c)
	if err != nil {
		return Settings{}, err
	}
	out.APIKey, out.Ready.Key = c.APIKey, saved && c.APIKey != ""
	if _, err = load(ctx, s.c.Saved, keyProfile, &out.Profile); err != nil {
		return Settings{}, err
	}
	return out, nil
}

// chatRow is the saved key.
type chatRow struct {
	APIKey string `json:"apiKey"`
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
	return p, save(ctx, s.c.Saved, keyProfile, p)
}

// Name is what the tutor calls the student; empty when they haven't said.
func (s *Service) Name(ctx context.Context) string {
	var p Profile
	_, err := load(ctx, s.c.Saved, keyProfile, &p)
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
	if err := save(ctx, s.c.Saved, keyChat, chatRow{APIKey: strings.TrimSpace(in.APIKey)}); err != nil {
		return SaveResult{}, err
	}
	// A key that passed its test is accepted and its account has credit.
	s.heal(ctx, condition.IDKey, condition.IDCredit)
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

// Reset is a fresh install, of the old database: every table is dropped and
// recreated, the key and the name go, and every file in the data directory
// except the open databases goes. The store's database is left (Keep) until
// track 9 moves Reset onto it.
func (s *Service) Reset(ctx context.Context) error {
	// The key and the name are in the store's database, which Reset leaves
	// until track 9 moves Reset onto it. They go first: a fresh install has
	// none, and a store from before its settings table stops Reset before
	// it wipes anything.
	if _, err := s.c.Saved.ExecContext(ctx, `DELETE FROM settings`); err != nil {
		return errs.Database.Wrap(err)
	}
	if err := db.Wipe(ctx, s.c.DB, s.c.Migrations); err != nil {
		return fmt.Errorf("wipe database: %w", err)
	}
	entries, err := os.ReadDir(s.c.DataDir)
	if err != nil {
		return errs.Disk.Wrap(err)
	}
	keep := map[string]bool{}
	for _, path := range append([]string{s.c.DBPath}, s.c.Keep...) {
		base := filepath.Base(path)
		keep[base], keep[base+"-wal"], keep[base+"-shm"] = true, true, true
	}
	for _, e := range entries {
		n := e.Name()
		if keep[n] {
			continue
		}
		if err := os.RemoveAll(filepath.Join(s.c.DataDir, n)); err != nil {
			return errs.Disk.Wrap(err)
		}
	}
	return nil
}
