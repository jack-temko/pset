package material

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/jackt/pset/internal/action"
	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/condition"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/library"
	"github.com/jackt/pset/internal/pagenum"
	"github.com/jackt/pset/internal/probnum"
	"github.com/jackt/pset/internal/runner"
	"github.com/jackt/pset/internal/step"
	"github.com/jackt/pset/internal/store"
)

// Config is what the service is built from.
type Config struct {
	Store   *store.Store
	Actions *action.Catalog
	// Runner reads materials in; nil when the service is built only to
	// declare its actions (generating the catalog).
	Runner  *runner.Runner
	DataDir string
	// Tools read PDFs: library.LiveTools, or a test's.
	Tools library.Tools
	// OCRWorkers is how many pages of a scan are read at once; 0 is half
	// the cores, one to four.
	OCRWorkers int
	// ChatModel is the model naming and the contents ask.
	ChatModel string
	// Embed makes search's vectors, in EmbedModel's space; nil leaves a
	// material searchable by its words alone.
	Embed      func(ctx context.Context, texts []string) ([][]float32, error)
	EmbedModel string
}

// Service keeps a course's materials: adding one, reading it in, and its
// pages, contents and search.
type Service struct {
	c     Config
	pages *library.Pages
}

// New is the materials, with their actions declared in c.Actions and
// their pipeline on c.Runner.
func New(c Config) *Service {
	if c.Tools.Metadata == nil {
		c.Tools = library.LiveTools()
	}
	s := &Service{c: c, pages: library.NewPages(filepath.Join(c.DataDir, "cache", "pages"), c.Tools.PageImage)}
	action.Add(c.Actions, action.Def[Add]{
		ID: "material.add", Name: "Add material", Undoable: true, Costs: true,
		Needs:  []condition.ID{condition.IDPDFReader},
		Undone: "Took back adding {name}.", Redone: "Added {name} again.",
		Run: s.add,
		Try: func(sd action.Seed) Add { return Add{CourseID: sd.CourseID, UploadID: sd.UploadID} },
	})
	action.Add(c.Actions, action.Def[Rename]{
		ID: "material.rename", Name: "Rename material", Undoable: true,
		Undone: "Renamed back to {name}.", Redone: "Renamed to {name} again.",
		Run: s.rename,
		Try: func(sd action.Seed) Rename { return Rename{ID: sd.MaterialID, Title: "Signals and Systems"} },
	})
	action.Add(c.Actions, action.Def[Remove]{
		ID: "material.remove", Name: "Remove material", Undoable: true, Removes: true,
		Undone: "Brought back {name}.", Redone: "Removed {name} again.",
		Run: s.remove,
		Try: func(sd action.Seed) Remove { return Remove{ID: sd.MaterialID} },
	})
	action.Add(c.Actions, action.Def[Textbook]{
		ID: "material.textbook", Name: "Move between Textbooks and Materials", Undoable: true,
		Undone: "{name} is back where it was.", Redone: "Moved {name} again.",
		Run: s.textbook,
		Try: func(sd action.Seed) Textbook { return Textbook{ID: sd.MaterialID, Textbook: true} },
	})
	if c.Runner != nil {
		c.Runner.Add(s.pipeline())
	}
	return s
}

func (s *Service) uploadsDir() string    { return filepath.Join(s.c.DataDir, "uploads") }
func (s *Service) filesDir() string      { return filepath.Join(s.c.DataDir, "materials") }
func (s *Service) path(id string) string { return filepath.Join(s.filesDir(), id+".pdf") }

// File is where a material's PDF is kept.
func (s *Service) File(id string) string       { return s.path(id) }
func (s *Service) staged(id string) string     { return filepath.Join(s.uploadsDir(), id+".pdf") }
func (s *Service) stagedMeta(id string) string { return filepath.Join(s.uploadsDir(), id+".json") }

// staging is what an upload keeps beside its file.
type staging struct {
	Name string `json:"name"`
	Hash string `json:"hash"`
}

// Stage keeps an uploaded PDF, hashing it on the way in, for material.add
// to name. A file that isn't a PDF is refused under the file field.
func (s *Service) Stage(r io.Reader, name string) (Upload, error) {
	if err := os.MkdirAll(s.uploadsDir(), 0o700); err != nil {
		return Upload{}, errs.Disk.Wrap(err)
	}
	tmp, err := os.CreateTemp(s.uploadsDir(), ".upload-*")
	if err != nil {
		return Upload{}, errs.Disk.Wrap(err)
	}
	defer cleanup.Remove(tmp.Name()) // a no-op once renamed
	h := sha256.New()
	head := &sniffer{}
	src := &reading{r: r}
	if _, err := io.Copy(io.MultiWriter(tmp, h, head), src); err != nil {
		cleanup.Close(tmp)
		if src.err != nil {
			// The upload was cut off, not the disk.
			return Upload{}, httpx.UploadCut.Wrap(src.err).OnField("file")
		}
		return Upload{}, errs.Disk.Wrap(fmt.Errorf("stage upload: %w", err))
	}
	if err := tmp.Close(); err != nil {
		return Upload{}, errs.Disk.Wrap(err)
	}
	if !head.isPDF() {
		return Upload{}, notPDF.New().OnField("file")
	}
	id := uuid.NewString()
	meta, err := json.Marshal(staging{Name: filepath.Base(name), Hash: hex.EncodeToString(h.Sum(nil))})
	if err != nil {
		return Upload{}, errs.Data.Wrap(err)
	}
	if err := os.WriteFile(s.stagedMeta(id), meta, 0o600); err != nil {
		return Upload{}, errs.Disk.Wrap(err)
	}
	if err := os.Rename(tmp.Name(), s.staged(id)); err != nil {
		cleanup.Remove(s.stagedMeta(id))
		return Upload{}, errs.Disk.Wrap(err)
	}
	return Upload{ID: id, Name: filepath.Base(name)}, nil
}

// reading keeps the error reading the upload gave, apart from writing it.
type reading struct {
	r   io.Reader
	err error
}

func (r *reading) Read(p []byte) (int, error) {
	n, err := r.r.Read(p)
	if err != nil && !errors.Is(err, io.EOF) {
		r.err = err
	}
	return n, err //nolint:wrapcheck // a Reader passes its source's errors as they are: io.Copy needs io.EOF itself
}

// sniffer keeps the first bytes of a stream, to check it is a PDF.
type sniffer struct{ b []byte }

func (h *sniffer) Write(p []byte) (int, error) {
	if n := 1024 - len(h.b); n > 0 {
		h.b = append(h.b, p[:min(n, len(p))]...)
	}
	return len(p), nil
}

func (h *sniffer) isPDF() bool { return strings.Contains(string(h.b), "%PDF-") }

// add makes the staged upload a material of the course and starts reading
// it in. The file moves to the materials folder first, and back if the
// write fails.
func (s *Service) add(ctx context.Context, do *action.Do, in Add) error {
	up, err := s.Adopt(in.UploadID)
	if err != nil {
		return err
	}
	err = do.Write(ctx, change.ResourceMaterial, up.ID, func(tx *sql.Tx) error {
		_, err := up.Insert(ctx, tx, in.CourseID, false)
		return err
	})
	up.Settle(err)
	return err
}

// Adopted is an upload moved in as a material's file, waiting for its row:
// Insert it inside the write that makes the material, then Settle.
type Adopted struct {
	// ID is the material it becomes.
	ID     string
	s      *Service
	upload string
	st     staging
	reused bool
}

// Adopt moves a staged upload in as a new material's file, before the write
// that adds it.
func (s *Service) Adopt(uploadID string) (*Adopted, error) {
	if uploadID == "" || strings.ContainsAny(uploadID, `/\.`) {
		return nil, uploadGone.New()
	}
	raw, err := os.ReadFile(s.stagedMeta(uploadID))
	if err != nil {
		return nil, uploadGone.New()
	}
	a := &Adopted{ID: uuid.NewString(), s: s, upload: uploadID}
	if err := json.Unmarshal(raw, &a.st); err != nil {
		return nil, errs.Data.Wrap(err)
	}
	if err := os.MkdirAll(s.filesDir(), 0o700); err != nil {
		return nil, errs.Disk.Wrap(err)
	}
	if err := os.Rename(s.staged(uploadID), s.path(a.ID)); err != nil {
		return nil, uploadGone.Wrap(err)
	}
	// A rename keeps the upload's time; the sweep spares a file by its age,
	// so it is made new as it moves in.
	now := time.Now()
	cleanup.Log("material: date a file moved in", os.Chtimes(s.path(a.ID), now, now))
	return a, nil
}

// Insert adds the material's row to a visible course, and starts its import.
// The same file already in the course is refused as a duplicate, unless
// reuse: then that material is the one (a sheet uploaded again), and its id
// is returned in place of the new one.
func (a *Adopted) Insert(ctx context.Context, tx *sql.Tx, courseID string, reuse bool) (string, error) {
	a.reused = false
	var course bool
	if err := tx.QueryRowContext(ctx, `SELECT `+store.Visible(change.ResourceCourse, "?"), courseID).Scan(&course); err != nil {
		return "", errs.Database.Wrap(err)
	}
	if !course {
		return "", errs.Gone.New("thing", "course")
	}
	var have, title string
	err := tx.QueryRowContext(ctx, `SELECT id, title FROM materials WHERE course_id = ? AND file_hash = ? AND removed_at = ''`,
		courseID, a.st.Hash).Scan(&have, &title)
	switch {
	case err == nil && reuse:
		a.reused = true
		return have, nil
	case err == nil:
		return "", duplicate.New("title", title).About(have)
	case !errors.Is(err, sql.ErrNoRows):
		return "", errs.Database.Wrap(err)
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO materials (id, course_id, title, file_hash, added_at) VALUES (?, ?, ?, ?, ?)`,
		a.ID, courseID, library.FilenameTitle(a.st.Name), a.st.Hash, db.Now()); err != nil {
		return "", errs.Database.Wrap(err)
	}
	if a.s.c.Runner == nil {
		return a.ID, nil
	}
	return a.ID, a.s.c.Runner.Start(ctx, tx, change.ResourceMaterial, a.ID)
}

// Name is the upload's own file name.
func (a *Adopted) Name() string { return a.st.Name }

// Settle finishes after the write: a failed write puts the upload back to
// add again, a material reused drops the copy, and a new one is read in.
func (a *Adopted) Settle(err error) {
	switch {
	case err != nil:
		cleanup.Log("material: put an upload back", os.Rename(a.s.path(a.ID), a.s.staged(a.upload)))
		return
	case a.reused:
		cleanup.Remove(a.s.path(a.ID))
	}
	cleanup.Remove(a.s.stagedMeta(a.upload))
	if a.s.c.Runner != nil {
		a.s.c.Runner.Wake()
	}
}

// maxTitle is the longest a material's title may be.
const maxTitle = 200

func title(t string) (string, error) {
	t = strings.Join(strings.Fields(t), " ")
	switch {
	case t == "":
		return "", titleEmpty.New().OnField("title")
	case utf8.RuneCountInString(t) > maxTitle:
		return "", titleTooLong.New("max", strconv.Itoa(maxTitle)).OnField("title")
	}
	return t, nil
}

func (s *Service) rename(ctx context.Context, do *action.Do, in Rename) error {
	t, err := title(in.Title)
	if err != nil {
		return err
	}
	return do.Write(ctx, change.ResourceMaterial, in.ID, func(tx *sql.Tx) error {
		var cur string
		err := tx.QueryRowContext(ctx, `SELECT title FROM materials WHERE id = ? AND removed_at = ''`, in.ID).Scan(&cur)
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return errs.Gone.New("thing", "material")
		case err != nil:
			return errs.Database.Wrap(err)
		case cur == t:
			return action.ErrUnchanged
		}
		// renamed is the material's own mark: reading its title in never
		// writes over the student's.
		res, err := tx.ExecContext(ctx, `UPDATE materials SET title = ?, renamed = 1 WHERE id = ? AND removed_at = ''`, t, in.ID)
		return action.One(res, err, "material")
	})
}

func (s *Service) remove(ctx context.Context, do *action.Do, in Remove) error {
	return do.Write(ctx, change.ResourceMaterial, in.ID, func(tx *sql.Tx) error {
		res, err := tx.ExecContext(ctx, `UPDATE materials SET removed_at = ? WHERE id = ? AND removed_at = ''`, db.Now(), in.ID)
		return action.One(res, err, "material")
	})
}

// textbook puts a material under Textbooks or Materials, as the student
// says: a course may have any number of textbooks (ideas/dependencies-
// grill.md, D8). The student's choice stands from then on: detection no
// longer moves it.
func (s *Service) textbook(ctx context.Context, do *action.Do, in Textbook) error {
	return do.Write(ctx, change.ResourceMaterial, in.ID, func(tx *sql.Tx) error {
		var is, set bool
		err := tx.QueryRowContext(ctx, `SELECT textbook, textbook_set FROM materials WHERE id = ? AND removed_at = ''`, in.ID).Scan(&is, &set)
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return errs.Gone.New("thing", "material")
		case err != nil:
			return errs.Database.Wrap(err)
		case is == in.Textbook && set:
			return action.ErrUnchanged
		}
		// Even where detection already put it, the action pins it there (not
		// yet the student's choice): a later detection can't move it, and it
		// is a change Undo can take back.
		res, err := tx.ExecContext(ctx, `UPDATE materials SET textbook = ?, textbook_set = 1 WHERE id = ?`, in.Textbook, in.ID)
		return action.One(res, err, "material")
	})
}

// row is a material as the steps read it.
type row struct {
	Material
	Kind      string
	PageWidth float64
	Renamed   bool
	pagesRead int
}

const columns = `id, seq, course_id, title, page_count, aspect, page_runs, problems, textbook, pages_read, added_at, removed_at, kind, page_width, renamed`

func scanRow(sc interface{ Scan(...any) error }) (row, error) {
	var r row
	var runs, problems string
	err := sc.Scan(&r.ID, &r.Seq, &r.CourseID, &r.Title, &r.PageCount, &r.Aspect, &runs, &problems, &r.Textbook,
		&r.pagesRead, &r.AddedAt, &r.RemovedAt, &r.Kind, &r.PageWidth, &r.Renamed)
	if err != nil {
		return row{}, err
	}
	r.PageRuns = []pagenum.Run{}
	if err := json.Unmarshal([]byte(runs), &r.PageRuns); err != nil {
		return row{}, errs.Data.Wrap(err)
	}
	if problems != "null" && problems != "" {
		var st probnum.Style
		if err := json.Unmarshal([]byte(problems), &st); err != nil {
			return row{}, errs.Data.Wrap(err)
		}
		r.Problems = &st
	}
	return r, nil
}

// get is one material, removed or not: a removed one stays readable while
// a set uses it (D13).
func (s *Service) get(ctx context.Context, id string) (row, error) {
	r, err := scanRow(s.c.Store.DB.QueryRowContext(ctx, `SELECT `+columns+` FROM materials WHERE id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return row{}, errs.Gone.New("thing", "material")
	}
	return r, errs.Database.Of(err)
}

// Get is one material as the page has it, with its steps and progress.
func (s *Service) Get(ctx context.Context, id string) (Material, error) {
	r, err := s.get(ctx, id)
	if err != nil {
		return Material{}, err
	}
	return s.wire(ctx, r)
}

// List is a course's materials not removed, in the order they were added,
// sheets left out: they are listed with their sets.
func (s *Service) List(ctx context.Context, courseID string) (Materials, error) {
	// A sheet is listed with its set (or its read under review), not here
	// (track 5a); it is still a material, found and opened by its id. A
	// sheet whose set and reads are all gone is listed again, and a
	// textbook named as a sheet stays under Textbooks.
	rows, err := s.c.Store.DB.QueryContext(ctx, `SELECT `+columns+` FROM materials
		WHERE course_id = ? AND removed_at = ''
		AND (textbook = 1 OR (
			NOT EXISTS (SELECT 1 FROM sets WHERE sets.sheet_id = materials.id AND sets.removed_at = '')
			AND NOT EXISTS (SELECT 1 FROM reads WHERE reads.sheet_id = materials.id AND reads.removed_at = '')))
		ORDER BY added_at, id`, courseID)
	if err != nil {
		return Materials{}, errs.Database.Wrap(err)
	}
	var rs []row
	for rows.Next() {
		r, err := scanRow(rows)
		if err != nil {
			cleanup.Close(rows)
			return Materials{}, errs.Database.Of(err)
		}
		rs = append(rs, r)
	}
	cleanup.Close(rows)
	if err := rows.Err(); err != nil {
		return Materials{}, errs.Database.Wrap(err)
	}
	out := Materials{Materials: []Material{}}
	for _, r := range rs {
		m, err := s.wire(ctx, r)
		if err != nil {
			return Materials{}, err
		}
		out.Materials = append(out.Materials, m)
	}
	return out, nil
}

// wire fills a material's steps, and its progress while its pages are
// being read.
func (s *Service) wire(ctx context.Context, r row) (Material, error) {
	m := r.Material
	m.Steps = []step.Step{}
	if s.c.Runner != nil {
		steps, err := s.c.Runner.Steps(ctx, change.ResourceMaterial, r.ID)
		if err != nil {
			return Material{}, err
		}
		m.Steps = steps
		for _, st := range steps {
			if st.Name == step.NameReadPages && st.State != step.StateDone && r.PageCount > 0 {
				m.Progress = progress(r.pagesRead, r.PageCount, st.StartedAt)
			}
		}
	}
	return m, nil
}

// progress is how far reading has got, with a guess at the time left once
// a few pages give a pace.
func progress(done, total int, started string) *Progress {
	p := &Progress{Done: done, Total: total}
	at, err := time.Parse(time.RFC3339Nano, started)
	if done >= 3 && err == nil {
		per := time.Since(at) / time.Duration(done)
		p.SecondsLeft = int((per * time.Duration(total-done)).Seconds())
	}
	return p
}

// Sweep clears files nothing names: a material purged from the store, and
// uploads kept past a day. Run at start and with the daily purge.
func (s *Service) Sweep(ctx context.Context) error {
	entries, err := os.ReadDir(s.filesDir())
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return errs.Disk.Wrap(err)
	}
	for _, e := range entries {
		id, ok := strings.CutSuffix(e.Name(), ".pdf")
		if !ok {
			continue
		}
		var n int
		if err := s.c.Store.DB.QueryRowContext(ctx, `SELECT count(*) FROM materials WHERE id = ?`, id).Scan(&n); err != nil {
			return errs.Database.Wrap(err)
		}
		// A file younger than a minute may be a material being added, its
		// row not yet committed.
		info, err := e.Info()
		if n == 0 && err == nil && time.Since(info.ModTime()) > time.Minute {
			cleanup.Remove(s.path(id))
			s.pages.Drop(id)
		}
	}
	uploads, err := os.ReadDir(s.uploadsDir())
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return errs.Disk.Wrap(err)
	}
	for _, e := range uploads {
		info, err := e.Info()
		if err == nil && time.Since(info.ModTime()) > 24*time.Hour {
			cleanup.Remove(filepath.Join(s.uploadsDir(), e.Name()))
		}
	}
	return nil
}
