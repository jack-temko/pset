package homework

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"regexp"
	"strings"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/doc"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/pagenum"
	"github.com/jackt/pset/internal/pdf"
)

// Migrations creates the tables: sets hang off books, questions off sets, and both cascade,
// so removing a book removes its homework without a call from library.
func Migrations() []db.Migration {
	return []db.Migration{{Name: "homework/1", SQL: `
CREATE TABLE homework (
	id           TEXT PRIMARY KEY,
	book_id      TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
	title        TEXT NOT NULL,
	due_date     TEXT NOT NULL DEFAULT '',
	turned_in_at TEXT NOT NULL DEFAULT '',
	created_at   TEXT NOT NULL,
	updated_at   TEXT NOT NULL
);
CREATE INDEX homework_book ON homework (book_id);

CREATE TABLE questions (
	id          TEXT PRIMARY KEY,
	homework_id TEXT NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
	position    INTEGER NOT NULL,
	text        TEXT NOT NULL,
	in_book     INTEGER NOT NULL,
	label       TEXT NOT NULL DEFAULT '',
	statement   TEXT NOT NULL DEFAULT '',
	page        INTEGER,
	pinned_page INTEGER,
	rect        TEXT NOT NULL DEFAULT 'null',
	figures     TEXT NOT NULL DEFAULT '[]',
	hint        TEXT NOT NULL DEFAULT '[]',
	walkthrough TEXT NOT NULL DEFAULT '[]',
	state       TEXT NOT NULL,
	reason      TEXT NOT NULL DEFAULT '',
	revealed    TEXT NOT NULL DEFAULT '[]',
	done_at     TEXT NOT NULL DEFAULT '',
	created_at  TEXT NOT NULL,
	updated_at  TEXT NOT NULL
);
CREATE INDEX questions_homework ON questions (homework_id, position);`},
		// What the writer is doing right now, for the walkthrough's working
		// line: thinking, a tool call, or writing.
		{Name: "homework/2", SQL: `ALTER TABLE questions ADD COLUMN activity TEXT NOT NULL DEFAULT ''`},
		// What writing the guide did with the book's memory.
		{Name: "homework/3", SQL: `ALTER TABLE questions ADD COLUMN memory TEXT NOT NULL DEFAULT '[]'`},
		// What kind of failure a failed question had.
		{Name: "homework/4", SQL: `ALTER TABLE questions ADD COLUMN failure TEXT NOT NULL DEFAULT ''`},
		// The guide's conversation so far, one tool round at a time, so a
		// restart carries on from its last round instead of starting over.
		// Read only by the writer: it holds images, so no list selects it.
		{Name: "homework/5", SQL: `ALTER TABLE questions ADD COLUMN rounds TEXT NOT NULL DEFAULT '[]'`},
		// A revision per question, bumped by every update, so the client
		// can keep the newest of two snapshots whatever order they land
		// in. A trigger rather than each UPDATE, so no write can forget it.
		// The WHEN keeps the trigger's own update from firing it again.
		{Name: "homework/6", SQL: `
ALTER TABLE questions ADD COLUMN rev INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER questions_rev AFTER UPDATE ON questions FOR EACH ROW WHEN NEW.rev = OLD.rev
BEGIN
	UPDATE questions SET rev = OLD.rev + 1 WHERE id = NEW.id;
END;`},
		// How its figure reads, one fact a line, and whether the student
		// has corrected it: the guide is written from it.
		{Name: "homework/7", SQL: `ALTER TABLE questions ADD COLUMN reading TEXT NOT NULL DEFAULT '[]';
ALTER TABLE questions ADD COLUMN reading_edited INTEGER NOT NULL DEFAULT 0`},
		// The boxes the student drew around the problem on the page scan,
		// which it's read from instead of being looked for.
		{Name: "homework/8", SQL: `ALTER TABLE questions ADD COLUMN boxes TEXT NOT NULL DEFAULT '[]'`},
		// The professor's instructions for the problem ("do c", "no
		// PSpice"), which the guide follows over the book.
		{Name: "homework/9", SQL: `ALTER TABLE questions ADD COLUMN notes TEXT NOT NULL DEFAULT '[]'`},
		// Where an imported set came from (a web page's URL, a file's
		// name), so checking the page again offers only new due dates.
		{Name: "homework/10", SQL: `ALTER TABLE homework ADD COLUMN source TEXT NOT NULL DEFAULT ''`},
		// An assignment being read in the background, then waiting for its
		// review: what it was read from, and what was read. Gone once it's
		// imported or dismissed.
		{Name: "homework/11", SQL: `
CREATE TABLE assignment_reads (
	id         TEXT PRIMARY KEY,
	book_id    TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
	source     TEXT NOT NULL,
	set_id     TEXT NOT NULL DEFAULT '',
	url        TEXT NOT NULL DEFAULT '',
	text       TEXT NOT NULL DEFAULT '',
	file       BLOB,
	state      TEXT NOT NULL,
	error      TEXT NOT NULL DEFAULT '',
	result     TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE INDEX assignment_reads_book ON assignment_reads (book_id, created_at);`},
		// Structured guides (ideas/structured-guides.md): a guide is a
		// document of blocks, and a statement, a professor's note and a
		// line of a figure's reading are runs. The old guides are deleted,
		// not converted: most were broken in some way, and the students'
		// questions, sets, due dates and Complete marks stay. A question
		// that had a guide has none until it is asked for ("Write the
		// guide"); one still waiting for its guide writes it in the new
		// format when its turn comes.
		{Name: "homework/12", Do: structuredGuides},
		// What a read is doing while it reads: thinking, then the lines
		// found so far.
		{Name: "homework/13", SQL: `ALTER TABLE assignment_reads ADD COLUMN activity TEXT NOT NULL DEFAULT ''`},
		// Where a figure's readings disagreed, as the settling said: the
		// points worth checking against the figure.
		{Name: "homework/14", SQL: `ALTER TABLE questions ADD COLUMN reading_doubts TEXT NOT NULL DEFAULT '[]'`},
		// How hard a question is against the rest of its set, 1 to 5; 0 is
		// not ranked yet. It weights the set's progress bar.
		{Name: "homework/15", SQL: `ALTER TABLE questions ADD COLUMN difficulty INTEGER NOT NULL DEFAULT 0`},
		// How many times a failed question has been tried again, and when
		// it last failed, so a second failure can say it is a second.
		{Name: "homework/16", SQL: `ALTER TABLE questions ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE questions ADD COLUMN failed_at TEXT NOT NULL DEFAULT ''`},
		// A walkthrough no longer shows what it did with the book's memory.
		{Name: "homework/17", SQL: `ALTER TABLE questions DROP COLUMN memory`},
		// A failed question and a failed read keep their error as catalog
		// entries, not as a kind and a sentence: the page draws the entry's
		// words. Rows that failed before get the entries their sentence
		// named, and the old columns go.
		{Name: "homework/18", SQL: `ALTER TABLE questions ADD COLUMN error TEXT NOT NULL DEFAULT ''`, Do: sentencesToErrors},
		{Name: "homework/19", SQL: `
ALTER TABLE questions DROP COLUMN reason;
ALTER TABLE questions DROP COLUMN failure`},
	}
}

var (
	oldProblem    = regexp.MustCompile(`problem \d+(?:\.\d+)*[A-Za-z]?`)
	oldPinnedPage = regexp.MustCompile(`It isn't on (.+?) either`)
	oldScope      = regexp.MustCompile(`Looked through (.+?) for `)
	oldPageStatus = regexp.MustCompile(`That page answered (\d+)`)
)

// sentencesToErrors is homework/18: the entries a failed question's kind and
// sentence named, and the same for a failed read's sentence.
func sentencesToErrors(ctx context.Context, tx *sql.Tx) error {
	rows, err := tx.QueryContext(ctx, `SELECT id, failure, reason FROM questions WHERE state = 'failed'`)
	if err != nil {
		return errs.Database.Wrap(err)
	}
	type old struct{ id, failure, reason string }
	var failed []old
	for rows.Next() {
		var o old
		if err := rows.Scan(&o.id, &o.failure, &o.reason); err != nil {
			cleanup.Close(rows)
			return errs.Database.Of(err)
		}
		failed = append(failed, o)
	}
	if err := rows.Err(); err != nil {
		return errs.Database.Wrap(err)
	}
	cleanup.Close(rows)
	for _, o := range failed {
		name := "this question"
		if m := oldProblem.FindString(o.reason); m != "" {
			name = m
		}
		st := errs.Stored{Chain: []string{"homework.question_failed"}, Params: map[string]string{"step": "write the guide for", "name": name}}
		switch r := o.reason; {
		case o.failure == "not_found":
			st.Chain = []string{"homework.not_found_in_book"}
			st.Params["where"] = "the book"
			if m := oldPinnedPage.FindStringSubmatch(r); m != nil {
				st.Params["where"] = m[1]
			} else if m := oldScope.FindStringSubmatch(r); m != nil {
				st.Params["where"] = m[1]
			}
		case strings.Contains(r, "words in the boxes"):
			st.Chain = []string{"homework.boxes_unreadable"}
		case strings.Contains(r, "no OpenRouter key yet"):
			st.Chain = append(st.Chain, "key.missing")
		case strings.Contains(r, "out of credit"):
			st.Chain = append(st.Chain, "key.out_of_credit")
		case strings.Contains(r, "turned the request down"):
			st.Chain = append(st.Chain, "key.refused")
		case o.failure == "unavailable":
			st.Chain = append(st.Chain, "model.busy")
		case strings.Contains(r, "stopped without writing"):
			st.Chain = append(st.Chain, "agent.no_answer")
		case strings.Contains(r, "stopped partway"):
			st.Chain = append(st.Chain, "model.cut")
		case strings.Contains(r, "missing a part"):
			st.Chain = append(st.Chain, "agent.no_answer")
		}
		if _, err := tx.ExecContext(ctx, `UPDATE questions SET error = ? WHERE id = ?`, st.Marshal(), o.id); err != nil {
			return errs.Database.Wrap(err)
		}
	}

	rows, err = tx.QueryContext(ctx, `SELECT id, error FROM assignment_reads WHERE state = 'failed' AND error != ''`)
	if err != nil {
		return errs.Database.Wrap(err)
	}
	var reads [][2]string
	for rows.Next() {
		var id, msg string
		if err := rows.Scan(&id, &msg); err != nil {
			cleanup.Close(rows)
			return errs.Database.Of(err)
		}
		reads = append(reads, [2]string{id, msg})
	}
	if err := rows.Err(); err != nil {
		return errs.Database.Wrap(err)
	}
	cleanup.Close(rows)
	for _, r := range reads {
		st := errs.Stored{Chain: []string{"homework.read_failed"}}
		cause := func(id string) { st.Chain = append(st.Chain, id) }
		switch m := r[1]; {
		case strings.Contains(m, "no OpenRouter key yet"):
			cause("key.missing")
		case strings.Contains(m, "out of credit"):
			cause("key.out_of_credit")
		case strings.Contains(m, "turned the request down"):
			cause("key.refused")
		case strings.Contains(m, "didn't answer while PSet read the assignment"):
			cause("model.busy")
		case strings.Contains(m, "make out the assignment's homework"):
			cause("homework.reply_unreadable")
		case strings.Contains(m, "find any homework"):
			cause("homework.no_homework_found")
		case strings.Contains(m, "PDF couldn't be read"):
			cause("homework.pdf_unreadable")
		case strings.Contains(m, "reach that page"):
			cause("homework.page_unreachable")
		case strings.Contains(m, "That page answered"):
			cause("homework.page_refused")
			status := "an error"
			if sub := oldPageStatus.FindStringSubmatch(m); sub != nil {
				status = sub[1]
			}
			st.Params = map[string]string{"status": status}
		case strings.Contains(m, "read that page"):
			cause("homework.page_unreadable")
		case strings.Contains(m, "no text to read"):
			cause("homework.page_empty")
		}
		if _, err := tx.ExecContext(ctx, `UPDATE assignment_reads SET error = ? WHERE id = ?`, st.Marshal(), r[0]); err != nil {
			return errs.Database.Wrap(err)
		}
	}
	return nil
}

// structuredGuides is homework/12: the guides go, and the text fields that
// were strings become runs.
func structuredGuides(ctx context.Context, tx *sql.Tx) error {
	if _, err := tx.ExecContext(ctx, `UPDATE questions SET
		state = CASE WHEN state = 'ready' THEN 'unwritten' ELSE state END,
		hint = '[]', walkthrough = '[]', revealed = '[]', rounds = '[]',
		memory = coalesce((SELECT json_group_array(json(value)) FROM json_each(memory) WHERE json_extract(value, '$.use') = 'found'), '[]')`); err != nil {
		return errs.Database.Wrap(err)
	}
	rows, err := tx.QueryContext(ctx, `SELECT id, statement, notes, reading FROM questions`)
	if err != nil {
		return errs.Database.Wrap(err)
	}
	type text struct{ id, statement, notes, reading string }
	var all []text
	for rows.Next() {
		var t text
		if err := rows.Scan(&t.id, &t.statement, &t.notes, &t.reading); err != nil {
			cleanup.Close(rows)
			return errs.Database.Of(err)
		}
		all = append(all, t)
	}
	if err := rows.Close(); err != nil {
		return errs.Database.Wrap(err)
	}
	for _, t := range all {
		if _, err := tx.ExecContext(ctx, `UPDATE questions SET statement = ?, notes = ?, reading = ? WHERE id = ?`,
			mustJSON(decodeRuns(t.statement)), mustJSON(decodeRunLists(t.notes)), mustJSON(decodeRunLists(t.reading)), t.id); err != nil {
			return errs.Database.Wrap(err)
		}
	}
	return nil
}

var errNotFound = errors.New("not found")

type queryer interface {
	QueryContext(ctx context.Context, q string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, q string, args ...any) *sql.Row
	ExecContext(ctx context.Context, q string, args ...any) (sql.Result, error)
}

const summaryCols = `h.id, h.book_id, h.title, h.due_date, h.turned_in_at, h.created_at,
	(SELECT count(*) FROM questions q WHERE q.homework_id = h.id),
	(SELECT count(*) FROM questions q WHERE q.homework_id = h.id AND q.done_at != '')`

func scanSummary(s interface{ Scan(...any) error }) (Summary, error) {
	var h Summary
	err := s.Scan(&h.ID, &h.BookID, &h.Title, &h.DueDate, &h.TurnedInAt, &h.CreatedAt, &h.Total, &h.Done)
	if errors.Is(err, sql.ErrNoRows) {
		return h, errNotFound
	}
	return h, err
}

func getSummary(ctx context.Context, q queryer, id string) (Summary, error) {
	return scanSummary(q.QueryRowContext(ctx, `SELECT `+summaryCols+` FROM homework h WHERE h.id = ?`, id))
}

func listSummaries(ctx context.Context, q queryer, where string, args ...any) ([]Summary, error) {
	rows, err := q.QueryContext(ctx, `SELECT `+summaryCols+` FROM homework h `+where, args...)
	if err != nil {
		return nil, err
	}
	defer cleanup.Close(rows)
	out := []Summary{}
	for rows.Next() {
		h, err := scanSummary(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, errs.Database.Of(rows.Err())
}

// row is a question with what the wire doesn't carry.
type row struct {
	Question
	BookID  string
	Pinned  *int
	Rect    *pdf.Rect
	FigRect []figure
}

// figure is a stored figure: its label and where it is on the page.
type figure struct {
	Label string   `json:"label"`
	Rect  pdf.Rect `json:"rect"`
	// Page is the PDF page the figure is on, when it isn't the
	// question's own: a figure boxed on another page.
	Page int `json:"page,omitempty"`
}

// on is the page a figure is on: its own, else the question's.
func (f figure) on(q row) int {
	if f.Page > 0 {
		return f.Page
	}
	if q.Page != nil {
		return *q.Page
	}
	return 0
}

const questionCols = `q.id, q.homework_id, q.position, q.text, q.in_book, q.label, q.statement, q.page, q.pinned_page,
	q.rect, q.figures, q.hint, q.walkthrough, q.state, q.error, q.revealed, q.done_at, q.activity, q.reading, q.reading_edited, q.reading_doubts, q.boxes, q.notes, q.difficulty, q.attempts, q.failed_at, q.updated_at, q.rev, h.book_id`

func scanQuestion(s interface{ Scan(...any) error }) (row, error) {
	var r row
	var page, pinned sql.NullInt64
	var rect, figs, statement, hint, walk, revealed, doneAt, reading, doubts, boxes, notes, failed string
	err := s.Scan(&r.ID, &r.HomeworkID, &r.Position, &r.Text, &r.InBook, &r.Label, &statement, &page, &pinned,
		&rect, &figs, &hint, &walk, &r.State, &failed, &revealed, &doneAt, &r.Activity, &reading, &r.ReadingEdited, &doubts, &boxes, &notes, &r.Difficulty, &r.Attempts, &r.FailedAt, &r.UpdatedAt, &r.Rev, &r.BookID)
	if errors.Is(err, sql.ErrNoRows) {
		return r, errNotFound
	}
	if err != nil {
		return r, err
	}
	if page.Valid {
		n := int(page.Int64)
		r.Page = &n
	}
	if pinned.Valid {
		n := int(pinned.Int64)
		r.Pinned = &n
	}
	if v, ok := errs.ParseStored(failed); ok {
		r.Error = &v
	}
	decodeColumn("rect", rect, &r.Rect)
	decodeColumn("figs", figs, &r.FigRect)
	r.Figures = make([]Figure, len(r.FigRect))
	for i, f := range r.FigRect {
		r.Figures[i] = Figure{Label: f.Label}
	}
	r.Statement = decodeRuns(statement)
	r.Hint, r.Walkthrough, r.Revealed = []doc.Block{}, []doc.Block{}, []string{}
	decodeColumn("hint", hint, &r.Hint)
	decodeColumn("walk", walk, &r.Walkthrough)
	decodeColumn("revealed", revealed, &r.Revealed)
	r.Reading = decodeRunLists(reading)
	r.ReadingDoubts = decodeRunLists(doubts)
	r.Boxes = []Box{}
	decodeColumn("boxes", boxes, &r.Boxes)
	r.Notes = decodeRunLists(notes)
	r.Done = doneAt != ""
	// When it failed only means something while it is failed.
	if r.State != StateFailed {
		r.FailedAt = ""
	}
	return r, nil
}

func getQuestion(ctx context.Context, q queryer, id string) (row, error) {
	return scanQuestion(q.QueryRowContext(ctx, `SELECT `+questionCols+`
		FROM questions q JOIN homework h ON h.id = q.homework_id WHERE q.id = ?`, id))
}

func listQuestions(ctx context.Context, q queryer, homeworkID string) ([]Question, error) {
	rows, err := q.QueryContext(ctx, `SELECT `+questionCols+`
		FROM questions q JOIN homework h ON h.id = q.homework_id WHERE q.homework_id = ? ORDER BY q.position`, homeworkID)
	if err != nil {
		return nil, err
	}
	defer cleanup.Close(rows)
	out := []Question{}
	for rows.Next() {
		r, err := scanQuestion(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r.Question)
	}
	return out, errs.Database.Of(rows.Err())
}

// savedRounds is a question's saved guide conversation: every message
// after the opening one, which is rebuilt each run.
func savedRounds(ctx context.Context, q queryer, id string) ([]llm.Message, error) {
	var raw string
	if err := q.QueryRowContext(ctx, `SELECT rounds FROM questions WHERE id = ?`, id).Scan(&raw); err != nil {
		return nil, errs.Database.Wrap(err)
	}
	var msgs []llm.Message
	if err := json.Unmarshal([]byte(raw), &msgs); err != nil {
		// Unreadable progress is no progress: start the guide over.
		return nil, nil
	}
	return msgs, nil
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

// renumber closes the gaps a removal leaves, keeping order.
func renumber(ctx context.Context, q queryer, homeworkID string) error {
	_, err := q.ExecContext(ctx, `UPDATE questions SET position = (
		SELECT count(*) FROM questions o WHERE o.homework_id = questions.homework_id
		AND (o.position < questions.position OR (o.position = questions.position AND o.created_at < questions.created_at))
	) + 1 WHERE homework_id = ?`, homeworkID)
	return err
}

// Text as runs, and back. A statement, a professor's note and a line of a
// figure's reading are stored as runs, split once when they are written;
// what the model reads, and what the student edits, is the source form,
// with math in \(..\).

// runsOf is a string as stored runs: split, with math KaTeX can't parse
// marked raw.
func runsOf(s string) []doc.Run {
	runs := doc.Text(strings.TrimSpace(s), pagenum.Map{})
	if runs == nil {
		runs = []doc.Run{}
	}
	return runs
}

// runLists is lines as a list of runs, a line each.
func runLists(lines []string) [][]doc.Run {
	out := make([][]doc.Run, len(lines))
	for i, l := range lines {
		out[i] = runsOf(l)
	}
	return out
}

// sources is a list of runs as its lines of source.
func sources(list [][]doc.Run) []string {
	out := make([]string, len(list))
	for i, runs := range list {
		out[i] = doc.Source(runs, pagenum.Map{})
	}
	return out
}

func source(runs []doc.Run) string { return doc.Source(runs, pagenum.Map{}) }

// decodeRuns reads stored runs. Text that isn't a list of runs (a row
// written before statements were runs) is split as it stands.
func decodeRuns(s string) []doc.Run {
	var runs []doc.Run
	if strings.HasPrefix(s, "[") && json.Unmarshal([]byte(s), &runs) == nil {
		return runs
	}
	if t := strings.TrimSpace(s); t == "" || t == "null" {
		return []doc.Run{}
	}
	return runsOf(s)
}

func decodeRunLists(s string) [][]doc.Run {
	var list [][]doc.Run
	if json.Unmarshal([]byte(s), &list) == nil && list != nil {
		return list
	}
	// A list of plain lines, as they were stored before runs.
	var lines []string
	if json.Unmarshal([]byte(s), &lines) == nil {
		return runLists(lines)
	}
	return [][]doc.Run{}
}

// decodeColumn reads a JSON column into dst. An empty one leaves dst as it
// is; a malformed one is logged, and dst keeps what decoded.
func decodeColumn(name, col string, dst any) {
	if col == "" {
		return
	}
	cleanup.Log("homework: read the "+name+" column", json.Unmarshal([]byte(col), dst))
}
