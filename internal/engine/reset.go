package engine

import (
	"context"
	"os"
	"path/filepath"

	"github.com/jackt/pset/internal/store"
)

type ResetOptions struct {
	// Apply performs the deletion; false only counts what would be removed.
	Apply bool
}

type ResetResult struct {
	Books         int64
	Pages         int64
	LibraryFiles  int
	FinishedTasks int64
}

// Reset reverts the database and library to their base state: no books, no
// pages, an empty library directory, schema at its current version. With
// Apply it deletes; otherwise it only counts. Library copies are derived
// from imports, so removing them loses nothing that a re-import cannot
// restore.
func (e *Engine) Reset(ctx context.Context, opts ResetOptions) (*ResetResult, error) {
	e.notify(EventStarted, "Resetting %s", e.dbPath)
	e.logger.Debug("resetting", "db", e.dbPath, "apply", opts.Apply)

	res := &ResetResult{}
	if _, err := os.Stat(e.dbPath); err == nil {
		s, err := store.Open(e.dbPath)
		if err != nil {
			return nil, userf(err, "cannot open database %s", e.dbPath)
		}
		defer s.Close()
		if err := s.Migrate(ctx); err != nil {
			return nil, userf(err, "cannot set up the database schema")
		}
		if n, err := s.UnsettledTaskCount(ctx); err != nil {
			return nil, userf(err, "could not check running jobs")
		} else if n > 0 {
			return nil, &ResetBlockedError{Active: n}
		}
		if opts.Apply {
			if res.Books, res.Pages, res.FinishedTasks, err = s.Reset(ctx); err != nil {
				return nil, userf(err, "could not clear the database")
			}
			e.logger.Debug("reset database", "books", res.Books, "pages", res.Pages, "finished_tasks", res.FinishedTasks)
		} else {
			if res.Books, res.Pages, res.FinishedTasks, err = s.Counts(ctx); err != nil {
				return nil, userf(err, "could not count existing books")
			}
		}
	} else if !os.IsNotExist(err) {
		return nil, accessError(e.dbPath, err)
	}

	libraryDir := e.libraryDir()
	if entries, err := os.ReadDir(libraryDir); err == nil {
		res.LibraryFiles = len(entries)
	}
	if opts.Apply {
		if err := os.RemoveAll(libraryDir); err != nil {
			return nil, userf(err, "cannot clear library directory %s", libraryDir)
		}
		if err := os.MkdirAll(libraryDir, 0o700); err != nil {
			return nil, userf(err, "cannot recreate library directory %s", libraryDir)
		}
		e.logger.Debug("cleared library", "files", res.LibraryFiles)
		e.logger.Debug("reset complete", "books", res.Books, "pages", res.Pages, "library_files", res.LibraryFiles)
	}
	return res, nil
}

func (e *Engine) libraryDir() string {
	return filepath.Join(filepath.Dir(e.dbPath), "library")
}

// LibraryDir is the on-disk folder holding the content-addressed library
// copies — exposed for the health endpoint, so the UI never guesses paths.
func (e *Engine) LibraryDir() string { return e.libraryDir() }
