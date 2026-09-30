package ocr

import (
	"context"
	"errors"
	"os/exec"
	"strings"
	"testing"
)

const scanned = "../../testdata/sample-scanned.pdf"

func need(t *testing.T) {
	t.Helper()
	for _, tool := range []string{"pdftoppm", "tesseract"} {
		if _, err := exec.LookPath(tool); err != nil {
			t.Skip(tool + " not installed")
		}
	}
}

// The committed scan's title page reads as its title.
func TestPageReadsTheScannedSample(t *testing.T) {
	need(t)
	text, err := Page(context.Background(), scanned, 1, "eng")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(text, "Primer of Brontolithics") {
		t.Fatalf("page 1 read as %q", text)
	}
}

func TestPageErrors(t *testing.T) {
	need(t)
	ctx := context.Background()
	if _, err := Page(ctx, scanned, 99, "eng"); err == nil {
		t.Error("a page past the end read")
	}
	if _, err := Page(ctx, scanned, 1, "no-such-language"); err == nil || !strings.Contains(err.Error(), "no-such-language") {
		t.Errorf("a missing language pack: %v", err)
	}
	cctx, cancel := context.WithCancel(ctx)
	cancel()
	if _, err := Page(cctx, scanned, 1, "eng"); err == nil {
		t.Error("a cancelled read finished")
	}
}

// With no PATH, the tools are missing and the error says so.
func TestPageWithoutTheTools(t *testing.T) {
	t.Setenv("PATH", t.TempDir())
	if _, err := Page(context.Background(), scanned, 1, "eng"); !errors.Is(err, ErrNotInstalled) {
		t.Fatalf("err = %v, want ErrNotInstalled", err)
	}
}
