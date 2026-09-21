// Package settings is the Settings screen's engine: the two model
// connections, the local health checks, Reset, and About.
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
	"strings"
	"time"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/llm"
)

// Defaults a fresh install shows. Showing isn't saving: a side counts as
// ready only once a Save has tested it.
var (
	DefaultChat  = ChatConnection{Endpoint: "https://api.z.ai/api/paas/v4", Model: "glm-5.3-flash"}
	DefaultEmbed = EmbedConnection{Endpoint: "http://localhost:11434/v1", Model: "nomic-embed-text"}
)

// Dialer tries a connection for real. The live one speaks to the model
// endpoints; tests swap in a fake.
type Dialer interface {
	// Chat sends a one-token request.
	Chat(ctx context.Context, c ChatConnection) error
	// Embed embeds one word and returns the vector's length.
	Embed(ctx context.Context, c EmbedConnection) (int, error)
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

type Service struct{ c Config }

func New(c Config) *Service { return &Service{c} }

// Get returns what the form shows: saved values, or defaults.
func (s *Service) Get(ctx context.Context) (Settings, error) {
	out := Settings{Chat: DefaultChat, Embeddings: DefaultEmbed}
	var err error
	if out.Ready.Chat, err = load(ctx, s.c.DB, keyChat, &out.Chat); err != nil {
		return Settings{}, err
	}
	if out.Ready.Embeddings, err = load(ctx, s.c.DB, keyEmbed, &out.Embeddings); err != nil {
		return Settings{}, err
	}
	return out, nil
}

// LLM is the saved connections, for the features that call models. A side
// never saved is blank, so llm.Config's Ready methods say what can run.
func (s *Service) LLM(ctx context.Context) (llm.Config, error) {
	cur, err := s.Get(ctx)
	if err != nil {
		return llm.Config{}, err
	}
	var c llm.Config
	if cur.Ready.Chat {
		c.ChatEndpoint, c.APIKey, c.ChatModel = cur.Chat.Endpoint, cur.Chat.APIKey, cur.Chat.Model
	}
	if cur.Ready.Embeddings {
		c.EmbedEndpoint, c.EmbedModel = cur.Embeddings.Endpoint, cur.Embeddings.Model
	}
	return c, nil
}

// probeTimeout keeps Test from hanging on an endpoint that accepts the
// connection and then says nothing.
const probeTimeout = 30 * time.Second

// Test dials one side as given and writes nothing.
func (s *Service) Test(ctx context.Context, in ConnectionInput) (TestResult, error) {
	ctx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()
	switch {
	case in.Chat != nil && in.Embeddings == nil:
		c := trimChat(*in.Chat)
		if err := validEndpoint(c.Endpoint); err != nil {
			return TestResult{}, err
		}
		if c.Model == "" {
			return TestResult{}, httpx.Invalid("model", "Name a model.")
		}
		if err := s.c.Dialer.Chat(ctx, c); err != nil {
			return TestResult{}, explain(err, true)
		}
		return TestResult{Detail: "Connected"}, nil
	case in.Embeddings != nil && in.Chat == nil:
		c := trimEmbed(*in.Embeddings)
		if err := validEndpoint(c.Endpoint); err != nil {
			return TestResult{}, err
		}
		if c.Model == "" {
			return TestResult{}, httpx.Invalid("model", "Name a model.")
		}
		dims, err := s.c.Dialer.Embed(ctx, c)
		if err != nil {
			return TestResult{}, explain(err, false)
		}
		return TestResult{Detail: fmt.Sprintf("Connected · %d dimensions", dims)}, nil
	}
	return TestResult{}, httpx.Errorf(httpx.CodeInvalid, "Send one side at a time: chat or embeddings.")
}

// Save tests one side, and writes it only if the test passes: what's
// stored always worked when it was stored.
func (s *Service) Save(ctx context.Context, in ConnectionInput) (SaveResult, error) {
	r, err := s.Test(ctx, in)
	if err != nil {
		return SaveResult{}, err
	}
	if in.Chat != nil {
		err = save(ctx, s.c.DB, keyChat, trimChat(*in.Chat))
	} else {
		err = save(ctx, s.c.DB, keyEmbed, trimEmbed(*in.Embeddings))
	}
	if err != nil {
		return SaveResult{}, err
	}
	cur, err := s.Get(ctx)
	return SaveResult{Settings: cur, Detail: r.Detail}, err
}

func trimChat(c ChatConnection) ChatConnection {
	return ChatConnection{strings.TrimSpace(c.Endpoint), strings.TrimSpace(c.APIKey), strings.TrimSpace(c.Model)}
}

func trimEmbed(c EmbedConnection) EmbedConnection {
	return EmbedConnection{strings.TrimSpace(c.Endpoint), strings.TrimSpace(c.Model)}
}

func validEndpoint(raw string) error {
	u, err := url.Parse(raw)
	if raw == "" || err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return httpx.Invalid("endpoint", "Not a URL. It should start with http:// or https://")
	}
	return nil
}

// explain turns a failed dial into the error for the field that caused
// it: the endpoint when nothing answers, the key when it's refused, the
// model when the server doesn't know it.
func explain(err error, chat bool) error {
	var le *llm.LLMError
	if errors.As(err, &le) {
		body := strings.ToLower(le.Body)
		switch {
		case chat && (le.Status == 401 || le.Status == 403):
			return httpx.Errorf(httpx.CodeBadKey, "The endpoint refused this key (%d)", le.Status).OnField("apiKey")
		case strings.Contains(body, "model"):
			return httpx.Errorf(httpx.CodeBadModel, "The endpoint doesn't know this model (%d)", le.Status).OnField("model")
		case le.Status == 404:
			return httpx.Errorf(httpx.CodeUnreachable, "Nothing answers at this path (404). Check the endpoint ends in /v1 or similar.").OnField("endpoint")
		default:
			return httpx.Errorf(httpx.CodeUnreachable, "The endpoint answered with an error (%d)", le.Status).OnField("endpoint")
		}
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return httpx.Errorf(httpx.CodeUnreachable, "The endpoint didn't answer in time").OnField("endpoint")
	}
	var ne net.Error
	var ue *url.Error
	if errors.As(err, &ne) || errors.As(err, &ue) {
		return httpx.Errorf(httpx.CodeUnreachable, "Can't reach this endpoint").OnField("endpoint")
	}
	return httpx.Errorf(httpx.CodeUnreachable, "The test failed: %v", err).OnField("endpoint")
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
