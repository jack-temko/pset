package store

import (
	"context"
	"testing"
)

func createSectionBook(t *testing.T, s *Store, sha string) *Book {
	t.Helper()
	b := &Book{SHA256: sha, FilePath: "/" + sha + ".pdf", FileSize: 1, PageCount: 10}
	if err := s.CreateBook(t.Context(), b); err != nil {
		t.Fatal(err)
	}
	return b
}

func TestSectionsTableExists(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	if v, err := s.Version(ctx); err != nil || v != LatestVersion() {
		t.Fatalf("version = %d/%v, want %d", v, err, LatestVersion())
	}

	// New books default to index_state none and start with no sections.
	createSectionBook(t, s, "v5book")
	got, err := s.BookBySHA256(ctx, "v5book")
	if err != nil {
		t.Fatal(err)
	}
	if got.Ready {
		t.Error("a book with no sections must not claim to be ready")
	}
	b := got
	sections, err := s.Sections(ctx, b.ID)
	if err != nil || sections != nil {
		t.Fatalf("sections = %v/%v, want none for an unindexed book", sections, err)
	}
}

func TestCreateSectionsRoundTripOrdering(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	b := createSectionBook(t, s, "order")

	in := []Section{
		{Level: 1, Title: "Alpha", Source: SourceOutline, StartPage: 1, EndPage: 4},
		{Level: 2, Title: "Alpha.1", Source: SourceOutline, StartPage: 2, EndPage: 4},
		{Level: 1, Title: "Beta", Source: SourceInferred, StartPage: 5, EndPage: 9},
	}
	// CreateSections assigns SortOrder from the slice position.
	for i := range in {
		in[i].SortOrder = i
	}
	if err := s.CreateSections(ctx, b.ID, in); err != nil {
		t.Fatal(err)
	}
	got, err := s.Sections(ctx, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != len(in) {
		t.Fatalf("sections = %d, want %d", len(got), len(in))
	}
	for i := range in {
		if got[i] != in[i] {
			t.Errorf("section %d = %+v, want %+v", i, got[i], in[i])
		}
	}
}

func TestCreateSectionsReplacesInPlace(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	b := createSectionBook(t, s, "replace")

	first := []Section{
		{Level: 1, Title: "Old One", Source: SourceOutline, StartPage: 1, EndPage: 5},
		{Level: 1, Title: "Old Two", Source: SourceOutline, StartPage: 6, EndPage: 9},
	}
	if err := s.CreateSections(ctx, b.ID, first); err != nil {
		t.Fatal(err)
	}
	second := []Section{
		{Level: 1, Title: "New One", Source: SourceOutline, StartPage: 1, EndPage: 3},
		{Level: 1, Title: "New Two", Source: SourceOutline, StartPage: 4, EndPage: 7},
		{Level: 1, Title: "New Three", Source: SourceOutline, StartPage: 8, EndPage: 9},
	}
	for i := range second {
		second[i].SortOrder = i
	}
	if err := s.CreateSections(ctx, b.ID, second); err != nil {
		t.Fatal(err)
	}

	got, err := s.Sections(ctx, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != len(second) {
		t.Fatalf("re-index left %d sections, want exactly the %d fresh rows", len(got), len(second))
	}
	for i := range second {
		if got[i] != second[i] {
			t.Errorf("section %d = %+v, want %+v", i, got[i], second[i])
		}
	}
}

func TestCreateSectionsEmptyClears(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	b := createSectionBook(t, s, "clear")
	if err := s.CreateSections(ctx, b.ID, []Section{
		{Level: 1, Title: "Temp", Source: SourceOutline, StartPage: 1, EndPage: 2},
	}); err != nil {
		t.Fatal(err)
	}
	if err := s.CreateSections(ctx, b.ID, nil); err != nil {
		t.Fatal(err)
	}
	got, err := s.Sections(ctx, b.ID)
	if err != nil || got != nil {
		t.Fatalf("sections after clear = %v/%v, want none", got, err)
	}
}

func TestSectionsArePerBookAndCascade(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	b1 := createSectionBook(t, s, "book1")
	b2 := createSectionBook(t, s, "book2")
	if err := s.CreateSections(ctx, b1.ID, []Section{
		{Level: 1, Title: "Only In One", Source: SourceOutline, StartPage: 1, EndPage: 2},
	}); err != nil {
		t.Fatal(err)
	}
	got, err := s.Sections(ctx, b2.ID)
	if err != nil || got != nil {
		t.Fatalf("book2 sections = %v, want none", got)
	}
	// Deleting the owning book cascades to its sections.
	if _, _, _, err := s.Reset(ctx); err != nil {
		t.Fatal(err)
	}
	sections, err := s.Sections(ctx, b1.ID)
	if err != nil || sections != nil {
		t.Fatalf("sections survived the book: %v/%v", sections, err)
	}
}
