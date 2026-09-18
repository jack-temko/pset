package engine

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func fakeLook(missing ...string) func(string) (string, error) {
	return func(name string) (string, error) {
		for _, m := range missing {
			if m == name {
				return "", errors.New(name + " not found")
			}
		}
		return "/usr/bin/" + name, nil
	}
}

func statuses(r *Report) map[string]Status {
	out := map[string]Status{}
	for _, c := range r.Checks {
		out[c.Name] = c.Status
	}
	return out
}

// doctorEngine returns an engine with scripted chat and embed endpoints, so
// the readiness checks pass. Failure tests build a bare New engine instead
// and expect the two endpoint checks to fail.
func doctorEngine(t *testing.T, dir string) *Engine {
	t.Helper()
	e, err := New(Config{DBPath: filepath.Join(dir, "pset.db")})
	if err != nil {
		t.Fatal(err)
	}
	chat := startFakeChat(t, "ok")
	embed := startFakeEmbed(t, &fakeEmbed{})
	if err := e.SaveConfig(context.Background(), Settings{
		APIBaseURL:   chat.srv.URL,
		APIKey:       "test-key",
		EmbedBaseURL: embed.URL,
		EmbedModel:   DefaultEmbedModel,
	}); err != nil {
		t.Fatal(err)
	}
	return e
}

func TestDoctorFixBuildsFullSetup(t *testing.T) {
	base := t.TempDir()
	e := doctorEngine(t, base)

	ctx := context.Background()
	report := e.Doctor(ctx, DoctorOptions{Fix: true, LookPath: fakeLook()})
	if !report.OK() {
		t.Fatalf("report not OK: %+v", report.Checks)
	}
	st := statuses(report)
	if st["data dir"] != StatusFixed || st["database"] != StatusFixed {
		t.Fatalf("statuses = %v, want data dir and database fixed", st)
	}
	if st["poppler"] != StatusOK {
		t.Fatalf("poppler status = %s, want ok", st["poppler"])
	}
	if st["chat api"] != StatusOK || st["semantic search"] != StatusOK {
		t.Fatalf("statuses = %v, want chat api and semantic search ok", st)
	}
	if info, err := os.Stat(filepath.Join(base, "library")); err != nil || !info.IsDir() {
		t.Fatalf("library dir not created: %v", err)
	}
	if _, err := os.Stat(e.DBPath()); err != nil {
		t.Fatalf("database not created: %v", err)
	}

	report = e.Doctor(ctx, DoctorOptions{LookPath: fakeLook()})
	if !report.OK() {
		t.Fatalf("rerun not OK: %+v", report.Checks)
	}
	for name, s := range statuses(report) {
		if s != StatusOK {
			t.Fatalf("check %q: status %s, want ok", name, s)
		}
	}
}

func TestDoctorCheckOnlyChangesNothing(t *testing.T) {
	base := t.TempDir()
	e := doctorEngine(t, base)

	report := e.Doctor(context.Background(), DoctorOptions{LookPath: fakeLook()})
	if !report.OK() {
		t.Fatalf("missing-but-fixable setup should not count as failed: %+v", report.Checks)
	}
	if _, err := os.Stat(e.DBPath()); !os.IsNotExist(err) {
		t.Fatal("check-only run must not create the database")
	}
	st := statuses(report)
	if st["data dir"] != StatusWarn || st["database"] != StatusWarn {
		t.Fatalf("statuses = %v, want data dir and database warn", st)
	}
}

func TestDoctorMissingPopplerWarns(t *testing.T) {
	base := t.TempDir()
	e := doctorEngine(t, base)

	report := e.Doctor(context.Background(), DoctorOptions{
		Fix:      true,
		LookPath: fakeLook("pdfinfo", "pdftotext"),
	})
	if !report.OK() {
		t.Fatal("missing poppler should warn, not fail, while doctor cannot install it")
	}
	st := statuses(report)
	if st["poppler"] != StatusWarn {
		t.Fatalf("poppler status = %s, want warn", st["poppler"])
	}
	if len(report.Warnings()) == 0 {
		t.Fatal("expected at least one warning")
	}
}

// Unconfigured chat and embed are platform failures, not warnings: imports
// and asks hard-fail without them, so the report is not OK and both
// findings point at Settings. Both endpoints point at a closed port so the
// test stays hermetic (the default embed URL can legitimately answer on a
// dev machine).
func TestDoctorEndpointChecksFailWithoutConfig(t *testing.T) {
	base := t.TempDir()
	e, err := New(Config{DBPath: filepath.Join(base, "pset.db")})
	if err != nil {
		t.Fatal(err)
	}
	if err := e.SaveConfig(context.Background(), Settings{
		APIBaseURL:   "http://127.0.0.1:1",
		EmbedBaseURL: "http://127.0.0.1:1/v1",
		EmbedModel:   DefaultEmbedModel,
	}); err != nil {
		t.Fatal(err)
	}

	report := e.Doctor(context.Background(), DoctorOptions{Fix: true, LookPath: fakeLook()})
	if report.OK() {
		t.Fatalf("report OK without chat/embed config: %+v", report.Checks)
	}
	st := statuses(report)
	if st["chat api"] != StatusFailed {
		t.Fatalf("chat api status = %s, want failed", st["chat api"])
	}
	if st["semantic search"] != StatusFailed {
		t.Fatalf("semantic search status = %s, want failed", st["semantic search"])
	}
	checks := map[string]CheckResult{}
	for _, c := range report.Checks {
		checks[c.Name] = c
	}
	for _, name := range []string{"chat api", "semantic search"} {
		f := checks[name]
		if len(f.Findings) == 0 || f.Findings[0].Link == nil || f.Findings[0].Link.Href != "/settings" {
			t.Fatalf("check %q findings = %+v, want a failure finding linking to /settings", name, f.Findings)
		}
	}
}
