package engine

import (
	"context"
	"errors"
	"os"
	"strings"

	"github.com/jackt/pset/internal/store"
)

// resolveBook finds the one book a target names: a sha256 (or a unique
// prefix of one) exactly, otherwise a case-insensitive title match. A target
// that fits several books is ambiguous rather than arbitrarily resolved.
func (e *Engine) resolveBook(ctx context.Context, s *store.Store, target string) (*store.Book, error) {
	target = strings.TrimSpace(target)
	if target == "" {
		return nil, &NoMatchError{Target: target}
	}
	if book, err := s.BookBySHA256(ctx, target); err == nil {
		return book, nil
	} else if !errors.Is(err, store.ErrNotFound) {
		return nil, userf(err, "database lookup failed")
	}

	books, err := s.Books(ctx)
	if err != nil {
		return nil, userf(err, "could not list the library")
	}
	lower := strings.ToLower(target)

	var byPrefix []*store.Book
	for _, b := range books {
		if strings.HasPrefix(b.SHA256, lower) {
			byPrefix = append(byPrefix, b)
		}
	}
	if len(byPrefix) == 1 {
		return byPrefix[0], nil
	}
	if len(byPrefix) > 1 {
		return nil, ambiguous(target, byPrefix)
	}

	var exact, partial []*store.Book
	for _, b := range books {
		title := strings.ToLower(b.Title)
		switch {
		case title == lower:
			exact = append(exact, b)
		case strings.Contains(title, lower):
			partial = append(partial, b)
		}
	}
	for _, group := range [][]*store.Book{exact, partial} {
		switch len(group) {
		case 1:
			return group[0], nil
		case 0:
			continue
		default:
			return nil, ambiguous(target, group)
		}
	}
	return nil, &NoMatchError{Target: target}
}

func ambiguous(target string, books []*store.Book) error {
	titles := make([]string, 0, len(books))
	for _, b := range books {
		titles = append(titles, b.Title)
	}
	return &AmbiguousError{Target: target, Titles: titles}
}

// BookStatus is a book with its derived readiness and the task, if any,
// that is preparing it or waiting on a decision about it.
type BookStatus struct {
	Book        *store.Book
	Readiness   store.Readiness
	FailedPages []store.Page
	Task        *TaskView
}

// BookStatuses lists the library with each book's derived readiness and the
// task that explains a book that is not ready. Readiness is computed here,
// not read from a flag, so a book that lost data reports it immediately.
func (e *Engine) BookStatuses(ctx context.Context) ([]*BookStatus, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	settings, err := e.Config(ctx)
	if err != nil {
		return nil, err
	}
	books, err := s.Books(ctx)
	if err != nil {
		return nil, userf(err, "could not list the library")
	}
	out := make([]*BookStatus, 0, len(books))
	for _, book := range books {
		st, err := e.bookStatus(ctx, s, book, settings.EmbedModel)
		if err != nil {
			return nil, err
		}
		out = append(out, st)
	}
	return out, nil
}

// BookStatus resolves one book and reports its readiness and task.
func (e *Engine) BookStatus(ctx context.Context, target string) (*BookStatus, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	settings, err := e.Config(ctx)
	if err != nil {
		return nil, err
	}
	book, err := e.resolveBook(ctx, s, target)
	if err != nil {
		return nil, err
	}
	return e.bookStatus(ctx, s, book, settings.EmbedModel)
}

func (e *Engine) bookStatus(ctx context.Context, s *store.Store, book *store.Book, embedModel string) (*BookStatus, error) {
	r, err := s.Readiness(ctx, book.ID, embedModel)
	if err != nil {
		return nil, err
	}
	book.Ready = r.Ready()
	st := &BookStatus{Book: book, Readiness: r}
	if r.PagesFailed > 0 {
		if st.FailedPages, err = s.FailedPages(ctx, book.ID); err != nil {
			return nil, err
		}
	}
	task, err := s.TaskForBook(ctx, book.ID)
	if err == nil {
		if st.Task, err = e.buildTaskView(ctx, s, task); err != nil {
			return nil, err
		}
	} else if errors.Is(err, store.ErrNotFound) {
		// No unsettled task, but the book may still be incomplete — data can
		// go missing after a preparation finished. Surface the task that
		// built it so the book has a door out of that state.
		if st.Task, err = e.lastTaskForBook(ctx, s, book); err != nil {
			return nil, err
		}
	} else {
		return nil, err
	}
	if st.Task != nil && !st.Readiness.Ready() {
		st.Task.BookIncomplete = true
	}
	return st, nil
}

// lastTaskForBook finds the finished preparation of a book, if its row is
// still in history; nil when history has pruned past it.
func (e *Engine) lastTaskForBook(ctx context.Context, s *store.Store, book *store.Book) (*TaskView, error) {
	finished, err := s.FinishedTasks(ctx, 0)
	if err != nil {
		return nil, err
	}
	for _, task := range finished {
		if task.BookID != nil && *task.BookID == book.ID {
			return e.buildTaskView(ctx, s, task)
		}
	}
	return nil, nil
}

// RemoveBook deletes a book and everything derived from it, including its
// library copy and its tasks. This is the only door that throws work away:
// stopping and failing both keep what they have.
func (e *Engine) RemoveBook(ctx context.Context, target string) (*store.Book, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	book, err := e.resolveBook(ctx, s, target)
	if err != nil {
		return nil, err
	}
	// Stop anything running on it first, so the runner is not writing rows
	// into a book that is being deleted underneath it.
	if task, terr := s.TaskForBook(ctx, book.ID); terr == nil {
		if r := e.getRunner(); r != nil {
			r.requestStop(task.ID)
		}
	}
	// Every task row that dies here is announced, not just the unsettled
	// one — a client holding a finished task in its list must hear that it
	// is gone, or it lingers until the next snapshot.
	removed, err := s.DeleteTasksForBook(ctx, book.ID)
	if err != nil {
		return nil, err
	}
	for _, id := range removed {
		e.publishRemoved(id)
	}
	if err := s.DeleteBook(ctx, book.ID); err != nil {
		return nil, userf(err, "could not remove %q", book.Title)
	}
	e.removeLibraryCopy(book)
	e.logger.Debug("removed book", "id", book.ID, "title", book.Title)
	return book, nil
}

// removeLibraryCopy deletes a book's content-addressed PDF. A failure here
// leaves a harmless orphan file rather than aborting the removal.
func (e *Engine) removeLibraryCopy(book *store.Book) {
	if book.FilePath == "" {
		return
	}
	if !strings.HasPrefix(book.FilePath, e.libraryDir()) {
		// Not ours to delete.
		return
	}
	if err := os.Remove(book.FilePath); err != nil && !errors.Is(err, os.ErrNotExist) {
		e.logger.Error("remove library copy", "path", book.FilePath, "err", err)
	}
}

// PageText returns one stored page's text, with the book's sha for the
// caller to echo. ErrNoPage when the page was never stored.
func (e *Engine) PageText(ctx context.Context, target string, n int) (string, string, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return "", "", err
	}
	defer s.Close()

	book, err := e.resolveBook(ctx, s, target)
	if err != nil {
		return "", "", err
	}
	page, err := s.Page(ctx, book.ID, n)
	if errors.Is(err, store.ErrNotFound) {
		return book.SHA256, "", ErrNoPage
	}
	if err != nil {
		return "", "", userf(err, "could not read page %d of %q", n, book.Title)
	}
	return book.SHA256, page.Text, nil
}
