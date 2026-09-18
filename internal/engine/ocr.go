package engine

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/jackt/pset/internal/ocr"
	"github.com/jackt/pset/internal/store"
)

// ocrLanguage is the tesseract language model used for every OCR run.
const ocrLanguage = "eng"

// openStore ensures the data directory exists, then opens and migrates the
// database — the standard entry for callers that expect a working store.
// Opens are serialised so a fresh database is never migrated twice in
// parallel (the background runner and request handlers race here).
func (e *Engine) openStore(ctx context.Context) (*store.Store, error) {
	e.openMu.Lock()
	defer e.openMu.Unlock()

	if err := os.MkdirAll(filepath.Dir(e.dbPath), 0o700); err != nil {
		return nil, userf(err, "cannot create data directory %s", filepath.Dir(e.dbPath))
	}
	s, err := store.Open(e.dbPath)
	if err != nil {
		return nil, userf(err, "cannot open database %s", e.dbPath)
	}
	if err := s.Migrate(ctx); err != nil {
		s.Close()
		if errors.Is(err, store.ErrSchemaMismatch) {
			return nil, err
		}
		return nil, userf(err, "cannot set up the database schema")
	}
	return s, nil
}

// phaseRead fills a book's pages. A digital book had its text stored at
// examine time and finishes here with a note; a scanned book is recognized
// page by page with the local tesseract backend.
//
// Every page gets a row, whatever happens to it. A blank page is not a
// failure — the tools succeeded and the page genuinely has no text — so it
// stores empty and never blocks the book. A page whose tools errored stores
// as failed with the reason, which keeps coverage complete, makes the gap
// visible, and lets a retry re-attempt only those pages.
func (p *pipeline) phaseRead(ctx context.Context, h PhaseHandle) error {
	book, err := p.phaseBook(ctx)
	if err != nil {
		return err
	}
	if book.Kind == store.KindDigital {
		return &notNeeded{"the PDF's own text layer was good"}
	}
	p.eng.notify(EventStarted, "Reading %q (%d pages)", book.Title, book.PageCount)
	if err := ocr.Available(); err != nil {
		return &EnvironmentError{Message: "tesseract isn't installed. Run `pset doctor` for details", Err: err}
	}

	settled, err := p.s.PageNumbers(ctx, book.ID)
	if err != nil {
		return userf(err, "could not check stored pages")
	}
	h.Progress(len(settled), book.PageCount)

	var failed []int
	for n := 1; n <= book.PageCount; n++ {
		if err := h.Checkpoint(); err != nil {
			return err
		}
		if settled[n] {
			continue
		}
		h.Note(fmt.Sprintf("recognizing page %d…", n))
		text, perr := ocr.Page(ctx, book.FilePath, n, ocrLanguage)
		page := store.Page{Number: n, Text: text, OCRStatus: store.PageText}
		if perr != nil {
			if err := h.Checkpoint(); err != nil {
				return err
			}
			page = store.Page{Number: n, OCRStatus: store.PageFailed, Error: firstSentence(perr.Error())}
			failed = append(failed, n)
		} else if strings.TrimSpace(text) == "" {
			page.OCRStatus = store.PageBlank
		}
		if err := p.s.SavePage(ctx, book.ID, page); err != nil {
			return userf(err, "could not save page %d of %q", n, book.Title)
		}
		if perr == nil {
			settled[n] = true
		}
		h.Progress(len(settled), book.PageCount)
		p.eng.logger.Debug("read page", "page", n, "chars", len(text), "status", page.OCRStatus)
	}

	if len(failed) > 0 {
		// Strict on real failures: the book is not ready and says exactly
		// which pages to try again. Blanks are not counted here.
		return &EnvironmentError{Message: fmt.Sprintf(
			"%s couldn't be read (%s). Try again, or check that tesseract is working",
			plural(len(failed), "page", "pages"), pageList(failed))}
	}
	p.eng.logger.Debug("read complete", "pages", book.PageCount)
	return nil
}

// pageList renders a handful of page numbers for a failure sentence.
func pageList(pages []int) string {
	const show = 6
	parts := make([]string, 0, show+1)
	for i, n := range pages {
		if i == show {
			parts = append(parts, fmt.Sprintf("and %d more", len(pages)-show))
			break
		}
		parts = append(parts, fmt.Sprintf("p.%d", n))
	}
	return strings.Join(parts, ", ")
}

func plural(n int, one, many string) string {
	if n == 1 {
		return fmt.Sprintf("%d %s", n, one)
	}
	return fmt.Sprintf("%d %s", n, many)
}
