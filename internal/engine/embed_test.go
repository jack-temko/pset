package engine

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/store"
)

func embedSettings(chatURL string, embedURL string) Settings {
	return Settings{
		APIBaseURL:   chatURL,
		APIKey:       "key",
		EmbedBaseURL: embedURL,
		EmbedModel:   "test-embed-model",
	}
}

func storedEmbeddingPages(t *testing.T, e *Engine, bookID, model string) map[int]bool {
	t.Helper()
	s, err := e.openStore(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	embeddings, err := s.Embeddings(context.Background(), bookID, model)
	if err != nil {
		t.Fatal(err)
	}
	out := map[int]bool{}
	for _, emb := range embeddings {
		if emb.Model != model {
			t.Errorf("page %d carries model %q, want %q", emb.PageNumber, emb.Model, model)
		}
		out[emb.PageNumber] = true
	}
	return out
}

// TestSearchPhaseSkipsTextlessPages pins that a blank page is not a gap: it
// has nothing to embed, and its absence from the index never blocks a book.
func TestSearchPhaseSkipsTextlessPages(t *testing.T) {
	e := testEngine(t, discardLogger())
	ctx := context.Background()

	book := seedFakeBook(t, e, "embedskip01", "Skip Blanks", store.KindDigital, 3)
	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.InsertPages(ctx, book.ID, []store.Page{
		{Number: 1, Text: "page one carries the brontolith fact"},
		{Number: 2, Text: "  \n ", OCRStatus: store.PageBlank},
		{Number: 3, Text: "page three carries the brontolith fact"},
	}); err != nil {
		t.Fatal(err)
	}
	s.Close()

	srv := startFakeEmbed(t, &fakeEmbed{})
	if err := e.SaveConfig(ctx, embedSettings("", srv.URL)); err != nil {
		t.Fatal(err)
	}
	row, err := runPhaseFor(t, e, book, "search")
	if err != nil {
		t.Fatalf("search phase: %v", err)
	}
	if row.Status != store.PhaseDone {
		t.Fatalf("search phase = %q/%q, want done", row.Status, row.Error)
	}
	done := storedEmbeddingPages(t, e, book.ID, "test-embed-model")
	if len(done) != 2 || !done[1] || !done[3] {
		t.Errorf("embedded pages = %v, want pages 1 and 3 only", done)
	}
}

func TestSearchPhaseResumesAndReplaces(t *testing.T) {
	e := testEngine(t, discardLogger())
	ctx := context.Background()

	book := seedFakeBook(t, e, "embed0001", "Embed Me", store.KindDigital, 33)
	seedBookPages(t, e, book.ID, 33)

	fake := &fakeEmbed{}
	srv := startFakeEmbed(t, fake)
	if err := e.SaveConfig(ctx, embedSettings("", srv.URL)); err != nil {
		t.Fatal(err)
	}

	// First run: the endpoint dies on the second batch, leaving 32 of 33
	// pages embedded (batch size 32).
	fake.failAfterBatches(1)
	row, err := runPhaseFor(t, e, book, "search")
	if err == nil {
		t.Fatal("a dead endpoint must fail the search phase")
	}
	if row.Status != store.PhaseFailed {
		t.Fatalf("search phase = %q, want failed", row.Status)
	}
	done := storedEmbeddingPages(t, e, book.ID, "test-embed-model")
	if len(done) != 32 {
		t.Fatalf("%d embeddings after the failed run, want 32", len(done))
	}
	// The book is not ready: a page that should carry a vector does not.
	if r := readinessOf(t, e, book); r.Ready() || r.Vectors >= r.PagesWithText {
		t.Fatalf("readiness = %+v, want not ready with a page still unindexed", r)
	}

	// Second run: healthy endpoint — the 32 done pages are skipped and only
	// the remaining page is requested.
	fake.stopFailing()
	firstRunRequests := fake.count()
	row2, err := runPhaseFor(t, e, book, "search")
	if err != nil {
		t.Fatalf("resumed search phase: %v", err)
	}
	if row2.Status != store.PhaseDone {
		t.Fatalf("resumed phase = %q/%q, want done", row2.Status, row2.Error)
	}
	done = storedEmbeddingPages(t, e, book.ID, "test-embed-model")
	if len(done) != 33 {
		t.Fatalf("%d embeddings after the resume, want 33", len(done))
	}
	if fake.count()-firstRunRequests != 1 {
		t.Errorf("resume made %d requests, want 1 (only the missing page)", fake.count()-firstRunRequests)
	}

	// Re-embedding under a different model replaces every vector, and
	// readiness follows the model that is actually configured.
	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.SaveEmbedding(ctx, book.ID, 1, "ancient-model", []float32{1, 2, 3}); err != nil {
		t.Fatal(err)
	}
	s.Close()

	if err := e.SaveConfig(ctx, Settings{APIKey: "key", EmbedBaseURL: srv.URL, EmbedModel: "new-embed-model"}); err != nil {
		t.Fatal(err)
	}
	row3, err := runPhaseFor(t, e, book, "search")
	if err != nil {
		t.Fatalf("model-mismatch search phase: %v", err)
	}
	if row3.Status != store.PhaseDone {
		t.Fatalf("model-mismatch phase = %q/%q, want done", row3.Status, row3.Error)
	}
	current := storedEmbeddingPages(t, e, book.ID, "new-embed-model")
	if len(current) != 33 {
		t.Fatalf("%d embeddings under the new model, want 33", len(current))
	}
	s, _ = e.openStore(ctx)
	defer s.Close()
	old, err := s.Embeddings(ctx, book.ID, "ancient-model")
	if err != nil || len(old) != 0 {
		t.Fatalf("old-model embeddings survived: %v/%d", err, len(old))
	}
}

// TestImportRefusedWithoutEmbedEndpoint pins the preflight: preparation ends
// in semantic search, so a missing connection is refused at the door rather
// than discovered after the whole book has been read.
func TestImportRefusedWithoutEmbedEndpoint(t *testing.T) {
	requirePoppler(t)
	m := loadManifest(t)
	e := testEngine(t, discardLogger())
	ctx := context.Background()

	if err := e.SaveConfig(ctx, Settings{EmbedBaseURL: "", EmbedModel: "m"}); err != nil {
		t.Fatal(err)
	}
	_, err := e.SubmitImport(ctx, filepath.Join(sampleDir, m.Digital.File))
	var unconfigured *EmbedUnconfiguredError
	if !errors.As(err, &unconfigured) {
		t.Fatalf("err = %v, want an EmbedUnconfiguredError", err)
	}
	if !strings.Contains(strings.ToLower(err.Error()), "settings") {
		t.Errorf("error = %q, want a Settings hint", err)
	}

	// Nothing was queued and nothing was staged.
	views, err := e.TaskViews(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(views) != 0 {
		t.Fatalf("%d tasks queued, want none — the refusal happens before any work", len(views))
	}
}
