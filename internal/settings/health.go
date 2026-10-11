package settings

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/platform"
)

// The local checks, in the order the screen lists them. OpenRouter isn't
// here: its status lives beside the key. Ollama is, since it's a program
// on this machine.
var checkOrder = []string{"data_dir", "database", "poppler", "tesseract", "ollama"}

// Health runs every check.
func (s *Service) Health(ctx context.Context) Health {
	out := Health{Checks: make([]HealthCheck, 0, len(checkOrder))}
	for _, id := range checkOrder {
		out.Checks = append(out.Checks, s.check(ctx, id))
	}
	return out
}

// Fix repairs one check and returns it re-run.
func (s *Service) Fix(ctx context.Context, id string) (HealthCheck, error) {
	c := s.check(ctx, id)
	if c.ID == "" {
		return HealthCheck{}, httpx.NotFound("check")
	}
	if c.OK {
		return c, nil
	}
	if !c.Fixable {
		return HealthCheck{}, httpx.Errorf(httpx.CodeInvalid, "PSet can't fix this one itself. %s", c.Detail)
	}
	switch id {
	case "data_dir":
		if err := os.MkdirAll(s.c.DataDir, 0o700); err != nil {
			return HealthCheck{}, httpx.Errorf(httpx.CodeInvalid, "Couldn't create it: %v", err)
		}
	case "database":
		if err := db.Migrate(ctx, s.c.DB, s.c.Migrations); err != nil {
			return HealthCheck{}, httpx.Errorf(httpx.CodeInvalid, "The migration failed: %v", err)
		}
	case "ollama":
		if err := s.c.Dialer.Pull(ctx, llm.EmbedModel); err != nil {
			return HealthCheck{}, httpx.Errorf(httpx.CodeInvalid, "Ollama couldn't download %s: %v", llm.EmbedModel, err)
		}
	}
	return s.check(ctx, id), nil
}

func (s *Service) check(ctx context.Context, id string) HealthCheck {
	switch id {
	case "data_dir":
		return s.checkDataDir()
	case "database":
		return s.checkDatabase(ctx)
	case "poppler":
		return s.checkTool("poppler", "Poppler", "pdftoppm", installHint("poppler-utils", "poppler"))
	case "tesseract":
		return s.checkTool("tesseract", "Tesseract", "tesseract", installHint("tesseract-ocr", "tesseract"))
	case "ollama":
		return s.checkOllama(ctx)
	}
	return HealthCheck{}
}

// ollamaTimeout: Ollama is on this machine, so it answers at once or
// isn't running.
const ollamaTimeout = 3 * time.Second

// checkOllama asks the local Ollama which models it has: it searches the
// books with one. A missing model is fixable, since Ollama can download
// it; Ollama itself can't be.
func (s *Service) checkOllama(ctx context.Context) HealthCheck {
	c := HealthCheck{ID: "ollama", Name: "Ollama"}
	ctx, cancel := context.WithTimeout(ctx, ollamaTimeout)
	defer cancel()
	have, err := s.c.Dialer.Ollama(ctx)
	if err != nil {
		c.Detail = "not running. " + platform.OllamaHint(platform.Current)
		return c
	}
	for _, m := range have {
		if m == llm.EmbedModel || strings.HasPrefix(m, llm.EmbedModel+":") {
			c.OK, c.Detail = true, llm.EmbedModel
			return c
		}
	}
	c.Fixable = true
	c.Detail = "running, without " + llm.EmbedModel + ". Fix downloads it (about 270 MB)"
	return c
}

func (s *Service) checkDataDir() HealthCheck {
	c := HealthCheck{ID: "data_dir", Name: "Data directory"}
	dir := s.c.DataDir
	// Features create their own subdirectories when they first need them,
	// so the directory itself is all there is to check.
	if st, err := os.Stat(dir); err != nil || !st.IsDir() {
		c.Detail = dir + " doesn't exist"
		c.Fixable = true
		return c
	}
	if !writable(dir) {
		c.Detail = dir + " is not writable. Check its permissions."
		return c
	}
	c.OK = true
	c.Detail = dir + " is writable"
	if old := oldMacData(dir); old != "" {
		c.Detail += ". Data from an earlier version is still in " + old + ": PSet did not move it. Copy it here to bring it over"
	}
	return c
}

// oldMacData is the folder an earlier PSet kept its library in on a Mac,
// when there is one with a database in it that is not this one; else "".
func oldMacData(dir string) string {
	if platform.Current != platform.Mac {
		return ""
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	old := platform.OldMacDataDir(home)
	if old == dir {
		return ""
	}
	if _, err := os.Stat(filepath.Join(old, "pset.db")); err != nil {
		return ""
	}
	return old
}

func (s *Service) checkDatabase(ctx context.Context) HealthCheck {
	c := HealthCheck{ID: "database", Name: "Database"}
	var verdict string
	if err := s.c.DB.QueryRowContext(ctx, `PRAGMA quick_check`).Scan(&verdict); err != nil {
		c.Detail = "couldn't check it: " + err.Error()
		return c
	}
	if verdict != "ok" {
		c.Detail = "damaged: " + verdict + ". Reset starts it over."
		return c
	}
	pending, err := db.Pending(ctx, s.c.DB, s.c.Migrations)
	if err != nil {
		c.Detail = "couldn't read the schema: " + err.Error()
		return c
	}
	if len(pending) > 0 {
		c.Detail = fmt.Sprintf("%d schema updates to apply", len(pending))
		c.Fixable = true
		return c
	}
	c.OK = true
	c.Detail = "up to date"
	return c
}

// installHint is the command that installs a package on this machine: apt's
// name on Linux and WSL, Homebrew's on macOS.
func installHint(apt, brew string) string {
	return platform.InstallHint(platform.Current, apt, brew)
}

func (s *Service) checkTool(id, name, bin, install string) HealthCheck {
	c := HealthCheck{ID: id, Name: name}
	look := s.c.LookPath
	if look == nil {
		look = exec.LookPath
	}
	path, err := look(bin)
	if err != nil {
		c.Detail = "not installed. Install it with " + install
		return c
	}
	c.OK = true
	c.Detail = bin + " " + toolVersion(path)
	c.Detail = strings.TrimSpace(c.Detail)
	return c
}

// toolVersion finds the version number in a tool's -v output, which both
// poppler and tesseract print in their own format.
func toolVersion(path string) string {
	out, err := exec.Command(path, "-v").CombinedOutput()
	if err != nil && len(out) == 0 {
		return ""
	}
	for _, f := range strings.Fields(string(out)) {
		f = strings.TrimPrefix(f, "v")
		if len(f) > 0 && f[0] >= '0' && f[0] <= '9' && strings.Contains(f, ".") {
			return f
		}
	}
	return ""
}

func writable(dir string) bool {
	f, err := os.CreateTemp(dir, ".pset-probe-*")
	if err != nil {
		return false
	}
	cleanup.Close(f)
	cleanup.Remove(f.Name())
	return true
}
