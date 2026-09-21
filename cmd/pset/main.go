// Command pset serves the PSet web app and its API. This file is wiring
// only: open the database, build the features, start the queue, serve.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/events"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/library"
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
	)
	ctx := context.Background()
	if err := db.Migrate(ctx, d, migrations); err != nil {
		return err
	}

	bus := events.NewBus()
	queue := jobs.New(d, log)
	queue.Lane(library.LaneImport, 1)

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

	mux := http.NewServeMux()
	cfg.Routes(mux)
	books.Routes(mux)
	mux.HandleFunc("GET /api/events", bus.Handler)
	mux.HandleFunc("/api/", httpx.NotFoundAPI)
	mux.Handle("/", httpx.SPA(web.Dist))

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
