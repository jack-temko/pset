package engine

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackt/pset/internal/store"
)

type DoctorOptions struct {
	Fix bool

	// nil means exec.LookPath; tests inject a stub.
	LookPath func(string) (string, error)
}

// Doctor reports a broken setup in the returned Report, not through an error.
func (e *Engine) Doctor(ctx context.Context, opts DoctorOptions) *Report {
	e.logger.Debug("running doctor", "fix", opts.Fix)
	r := &Report{}
	settings, err := e.Config(ctx)
	chatProbe, embedProbe := ProbeResult{OK: false, Detail: "could not read the saved settings"}, ProbeResult{OK: false, Detail: "could not read the saved settings"}
	if err == nil {
		client := e.llmClient(settings)
		chatProbe = probeWithTimeout(ctx, func(pctx context.Context) ProbeResult {
			return e.probeChat(pctx, client, settings)
		})
		embedProbe = probeWithTimeout(ctx, func(pctx context.Context) ProbeResult {
			return e.probeEmbed(pctx, client, settings)
		})
	}
	r.Checks = append(r.Checks,
		e.checkDataDir(opts),
		e.checkDatabase(ctx, opts),
		e.checkPoppler(opts),
		e.checkTesseract(opts),
		checkChat(chatProbe),
		checkEmbed(settings.EmbedModel, embedProbe),
	)
	for _, c := range r.Checks {
		e.logger.Debug("check complete", "name", c.Name, "status", string(c.Status))
	}
	return r
}

// probeTimeout bounds one endpoint probe so a hung server cannot hang the
// whole report.
const probeTimeout = 5 * time.Second

func probeWithTimeout(ctx context.Context, probe func(context.Context) ProbeResult) ProbeResult {
	pctx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()
	return probe(pctx)
}

// The endpoint checks never fix anything — their repairs live in Settings,
// which the findings link to.
func checkChat(probe ProbeResult) CheckResult {
	c := CheckResult{Name: "chat api"}
	if !probe.OK {
		c.failLink(Link{Label: "Add a key in Settings", Href: "/settings"}, "%s", probe.Detail)
		return c
	}
	c.Status = StatusOK
	c.add(SeverityInfo, "connected")
	return c
}

func checkEmbed(model string, probe ProbeResult) CheckResult {
	c := CheckResult{Name: "semantic search"}
	if !probe.OK {
		c.failLink(Link{Label: "Check it in Settings", Href: "/settings"}, "%s", probe.Detail)
		return c
	}
	c.Status = StatusOK
	c.add(SeverityInfo, "connected, model %s", model)
	return c
}

func (e *Engine) checkDataDir(opts DoctorOptions) CheckResult {
	c := CheckResult{Name: "data dir"}
	dir := filepath.Dir(e.dbPath)
	fixed := false
	for _, d := range []string{dir, filepath.Join(dir, "library")} {
		st, err := os.Stat(d)
		if err != nil && !os.IsNotExist(err) {
			c.fail("cannot access %s: %v", d, err)
			return c
		}
		if os.IsNotExist(err) {
			if !opts.Fix {
				c.Status = StatusWarn
				c.add(SeverityWarning, "%s does not exist (run with --fix to create)", d)
				continue
			}
			if err := os.MkdirAll(d, 0o700); err != nil {
				c.fail("cannot create %s: %v", d, err)
				return c
			}
			fixed = true
			c.add(SeverityInfo, "created %s", d)
		} else if !st.IsDir() {
			c.fail("%s exists but is not a directory", d)
			return c
		}
		if !writable(d) {
			c.fail("%s is not writable", d)
			return c
		}
		c.add(SeverityInfo, "%s is writable", d)
	}
	if fixed {
		c.Status = StatusFixed
	} else if c.Status != StatusWarn {
		c.Status = StatusOK
	}
	return c
}

func (e *Engine) checkDatabase(ctx context.Context, opts DoctorOptions) CheckResult {
	c := CheckResult{Name: "database"}

	// store.Open creates an empty file; check-only mode must not.
	if _, err := os.Stat(e.dbPath); err != nil && os.IsNotExist(err) && !opts.Fix {
		c.Status = StatusWarn
		c.add(SeverityWarning, "%s does not exist (run with --fix to create)", e.dbPath)
		return c
	}

	s, err := store.Open(e.dbPath)
	if err != nil {
		c.fail("cannot open database %s: %v", e.dbPath, err)
		return c
	}
	defer s.Close()

	verdict, err := s.QuickCheck(ctx)
	if err != nil {
		c.fail("integrity check failed: %v", err)
		return c
	}
	if verdict != "ok" {
		c.fail("integrity check returned %q", verdict)
		return c
	}

	current, err := s.Version(ctx)
	if err != nil {
		c.fail("read schema version: %v", err)
		return c
	}
	latest := store.LatestVersion()
	if current == latest {
		c.Status = StatusOK
		c.add(SeverityInfo, "schema v%d at %s", current, e.dbPath)
		return c
	}
	// The only migration left after the pre-release reset is the v0 → v1
	// bootstrap of a database doctor itself created. A foreign schema
	// (newer than this build) is refused by Migrate, not repaired.
	if !opts.Fix {
		c.Status = StatusWarn
		c.add(SeverityWarning, "schema v%d, expected v%d (run Repair to migrate)", current, latest)
		return c
	}
	if err := s.Migrate(ctx); err != nil {
		c.fail("schema migration failed: %v", err)
		return c
	}
	c.Status = StatusFixed
	c.add(SeverityInfo, "migrated schema v%d to v%d", current, latest)
	return c
}

var popplerTools = []string{"pdfinfo", "pdftotext"}

func (e *Engine) checkPoppler(opts DoctorOptions) CheckResult {
	return e.checkTools("poppler",
		"required to import PDFs; install poppler-utils (e.g. `sudo apt-get install poppler-utils`)",
		opts, popplerTools...)
}

func (e *Engine) checkTesseract(opts DoctorOptions) CheckResult {
	return e.checkTools("tesseract",
		"required to read scanned books; install e.g. `sudo apt-get install tesseract-ocr`",
		opts, "tesseract")
}

func (e *Engine) checkTools(name, hint string, opts DoctorOptions, tools ...string) CheckResult {
	c := CheckResult{Name: name}
	look := opts.LookPath
	if look == nil {
		look = exec.LookPath
	}

	var missing []string
	for _, tool := range tools {
		path, err := look(tool)
		if err != nil {
			missing = append(missing, tool)
			continue
		}
		if v := toolVersion(path); v != "" {
			c.add(SeverityInfo, "%s at %s (%s)", tool, path, v)
		} else {
			c.add(SeverityInfo, "%s at %s", tool, path)
		}
	}
	if len(missing) > 0 {
		c.Status = StatusWarn
		c.add(SeverityWarning, "missing %s, %s", strings.Join(missing, ", "), hint)
		return c
	}
	c.Status = StatusOK
	return c
}

func toolVersion(path string) string {
	out, err := exec.Command(path, "-v").CombinedOutput()
	if err != nil {
		return ""
	}
	line, _, _ := strings.Cut(strings.TrimSpace(string(out)), "\n")
	return line
}

func writable(dir string) bool {
	probe, err := os.CreateTemp(dir, ".pset-probe-*")
	if err != nil {
		return false
	}
	probe.Close()
	os.Remove(probe.Name())
	return true
}
