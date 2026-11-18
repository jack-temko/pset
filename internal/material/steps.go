package material

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/google/uuid"

	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/execx"
	"github.com/jackt/pset/internal/library"
	"github.com/jackt/pset/internal/pdf"
	"github.com/jackt/pset/internal/runner"
	"github.com/jackt/pset/internal/step"
)

// The limits the import's steps count against, beside the chat model's:
// one page is recognized at a time, and the embedder takes one batch.
const (
	limitReader   = "reader"
	limitEmbedder = "embedder"
)

// pipeline is a material's import, as steps: examine, read pages,
// contents, numbering, search (D3). Each is the old import's phase, its
// craft unchanged (internal/library's craft.go), writing to the new tables.
func (s *Service) pipeline() runner.Pipeline {
	return runner.Pipeline{Kind: change.ResourceMaterial, Steps: []runner.Handler{
		{Name: step.NameExamine, Run: s.examine},
		{Name: step.NameReadPages, Model: limitReader, Run: s.readPages},
		{Name: step.NameContents, Model: s.c.ChatModel, Run: s.contents},
		{Name: step.NameNumbering, Run: s.numbering},
		// Its input is the embedder: vectors from another model are
		// useless, so a new one makes search out of date.
		{Name: step.NameSearch, Model: limitEmbedder, Run: s.search,
			Input: func(context.Context, *sql.DB, string) (string, error) { return s.c.EmbedModel, nil }},
	}}
}

// stopped is a step's context ending, as the old import said it.
func stopped(ctx context.Context) error { return fmt.Errorf("stopped: %w", ctx.Err()) }

// examine reads the file's metadata and text layer, decides whether it is
// digital or scanned, and stores a digital material's pages straight away.
func (s *Service) examine(ctx context.Context, run *runner.Run) error {
	m, err := s.get(ctx, run.SubjectID)
	if err != nil {
		return err
	}
	path := s.path(m.ID)
	run.Activity("Looking at the file")
	meta, err := s.c.Tools.Metadata(ctx, path)
	if err != nil {
		if ctx.Err() != nil {
			return stopped(ctx)
		}
		return pdfUnreadable.Wrap(err)
	}
	if meta.PageCount <= 0 {
		return pdfEmpty.New()
	}
	text, err := s.c.Tools.Text(ctx, path)
	if err != nil {
		if ctx.Err() != nil {
			return stopped(ctx)
		}
		return pdfUnreadable.Wrap(err)
	}
	pages := library.SplitPages(text, meta.PageCount)
	kind := library.Classify(pages)
	aspect := 0.0
	if meta.PageWidth > 0 {
		aspect = meta.PageHeight / meta.PageWidth
	}
	return run.Write(ctx, func(tx *sql.Tx) error {
		if kind == "digital" {
			// A PDF's pages never change, so a run again writes over the
			// same pages: nothing is deleted (only the purge deletes).
			for i, p := range pages {
				if err := savePage(ctx, tx, m.ID, i+1, p, pageStatus(p)); err != nil {
					return err
				}
			}
		}
		// The title the file gives, unless the student has renamed it by
		// now: checked in this write, not from the read above, which is
		// seconds old on a big book. pages_read is what is stored, so a run
		// again never forgets a scan's pages.
		_, err := tx.ExecContext(ctx, `UPDATE materials SET
			title = CASE WHEN renamed = 0 AND ?1 != '' THEN ?1 ELSE title END,
			page_count = ?2, aspect = ?3, page_width = ?4, kind = ?5,
			pages_read = (SELECT count(*) FROM pages WHERE material_id = ?6 AND status != 'failed')
			WHERE id = ?6`,
			library.MetaTitle(meta.Title), meta.PageCount, aspect, meta.PageWidth, kind, m.ID)
		return errs.Database.Of(err)
	})
}

func pageStatus(text string) string {
	if strings.TrimSpace(text) == "" {
		return "blank"
	}
	return "text"
}

func savePage(ctx context.Context, tx *sql.Tx, id string, n int, text, status string) error {
	_, err := tx.ExecContext(ctx, `INSERT INTO pages (material_id, number, text, status) VALUES (?, ?, ?, ?)
		ON CONFLICT (material_id, number) DO UPDATE SET text = excluded.text, status = excluded.status`, id, n, text, status)
	return errs.Database.Of(err)
}

// readPages recognizes a scan page by page. Pages already read are skipped,
// so a stopped or retried read picks up where it stopped. A page the
// reader chokes on is kept as failed and the step fails with the list; a
// blank page is not a failure. A digital material's pages were stored when
// it was examined.
func (s *Service) readPages(ctx context.Context, run *runner.Run) error {
	m, err := s.get(ctx, run.SubjectID)
	if err != nil {
		return err
	}
	if m.Kind != "scanned" {
		return nil
	}
	settled, err := s.settled(ctx, m.ID)
	if err != nil {
		return err
	}
	path := s.path(m.ID)
	var failed []int
	for n := 1; n <= m.PageCount; n++ {
		if settled[n] {
			continue
		}
		if ctx.Err() != nil {
			return stopped(ctx)
		}
		run.Activity(fmt.Sprintf("Reading page %d of %d", n, m.PageCount))
		text, err := s.c.Tools.OCR(ctx, path, n)
		status := pageStatus(text)
		switch {
		case err != nil && ctx.Err() != nil:
			return stopped(ctx)
		case err != nil:
			// A reader that isn't installed is the computer's, not this
			// page's: the step waits on it (condition.Cause).
			if errors.Is(err, execx.ErrNotInstalled) {
				return err
			}
			text, status = "", "failed"
			failed = append(failed, n)
		}
		err = run.Write(ctx, func(tx *sql.Tx) error {
			if err := savePage(ctx, tx, m.ID, n, text, status); err != nil {
				return err
			}
			_, err := tx.ExecContext(ctx, `UPDATE materials SET pages_read = (SELECT count(*) FROM pages WHERE material_id = ?1 AND status != 'failed') WHERE id = ?1`, m.ID)
			return errs.Database.Of(err)
		})
		if err != nil {
			return err
		}
	}
	if len(failed) > 0 {
		return pagesUnread.New("count", plural(len(failed), "page"), "list", pageList(failed))
	}
	return nil
}

func (s *Service) settled(ctx context.Context, id string) (map[int]bool, error) {
	rows, err := s.c.Store.DB.QueryContext(ctx, `SELECT number FROM pages WHERE material_id = ? AND status != 'failed'`, id)
	if err != nil {
		return nil, errs.Database.Wrap(err)
	}
	defer cleanup.Close(rows)
	out := map[int]bool{}
	for rows.Next() {
		var n int
		if err := rows.Scan(&n); err != nil {
			return nil, errs.Database.Wrap(err)
		}
		out[n] = true
	}
	return out, errs.Database.Of(rows.Err())
}

func plural(n int, word string) string {
	if n == 1 {
		return "1 " + word
	}
	return fmt.Sprintf("%d %ss", n, word)
}

func pageList(pages []int) string {
	const show = 5
	var parts []string
	for i, n := range pages {
		if i == show {
			parts = append(parts, fmt.Sprintf("and %d more", len(pages)-show))
			break
		}
		parts = append(parts, fmt.Sprintf("p. %d", n))
	}
	return strings.Join(parts, ", ")
}

// texts is a material's pages as text, index i holding PDF page i+1.
func (s *Service) texts(ctx context.Context, id string, count int) ([]string, error) {
	rows, err := s.c.Store.DB.QueryContext(ctx, `SELECT number, text FROM pages WHERE material_id = ?`, id)
	if err != nil {
		return nil, errs.Database.Wrap(err)
	}
	defer cleanup.Close(rows)
	out := make([]string, count)
	for rows.Next() {
		var n int
		var t string
		if err := rows.Scan(&n, &t); err != nil {
			return nil, errs.Database.Wrap(err)
		}
		if n >= 1 && n <= count {
			out[n-1] = t
		}
	}
	return out, errs.Database.Of(rows.Err())
}

// images is a material's pages, rendered through the page cache.
func (s *Service) images(m row) library.PageImage {
	return func(ctx context.Context, page, width int) ([]byte, error) {
		return s.pages.Get(ctx, m.ID, s.path(m.ID), m.PageCount, m.PageWidth, page, width)
	}
}

// contents names the material from its first pages (unless the student
// renamed it) and works out its contents: the PDF's outline, else the
// printed contents as the model reads them, else headings it picks.
func (s *Service) contents(ctx context.Context, run *runner.Run) error {
	m, err := s.get(ctx, run.SubjectID)
	if err != nil {
		return err
	}
	pages, err := s.texts(ctx, m.ID, m.PageCount)
	if err != nil {
		return err
	}
	var secs []library.Section
	var lines []pdf.XMLLine
	if m.Kind == "digital" {
		doc, err := s.c.Tools.XML(ctx, s.path(m.ID))
		if err != nil {
			if ctx.Err() != nil {
				return stopped(ctx)
			}
			return fmt.Errorf("read the material's structure: %w", err)
		}
		secs, lines = library.OutlineSections(doc.Outline), doc.Lines
	}
	client, err := run.Client(ctx)
	if err != nil {
		return err
	}
	model := library.Model(client, s.c.ChatModel, run.Request)
	printed := library.FindContentsPages(pages)
	if !m.Renamed {
		run.Activity("Reading the title")
		// Only a stopped step is an error: a failed call or an answer that
		// doesn't check out leaves the title as it was, as the old import's
		// did.
		// The hint is the file's own name and author, as the old import's
		// was; the author is only a hint here, since a material has none.
		author := ""
		if meta, err := s.c.Tools.Metadata(ctx, s.path(m.ID)); err == nil {
			author = strings.TrimSpace(meta.Author)
		}
		t, _, err := library.ReadName(ctx, model, s.images(m), m.ID, m.Title, author, pages, printed)
		switch {
		case ctx.Err() != nil:
			return stopped(ctx)
		case err != nil:
			slog.Warn("naming: no name read", "material", m.ID, "err", err)
		case t != "":
			if err := run.Write(ctx, func(tx *sql.Tx) error {
				_, err := tx.ExecContext(ctx, `UPDATE materials SET title = ? WHERE id = ? AND renamed = 0`, t, m.ID)
				return errs.Database.Of(err)
			}); err != nil {
				return err
			}
		}
	}
	if len(secs) == 0 {
		run.Activity("Reading the contents")
		if secs, err = library.ReadContents(ctx, model, s.images(m), m.ID, pages, lines, printed); err != nil {
			return err
		}
	}
	secs = library.TidySections(secs, m.PageCount)
	return run.Write(ctx, func(tx *sql.Tx) error { return saveSections(ctx, tx, m.ID, secs) })
}

// saveSections replaces a material's contents. Each section's parent is the
// nearest section above it at a shallower level. Only the purge deletes, so
// a run again writes over the sections it had, position by position, keeps
// their ids, and retires those past the new count (position -1): reads skip
// them and the purge takes them.
func saveSections(ctx context.Context, tx *sql.Tx, id string, secs []library.Section) error {
	have := map[int]string{}
	rows, err := tx.QueryContext(ctx, `SELECT position, id FROM sections WHERE material_id = ? AND position >= 0`, id)
	if err != nil {
		return errs.Database.Wrap(err)
	}
	for rows.Next() {
		var pos int
		var sid string
		if err := rows.Scan(&pos, &sid); err != nil {
			cleanup.Close(rows)
			return errs.Database.Wrap(err)
		}
		have[pos] = sid
	}
	err = rows.Err()
	cleanup.Close(rows)
	if err != nil {
		return errs.Database.Wrap(err)
	}
	if _, err := tx.ExecContext(ctx, `UPDATE sections SET position = -1 WHERE material_id = ? AND position >= ?`, id, len(secs)); err != nil {
		return errs.Database.Wrap(err)
	}
	type open struct {
		level int
		id    string
	}
	var stack []open
	for i, sec := range secs {
		for len(stack) > 0 && stack[len(stack)-1].level >= sec.Level {
			stack = stack[:len(stack)-1]
		}
		parent := ""
		if len(stack) > 0 {
			parent = stack[len(stack)-1].id
		}
		sid, ok := have[i]
		if !ok {
			sid = uuid.NewString()
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO sections (id, material_id, parent_id, title, page, end_page, level, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (id) DO UPDATE SET parent_id = excluded.parent_id, title = excluded.title, page = excluded.page,
				end_page = excluded.end_page, level = excluded.level`,
			sid, id, parent, sec.Title, sec.StartPage, sec.EndPage, sec.Level, i); err != nil {
			return errs.Database.Wrap(err)
		}
		stack = append(stack, open{sec.Level, sid})
	}
	return nil
}

func (s *Service) sections(ctx context.Context, id string) ([]library.Section, error) {
	rows, err := s.c.Store.DB.QueryContext(ctx, `SELECT level, title, page, end_page FROM sections WHERE material_id = ? AND position >= 0 ORDER BY position`, id)
	if err != nil {
		return nil, errs.Database.Wrap(err)
	}
	defer cleanup.Close(rows)
	var out []library.Section
	for rows.Next() {
		var sec library.Section
		if err := rows.Scan(&sec.Level, &sec.Title, &sec.StartPage, &sec.EndPage); err != nil {
			return nil, errs.Database.Wrap(err)
		}
		out = append(out, sec)
	}
	return out, errs.Database.Of(rows.Err())
}

// numbering works out how the material's printed page numbers run and how
// it numbers its problems. A material that numbers its problems goes under
// Textbooks, one that doesn't under Materials, until the student moves it
// (ideas/dependencies-grill.md, D9).
func (s *Service) numbering(ctx context.Context, run *runner.Run) error {
	m, err := s.get(ctx, run.SubjectID)
	if err != nil {
		return err
	}
	pages, err := s.texts(ctx, m.ID, m.PageCount)
	if err != nil {
		return err
	}
	secs, err := s.sections(ctx, m.ID)
	if err != nil {
		return err
	}
	runs, haveRuns := library.DetectRuns(pages)
	style, haveProblems := library.DetectProblems(secs, pages)
	return run.Write(ctx, func(tx *sql.Tx) error {
		if haveRuns {
			b, err := json.Marshal(runs)
			if err != nil {
				return errs.Data.Wrap(err)
			}
			if _, err := tx.ExecContext(ctx, `UPDATE materials SET page_runs = ? WHERE id = ?`, string(b), m.ID); err != nil {
				return errs.Database.Wrap(err)
			}
		}
		if !haveProblems {
			return shelve(ctx, tx, m.ID, false)
		}
		b, err := json.Marshal(style)
		if err != nil {
			return errs.Data.Wrap(err)
		}
		if _, err := tx.ExecContext(ctx, `UPDATE materials SET problems = ? WHERE id = ?`, string(b), m.ID); err != nil {
			return errs.Database.Wrap(err)
		}
		return shelve(ctx, tx, m.ID, true)
	})
}

// shelve puts a material under Textbooks or Materials by what detection
// found, unless the student has put it somewhere themselves.
func shelve(ctx context.Context, tx *sql.Tx, id string, textbook bool) error {
	_, err := tx.ExecContext(ctx, `UPDATE materials SET textbook = ? WHERE id = ? AND textbook_set = 0`, textbook, id)
	return errs.Database.Of(err)
}

// search gives every page with text a vector in the embedder's space, in
// batches. Vectors from another model are dropped first. Without an
// embedder the material is searchable by its words alone.
func (s *Service) search(ctx context.Context, run *runner.Run) error {
	if s.c.Embed == nil {
		return nil
	}
	m, err := s.get(ctx, run.SubjectID)
	if err != nil {
		return err
	}
	if _, err := s.c.Store.DB.ExecContext(ctx, `DELETE FROM embeddings WHERE material_id = ? AND model != ?`, m.ID, s.c.EmbedModel); err != nil {
		return errs.Database.Wrap(err)
	}
	type page struct {
		n    int
		text string
	}
	rows, err := s.c.Store.DB.QueryContext(ctx, `SELECT p.number, p.text FROM pages p
		WHERE p.material_id = ? AND p.status = 'text'
		AND NOT EXISTS (SELECT 1 FROM embeddings e WHERE e.material_id = p.material_id AND e.number = p.number)
		ORDER BY p.number`, m.ID)
	if err != nil {
		return errs.Database.Wrap(err)
	}
	var todo []page
	for rows.Next() {
		var p page
		if err := rows.Scan(&p.n, &p.text); err != nil {
			cleanup.Close(rows)
			return errs.Database.Wrap(err)
		}
		todo = append(todo, p)
	}
	cleanup.Close(rows)
	if err := rows.Err(); err != nil {
		return errs.Database.Wrap(err)
	}
	for len(todo) > 0 {
		if ctx.Err() != nil {
			return stopped(ctx)
		}
		batch := todo[:min(library.EmbedBatch, len(todo))]
		todo = todo[len(batch):]
		run.Activity(fmt.Sprintf("Making page %d searchable", batch[0].n))
		texts := make([]string, len(batch))
		for i, p := range batch {
			texts[i] = p.text
		}
		vecs, err := s.c.Embed(ctx, texts)
		if err != nil {
			if ctx.Err() != nil {
				return stopped(ctx)
			}
			return err
		}
		if len(vecs) != len(batch) {
			return errs.Data.Wrap(fmt.Errorf("search: %d vectors for %d pages", len(vecs), len(batch)))
		}
		err = run.Write(ctx, func(tx *sql.Tx) error {
			for i, p := range batch {
				if _, err := tx.ExecContext(ctx, `INSERT INTO embeddings (material_id, number, model, vector) VALUES (?, ?, ?, ?)
					ON CONFLICT (material_id, number) DO UPDATE SET model = excluded.model, vector = excluded.vector`,
					m.ID, p.n, s.c.EmbedModel, library.EncodeVector(vecs[i])); err != nil {
					return errs.Database.Wrap(err)
				}
			}
			return nil
		})
		if err != nil {
			return err
		}
	}
	return nil
}
