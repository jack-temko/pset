package settings

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/httpx"
)

// The local checks, in the order the screen lists them. The endpoints
// aren't here: their status lives beside their fields.
var checkOrder = []string{"data_dir", "database", "poppler", "tesseract"}

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
		return s.checkTool("poppler", "Poppler", "pdftoppm", "sudo apt install poppler-utils")
	case "tesseract":
		return s.checkTool("tesseract", "Tesseract", "tesseract", "sudo apt install tesseract-ocr")
	}
	return HealthCheck{}
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
	return c
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
	f.Close()
	os.Remove(f.Name())
	return true
}
