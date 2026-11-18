package library

import (
	"context"
	"errors"
	"time"

	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/usage"
)

// runImports stands in for the job queue the import ran on, which went in
// track 3 of ideas/backend-courses.md: it imports each queued book in
// turn, examining then preparing it as the queue's two jobs did. The
// import's own steps stay tested this way until track 4 ports them onto
// the step runner.
func (s *Service) runImports(ctx context.Context) {
	for ctx.Err() == nil {
		var id string
		err := s.c.DB.QueryRowContext(ctx, `SELECT id FROM books WHERE state = 'queued' ORDER BY created_at LIMIT 1`).Scan(&id)
		if err != nil {
			select {
			case <-ctx.Done():
			case <-time.After(10 * time.Millisecond):
			}
			continue
		}
		s.importOne(ctx, id)
	}
}

// importOne is what the two import jobs did between them, less the queue:
// examine, prepare, then ready, or failed with why.
func (s *Service) importOne(ctx context.Context, id string) {
	// The labels the job set, so the book's usage still finds its calls:
	// one import is one run.
	ctx = llm.WithSession(ctx, "book-"+id)
	ctx = llm.WithSubject(ctx, llm.Subject{Type: usage.SubjectBook, ID: id})
	ctx = llm.WithStage(llm.WithRun(ctx, "import-"+id), "Contents")
	b, err := getBook(ctx, s.c.DB, id)
	if err != nil {
		return
	}
	err = func() error {
		if _, _, err := s.examine(ctx, b, s.pdfPath(b.ID)); err != nil {
			return err
		}
		examined, err := getBook(ctx, s.c.DB, id)
		if err != nil {
			return err
		}
		return s.prepare(ctx, examined)
	}()
	switch {
	case errors.Is(err, errNotFound), ctx.Err() != nil:
	case err == nil:
		s.setState(ctx, id, BookState{Kind: StateReady}, true)
	default:
		v := errs.Report(ctx, importFailed.Wrap(err, "title", b.Title), errs.Where{Route: "import", Book: id})
		s.setState(ctx, id, BookState{Kind: StateFailed, Error: &v}, true)
	}
}
