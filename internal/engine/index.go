package engine

import (
	"context"

	"github.com/jackt/pset/internal/pdf"
	"github.com/jackt/pset/internal/store"
)

// BookSections is a resolved book with its stored sections.
type BookSections struct {
	Book     *store.Book
	Sections []store.Section
}

// phaseIndex extracts a book's structure and replaces any sections stored
// earlier. A book read from its own text layer uses the PDF's outline,
// falling back to headings inferred from font sizes; a recognized book gets
// the pattern pass over its stored page text.
//
// A book with no detectable structure still gets one section covering the
// whole thing. Structure is something every book has — a table of contents
// nobody wrote is not a reason to call the book unusable.
func (p *pipeline) phaseIndex(ctx context.Context, h PhaseHandle) error {
	book, err := p.phaseBook(ctx)
	if err != nil {
		return err
	}
	h.Note("reading the structure…")
	h.Progress(0, book.PageCount)
	p.eng.notify(EventStarted, "Indexing %q (%d pages)", book.Title, book.PageCount)

	var sections []store.Section
	if book.Kind == store.KindDigital {
		if err := pdf.XMLAvailable(); err != nil {
			return &EnvironmentError{Message: "poppler isn't installed. Run `pset doctor` for details", Err: err}
		}
		doc, err := pdf.XML(ctx, book.FilePath)
		if err != nil {
			return userf(err, "could not read the structure of %q", book.Title)
		}
		p.eng.logger.Debug("parsed pdftohtml xml", "outline entries", len(doc.Outline), "lines", len(doc.Lines))
		if len(doc.Outline) > 0 {
			sections = outlineSections(doc.Outline)
			p.eng.notify(EventPhase, "Read %d outline entries", len(doc.Outline))
		} else {
			p.eng.notify(EventPhase, "No outline found. Inferring headings from text")
			sections = inferSections(doc.Lines)
		}
	} else {
		pages, err := p.s.Pages(ctx, book.ID)
		if err != nil {
			return userf(err, "could not read the pages of %q", book.Title)
		}
		sections = patternSections(pages)
	}

	assignEndPages(sections, book.PageCount)
	if len(sections) == 0 {
		p.eng.logger.Debug("no detectable structure; using a whole-book section", "book", book.ID)
		h.Note("no chapters found, so the whole book is one section")
		sections = []store.Section{{
			Level:     1,
			Title:     book.Title,
			Source:    store.SourceInferred,
			StartPage: 1,
			EndPage:   book.PageCount,
		}}
	}

	if err := p.s.CreateSections(ctx, book.ID, sections); err != nil {
		return userf(err, "could not store the sections of %q", book.Title)
	}
	h.Progress(book.PageCount, book.PageCount)
	p.eng.logger.Debug("indexed book", "sections", len(sections))
	return nil
}

// BookSections resolves a book and returns its stored sections in sort
// order; a book that was never indexed has none.
func (e *Engine) BookSections(ctx context.Context, target string) (*BookSections, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	book, err := e.resolveBook(ctx, s, target)
	if err != nil {
		return nil, err
	}
	sections, err := s.Sections(ctx, book.ID)
	if err != nil {
		return nil, userf(err, "could not read the sections of %q", book.Title)
	}
	return &BookSections{Book: book, Sections: sections}, nil
}
