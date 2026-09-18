package engine

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackt/pset/internal/pdf"
	"github.com/jackt/pset/internal/store"
)

// Classification thresholds. A page "has text" when it yields at least
// pageTextMinWords (scans often carry a few stray words — watermarks,
// stamps — so exact zero is too strict), and a book is digital when at
// least digitalMinPageRatio of its pages qualify AND the whole document
// yields digitalMinWords words. The word guard keeps small scans with a
// text-y cover from sneaking past the ratio; miscalling a scan as digital
// is the one dangerous direction, and a miscalled digital book merely pays
// for OCR it did not need.
const (
	pageTextMinWords    = 10
	digitalMinPageRatio = 0.5
	digitalMinWords     = 120
)

// classifyBook makes the scanned/digital call from the full extracted text.
func classifyBook(pageTexts []string) string {
	if len(pageTexts) == 0 {
		return store.KindScanned
	}
	pagesWithText, words := 0, 0
	for _, t := range pageTexts {
		n := len(strings.Fields(t))
		words += n
		if n >= pageTextMinWords {
			pagesWithText++
		}
	}
	if float64(pagesWithText)/float64(len(pageTexts)) >= digitalMinPageRatio && words >= digitalMinWords {
		return store.KindDigital
	}
	return store.KindScanned
}

func (e *Engine) spoolDir() string {
	return filepath.Join(filepath.Dir(e.dbPath), "spool")
}

// spoolPrefix namespaces the staged source file of one prepare task; the
// original file name is embedded so a task resumed after a restart still has
// a title fallback.
func spoolPrefix(taskID string) string { return fmt.Sprintf("import-%s-", taskID) }

func spoolName(taskID string, original string) string {
	return spoolPrefix(taskID) + spoolSafeName(original)
}

func spoolSafeName(name string) string {
	base := filepath.Base(strings.TrimSpace(name))
	var b strings.Builder
	for _, r := range base {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9',
			r == '-', r == '_', r == '.':
			b.WriteRune(r)
		default:
			b.WriteByte('-')
		}
	}
	out := strings.Trim(b.String(), "-.")
	if out == "" {
		out = "book"
	}
	if len(out) > 80 {
		out = out[:80]
	}
	return out
}

// spoolPathFor locates the staged source of a prepare task.
func (e *Engine) spoolPathFor(taskID string) (string, error) {
	matches, err := filepath.Glob(filepath.Join(e.spoolDir(), spoolPrefix(taskID)+"*"))
	if err != nil {
		return "", userf(err, "could not locate the staged import")
	}
	if len(matches) == 0 {
		return "", &PermanentError{Message: "the staged file for this import is gone — import it again"}
	}
	return matches[0], nil
}

// spoolDisplayName recovers the original file name embedded in a spool path.
func spoolDisplayName(spool string, taskID string) string {
	name := strings.TrimSuffix(strings.TrimPrefix(filepath.Base(spool), spoolPrefix(taskID)), ".pdf")
	if name == "" {
		return filepath.Base(spool)
	}
	return name
}

// ImportSubmission reports the outcome of an import submission: either the
// content already existed (nothing enqueued) or a fresh task was created.
type ImportSubmission struct {
	Task       *store.Task
	Book       *store.Book
	Duplicated bool
}

// SubmitImport validates the source, stages and hashes it synchronously in
// one pass, and enqueues an ingest job. Submitting content that is already
// in the library enqueues nothing and reports the stored book.
func (e *Engine) SubmitImport(ctx context.Context, source string) (*ImportSubmission, error) {
	orig := source
	source, err := filepath.Abs(source)
	if err != nil {
		return nil, userf(err, "cannot resolve path %q", orig)
	}
	info, err := os.Stat(source)
	if err != nil {
		return nil, accessError(orig, err)
	}
	if info.IsDir() {
		return nil, &UserError{Message: fmt.Sprintf("%s is a directory", orig)}
	}
	if err := pdf.Available(); err != nil {
		return nil, userf(err, "poppler is not installed — run `pset doctor` for details")
	}
	f, err := os.Open(source)
	if err != nil {
		return nil, userf(err, "cannot read %s", source)
	}
	defer f.Close()

	sub, err := e.submitImportStream(ctx, f, filepath.Base(source))
	if err != nil {
		return nil, err
	}
	if !sub.Duplicated {
		e.recordOrigin(sub.Task.ID, source)
	}
	return sub, nil
}

// SubmitImportReader stages an uploaded stream like SubmitImport; name only
// feeds the book's title fallback.
func (e *Engine) SubmitImportReader(ctx context.Context, r io.Reader, name string) (*ImportSubmission, error) {
	return e.submitImportStream(ctx, r, name)
}

// submitImportStream stages and hashes the source in one pass, then enqueues
// a prepare task. Preparation ends in semantic search, which needs an
// embeddings endpoint, so a missing connection is refused here rather than
// discovered forty minutes into OCR.
func (e *Engine) submitImportStream(ctx context.Context, r io.Reader, name string) (*ImportSubmission, error) {
	settings, err := e.Config(ctx)
	if err != nil {
		return nil, err
	}
	if !settings.EmbedConfigured() {
		return nil, &EmbedUnconfiguredError{}
	}
	if err := os.MkdirAll(e.spoolDir(), 0o700); err != nil {
		return nil, userf(err, "cannot create the spool directory %s", e.spoolDir())
	}
	tmp, err := os.CreateTemp(e.spoolDir(), ".staging-*")
	if err != nil {
		return nil, userf(err, "cannot stage the import")
	}
	tmpName := tmp.Name()
	remove := func() {
		tmp.Close()
		os.Remove(tmpName)
	}

	hasher := sha256.New()
	size, err := io.Copy(io.MultiWriter(tmp, hasher), r)
	if err != nil {
		remove()
		return nil, userf(err, "cannot read the import source")
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmpName)
		return nil, userf(err, "cannot stage the import")
	}
	sha := hex.EncodeToString(hasher.Sum(nil))

	s, err := e.openStore(ctx)
	if err != nil {
		os.Remove(tmpName)
		return nil, err
	}
	defer s.Close()

	existing, err := s.BookBySHA256(ctx, sha)
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		os.Remove(tmpName)
		return nil, userf(err, "database lookup failed")
	}
	if existing != nil {
		os.Remove(tmpName)
		e.logger.Debug("already imported, nothing to do", "sha256", shortSHA(sha), "title", existing.Title)
		return &ImportSubmission{Book: existing, Duplicated: true}, nil
	}

	task := &store.Task{Kind: store.TaskPrepare}
	if err := s.CreateTask(ctx, task); err != nil {
		os.Remove(tmpName)
		return nil, userf(err, "could not enqueue the import")
	}
	final := filepath.Join(e.spoolDir(), spoolName(task.ID, name))
	if err := os.Rename(tmpName, final); err != nil {
		os.Remove(tmpName)
		task.Status = store.TaskFailed
		task.FailKind = store.FailEnvironment
		task.Error = "could not stage the import source"
		task.FinishedAt = time.Now().UTC()
		if err := s.SaveTask(ctx, task); err != nil {
			e.logger.Error("persist task failure", "task", task.ID, "err", err)
		}
		return nil, userf(err, "could not stage the import")
	}
	e.recordOrigin(task.ID, name)
	e.logger.Debug("import enqueued", "task", task.ID, "sha256", shortSHA(sha), "bytes", size)
	e.publishTaskView(ctx, s, task)
	e.nudgeRunner()
	return &ImportSubmission{Task: task}, nil
}

// preparePlan declares the four phases of preparing a book, in the words a
// student reads. The whole plan is declared up front so the shape is stable
// from the first frame; a phase with nothing to do (reading a book that
// already has a text layer) finishes with a note rather than vanishing.
func (p *pipeline) preparePlan(ctx context.Context) ([]PhaseSpec, error) {
	return []PhaseSpec{
		{Key: "examine", Name: "Examine the pages", Run: p.phaseExamine},
		{Key: "read", Name: "Read the pages", Run: p.phaseRead},
		{Key: "index", Name: "Index the sections", Run: p.phaseIndex},
		{Key: "search", Name: "Build search", Run: p.phaseSearch},
	}, nil
}

// stageExamineStep takes custody of the staged source and makes the verdict
// that drives the rest of the pipeline: copy into the library, read
// metadata, extract the full text, and classify the book digital or
// scanned. A digital book's pages are stored straight from the text layer;
// a scanned book stores nothing yet and leaves the pages to OCR. A book
// that was already imported leaves the remaining phases to self-skip.
func (p *pipeline) phaseExamine(ctx context.Context, h PhaseHandle) error {
	spool, err := p.eng.spoolPathFor(p.task.ID)
	if err != nil {
		return err
	}
	p.eng.notify(EventStarted, "Examining %s", spoolDisplayName(spool, p.task.ID))

	if err := pdf.Available(); err != nil {
		return &EnvironmentError{Message: "poppler isn't installed — run `pset doctor` for details", Err: err}
	}
	info, err := os.Stat(spool)
	if err != nil {
		return accessError(spool, err)
	}
	sha, err := hashFile(spool)
	if err != nil {
		return err
	}
	p.eng.logger.Debug("storing book", "task", p.task.ID, "sha256", sha, "bytes", info.Size())

	existing, err := p.s.BookBySHA256(ctx, sha)
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		return userf(err, "database lookup failed")
	}
	if existing != nil {
		// Re-entering examine after a crash or a retry: adopt the book and
		// let the later phases resume it. Never skip them — a book that is
		// already here but not ready is exactly what a retry is for.
		p.task.BookID = &existing.ID
		p.book = existing
		p.saveAndPublishTask(ctx)
		return &notNeeded{reason: "already examined"}
	}

	libraryPath, created, err := p.eng.copyIntoLibrary(spool, sha, info.Mode())
	if err != nil {
		return err
	}
	if created {
		p.libCreated = libraryPath
	}

	meta, err := pdf.Metadata(ctx, libraryPath)
	if err != nil {
		return permanentf(err, "this PDF can't be read — pset couldn't open %s", p.sourceLabel())
	}
	if meta.PageCount <= 0 {
		return permanentf(nil, "this PDF has no pages")
	}
	p.eng.logger.Debug("read metadata", "pages", meta.PageCount, "title", meta.Title)

	title := meta.Title
	if title == "" {
		title = filenameTitle(spoolDisplayName(spool, p.task.ID))
	}

	h.Note("reading the text…")
	text, terr := pdf.Text(ctx, libraryPath)
	if terr != nil {
		return permanentf(terr, "this PDF can't be read — pset couldn't extract any text from %q", title)
	}
	pageTexts := splitPages(text)
	p.eng.logger.Debug("extracted text", "pages", len(pageTexts), "words", countWords(pageTexts))

	kind := classifyBook(pageTexts)

	book := &store.Book{
		SHA256:     sha,
		FilePath:   libraryPath,
		FileSize:   info.Size(),
		Title:      title,
		Author:     meta.Author,
		Subject:    meta.Subject,
		PageCount:  meta.PageCount,
		PDFVersion: meta.PDFVersion,
		PageWidth:  meta.PageWidth,
		PageHeight: meta.PageHeight,
		OriginPath: p.eng.origin(p.task.ID),
		Kind:       kind,
	}

	// The book row and its pages commit together. A crash between the two
	// used to leave a book that could never be prepared and never be
	// recovered — the sharpest failure the old pipeline had.
	var pages []store.Page
	if kind == store.KindDigital {
		pages = make([]store.Page, len(pageTexts))
		for i, t := range pageTexts {
			status := store.PageText
			if strings.TrimSpace(t) == "" {
				status = store.PageBlank
			}
			pages[i] = store.Page{Number: i + 1, Text: t, OCRStatus: status}
		}
		if len(pages) > meta.PageCount {
			pages = pages[:meta.PageCount]
		}
	}
	if err := p.s.CreateBookWithPages(ctx, book, pages); err != nil {
		return userf(err, "could not save the book")
	}
	p.libCreated = ""
	p.task.BookID = &book.ID
	p.book = book
	// Persist and publish the book link now, not at settle time: Tasks shows
	// the book's name the moment the examine phase has read it.
	p.saveAndPublishTask(ctx)
	p.eng.logger.Debug("stored book", "id", book.ID, "pages", book.PageCount, "title", title, "kind", kind)

	if kind == store.KindScanned {
		h.Note("looks scanned, so the pages need recognizing")
	}
	return nil
}

// countWords is the classifier's word tally, for the developer log.
func countWords(pageTexts []string) int {
	n := 0
	for _, t := range pageTexts {
		n += len(strings.Fields(t))
	}
	return n
}

// saveAndPublishTask persists the in-memory task row and streams it — the
// points mid-pipeline where the task gains facts the queue should show.
func (p *pipeline) saveAndPublishTask(ctx context.Context) {
	if err := p.s.SaveTask(ctx, p.task); err != nil {
		p.eng.logger.Error("persist task mid-run", "task", p.task.ID, "err", err)
	}
	p.publishTask(ctx)
}

func (p *pipeline) publishTask(ctx context.Context) {
	p.eng.publishTaskView(ctx, p.s, p.task)
}

// phaseBook resolves the task's book: the in-memory row when examine ran in
// this pipeline, else the row the task points at (a resumed run after a
// retry, restart, or crash).
func (p *pipeline) phaseBook(ctx context.Context) (*store.Book, error) {
	if p.book != nil {
		return p.book, nil
	}
	if p.task.BookID == nil {
		return nil, &PermanentError{Message: "this import lost track of its book — import it again"}
	}
	book, err := p.s.BookByID(ctx, *p.task.BookID)
	if errors.Is(err, store.ErrNotFound) {
		return nil, &PermanentError{Message: "this import's book is gone — import it again"}
	}
	if err != nil {
		return nil, userf(err, "could not read the book of task %s", p.task.ID)
	}
	p.book = book
	return book, nil
}

func (e *Engine) copyIntoLibrary(source, sha string, mode os.FileMode) (libraryPath string, created bool, err error) {
	libraryDir := e.libraryDir()
	if err := os.MkdirAll(libraryDir, 0o700); err != nil {
		return "", false, userf(err, "cannot create library directory %s", libraryDir)
	}
	libraryPath = filepath.Join(libraryDir, sha+".pdf")
	if _, err := os.Stat(libraryPath); err == nil {
		e.logger.Debug("library copy already present", "path", libraryPath)
		e.notify(EventPhase, "Reused existing library copy")
		return libraryPath, false, nil
	}

	tmp, err := os.CreateTemp(libraryDir, ".import-*")
	if err != nil {
		return "", false, userf(err, "cannot write to library directory %s", libraryDir)
	}
	tmpName := tmp.Name()
	defer func() {
		tmp.Close()
		os.Remove(tmpName)
	}()

	in, err := os.Open(source)
	if err != nil {
		return "", false, userf(err, "cannot read %s", source)
	}
	defer in.Close()
	if _, err := io.Copy(tmp, in); err != nil {
		return "", false, userf(err, "cannot copy %s into the library", source)
	}
	if err := tmp.Chmod(mode.Perm()); err != nil {
		return "", false, userf(err, "cannot finalize the library copy")
	}
	if err := tmp.Close(); err != nil {
		return "", false, userf(err, "cannot finalize the library copy")
	}
	if err := os.Rename(tmpName, libraryPath); err != nil {
		return "", false, userf(err, "cannot finalize the library copy")
	}
	e.logger.Debug("copied into library", "path", libraryPath)
	e.notify(EventPhase, "Copied into library")
	return libraryPath, true, nil
}

// sourceLabel is the display name of an import's source file: the
// remembered origin path, or the name embedded in the spool file.
func (p *pipeline) sourceLabel() string {
	if origin := p.eng.origin(p.task.ID); origin != "" {
		return origin
	}
	if spool, err := p.eng.spoolPathFor(p.task.ID); err == nil {
		return spoolDisplayName(spool, p.task.ID)
	}
	return "this file"
}

func hashFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", userf(err, "cannot read %s", path)
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", userf(err, "cannot read %s", path)
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// splitPages splits pdftotext output on form feeds; the feed after the last
// page is dropped, interior blank pages are kept.
func splitPages(text string) []string {
	parts := strings.Split(text, "\f")
	if n := len(parts); n > 1 && strings.TrimSpace(parts[n-1]) == "" {
		parts = parts[:n-1]
	}
	return parts
}

// filenameTitle is the fallback title: the filename stem with separators
// turned into spaces.
func filenameTitle(path string) string {
	base := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
	return strings.Join(strings.FieldsFunc(base, func(r rune) bool {
		return r == '-' || r == '_' || r == '.' || r == ' '
	}), " ")
}

func shortSHA(sha string) string {
	if len(sha) > 12 {
		return sha[:12]
	}
	return sha
}
