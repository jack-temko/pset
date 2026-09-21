// Command dev is `make dev`: the Go server rebuilt and restarted on save,
// the TS types regenerated whenever a wire.go changes, and Vite serving the
// UI with /api proxied to the server. One terminal, one Ctrl+C.
//
// It polls instead of using inotify so it needs no dependency, and works
// the same under WSL where file events from Windows editors are unreliable.
package main

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

const bin = ".dev/pset"

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	data := os.Getenv("PSET_DATA")
	if data == "" {
		data = ".dev/data"
	}
	vite := exec.CommandContext(ctx, "npm", "run", "dev")
	vite.Dir = "web"
	vite.Stdout, vite.Stderr = os.Stdout, os.Stderr
	if err := vite.Start(); err != nil {
		fmt.Fprintln(os.Stderr, "dev: vite:", err)
		os.Exit(1)
	}

	var server *exec.Cmd
	var lastGo, lastWire time.Time
	for {
		goMod, wireMod := latest()
		if wireMod.After(lastWire) {
			lastWire = wireMod
			run("go", "tool", "tygo", "generate")
		}
		if goMod.After(lastGo) {
			lastGo = goMod
			if run("go", "build", "-o", bin, "./cmd/pset") {
				halt(server)
				server = exec.Command(bin, "-data", data)
				server.Stdout, server.Stderr = os.Stdout, os.Stderr
				if err := server.Start(); err != nil {
					fmt.Fprintln(os.Stderr, "dev: start:", err)
				}
			}
		}
		select {
		case <-ctx.Done():
			halt(server)
			vite.Wait()
			return
		case <-time.After(500 * time.Millisecond):
		}
	}
}

// latest is the newest mtime of any Go file, and of any wire.go.
func latest() (goMod, wireMod time.Time) {
	for _, root := range []string{"cmd", "internal", "web/embed.go"} {
		filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() || !strings.HasSuffix(p, ".go") || strings.HasSuffix(p, "_test.go") {
				return nil
			}
			info, err := d.Info()
			if err != nil {
				return nil
			}
			if t := info.ModTime(); t.After(goMod) {
				goMod = t
			}
			if filepath.Base(p) == "wire.go" && info.ModTime().After(wireMod) {
				wireMod = info.ModTime()
			}
			return nil
		})
	}
	return
}

func run(name string, args ...string) bool {
	cmd := exec.Command(name, args...)
	cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
	if err := cmd.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "dev: %s %s: %v\n", name, strings.Join(args, " "), err)
		return false
	}
	return true
}

func halt(c *exec.Cmd) {
	if c == nil || c.Process == nil {
		return
	}
	c.Process.Signal(os.Interrupt)
	done := make(chan struct{})
	go func() { c.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(10 * time.Second):
		c.Process.Kill()
		<-done
	}
}
