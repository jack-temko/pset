package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// TestSampleBooksRoundTrip imports both committed sample PDFs the way the
// future import command will — content hash and size from the real file
// bytes, metadata from the manifest — and fetches them back by sha256.
func TestSampleBooksRoundTrip(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("..", "..", "testdata", "manifest.json"))
	if err != nil {
		t.Fatalf("read committed manifest: %v", err)
	}
	var m struct {
		Digital struct {
			File   string
			Pages  int
			Title  string
			Author string
		}
		Scanned struct {
			File  string
			Pages int
		}
	}
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("parse committed manifest: %v", err)
	}

	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}

	for _, bm := range []struct {
		file, title, author string
		pages               int
	}{
		{m.Digital.File, m.Digital.Title, m.Digital.Author, m.Digital.Pages},
		{m.Scanned.File, "", "", m.Scanned.Pages},
	} {
		path := filepath.Join("..", "..", "testdata", bm.file)
		pdf, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read %s: %v", path, err)
		}
		sum := sha256.Sum256(pdf)

		in := &Book{
			SHA256:     hex.EncodeToString(sum[:]),
			FilePath:   path,
			FileSize:   int64(len(pdf)),
			Title:      bm.title,
			Author:     bm.author,
			PageCount:  bm.pages,
			PDFVersion: "1.4",
		}
		if err := s.CreateBook(ctx, in); err != nil {
			t.Fatalf("create %s: %v", bm.file, err)
		}
		if in.ID == "" {
			t.Fatalf("%s: ID not set", bm.file)
		}

		got, err := s.BookBySHA256(ctx, in.SHA256)
		if err != nil {
			t.Fatalf("fetch %s by sha: %v", bm.file, err)
		}
		if got.SHA256 != in.SHA256 || got.FilePath != in.FilePath ||
			got.FileSize != in.FileSize || got.Title != in.Title ||
			got.Author != in.Author || got.PageCount != in.PageCount ||
			got.PDFVersion != in.PDFVersion {
			t.Fatalf("%s roundtrip mismatch:\n got  %+v\n want %+v", bm.file, got, in)
		}
		if got.ID != in.ID {
			t.Errorf("%s: ID = %s, want %s", bm.file, got.ID, in.ID)
		}
		if got.CreatedAt.IsZero() || got.UpdatedAt.IsZero() {
			t.Errorf("%s: timestamps not persisted", bm.file)
		}
	}
}
