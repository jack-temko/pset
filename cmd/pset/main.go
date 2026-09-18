package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackt/pset/internal/api"
	"github.com/jackt/pset/internal/engine"
)

// Version is overridden at build time via -ldflags.
var Version = "0.1.0-dev"

func main() {
	fs := flag.NewFlagSet("pset", flag.ExitOnError)
	addr := fs.String("addr", "127.0.0.1:8420", "listen address for the web server")
	dbPath := fs.String("db", "", "SQLite database path (default: $PSET_DB, then ~/.pset/pset.db)")
	verbose := fs.Bool("verbose", false, "log a detailed developer trace to stderr")
	showVersion := fs.Bool("version", false, "print the pset version and exit")
	fs.Parse(os.Args[1:])

	if *showVersion {
		fmt.Println("pset", Version)
		return
	}
	if fs.NArg() > 0 {
		fmt.Fprintf(os.Stderr, "pset: unexpected argument %q — pset serves the web interface and API\n", fs.Arg(0))
		os.Exit(1)
	}

	eng, err := engine.New(engine.Config{
		DBPath: *dbPath,
		Logger: newLogger(*verbose),
	})
	if err != nil {
		fail(err)
	}

	// Migrate up front so a broken database is an exit code, not a broken
	// server.
	if err := eng.Migrate(context.Background()); err != nil {
		fail(err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	runner := engine.NewRunner(eng)
	go runner.Run(ctx)

	// Handlers hang off a context of their own so shutdown can end the
	// long-lived ones. The event stream deliberately never returns while its
	// client is listening, and Shutdown only waits for connections to go
	// idle — it does not cancel requests — so without this every Ctrl+C sat
	// out the full grace period and then reported a deadline.
	handlerCtx, endHandlers := context.WithCancel(context.Background())
	defer endHandlers()

	srv := &http.Server{
		Addr:              *addr,
		Handler:           api.New(Version, eng).Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		BaseContext:       func(net.Listener) context.Context { return handlerCtx },
	}
	ln, err := net.Listen("tcp", *addr)
	if err != nil {
		fail(fmt.Errorf("listen on %s: %w", *addr, err))
	}

	serveErr := make(chan error, 1)
	go func() {
		if err := srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serveErr <- err
		}
		close(serveErr)
	}()

	fmt.Printf("PSet serving at http://%s\n", *addr)

	select {
	case err := <-serveErr:
		if err != nil {
			fail(err)
		}
		return
	case <-ctx.Done():
	}

	// Shutdown pauses the running job at a page or stage boundary (its
	// status returns to queued), then stops serving.
	select {
	case <-runner.Done():
	case <-time.After(30 * time.Second):
		fmt.Fprintln(os.Stderr, "pset: the job runner did not pause in time; exiting")
	}
	// Tell the streaming handlers to let go, then drain.
	endHandlers()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		// A client that will not let go is not a reason to exit non-zero:
		// everything worth keeping is already on disk by here.
		if errors.Is(err, context.DeadlineExceeded) {
			fmt.Fprintln(os.Stderr, "pset: a connection did not close in time; exiting anyway")
			srv.Close()
		} else {
			fail(err)
		}
	}
	if err := runner.Err(); err != nil {
		fail(err)
	}
}

func newLogger(verbose bool) *slog.Logger {
	if !verbose {
		return slog.New(slog.NewTextHandler(io.Discard, nil))
	}
	return slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelDebug}))
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "pset:", err)
	os.Exit(1)
}
