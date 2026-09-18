package engine

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

type Engine struct {
	dbPath   string
	logger   *slog.Logger
	progress func(Event)

	openMu     sync.Mutex
	mu         sync.Mutex
	runner     *Runner
	origins    map[string]string
	overrides  map[string]map[string]int // job id → per-step maxAttempts from its submit body
	events     *eventBroker
	settingsMu sync.Mutex
}

type Config struct {
	DBPath string
	// Logger receives the developer trace (debug-level stage detail); nil
	// discards it. Adapters choose destination and level.
	Logger *slog.Logger
	// Progress receives user-facing events for main state transitions; nil
	// discards them. Adapters render Event however they like.
	Progress func(Event)
}

func New(cfg Config) (*Engine, error) {
	dbPath, err := resolveDBPath(cfg.DBPath)
	if err != nil {
		return nil, err
	}
	logger := cfg.Logger
	if logger == nil {
		logger = slog.New(slog.NewTextHandler(io.Discard, nil))
	}
	return &Engine{
		dbPath:    dbPath,
		logger:    logger,
		progress:  cfg.Progress,
		origins:   map[string]string{},
		overrides: map[string]map[string]int{},
		events:    newEventBroker(),
	}, nil
}

func (e *Engine) DBPath() string { return e.dbPath }

// Migrate brings the database up to the current schema.
func (e *Engine) Migrate(ctx context.Context) error {
	s, err := e.openStore(ctx)
	if err != nil {
		return err
	}
	return s.Close()
}

func DefaultDBPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("find home directory: %w", err)
	}
	return filepath.Join(home, ".pset", "pset.db"), nil
}

func resolveDBPath(flag string) (string, error) {
	path := flag
	if path == "" {
		path = os.Getenv("PSET_DB")
	}
	if path == "" {
		return DefaultDBPath()
	}
	path, err := expandTilde(path)
	if err != nil {
		return "", err
	}
	return filepath.Abs(path)
}

func expandTilde(path string) (string, error) {
	if path == "~" || strings.HasPrefix(path, "~/") {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("find home directory: %w", err)
		}
		return filepath.Join(home, strings.TrimPrefix(path, "~")), nil
	}
	return path, nil
}

func (e *Engine) setRunner(r *Runner) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.runner = r
}

func (e *Engine) getRunner() *Runner {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.runner
}

func (e *Engine) nudgeRunner() {
	if r := e.getRunner(); r != nil {
		r.nudge()
	}
}

// recordOrigin remembers the server-side source path of an import job for
// the life of this process; it is display metadata only and is not persisted.
func (e *Engine) recordOrigin(jobID string, path string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.origins[jobID] = path
}

func (e *Engine) origin(jobID string) string {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.origins[jobID]
}

// recordSubmitOverrides remembers a submit body's per-step maxAttempts for
// the job's first claim; the skeleton persists them onto the step rows.
func (e *Engine) recordSubmitOverrides(jobID string, m map[string]int) {
	if len(m) == 0 {
		return
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	e.overrides[jobID] = m
}

func (e *Engine) submitOverride(jobID, key string) (int, bool) {
	e.mu.Lock()
	defer e.mu.Unlock()
	m, ok := e.overrides[jobID]
	if !ok {
		return 0, false
	}
	n, ok := m[key]
	return n, ok
}

func (e *Engine) dropSubmitOverrides(jobID string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	delete(e.overrides, jobID)
}
