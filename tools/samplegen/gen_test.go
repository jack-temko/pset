package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// committedTestdata holds the samples the repo ships; tests regenerate into a
// temp dir and require byte equality with it.
const committedTestdata = "../../testdata"

func readCommittedManifest(t *testing.T) Manifest {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(committedTestdata, "manifest.json"))
	if err != nil {
		t.Fatalf("committed manifest missing; run `go run ./tools/samplegen`: %v", err)
	}
	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("parse committed manifest: %v", err)
	}
	return m
}

func generate(t *testing.T) (*Manifest, string) {
	t.Helper()
	dir := t.TempDir()
	m, err := Generate(dir)
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	return m, dir
}

func fileSHA256(t *testing.T, path string) string {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// TestGenerateReproducesCommittedTestdata is the strongest guard on
// determinism: a fresh run must be byte-identical to what the repo ships.
func TestGenerateReproducesCommittedTestdata(t *testing.T) {
	readCommittedManifest(t)
	m, dir := generate(t)

	for _, book := range []BookManifest{m.Digital, m.Scanned, m.Flat} {
		if got, want := book.SHA256, fileSHA256(t, filepath.Join(dir, book.File)); got != want {
			t.Fatalf("%s: manifest sha256 %s != file sha256 %s", book.File, got, want)
		}
		committedPath := filepath.Join(committedTestdata, book.File)
		if book.SHA256 != fileSHA256(t, committedPath) {
			t.Errorf("%s: regenerated sha256 %s != committed %s; rerun `go run ./tools/samplegen` and commit",
				book.File, book.SHA256, fileSHA256(t, committedPath))
		}
	}

	committedManifest, err := os.ReadFile(filepath.Join(committedTestdata, "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	freshManifest, err := os.ReadFile(filepath.Join(dir, "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(committedManifest, freshManifest) {
		t.Error("regenerated manifest.json differs from committed manifest.json")
	}
}

// TestGenerateStableAcrossCalls pins reproducibility within one process.
func TestGenerateStableAcrossCalls(t *testing.T) {
	_, dir1 := generate(t)
	_, dir2 := generate(t)
	for _, name := range []string{"sample-digital.pdf", "sample-scanned.pdf", "sample-flat.pdf", "manifest.json"} {
		a, err := os.ReadFile(filepath.Join(dir1, name))
		if err != nil {
			t.Fatal(err)
		}
		b, err := os.ReadFile(filepath.Join(dir2, name))
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(a, b) {
			t.Fatalf("%s differs between two runs in one process", name)
		}
	}
}

func specText(chapters []chapter) string {
	var sb strings.Builder
	for _, ch := range chapters {
		sb.WriteString(ch.title)
		sb.WriteString(" ")
		for _, p := range ch.paras {
			sb.WriteString(p.text)
			sb.WriteString(" ")
		}
	}
	return sb.String()
}

func TestDigitalBookBudget(t *testing.T) {
	words := countWords(digitalSpec.chapters)
	if words > 1200 {
		t.Fatalf("digital book has %d words, budget is 1200", words)
	}
	if pages := 2 + len(digitalSpec.chapters); pages > 8 {
		t.Fatalf("digital book has %d pages, budget is 8", pages)
	}
	facts := digitalFacts(digitalSpec)
	if len(facts) < 8 || len(facts) > 12 {
		t.Fatalf("digital book plants %d facts, want 8-12", len(facts))
	}
	text := specText(digitalSpec.chapters)
	for _, anchor := range []string{"KAX-4471", "TVR-09", "Umbel-7", "Mirefill Basin", "0.37 karsts"} {
		if !strings.Contains(text, anchor) {
			t.Errorf("digital book missing low-prior anchor %q", anchor)
		}
	}
}

func TestScannedBookBudget(t *testing.T) {
	if pages := 2 + len(scannedSpec.chapters); pages > 6 {
		t.Fatalf("scanned book has %d pages, budget is 6", pages)
	}
	facts := scannedFacts(scannedSpec)
	if len(facts) < 8 || len(facts) > 12 {
		t.Fatalf("scanned book plants %d facts, want 8-12", len(facts))
	}
	text := specText(scannedSpec.chapters)
	for _, anchor := range []string{"TVR-09", "4,006", "Brontide", "Umbel-7"} {
		if !strings.Contains(text, anchor) {
			t.Errorf("scanned book missing low-prior anchor %q", anchor)
		}
	}
}

func TestFlatBookBudget(t *testing.T) {
	if pages := len(flatSpec.pages); pages > 8 {
		t.Fatalf("flat book has %d pages, budget is 8", pages)
	}
	facts := flatFacts(flatSpec)
	if len(facts) < 8 || len(facts) > 12 {
		t.Fatalf("flat book plants %d facts, want 8-12", len(facts))
	}
	headings := flatHeadings(flatSpec)
	if len(headings) < 2 || len(headings) > 6 {
		t.Fatalf("flat book plants %d headings, want 2-6", len(headings))
	}
	if words := countFlatWords(flatSpec); words < 100 {
		t.Fatalf("flat book has %d words, want a real text layer (> 100)", words)
	}
	// The heading and body sizes are what the inference path measures; the
	// gap must clear the engine's 1.25x body-median rule with room to spare.
	if float64(flatHeadingPt) < float64(flatBodyPt)*1.4 {
		t.Fatalf("heading %dpt is under 1.4x the %dpt body; the classifier needs a clear gap", flatHeadingPt, flatBodyPt)
	}
}
