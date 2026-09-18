package store

import (
	"context"
	"testing"
)

func TestCreateBookWithPages(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}

	b := &Book{SHA256: "withpages", FilePath: "/lib/x.pdf", FileSize: 9, Title: "T"}
	pages := []Page{
		{Number: 1, Text: "first page"},
		{Number: 2, Text: ""},
		{Number: 3, Text: "third page"},
	}
	if err := s.CreateBookWithPages(ctx, b, pages); err != nil {
		t.Fatalf("create: %v", err)
	}

	got, err := s.Pages(ctx, b.ID)
	if err != nil {
		t.Fatalf("pages: %v", err)
	}
	if len(got) != len(pages) {
		t.Fatalf("len = %d, want %d", len(got), len(pages))
	}
	for i, p := range got {
		if p.Number != pages[i].Number || p.Text != pages[i].Text {
			t.Errorf("page %d = (%d, %q), want (%d, %q)",
				i, p.Number, p.Text, pages[i].Number, pages[i].Text)
		}
	}
}

func TestPagesAreOrderedAndScoped(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}

	b1 := &Book{SHA256: "a", FilePath: "/a.pdf", FileSize: 1}
	b2 := &Book{SHA256: "b", FilePath: "/b.pdf", FileSize: 2}
	if err := s.CreateBookWithPages(ctx, b1, []Page{{Number: 2, Text: "b-two"}, {Number: 1, Text: "b-one"}}); err != nil {
		t.Fatal(err)
	}
	if err := s.CreateBookWithPages(ctx, b2, []Page{{Number: 1, Text: "other book"}}); err != nil {
		t.Fatal(err)
	}

	got, err := s.Pages(ctx, b1.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0].Text != "b-one" || got[1].Text != "b-two" {
		t.Fatalf("pages = %+v, want b-one then b-two", got)
	}
}
