// Command pset serves the PSet web app and its API. This file is wiring
// only: open the database, build the features, start the queue, serve.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"github.com/jackt/pset/internal/pagenum"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/jackt/pset/internal/activity"
	"github.com/jackt/pset/internal/agent"
	"github.com/jackt/pset/internal/ask"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/events"
	"github.com/jackt/pset/internal/homework"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/library"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/memory"
	"github.com/jackt/pset/internal/settings"
	"github.com/jackt/pset/web"
)

// Version is overridden at build time via -ldflags.
var Version = "0.1.0-dev"

func main() {
	fs := flag.NewFlagSet("pset", flag.ExitOnError)
	addr := fs.String("addr", "127.0.0.1:8420", "listen address")
	dataDir := fs.String("data", "", "data directory (default: $PSET_DATA, then ~/.local/share/pset)")
	verbose := fs.Bool("verbose", false, "log debug detail")
	showVersion := fs.Bool("version", false, "print the version and exit")
	fs.Parse(os.Args[1:])

	if *showVersion {
		fmt.Println("pset", Version)
		return
	}
	level := slog.LevelInfo
	if *verbose {
		level = slog.LevelDebug
	}
	log := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level}))
	httpx.Logger = log

	dir, err := resolveDataDir(*dataDir)
	if err != nil {
		fail(err)
	}
	if err := serve(*addr, dir, log); err != nil {
		fail(err)
	}
}

func serve(addr, dir string, log *slog.Logger) error {
	dbPath := filepath.Join(dir, "pset.db")
	d, err := db.Open(dbPath)
	if err != nil {
		return err
	}
	defer d.Close()

	// Every feature's migrations, in dependency order: a table's parent
	// before the table.
	migrations := concat(
		jobs.Migrations(),
		settings.Migrations(),
		library.Migrations(),
		memory.Migrations(),
		homework.Migrations(),
		ask.Migrations(),
		activity.Migrations(),
	)
	ctx := context.Background()
	if err := db.Migrate(ctx, d, migrations); err != nil {
		return err
	}

	// Every model request and reply, to trace a bad answer to its prompt.
	llm.LogCallsTo(filepath.Join(dir, "logs", "llm.jsonl"))

	bus := events.NewBus()
	queue := jobs.New(d, log)
	queue.Lane(library.LaneImport, 1)
	queue.Lane(homework.LaneQuestion, 2)
	// Many books may be answering at once; each book one question at a time.
	queue.Lane(ask.LaneTurn, 8)

	cfg := settings.New(settings.Config{
		DB: d, DataDir: dir, DBPath: dbPath, Version: Version,
		Migrations: migrations,
		Dialer:     settings.LiveDialer{},
		Queue:      queue,
	})
	books := library.New(library.Config{
		DB: d, DataDir: dir, Events: bus, Queue: queue, Models: cfg,
	})
	cfg.SetLibrary(books)
	memories := memory.New(d, bus)
	sets := homework.New(homework.Config{
		DB: d, Events: bus, Queue: queue, Library: homeworkLibrary{books}, Settings: cfg,
		Memory: homeworkMemory{agentMemory{memories}},
	})

	tutor := ask.New(ask.Config{
		DB: d, Events: bus, Queue: queue, Library: askLibrary{books}, Settings: cfg,
		Memory: agentMemory{memories},
	})

	mux := http.NewServeMux()
	cfg.Routes(mux)
	books.Routes(mux)
	sets.Routes(mux)
	tutor.Routes(mux)
	memories.Routes(mux)
	activity.New(d, sets).Routes(mux)
	mux.HandleFunc("GET /api/events", bus.Handler)
	mux.HandleFunc("/api/", httpx.NotFoundAPI)
	mux.Handle("/", httpx.SPAFrom(web.Dist, "dist"))

	runCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	queueDone := make(chan struct{})
	go func() {
		if err := queue.Run(runCtx); err != nil {
			log.Error("queue stopped", "err", err)
		}
		close(queueDone)
	}()

	// Handlers hang off a context of their own so shutdown can end the
	// event stream, which otherwise never returns while a tab is open.
	handlerCtx, endHandlers := context.WithCancel(context.Background())
	defer endHandlers()
	srv := &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
		BaseContext:       func(net.Listener) context.Context { return handlerCtx },
	}
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", addr, err)
	}
	serveErr := make(chan error, 1)
	go func() { serveErr <- srv.Serve(ln) }()
	fmt.Printf("PSet serving at http://%s (data in %s)\n", addr, dir)

	select {
	case err := <-serveErr:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-runCtx.Done():
	}

	// Running jobs go back to queued and resume on the next start.
	select {
	case <-queueDone:
	case <-time.After(30 * time.Second):
		log.Warn("the queue did not stop in time")
	}
	endHandlers()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); errors.Is(err, context.DeadlineExceeded) {
		srv.Close()
	}
	return nil
}

func resolveDataDir(flagValue string) (string, error) {
	dir := flagValue
	if dir == "" {
		dir = os.Getenv("PSET_DATA")
	}
	if dir == "" {
		base := os.Getenv("XDG_DATA_HOME")
		if base == "" {
			home, err := os.UserHomeDir()
			if err != nil {
				return "", err
			}
			base = filepath.Join(home, ".local", "share")
		}
		dir = filepath.Join(base, "pset")
	}
	dir, err := filepath.Abs(dir)
	if err != nil {
		return "", err
	}
	return dir, os.MkdirAll(dir, 0o700)
}

// homeworkLibrary hands homework the book facts it asks for, in its own
// shape.
type homeworkLibrary struct{ *library.Service }

func (l homeworkLibrary) Book(ctx context.Context, id string) (homework.Book, error) {
	b, err := l.Get(ctx, id)
	hb := homework.Book{ID: b.ID, Title: b.Title, PageCount: b.PageCount, Pages: pagenum.New(b.PageRuns)}
	if b.Problems != nil {
		hb.Problems = *b.Problems
	}
	return hb, err
}

type askLibrary struct{ *library.Service }

func (l askLibrary) Book(ctx context.Context, id string) (ask.Book, error) {
	b, err := l.Get(ctx, id)
	return ask.Book{ID: b.ID, Title: b.Title, PageCount: b.PageCount, Pages: pagenum.New(b.PageRuns)}, err
}

// agentMemory is the book's memory as the tutor's loop reads and writes
// it: notes in, remember and forget out.
type agentMemory struct{ *memory.Service }

func note(m memory.Memory) agent.Note {
	n := agent.Note{ID: m.ID, Kind: string(m.Kind), Text: m.Text, Source: string(m.Source)}
	if m.Page != nil {
		n.Page = *m.Page
	}
	return n
}

func (a agentMemory) Notes(ctx context.Context, bookID string) ([]agent.Note, error) {
	ms, err := a.ForPrompt(ctx, bookID)
	out := make([]agent.Note, len(ms))
	for i, m := range ms {
		out[i] = note(m)
	}
	return out, err
}

func (a agentMemory) Remember(ctx context.Context, bookID string, n agent.NewNote) (agent.Note, string, error) {
	in := memory.Save{Kind: memory.Kind(n.Kind), Text: n.Text, Source: memory.SourceTutor, Replaces: n.Replaces}
	if n.FromStudent {
		in.Source = memory.SourceYou
	}
	if n.Page > 0 {
		in.Page = &n.Page
	}
	m, outcome, err := a.Save(ctx, bookID, in)
	return note(m), string(outcome), err
}

func (a agentMemory) Forget(ctx context.Context, bookID, ref string) (agent.Note, error) {
	m, err := a.Service.Forget(ctx, bookID, ref)
	return note(m), err
}

// homeworkMemory adds the problem ranges locate keeps.
type homeworkMemory struct{ agentMemory }

func (h homeworkMemory) ProblemsSeen(ctx context.Context, bookID string, chapter int) (homework.Problems, error) {
	p, err := h.Service.ProblemsSeen(ctx, bookID, chapter)
	out := homework.Problems{MemoryID: p.MemoryID, Text: p.Text}
	for _, s := range p.Seen {
		out.Seen = append(out.Seen, homework.Seen{Label: s.Label, Page: s.Page})
	}
	return out, err
}

func concat(lists ...[]db.Migration) []db.Migration {
	var out []db.Migration
	for _, l := range lists {
		out = append(out, l...)
	}
	return out
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "pset:", err)
	os.Exit(1)
}
