package store

import (
	"context"
	"testing"
)

// TestReadinessIsDerived pins the rule that replaced the old state flags: a
// book is ready when its data says so, and stops being ready the instant the
// data stops saying so. Nothing writes a claim that could go stale.
func TestReadinessIsDerived(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}

	b := &Book{SHA256: "state1", FilePath: "/s.pdf", FileSize: 1, PageCount: 2}
	if err := s.CreateBookWithPages(ctx, b, []Page{
		{Number: 1, Text: "one"},
		{Number: 2, Text: "two"},
	}); err != nil {
		t.Fatal(err)
	}

	r, err := s.Readiness(ctx, b.ID, "m")
	if err != nil {
		t.Fatal(err)
	}
	if r.Ready() {
		t.Fatal("a book with no sections and no vectors must not be ready")
	}
	if got := r.Missing(); got != "index" {
		t.Fatalf("missing = %q, want %q", got, "index")
	}

	if err := s.CreateSections(ctx, b.ID, []Section{
		{Level: 1, Title: "One", Source: SourceInferred, StartPage: 1, EndPage: 2},
	}); err != nil {
		t.Fatal(err)
	}
	for _, n := range []int{1, 2} {
		if err := s.SaveEmbedding(ctx, b.ID, n, "m", []float32{1, 0}); err != nil {
			t.Fatal(err)
		}
	}
	if r, err = s.Readiness(ctx, b.ID, "m"); err != nil {
		t.Fatal(err)
	}
	if !r.Ready() {
		t.Fatalf("a fully prepared book must be ready: %+v", r)
	}

	// A different embedding model means the vectors no longer apply.
	if r, err = s.Readiness(ctx, b.ID, "other"); err != nil {
		t.Fatal(err)
	}
	if r.Ready() {
		t.Fatal("vectors from another model must not count as ready")
	}
}

// TestBlankPageIsNotAFailure pins the distinction the old pipeline threw
// away: a page the tools read as empty is finished, a page whose tools
// errored is missing. Only the second blocks the book.
func TestBlankPageIsNotAFailure(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	b := &Book{SHA256: "blank1", FilePath: "/b.pdf", FileSize: 1, PageCount: 2}
	if err := s.CreateBookWithPages(ctx, b, nil); err != nil {
		t.Fatal(err)
	}
	if err := s.SavePage(ctx, b.ID, Page{Number: 1, OCRStatus: PageBlank}); err != nil {
		t.Fatal(err)
	}
	if err := s.SavePage(ctx, b.ID, Page{Number: 2, OCRStatus: PageFailed, Error: "tesseract crashed"}); err != nil {
		t.Fatal(err)
	}

	r, err := s.Readiness(ctx, b.ID, "m")
	if err != nil {
		t.Fatal(err)
	}
	if r.PagesStored != 2 {
		t.Fatalf("pages stored = %d, want 2 — every page gets a row", r.PagesStored)
	}
	if r.PagesFailed != 1 {
		t.Fatalf("pages failed = %d, want 1 — the blank page is not a failure", r.PagesFailed)
	}
	if got := r.Missing(); got != "read" {
		t.Fatalf("missing = %q, want %q", got, "read")
	}

	// A failed page is not a resume marker: a retry must re-attempt it.
	nums, err := s.PageNumbers(ctx, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !nums[1] || nums[2] {
		t.Fatalf("settled pages = %v, want only the blank page", nums)
	}

	failed, err := s.FailedPages(ctx, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(failed) != 1 || failed[0].Number != 2 || failed[0].Error == "" {
		t.Fatalf("failed pages = %+v, want page 2 with a reason", failed)
	}

	// Recovering the page clears the block without touching anything else.
	if err := s.SavePage(ctx, b.ID, Page{Number: 2, Text: "recovered"}); err != nil {
		t.Fatal(err)
	}
	if r, err = s.Readiness(ctx, b.ID, "m"); err != nil {
		t.Fatal(err)
	}
	if r.PagesFailed != 0 {
		t.Fatalf("pages failed after recovery = %d, want 0", r.PagesFailed)
	}
}

func TestSavePageAndPageNumbers(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	b := &Book{SHA256: "pages1", FilePath: "/p.pdf", FileSize: 1}
	if err := s.CreateBookWithPages(ctx, b, nil); err != nil {
		t.Fatal(err)
	}

	for _, n := range []int{1, 3} {
		if err := s.SavePage(ctx, b.ID, Page{Number: n, Text: "text"}); err != nil {
			t.Fatal(err)
		}
	}
	nums, err := s.PageNumbers(ctx, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !nums[1] || !nums[3] || nums[2] {
		t.Fatalf("page numbers = %v, want 1 and 3 but not 2", nums)
	}

	// Saving a page again replaces it: a retry re-attempting a page that
	// failed is the whole point, so the write must not refuse.
	if err := s.SavePage(ctx, b.ID, Page{Number: 3, Text: "second attempt"}); err != nil {
		t.Fatalf("re-saving a page must replace it: %v", err)
	}
	got, err := s.Page(ctx, b.ID, 3)
	if err != nil {
		t.Fatal(err)
	}
	if got.Text != "second attempt" {
		t.Fatalf("page 3 text = %q, want the second attempt", got.Text)
	}
}

func TestPageCounts(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	b1 := &Book{SHA256: "c1", FilePath: "/1.pdf", FileSize: 1}
	b2 := &Book{SHA256: "c2", FilePath: "/2.pdf", FileSize: 2}
	if err := s.CreateBookWithPages(ctx, b1, []Page{{Number: 1, Text: "a"}, {Number: 2, Text: "b"}}); err != nil {
		t.Fatal(err)
	}
	if err := s.CreateBookWithPages(ctx, b2, nil); err != nil {
		t.Fatal(err)
	}

	counts, err := s.PageCounts(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if counts[b1.ID] != 2 || counts[b2.ID] != 0 {
		t.Fatalf("counts = %v, want book %s: 2", counts, b1.ID)
	}
}
