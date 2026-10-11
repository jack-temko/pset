package pdf

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func requirePoppler(t *testing.T) {
	t.Helper()
	for _, bin := range []string{"pdfinfo", "pdftotext"} {
		if _, err := exec.LookPath(bin); err != nil {
			t.Skipf("poppler not installed: %s not on PATH; skipping poppler-dependent test", bin)
		}
	}
}

func samplePath(t *testing.T, name string) string {
	t.Helper()
	path := filepath.Join("..", "..", "testdata", name)
	if _, err := filepath.Abs(path); err != nil {
		t.Fatal(err)
	}
	return path
}

// Local copy of the manifest shape; internal/pdf must not depend on the
// generator, only on the JSON contract documented in testdata/README.md.
type manifestFact struct {
	ID   string
	Text string
	Page int
}

type manifestBook struct {
	File   string
	SHA256 string
	Pages  int
	Title  string
	Author string
	Facts  []manifestFact
}

type sampleManifest struct {
	Digital manifestBook
	Scanned manifestBook
}

func loadSampleManifest(t *testing.T) sampleManifest {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("..", "..", "testdata", "manifest.json"))
	if err != nil {
		t.Fatalf("read committed manifest: %v", err)
	}
	var m sampleManifest
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("parse committed manifest: %v", err)
	}
	return m
}

func normalize(s string) string { return strings.Join(strings.Fields(s), " ") }

func TestMetadataDigitalSampleMatchesManifest(t *testing.T) {
	requirePoppler(t)
	m := loadSampleManifest(t)

	got, err := Metadata(context.Background(), samplePath(t, m.Digital.File))
	if err != nil {
		t.Fatalf("Metadata: %v", err)
	}
	if got.Title != m.Digital.Title {
		t.Errorf("title = %q, want %q", got.Title, m.Digital.Title)
	}
	if got.Author != m.Digital.Author {
		t.Errorf("author = %q, want %q", got.Author, m.Digital.Author)
	}
	if got.PageCount != m.Digital.Pages {
		t.Errorf("page count = %d, want %d", got.PageCount, m.Digital.Pages)
	}
	if got.PDFVersion == "" {
		t.Error("PDFVersion not parsed from pdfinfo output")
	}
}

func TestDigitalTextContainsPlantedFacts(t *testing.T) {
	requirePoppler(t)
	m := loadSampleManifest(t)

	text, err := Text(context.Background(), samplePath(t, m.Digital.File))
	if err != nil {
		t.Fatalf("Text: %v", err)
	}
	got := normalize(text)
	for _, fact := range m.Digital.Facts {
		if !strings.Contains(got, normalize(fact.Text)) {
			t.Errorf("fact %s not found in extracted text: %q", fact.ID, fact.Text)
		}
	}
	if !strings.Contains(got, "KAX-4471") {
		t.Error("low-prior token KAX-4471 not found in extracted text")
	}
}

func TestScannedTextIsNearEmpty(t *testing.T) {
	requirePoppler(t)
	m := loadSampleManifest(t)

	text, err := Text(context.Background(), samplePath(t, m.Scanned.File))
	if err != nil {
		t.Fatalf("Text: %v", err)
	}
	if n := len(strings.TrimSpace(text)); n >= 50 {
		t.Errorf("scanned sample yielded %d characters of text; a fake scan must have no text layer", n)
	}
}

func TestMetadataNotInstalled(t *testing.T) {
	t.Setenv("PATH", t.TempDir())
	_, err := Metadata(context.Background(), "whatever.pdf")
	if !errors.Is(err, ErrNotInstalled) {
		t.Fatalf("err = %v, want ErrNotInstalled", err)
	}
}
