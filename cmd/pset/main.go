// Command pset serves the PSet web app and its API. This file is wiring
// only: open the database, build the features, start the queue, serve.
package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"sync/atomic"
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
	"github.com/jackt/pset/internal/pagenum"
	"github.com/jackt/pset/internal/platform"
	"github.com/jackt/pset/internal/settings"
	"github.com/jackt/pset/internal/update"
	"github.com/jackt/pset/internal/usage"
	"github.com/jackt/pset/web"
)

// Version is overridden at build time via -ldflags.
var Version = "0.1.0-dev"

func main() {
	fs := flag.NewFlagSet("pset", flag.ExitOnError)
	addr := fs.String("addr", "127.0.0.1:8420", "listen address")
	dataDir := fs.String("data", "", "data directory (default: $PSET_DATA, then ~/Library/Application Support/pset on a Mac, else ~/.local/share/pset)")
	open := fs.Bool("open", true, "open the browser once PSet is serving")
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
	exe, _ := update.Executable()
	if err := serve(*addr, dir, *open, log); err != nil {
		fail(err)
	}
	if restarting.Load() {
		// Served and shut down cleanly: the program on disk is the new one.
		// Same arguments, but the page is already open, so not another browser.
		args := append([]string{os.Args[0]}, append([]string{"-open=false"}, os.Args[1:]...)...)
		fail(fmt.Errorf("PSet was updated but couldn't start itself again (start it yourself): %w", syscall.Exec(exe, args, os.Environ())))
	}
}

// restarting is set when an update has replaced the program and PSet has been
// asked to start the new one once it has shut down.
var restarting atomic.Bool

// restartSelf asks for a clean shutdown (the same path as Ctrl+C: running jobs
// go back to queued and resume), after which main starts the new program.
func restartSelf() {
	restarting.Store(true)
	syscall.Kill(syscall.Getpid(), syscall.SIGTERM)
}

func serve(addr, dir string, open bool, log *slog.Logger) error {
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
		usage.Migrations(),
		library.Migrations(),
		memory.Migrations(),
		homework.Migrations(),
		ask.Migrations(),
		activity.Migrations(),
	)
	ctx := context.Background()
	// A new version that changes an existing library's schema backs it up
	// first, whichever way it was installed.
	if backup, err := db.BackupBeforeMigrating(ctx, d, migrations, dir, Version); err != nil {
		return err
	} else if backup != "" {
		log.Info("this version updates the database: a copy of it was kept", "backup", backup)
	}
	if err := db.Migrate(ctx, d, migrations); err != nil {
		return err
	}

	// Every model request and reply, to trace a bad answer to its prompt.
	llm.LogCallsTo(filepath.Join(dir, "logs", "llm.jsonl"))
	llm.SetSessionPrefix(installTag(dir))
	// Every call's cost, recorded on what it was spent on.
	llm.OnCall(usage.Sink(d))
	if err := usage.Sweep(ctx, d); err != nil {
		log.Warn("usage: sweep", "err", err)
	}

	bus := events.NewBus()
	queue := jobs.New(d, log)
	queue.Lane(library.LaneImport, 1)
	queue.Lane(homework.LaneQuestion, 2)
	queue.Lane(homework.LaneAssignment, 2)
	// Many books may be answering at once; each book one question at a time.
	queue.Lane(ask.LaneTurn, 8)

	cfg := settings.New(settings.Config{
		DB: d, DataDir: dir, DBPath: dbPath, Version: Version,
		Migrations: migrations,
		Dialer:     settings.LiveDialer{},
		Queue:      queue,
	})
	// The book remover deletes a book's homework and turn usage through
	// these, which the features fill in once built.
	var sets *homework.Service
	var tutor *ask.Service
	books := library.New(library.Config{
		DB: d, DataDir: dir, Events: bus, Queue: queue, Models: cfg,
		ForgetCalls: func(ctx context.Context, bookID string) error {
			if err := sets.ForgetBookCalls(ctx, bookID); err != nil {
				return err
			}
			return tutor.ForgetBookCalls(ctx, bookID)
		},
	})
	cfg.SetLibrary(books)
	memories := memory.New(d, bus)
	// Time is counted by activity and read by homework, which activity in
	// turn reads "questions worked" from: built first, told after.
	clock := activity.New(d, nil)
	sets = homework.New(homework.Config{
		DB: d, Events: bus, Queue: queue, Library: homeworkLibrary{books}, Settings: cfg,
		Memory: agentMemory{memories}, Time: clock,
	})
	clock.SetHomework(sets)

	tutor = ask.New(ask.Config{
		DB: d, Events: bus, Queue: queue, Library: askLibrary{books}, Settings: cfg,
		Memory: agentMemory{memories},
	})

	mux := http.NewServeMux()
	cfg.Routes(mux)
	books.Routes(mux)
	sets.Routes(mux)
	tutor.Routes(mux)
	memories.Routes(mux)
	clock.Routes(mux)
	updater := update.New(update.Config{
		Version: Version, PublicKey: update.PublicKey,
		Busy: func(ctx context.Context) (n int, err error) {
			err = d.QueryRowContext(ctx, `SELECT count(*) FROM jobs WHERE state IN ('queued', 'running')`).Scan(&n)
			return
		},
		Restart: restartSelf,
	})
	updater.Routes(mux)
	mux.HandleFunc("GET /api/events", bus.Handler)
	mux.HandleFunc("/api/", httpx.NotFoundAPI)
	mux.Handle("/", httpx.SPAFrom(web.Dist, "dist"))

	// The port is taken before the queue starts: a second copy on the same
	// data would otherwise put the first one's running jobs back to queued,
	// and start them again, before finding the port busy.
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", addr, err)
	}
	defer ln.Close()

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
		Handler:           httpx.LocalOnly(addr, mux),
		ReadHeaderTimeout: 10 * time.Second,
		BaseContext:       func(net.Listener) context.Context { return handlerCtx },
	}
	serveErr := make(chan error, 1)
	go func() { serveErr <- srv.Serve(ln) }()
	fmt.Printf("PSet serving at http://%s (data in %s)\n", addr, dir)
	if open {
		// The server is up and the port is ours: the page will load. A machine
		// with no way to open a browser is not an error, it just isn't opened.
		if err := platform.OpenBrowser(platform.BrowserURL(addr)); err != nil {
			log.Info("couldn't open a browser; open the address above yourself", "err", err)
		}
	}

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
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		dir = platform.DataDir(platform.Current, home, os.Getenv("XDG_DATA_HOME"))
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
	if err == nil {
		hb.Parts, err = l.Parts(ctx, id)
	}
	return hb, err
}

type askLibrary struct{ *library.Service }

func (l askLibrary) Book(ctx context.Context, id string) (ask.Book, error) {
	b, err := l.Get(ctx, id)
	return ask.Book{ID: b.ID, Title: b.Title, PageCount: b.PageCount, Pages: pagenum.New(b.PageRuns)}, err
}

// agentMemory is the book's preferences as the tutor's loop reads and
// writes them: notes in, remember and forget out. Only the student's Ask
// saves, so everything it remembers is theirs.
type agentMemory struct{ *memory.Service }

func note(m memory.Memory) agent.Note {
	return agent.Note{ID: m.ID, Text: m.Text, Source: string(m.Source)}
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
	m, outcome, err := a.Save(ctx, bookID, memory.Save{Text: n.Text, Source: memory.SourceYou, Replaces: n.Replaces})
	return note(m), string(outcome), err
}

func (a agentMemory) Forget(ctx context.Context, bookID, ref string) (agent.Note, error) {
	m, err := a.Service.Forget(ctx, bookID, ref)
	return note(m), err
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

// installTag names this install in OpenRouter sessions: a short hash of
// the data directory, the same every run, and different for a copy of the
// library kept elsewhere.
func installTag(dir string) string {
	if abs, err := filepath.Abs(dir); err == nil {
		dir = abs
	}
	sum := sha256.Sum256([]byte(dir))
	return "pset-" + hex.EncodeToString(sum[:4])
}
