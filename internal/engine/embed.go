package engine

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/store"
)

// embedBatchSize is how many pages go into one embeddings request. Batches
// are an implementation detail of the search phase, not something a student
// sees: the phase reports pages, because pages are what a book has.
const embedBatchSize = 32

// embedRun is the search phase's shared setup: the client, the book's page
// texts, and the set of pages that already carry a vector for the current
// model.
type embedRun struct {
	client     *llm.Client
	model      string
	book       *store.Book
	textByPage map[int]string
	existing   map[int]bool
}

// phaseSearch builds the book's semantic index. It reads the pages, discards
// vectors from a different model, and works through the pages that still
// need one in batches. Already-vectored pages are skipped, so an interrupted
// run resumes mid-book rather than starting over.
//
// Completion is verified by count, not assumed from a successful call: a
// book is searchable when it has a vector per page, and nothing else says so.
func (p *pipeline) phaseSearch(ctx context.Context, h PhaseHandle) error {
	book, err := p.phaseBook(ctx)
	if err != nil {
		return err
	}
	p.book = book
	p.eng.notify(EventStarted, "Building search for %q (%d pages)", book.Title, book.PageCount)

	settings, err := p.eng.Config(ctx)
	if err != nil {
		return err
	}
	if !settings.EmbedConfigured() {
		return &EmbedUnconfiguredError{}
	}

	pages, err := p.s.Pages(ctx, book.ID)
	if err != nil {
		return userf(err, "could not read the pages of %q", book.Title)
	}
	if len(pages) == 0 {
		return &UserError{Message: fmt.Sprintf("%q has no stored page text yet", book.Title)}
	}
	textByPage := make(map[int]string, len(pages))
	for _, pg := range pages {
		textByPage[pg.Number] = pg.Text
	}

	if err := p.dropForeignVectors(ctx, book.ID, settings.EmbedModel); err != nil {
		return err
	}
	done, err := p.s.Embeddings(ctx, book.ID, settings.EmbedModel)
	if err != nil {
		return userf(err, "could not check stored embeddings")
	}
	existing := make(map[int]bool, len(done))
	for _, emb := range done {
		existing[emb.PageNumber] = true
	}
	p.embed = &embedRun{
		client:     p.eng.llmClient(settings),
		model:      settings.EmbedModel,
		book:       book,
		textByPage: textByPage,
		existing:   existing,
	}

	h.Progress(len(existing), book.PageCount)
	for first := 1; first <= book.PageCount; first += embedBatchSize {
		last := first + embedBatchSize - 1
		if last > book.PageCount {
			last = book.PageCount
		}
		if err := h.Checkpoint(); err != nil {
			return err
		}
		if err := p.runEmbedBatch(ctx, h, first, last); err != nil {
			return err
		}
		h.Progress(len(existing), book.PageCount)
	}

	// Verify rather than assume. A page with no text has nothing to embed;
	// anything else missing means the run did not finish its job.
	missing := 0
	for _, pg := range pages {
		if !existing[pg.Number] && strings.TrimSpace(pg.Text) != "" {
			missing++
		}
	}
	if missing > 0 {
		return &UserError{Message: fmt.Sprintf(
			"search is missing %s of %q — try again", plural(missing, "page", "pages"), book.Title)}
	}
	p.eng.logger.Debug("search built", "pages", book.PageCount, "model", p.embed.model)
	return nil
}

// runEmbedBatch requests vectors for one batch and stores them page by
// page. Pages that already carry a vector are skipped, so an interrupted
// batch resumes mid-range.
func (p *pipeline) runEmbedBatch(ctx context.Context, h PhaseHandle, first, last int) error {
	e := p.embed
	var batch []store.Page
	for n := first; n <= last; n++ {
		if err := h.Checkpoint(); err != nil {
			return err
		}
		if e.existing[n] {
			continue
		}
		text, ok := e.textByPage[n]
		if !ok || strings.TrimSpace(text) == "" {
			// A blank page has nothing to embed; that is not a gap.
			continue
		}
		batch = append(batch, store.Page{Number: n, Text: text})
	}
	if len(batch) == 0 {
		return nil
	}
	h.Note(fmt.Sprintf("indexing pages %d to %d…", first, last))

	texts := make([]string, len(batch))
	for i, pg := range batch {
		texts[i] = pg.Text
	}
	vectors, err := e.client.Embed(ctx, texts)
	if err != nil {
		if ctx.Err() != nil {
			// Shutdown, not a model failure: rest like a checkpoint would.
			return &taskStopped{status: store.TaskQueued}
		}
		return llmFail(err)
	}
	for i, pg := range batch {
		if err := p.s.SaveEmbedding(ctx, e.book.ID, pg.Number, e.model, vectors[i]); err != nil {
			return userf(err, "could not save the embedding of page %d", pg.Number)
		}
		e.existing[pg.Number] = true
	}
	return nil
}

// dropForeignVectors clears vectors built with a different model, so the run
// rebuilds the book in the current embedding space.
func (p *pipeline) dropForeignVectors(ctx context.Context, bookID, model string) error {
	models, err := p.s.EmbeddingModels(ctx, bookID)
	if err != nil {
		return userf(err, "could not check stored embedding models")
	}
	stale := false
	for _, m := range models {
		if m != model {
			stale = true
			break
		}
	}
	if !stale {
		return nil
	}
	p.eng.logger.Debug("discarding embeddings of a different model", "book", bookID)
	if err := p.s.ClearEmbeddings(ctx, bookID); err != nil {
		return userf(err, "could not clear outdated embeddings")
	}
	return nil
}
