package work

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/jackt/pset/internal/action"
	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/doc"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/material"
	"github.com/jackt/pset/internal/pagenum"
	"github.com/jackt/pset/internal/pdf"
	"github.com/jackt/pset/internal/probnum"
	"github.com/jackt/pset/internal/runner"
	"github.com/jackt/pset/internal/step"
	"github.com/jackt/pset/internal/store"
)

// Materials is where a read keeps its sheet: an upload adopted as a
// material in the read's own write, and the file it was kept as.
type Materials interface {
	Adopt(uploadID string) (*material.Adopted, error)
	File(id string) string
}

// The old homework's caps on what a read takes in and gives back.
const (
	maxAssignmentText = 60000
	maxGroups         = 40
	maxRows           = 80
	// scanPages is how many pages of a sheet without text are looked at.
	scanPages = 4
)

// declareReads adds the reads' actions and, with a runner, their step.
func (s *Service) declareReads() {
	a := s.c.Actions
	action.Add(a, action.Def[StartRead]{
		ID: "read.start", Name: "Read an assignment",
		Run: s.startRead,
	})
	action.Add(a, action.Def[DismissRead]{
		ID: "read.dismiss", Name: "Dismiss", Undoable: true,
		Undone: "Brought the reading back.", Redone: "Dismissed it again.",
		Run: s.dismissRead,
		Try: func(sd action.Seed) DismissRead { return DismissRead{ID: sd.ReadID} },
	})
	action.Add(a, action.Def[ImportRead]{
		ID: "read.import", Name: "Add the homework", Undoable: true,
		Undone: "Took back the homework added.", Redone: "Added the homework again.",
		Run: s.importRead,
		Try: func(sd action.Seed) ImportRead {
			return ImportRead{ReadID: sd.ReadID, Groups: []ImportGroup{{Title: "Problem set 6", Due: "2026-12-15", Rows: []Draft{{Text: "Sketch the circuit."}}}}}
		},
	})
	if s.c.Runner != nil {
		s.c.Runner.Add(runner.Pipeline{Kind: change.ResourceRead, Steps: []runner.Handler{
			{Name: step.NameRead, Model: llm.Reader.Model, Run: s.readStep},
		}})
	}
}

// startRead keeps the uploaded sheet as a material (the same file the
// course already has is that one) and the read, in one write, and starts
// reading. Starting a read spends on a model call, and is not undone: the
// read is dismissed instead.
func (s *Service) startRead(ctx context.Context, do *action.Do, in StartRead) error {
	if s.c.Materials == nil {
		return errs.Unexpected.Wrap(errors.New("work: reads need the materials"))
	}
	up, err := s.c.Materials.Adopt(in.UploadID)
	if err != nil {
		return err
	}
	id := uuid.NewString()
	err = do.Write(ctx, change.ResourceRead, id, func(tx *sql.Tx) error {
		if in.SetID != "" {
			if err := inCourse(ctx, tx, in.SetID, in.CourseID); err != nil {
				return err
			}
		}
		sheet, err := up.Insert(ctx, tx, in.CourseID, true)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO reads (id, course_id, source, sheet_id, set_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
			id, in.CourseID, up.Name(), sheet, in.SetID, db.Now()); err != nil {
			return errs.Database.Wrap(err)
		}
		if s.c.Runner == nil {
			return nil
		}
		return s.c.Runner.Start(ctx, tx, change.ResourceRead, id)
	})
	up.Settle(err)
	return err
}

// inCourse fails Gone unless the set is there and in the course: a read
// never names, nor updates, another course's set.
func inCourse(ctx context.Context, tx *sql.Tx, setID, courseID string) error {
	if err := visible(ctx, tx, change.ResourceSet, setID, "assignment"); err != nil {
		return err
	}
	var n int
	if err := tx.QueryRowContext(ctx, `SELECT count(*) FROM sets WHERE id = ? AND course_id = ?`, setID, courseID).Scan(&n); err != nil {
		return errs.Database.Wrap(err)
	}
	if n == 0 {
		return errs.Gone.New("thing", "assignment")
	}
	return nil
}

func (s *Service) dismissRead(ctx context.Context, do *action.Do, in DismissRead) error {
	return do.Write(ctx, change.ResourceRead, in.ID, func(tx *sql.Tx) error {
		if err := visible(ctx, tx, change.ResourceRead, in.ID, "reading"); err != nil {
			return err
		}
		res, err := tx.ExecContext(ctx, `UPDATE reads SET removed_at = ? WHERE id = ?`, db.Now(), in.ID)
		return action.One(res, err, "reading")
	})
}

// textbook is the course's textbook a read and a split go by: the oldest
// that has worked out its numbering (track 5b picks per set, D11), else the
// oldest still being read in, with no numbering yet. Empty when the course
// has none.
func textbook(ctx context.Context, q interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}, courseID string) (title string, st probnum.Style, err error) {
	var raw string
	// The oldest whose numbering is known, else the oldest still being
	// read in (its title is known, its numbering not yet). Never a sheet.
	err = q.QueryRowContext(ctx, `SELECT title, problems FROM materials m WHERE course_id = ? AND textbook = 1 AND removed_at = ''
		AND NOT EXISTS (SELECT 1 FROM sets WHERE sets.sheet_id = m.id) AND NOT EXISTS (SELECT 1 FROM reads WHERE reads.sheet_id = m.id)
		ORDER BY problems = 'null', added_at, id LIMIT 1`, courseID).Scan(&title, &raw)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return "", st, nil
	case err != nil:
		return "", st, errs.Database.Wrap(err)
	}
	return title, st, errs.Data.Of(json.Unmarshal([]byte(raw), &st))
}

// readStep reads the sheet out into dates and lines, with one Reader call
// and the old homework's prompt, and keeps the result on the read.
func (s *Service) readStep(ctx context.Context, run *runner.Run) error {
	var courseID, sheet string
	if err := s.c.Store.DB.QueryRowContext(ctx, `SELECT course_id, sheet_id FROM reads WHERE id = ?`, run.SubjectID).
		Scan(&courseID, &sheet); err != nil {
		return errs.Database.Wrap(err)
	}
	title, st, err := textbook(ctx, s.c.Store.DB, courseID)
	if err != nil {
		return err
	}
	run.Activity("Looking at the sheet")
	content, err := sheetParts(ctx, s.c.Materials.File(sheet))
	if err != nil {
		return err
	}
	client, err := run.Client(ctx)
	if err != nil {
		return err
	}
	msg := llm.PartsContent(llm.TextPart("The assignment:"))
	for _, p := range content {
		msg.AppendPart(p)
	}
	run.Activity("Reading the assignment")
	reply, err := client.ChatOnce(ctx, run.Request(llm.ChatRequest{Model: llm.Reader.Model, Messages: []llm.Message{
		llm.TextMessage("system", assignmentBrief(title, st, time.Now())),
		{Role: "user", Content: msg},
	}}))
	if err != nil {
		return err
	}
	a, err := readOut(reply, st)
	if err != nil {
		return err
	}
	raw, err := json.Marshal(a)
	if err != nil {
		return errs.Data.Wrap(err)
	}
	return run.Write(ctx, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, `UPDATE reads SET result = ? WHERE id = ?`, string(raw), run.SubjectID)
		return errs.Database.Of(err)
	})
}

// sheetParts is a sheet as the model is shown it: a PDF's text, or, for a
// scan, its first pages as images.
func sheetParts(ctx context.Context, path string) ([]llm.Part, error) {
	text, err := pdf.Text(ctx, path)
	if err != nil {
		return nil, pdfUnreadable.Wrap(err)
	}
	if len(strings.TrimSpace(strings.ReplaceAll(text, "\f", ""))) > 40 {
		return []llm.Part{llm.TextPart(clip(text, maxAssignmentText))}, nil
	}
	var parts []llm.Part
	for n := 1; n <= scanPages; n++ {
		img, err := pdf.PageImage(ctx, path, n, 150)
		if err != nil {
			break
		}
		parts = append(parts, llm.ImagePart("data:image/jpeg;base64,"+base64.StdEncoding.EncodeToString(img)))
	}
	if len(parts) == 0 {
		return nil, pdfUnreadable.New()
	}
	return parts, nil
}

func clip(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

// readOut is the model's reply as an assignment: dates as groups, within
// the caps, each textbook line read as the questions it becomes.
func readOut(reply string, st probnum.Style) (Assignment, error) {
	known := st.Form != ""
	var read struct {
		Title  string `json:"title"`
		Groups []struct {
			Due   string `json:"due"`
			Title string `json:"title"`
			Rows  []struct {
				Kind RowKind `json:"kind"`
				Text string  `json:"text"`
			} `json:"rows"`
		} `json:"groups"`
	}
	if err := json.Unmarshal([]byte(llm.Unfence(reply)), &read); err != nil {
		slog.Warn("assignment: reply wasn't JSON", "err", err)
		return Assignment{}, replyUnreadable.Wrap(err)
	}
	out := Assignment{Title: strings.TrimSpace(read.Title), Groups: []AssignmentGroup{}}
	for _, g := range read.Groups {
		if len(out.Groups) == maxGroups {
			break
		}
		due, _ := cleanDate(g.Due)
		group := AssignmentGroup{Due: due, Title: strings.TrimSpace(g.Title), Rows: []AssignmentRow{}, Gone: []SetQuestion{}}
		for _, r := range g.Rows {
			text := strings.TrimSpace(r.Text)
			if text == "" || len(group.Rows) == maxRows {
				continue
			}
			row := AssignmentRow{Kind: r.Kind, Text: text, Labels: []string{}, Notes: []string{}, Present: []string{}, Changed: []NotesChange{}}
			switch r.Kind {
			case RowKindTextbook:
				// With no textbook whose numbering is known, a line can't be
				// placed: it is read as typed, for the student to look at.
				row.Labels, row.Notes, row.Unread = []string{}, []string{}, true
				if known {
					row.Labels, row.Notes, row.Unread = readLine(text, st)
				}
			case RowKindOwn, RowKindOther:
			default:
				row.Kind = RowKindOther
			}
			group.Rows = append(group.Rows, row)
		}
		if len(group.Rows) > 0 {
			out.Groups = append(out.Groups, group)
		}
	}
	if len(out.Groups) == 0 {
		return Assignment{}, noHomeworkFound.New()
	}
	for i, g := range out.Groups {
		if g.Title == "" {
			out.Groups[i].Title = defaultTitle(out.Title, g.Due, len(out.Groups) > 1)
		}
	}
	return out, nil
}

// readLine is a textbook line as the questions it becomes, in the
// textbook's numbering, and the notes they carry; unread when it isn't a
// reference the numbering can place.
func readLine(text string, st probnum.Style) (labels, notes []string, unread bool) {
	if _, ok := ParseRefs(text, st); !ok {
		return []string{}, []string{}, true
	}
	labels, notes = []string{}, []string{}
	for _, q := range splitDraft(Draft{Text: text, Find: true}, st) {
		labels = append(labels, q.label)
		for _, n := range q.notes {
			if !slices.Contains(notes, n) {
				notes = append(notes, n)
			}
		}
	}
	return labels, notes, false
}

// defaultTitle names a set without a title of its own. One date's sheet is
// the document's name ("Assignment #3"); a semester's table names every
// date the same, so there it's when it's due, which tells the sets apart.
func defaultTitle(name, due string, several bool) string {
	t, err := time.Parse("2006-01-02", due)
	switch {
	case name != "" && !several:
		return name
	case err == nil:
		return "Homework due " + t.Format("Jan 2")
	case name != "":
		return name
	}
	return "Homework"
}

// assignmentBrief is the prompt filled in: today, and the course's textbook
// and its numbering, or that it has none yet (the old homework always had a
// book; a course may not).
func assignmentBrief(title string, st probnum.Style, now time.Time) string {
	textbook := fmt.Sprintf("The course's textbook is %q, and in it\n%s.", title, styleSentence(st))
	switch {
	case title == "":
		textbook = "The course has no textbook yet."
	case st.Form == "":
		textbook = fmt.Sprintf("The course's textbook is %q.", title)
	}
	return fmt.Sprintf(assignmentPrompt, now.Format("Monday, January 2, 2006"), textbook)
}

// styleSentence says how a textbook numbers its problems, for the prompt.
func styleSentence(st probnum.Style) string {
	switch st.Form {
	case probnum.FormLocal:
		return `problems start again in each section, so a reference names the section and the number ("2.1: 1, 4" or "3.1 #7")`
	case probnum.FormSection:
		return `problems are numbered like 2.1.4 (section, then problem)`
	}
	return "problems are numbered like 4.27 (chapter, then problem)"
}

// assignmentPrompt is the old homework's, word for word (rule 1), but for two
// changes: "book" became "textbook", in the row kind and the prose about it
// (the contract's word), and the textbook's sentence is filled in, saying so
// when the course has none or its numbering isn't known yet. No eval covers
// assignment reads: track 0's bar has none, and track 5's evals should.
// Filled by assignmentBrief.
const assignmentPrompt = `You read a course's homework assignment for a student, from what their professor gave them: a
PDF, a web page, a photo, or pasted text. Today is %s. %s

Reply with only JSON, no prose and no code fence:
{"title": "Assignment #3", "groups": [{"due": "2026-09-15", "title": "Assignment #3", "rows": [
  {"kind": "textbook", "text": "Problem 2.1.4, p. 57."},
  {"kind": "own", "text": "There are 24 letters in the Greek alphabet. (a) How many ...? (b) ..."},
  {"kind": "other", "text": "Reading: Sections 2.1 to 2.4"}]}]}

- title: the document's own name for the assignment, or "".
- A group is everything due on one date, in the document's order. due is the date as YYYY-MM-DD,
  its year worked out from the document and today, or "" when none is given. title is the
  group's own name if it has one, else "".
- A table with a row a lecture and a column of problems (a semester schedule) is one group per
  due date, gathering every row due then.
- rows, one per line of homework as the document gives it:
  - "textbook": problems from the textbook. text is the line as written, the reference and every
    note with it, like "2.1: 1, 4, 6 (do c, 6 pts each)", "4.25 (no PSpice or MultiSim)" or
    "Problem 2.3.4, p. 60. Express your answer in terms of p." Keep notes in the line.
  - "own": a problem the professor wrote out. text is all of it, every part, as written, with
    math in LaTeX between $...$. A textbook problem with changes ("do problem 2.5.2, but for 500
    packets") is "textbook", the changes kept as its note.
  - "other": anything that isn't a problem to hand in: reading, quizzes done but not handed in,
    lecture notes, links.
- Leave out headings, footers, copyright lines and page numbers.`

// importRead makes each group the student kept into a set pointing at the
// sheet, or updates the set it names, and is done with the read: one write,
// so one Undo takes it all back.
func (s *Service) importRead(ctx context.Context, do *action.Do, in ImportRead) error {
	if len(in.Groups) == 0 {
		return noGroups.New().OnField("groups")
	}
	return do.Write(ctx, change.ResourceRead, in.ReadID, func(tx *sql.Tx) error {
		if err := visible(ctx, tx, change.ResourceRead, in.ReadID, "reading"); err != nil {
			return err
		}
		var courseID, sheet string
		if err := tx.QueryRowContext(ctx, `SELECT course_id, sheet_id FROM reads WHERE id = ?`, in.ReadID).Scan(&courseID, &sheet); err != nil {
			return errs.Database.Wrap(err)
		}
		_, st, err := textbook(ctx, tx, courseID)
		if err != nil {
			return err
		}
		changed := false
		for _, g := range in.Groups {
			did, err := s.importGroup(ctx, tx, courseID, sheet, g, st)
			if err != nil {
				return err
			}
			changed = changed || did
		}
		if !changed {
			return nothingToAdd.New().OnField("groups")
		}
		_, err = tx.ExecContext(ctx, `UPDATE reads SET removed_at = ? WHERE id = ?`, db.Now(), in.ReadID)
		return errs.Database.Of(err)
	})
}

// importGroup makes one group's set, or applies it to the set it names: new
// lines added (what the set has skipped), instructions rewritten, questions
// taken out. It says whether anything changed.
func (s *Service) importGroup(ctx context.Context, tx *sql.Tx, courseID, sheet string, g ImportGroup, st probnum.Style) (bool, error) {
	var rows []Draft
	for _, r := range g.Rows {
		if strings.TrimSpace(r.Text) == "" {
			continue
		}
		if utf8.RuneCountInString(r.Text) > maxDraft {
			return false, draftTooLong.New("max", strconv.Itoa(maxDraft)).OnField("groups")
		}
		rows = append(rows, r)
	}
	if g.SetID == "" {
		if len(rows) == 0 {
			return false, nil
		}
		title, err := cleanTitle(g.Title)
		if err != nil {
			return false, err
		}
		due, err := cleanDate(g.Due)
		if err != nil {
			return false, err
		}
		id := uuid.NewString()
		if _, err := tx.ExecContext(ctx, `INSERT INTO sets (id, course_id, title, due, sheet_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
			id, courseID, title, due, sheet, db.Now()); err != nil {
			return false, errs.Database.Wrap(err)
		}
		drafts, err := cleanDrafts(rows)
		if err != nil {
			return false, err
		}
		return true, insertQuestions(ctx, tx, id, drafts)
	}
	if err := inCourse(ctx, tx, g.SetID, courseID); err != nil {
		return false, err
	}
	has, err := setHas(ctx, tx, g.SetID, st)
	if err != nil {
		return false, err
	}
	var add []Draft
	for _, r := range rows {
		for _, q := range splitDraft(r, st) {
			if !has.holds(q) {
				add = append(add, Draft{Text: q.text, Find: q.find})
			}
		}
	}
	mine := map[string]bool{}
	for _, q := range has.qs {
		mine[q.id] = true
	}
	changed := false
	for _, n := range g.Notes {
		if !mine[n.QuestionID] {
			continue
		}
		lines, err := cleanNotes(n.Notes)
		if err != nil {
			return false, err
		}
		raw, err := json.Marshal(runLists(lines))
		if err != nil {
			return false, errs.Data.Wrap(err)
		}
		if _, err := tx.ExecContext(ctx, `UPDATE questions SET notes = ? WHERE id = ?`, string(raw), n.QuestionID); err != nil {
			return false, errs.Database.Wrap(err)
		}
		changed = true
	}
	for _, id := range g.Remove {
		if !mine[id] {
			continue
		}
		if _, err := tx.ExecContext(ctx, `UPDATE questions SET removed_at = ? WHERE id = ? AND removed_at = ''`, db.Now(), id); err != nil {
			return false, errs.Database.Wrap(err)
		}
		changed = true
	}
	if len(add) > 0 {
		if err := insertQuestions(ctx, tx, g.SetID, add); err != nil {
			return false, err
		}
		changed = true
	}
	// A set updated from a sheet it didn't come from is checked against that
	// sheet from now on.
	if changed {
		if _, err := tx.ExecContext(ctx, `UPDATE sets SET sheet_id = ? WHERE id = ? AND sheet_id = ''`, sheet, g.SetID); err != nil {
			return false, errs.Database.Wrap(err)
		}
	}
	return changed, nil
}

// setContents is what a set has, to tell a sheet's lines it already holds.
type setContents struct {
	qs      []setQ
	byLabel map[string]*setQ
	texts   map[string]bool
}

type setQ struct {
	id    string
	label string
	notes []string
	// Looked-up questions only: every label it is known by.
	labels []string
}

type queryer interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}

// setHas reads a set's questions still there; no set is an empty one. A
// problem is known by the labels it was added under and the one it carries.
func setHas(ctx context.Context, q queryer, setID string, st probnum.Style) (setContents, error) {
	c := setContents{byLabel: map[string]*setQ{}, texts: map[string]bool{}}
	if setID == "" {
		return c, nil
	}
	rows, err := q.QueryContext(ctx, `SELECT id, text, find, label, notes FROM questions WHERE set_id = ? AND removed_at = ''
		ORDER BY position, created_at, id`, setID)
	if err != nil {
		return c, errs.Database.Wrap(err)
	}
	for rows.Next() {
		var sq setQ
		var text, notes string
		var find bool
		if err := rows.Scan(&sq.id, &text, &find, &sq.label, &notes); err != nil {
			return c, errs.Database.Of(errors.Join(err, rows.Close()))
		}
		c.texts[normText(text)] = true
		if !find {
			continue
		}
		var runs [][]doc.Run
		if err := json.Unmarshal([]byte(notes), &runs); err != nil {
			return c, errs.Data.Of(errors.Join(err, rows.Close()))
		}
		for _, r := range runs {
			sq.notes = append(sq.notes, doc.Source(r, pagenum.Map{}))
		}
		for _, sp := range splitDraft(Draft{Text: text, Find: true}, st) {
			sq.labels = append(sq.labels, sp.label)
		}
		if sq.label != "" && !slices.Contains(sq.labels, sq.label) {
			sq.labels = append(sq.labels, sq.label)
		}
		if len(sq.labels) > 0 {
			sq.label = sq.labels[0]
		}
		c.qs = append(c.qs, sq)
	}
	if err := errors.Join(rows.Err(), rows.Close()); err != nil {
		return c, errs.Database.Wrap(err)
	}
	for i := range c.qs {
		for _, l := range c.qs[i].labels {
			c.byLabel[l] = &c.qs[i]
		}
	}
	return c, nil
}

// compare marks a sheet's date against the set: each line's labels the set
// has, whether it has the whole line, whose instructions changed, and the
// set's problems the date no longer lists.
func (c setContents) compare(g *AssignmentGroup) {
	g.Gone = []SetQuestion{}
	listed := map[string]bool{}
	for ri := range g.Rows {
		row := &g.Rows[ri]
		row.Present, row.Changed, row.Added = []string{}, []NotesChange{}, false
		for _, l := range row.Labels {
			q := c.byLabel[l]
			if q == nil {
				continue
			}
			listed[q.id] = true
			row.Present = append(row.Present, l)
			if row.Kind == RowKindTextbook && !slices.Equal(q.notes, row.Notes) {
				was := q.notes
				if was == nil {
					was = []string{}
				}
				row.Changed = append(row.Changed, NotesChange{QuestionID: q.id, Label: l, Was: was, Now: row.Notes})
			}
		}
		if row.Kind == RowKindTextbook && len(row.Labels) > 0 {
			row.Added = len(row.Present) == len(row.Labels)
		} else {
			row.Added = c.texts[normText(row.Text)]
		}
	}
	if len(c.qs) == 0 {
		return
	}
	for _, q := range c.qs {
		if !listed[q.id] {
			g.Gone = append(g.Gone, SetQuestion{QuestionID: q.id, Label: q.label})
		}
	}
}

// holds says whether the set has a question: a problem by label, anything
// by its text.
func (c setContents) holds(q split) bool {
	return (q.find && q.label != "" && c.byLabel[q.label] != nil) || c.texts[normText(q.text)]
}

// normText is a line's text as compared: case and spacing don't count.
func normText(t string) string {
	return strings.ToLower(strings.Join(strings.Fields(t), " "))
}

// Reads is a course's reads still under way or waiting for review, oldest
// first, each read marked against the sets: the one it updates, or those
// made from the same sheet, by due date.
func (s *Service) Reads(ctx context.Context, courseID string) (Reads, error) {
	rows, err := s.c.Store.DB.QueryContext(ctx, `SELECT id, seq, course_id, source, sheet_id, set_id, result, created_at
		FROM reads r WHERE course_id = ? AND `+store.Visible(change.ResourceRead, "r.id")+` ORDER BY created_at, id`, courseID)
	if err != nil {
		return Reads{}, errs.Database.Wrap(err)
	}
	out := Reads{Reads: []Read{}}
	var results []string
	for rows.Next() {
		var r Read
		var result string
		if err := rows.Scan(&r.ID, &r.Seq, &r.CourseID, &r.Source, &r.SheetID, &r.SetID, &result, &r.CreatedAt); err != nil {
			return Reads{}, errs.Database.Of(errors.Join(err, rows.Close()))
		}
		out.Reads, results = append(out.Reads, r), append(results, result)
	}
	if err := errors.Join(rows.Err(), rows.Close()); err != nil {
		return Reads{}, errs.Database.Wrap(err)
	}
	_, st, err := textbook(ctx, s.c.Store.DB, courseID)
	if err != nil {
		return Reads{}, err
	}
	for i := range out.Reads {
		r := &out.Reads[i]
		r.Steps = []step.Step{}
		if s.c.Runner != nil {
			if r.Steps, err = s.c.Runner.Steps(ctx, change.ResourceRead, r.ID); err != nil {
				return Reads{}, err
			}
		}
		if results[i] == "null" {
			continue
		}
		var a Assignment
		if err := json.Unmarshal([]byte(results[i]), &a); err != nil {
			return Reads{}, errs.Data.Wrap(err)
		}
		if err := s.mark(ctx, st, r, &a); err != nil {
			return Reads{}, err
		}
		r.Assignment = &a
	}
	return out, nil
}

// mark marks each group against the set it updates: the one the read names,
// or the one made from the same sheet with the group's due date.
func (s *Service) mark(ctx context.Context, st probnum.Style, r *Read, a *Assignment) error {
	named := r.SetID
	if named != "" {
		var there bool
		if err := s.c.Store.DB.QueryRowContext(ctx, `SELECT `+store.Visible(change.ResourceSet, "?"), named).Scan(&there); err != nil {
			return errs.Database.Wrap(err)
		}
		if !there {
			// The set it was read for has gone since: its dates update
			// nothing, and read.import would refuse it.
			named, r.SetID = "", ""
		}
	}
	sets := map[string]string{}
	if named == "" {
		rows, err := s.c.Store.DB.QueryContext(ctx, `SELECT due, id FROM sets t WHERE sheet_id = ? AND due != '' AND `+
			store.Visible(change.ResourceSet, "t.id")+` ORDER BY created_at`, r.SheetID)
		if err != nil {
			return errs.Database.Wrap(err)
		}
		for rows.Next() {
			var due, id string
			if err := rows.Scan(&due, &id); err != nil {
				return errs.Database.Of(errors.Join(err, rows.Close()))
			}
			sets[due] = id
		}
		if err := errors.Join(rows.Err(), rows.Close()); err != nil {
			return errs.Database.Wrap(err)
		}
	}
	for gi := range a.Groups {
		g := &a.Groups[gi]
		id := named
		if id == "" && g.Due != "" {
			id = sets[g.Due]
		}
		g.Imported, g.SetID = named == "" && id != "", id
		c, err := setHas(ctx, s.c.Store.DB, id, st)
		if err != nil {
			return err
		}
		c.compare(g)
	}
	return nil
}

// readRoutes mounts the reads a course has under way or waiting for review.
func (s *Service) readRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/courses/{id}/reads", httpx.Reply(func(r *http.Request) (Reads, error) {
		return s.Reads(r.Context(), r.PathValue("id"))
	}))
}
