// Root-level tests for the committed sample books in testdata/. They guard
// the manifest contract (hashes, structure, sizes) and, when poppler is
// installed, cross-check page counts against what poppler reports.
package pset

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/jackt/pset/internal/pdf"
)

const testdataDir = "testdata"

const maxSampleSize = 250 << 10 // 250KB

type sampleFact struct {
	ID   string `json:"id"`
	Text string `json:"text"`
	Page int    `json:"page"`
}

type sampleHeading struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Page  int    `json:"page"`
	Level int    `json:"level"`
}

type sampleBook struct {
	File     string          `json:"file"`
	SHA256   string          `json:"sha256"`
	Pages    int             `json:"pages"`
	Title    string          `json:"title"`
	Author   string          `json:"author"`
	Subject  string          `json:"subject"`
	Facts    []sampleFact    `json:"facts"`
	Outline  []sampleHeading `json:"outline"`
	Headings []sampleHeading `json:"headings"`
}

type sampleManifest struct {
	Digital sampleBook `json:"digital"`
	Scanned sampleBook `json:"scanned"`
	Flat    sampleBook `json:"flat"`
}

func loadSampleManifest(t *testing.T) sampleManifest {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(testdataDir, "manifest.json"))
	if err != nil {
		t.Fatalf("read manifest: %v", err)
	}
	var m sampleManifest
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("parse manifest: %v", err)
	}
	return m
}

func requirePoppler(t *testing.T) {
	t.Helper()
	for _, bin := range []string{"pdfinfo", "pdftotext"} {
		if _, err := exec.LookPath(bin); err != nil {
			t.Skipf("poppler not installed: %s not on PATH; skipping poppler-dependent test", bin)
		}
	}
}

// TestSampleManifestIntegrity verifies the committed files against
// manifest.json: hashes, size budget, page ranges, and fact structure.
func TestSampleManifestIntegrity(t *testing.T) {
	m := loadSampleManifest(t)
	if m.Digital.Title == "" || m.Digital.Author == "" || m.Digital.Subject == "" {
		t.Error("digital manifest must carry title, author, and subject (the PDF metadata)")
	}
	if m.Scanned.Title != "" || m.Scanned.Author != "" {
		t.Error("scanned manifest must not carry document metadata")
	}
	if m.Flat.Title == "" || m.Flat.Outline != nil || len(m.Flat.Headings) == 0 {
		t.Error("flat manifest must carry metadata and planted headings but no outline")
	}
	if m.Digital.Headings != nil {
		t.Error("digital manifest must not carry inferred headings")
	}
	if len(m.Digital.Outline) == 0 {
		t.Error("digital manifest must carry the planted bookmark outline")
	}

	// Structural entries: outline levels nest upward from 1, headings are flat.
	for _, mark := range m.Digital.Outline {
		if mark.Level < 1 || mark.Level > 3 {
			t.Errorf("outline entry %s has level %d, want 1..3", mark.ID, mark.Level)
		}
	}
	for _, mark := range m.Flat.Headings {
		if mark.Level != 1 {
			t.Errorf("heading %s has level %d, want 1 (inferred sections are flat)", mark.ID, mark.Level)
		}
	}

	for _, book := range []sampleBook{m.Digital, m.Scanned, m.Flat} {
		path := filepath.Join(testdataDir, book.File)
		info, err := os.Stat(path)
		if err != nil {
			t.Fatalf("committed sample missing: %v", err)
		}
		if info.Size() > maxSampleSize {
			t.Errorf("%s is %d bytes; samples must stay under %d", book.File, info.Size(), maxSampleSize)
		}

		data, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		sum := sha256.Sum256(data)
		if got := hex.EncodeToString(sum[:]); got != book.SHA256 {
			t.Errorf("%s sha256 = %s, manifest says %s", book.File, got, book.SHA256)
		}

		if book.Pages < 1 || book.Pages > 50 {
			t.Errorf("%s: page count %d out of range", book.File, book.Pages)
		}
		if len(book.Facts) < 8 || len(book.Facts) > 12 {
			t.Errorf("%s: %d facts, want 8-12", book.File, len(book.Facts))
		}

		seen := map[string]bool{}
		for _, f := range book.Facts {
			if f.ID == "" {
				t.Errorf("%s: fact with empty id", book.File)
			}
			if seen[f.ID] {
				t.Errorf("%s: duplicate fact id %s", book.File, f.ID)
			}
			seen[f.ID] = true
			if f.Text == "" {
				t.Errorf("%s: fact %s has empty text", book.File, f.ID)
			}
			if f.Page < 1 || f.Page > book.Pages {
				t.Errorf("%s: fact %s on page %d, outside 1..%d", book.File, f.ID, f.Page, book.Pages)
			}
		}
	}
}

// TestSamplePageCountsMatchManifest is the poppler cross-check: pdfinfo must
// see exactly the page count the generator recorded.
func TestSamplePageCountsMatchManifest(t *testing.T) {
	requirePoppler(t)
	m := loadSampleManifest(t)

	for _, book := range []sampleBook{m.Digital, m.Scanned, m.Flat} {
		got, err := pdf.Metadata(t.Context(), filepath.Join(testdataDir, book.File))
		if err != nil {
			t.Fatalf("metadata for %s: %v", book.File, err)
		}
		if got.PageCount != book.Pages {
			t.Errorf("%s: poppler reports %d pages, manifest says %d", book.File, got.PageCount, book.Pages)
		}
	}
}
