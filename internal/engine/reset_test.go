package engine

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/jackt/pset/internal/store"
)

func TestResetPreviewAndApply(t *testing.T) {
	e := testEngine(t, discardLogger())
	ctx := context.Background()

	if err := os.MkdirAll(filepath.Dir(e.DBPath()), 0o700); err != nil {
		t.Fatal(err)
	}
	s, err := store.Open(e.DBPath())
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	if err := s.CreateBookWithPages(ctx,
		&store.Book{SHA256: "x1", FilePath: "/1.pdf", FileSize: 1},
		[]store.Page{{Number: 1, Text: "one"}}); err != nil {
		t.Fatal(err)
	}
	if err := s.Close(); err != nil {
		t.Fatal(err)
	}

	libraryDir := filepath.Join(filepath.Dir(e.DBPath()), "library")
	if err := os.MkdirAll(libraryDir, 0o700); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"a.pdf", "b.pdf"} {
		if err := os.WriteFile(filepath.Join(libraryDir, name), []byte("pdf"), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	plan, err := e.Reset(ctx, ResetOptions{})
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	if plan.Books != 1 || plan.Pages != 1 || plan.LibraryFiles != 2 {
		t.Fatalf("plan = %+v, want 1 book / 1 page / 2 files", plan)
	}
	entries, err := os.ReadDir(libraryDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 2 {
		t.Fatalf("preview must not delete library files, found %d", len(entries))
	}

	res, err := e.Reset(ctx, ResetOptions{Apply: true})
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if res.Books != 1 || res.Pages != 1 || res.LibraryFiles != 2 {
		t.Fatalf("result = %+v, want 1 book / 1 page / 2 files", res)
	}

	entries, err = os.ReadDir(libraryDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Fatalf("library holds %d files after reset, want 0", len(entries))
	}

	s2, err := store.Open(e.DBPath())
	if err != nil {
		t.Fatal(err)
	}
	defer s2.Close()
	all, err := s2.Books(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 0 {
		t.Fatalf("books after reset = %d, want 0", len(all))
	}
	v, err := s2.Version(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if v != store.LatestVersion() {
		t.Fatalf("version after reset = %d, want %d", v, store.LatestVersion())
	}
}

func TestResetOnFreshSetup(t *testing.T) {
	e := testEngine(t, discardLogger())
	res, err := e.Reset(context.Background(), ResetOptions{Apply: true})
	if err != nil {
		t.Fatalf("reset on fresh setup: %v", err)
	}
	if res.Books != 0 || res.Pages != 0 || res.LibraryFiles != 0 {
		t.Fatalf("result = %+v, want all zero", res)
	}
}
