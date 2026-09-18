package store

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
)

func testStore(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func TestMigrateIdempotent(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()

	if err := s.Migrate(ctx); err != nil {
		t.Fatalf("first migrate: %v", err)
	}
	if err := s.Migrate(ctx); err != nil {
		t.Fatalf("second migrate: %v", err)
	}
	v, err := s.Version(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if v != LatestVersion() {
		t.Fatalf("version = %d, want %d", v, LatestVersion())
	}
}

func TestVersionUninitialized(t *testing.T) {
	s := testStore(t)
	v, err := s.Version(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if v != 0 {
		t.Fatalf("version = %d, want 0", v)
	}
}

func TestBookCRUD(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}

	in := &Book{
		SHA256:     "abc123",
		FilePath:   "/books/calculus.pdf",
		FileSize:   12345,
		Title:      "Calculus",
		Author:     "Stewart",
		PageCount:  1200,
		PDFVersion: "1.7",
	}
	if err := s.CreateBook(ctx, in); err != nil {
		t.Fatalf("create: %v", err)
	}
	if in.ID == "" {
		t.Fatal("ID not set")
	}

	got, err := s.BookBySHA256(ctx, "abc123")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Title != in.Title || got.Author != in.Author || got.FileSize != in.FileSize ||
		got.PageCount != in.PageCount || got.PDFVersion != in.PDFVersion ||
		got.CreatedAt.IsZero() || got.UpdatedAt.IsZero() {
		t.Fatalf("roundtrip mismatch:\n got  %+v\n want %+v", got, in)
	}

	all, err := s.Books(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 1 || all[0].SHA256 != "abc123" {
		t.Fatalf("list = %+v, want one book with sha abc123", all)
	}
}

func TestBookBySHA256NotFound(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := s.BookBySHA256(ctx, "nope"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
}

func TestBookSHA256Unique(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	first := &Book{SHA256: "dup", FilePath: "/a.pdf", FileSize: 1}
	dup := &Book{SHA256: "dup", FilePath: "/b.pdf", FileSize: 2}
	if err := s.CreateBook(ctx, first); err != nil {
		t.Fatalf("first insert: %v", err)
	}
	if err := s.CreateBook(ctx, dup); err == nil {
		t.Fatal("duplicate sha256 should be rejected")
	}
}

func TestMigrateRefusesNewerSchema(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(`INSERT INTO schema_migrations (version, applied_at) VALUES (99, '2026-09-12T00:00:00Z')`); err != nil {
		t.Fatal(err)
	}
	err := s.Migrate(ctx)
	if !errors.Is(err, ErrSchemaMismatch) {
		t.Fatalf("err = %v, want ErrSchemaMismatch", err)
	}
}

func TestMigrateV2KeepsEmbeddings(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()

	// Build the database exactly as v2 left it — the shape every existing
	// library is on — and put one vector in it.
	if _, err := s.db.Exec(createMigrationsTable); err != nil {
		t.Fatal(err)
	}
	for _, m := range migrations {
		if m.version <= 2 {
			if err := s.apply(ctx, m); err != nil {
				t.Fatalf("apply v%d: %v", m.version, err)
			}
		}
	}
	b := &Book{SHA256: "v2-library", FilePath: "/a.pdf", FileSize: 1}
	if err := s.CreateBook(ctx, b); err != nil {
		t.Fatal(err)
	}
	// x'0000803f' is the float32 1.0.
	if _, err := s.db.Exec(`INSERT INTO embeddings (id, book_id, page_number, model, vector)
		VALUES ('kept', ?, 4, 'nomic-embed-text', x'0000803f')`, b.ID); err != nil {
		t.Fatal(err)
	}

	if err := s.Migrate(ctx); err != nil {
		t.Fatalf("migrate to v%d: %v", LatestVersion(), err)
	}
	got, err := s.Embeddings(ctx, b.ID, "nomic-embed-text")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].PageNumber != 4 || len(got[0].Vector) != 1 || got[0].Vector[0] != 1 {
		t.Fatalf("embeddings after migration = %+v, want page 4's vector carried over", got)
	}

	// The point of the rebuild: the same page holds a vector per model, and
	// re-saving one model leaves the other alone.
	if err := s.SaveEmbedding(ctx, b.ID, 4, "other-model", []float32{2}); err != nil {
		t.Fatal(err)
	}
	if err := s.SaveEmbedding(ctx, b.ID, 4, "nomic-embed-text", []float32{3}); err != nil {
		t.Fatal(err)
	}
	both, err := s.Embeddings(ctx, b.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(both) != 2 {
		t.Fatalf("%d embeddings after saving a second model, want one per model", len(both))
	}
}
