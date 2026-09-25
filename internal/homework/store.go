package homework

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/jackt/pset/internal/cards"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/pdf"
)

// Migrations: sets hang off books, questions off sets, and both cascade,
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
	}
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
	defer rows.Close()
	out := []Summary{}
	for rows.Next() {
		h, err := scanSummary(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
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
	q.rect, q.figures, q.hint, q.walkthrough, q.state, q.reason, q.revealed, q.done_at, q.activity, q.memory, q.failure, q.reading, q.reading_edited, q.boxes, q.notes, q.updated_at, q.rev, h.book_id`

func scanQuestion(s interface{ Scan(...any) error }) (row, error) {
	var r row
	var page, pinned sql.NullInt64
	var rect, figs, hint, walk, revealed, doneAt, memory, reading, boxes, notes string
	err := s.Scan(&r.ID, &r.HomeworkID, &r.Position, &r.Text, &r.InBook, &r.Label, &r.Statement, &page, &pinned,
		&rect, &figs, &hint, &walk, &r.State, &r.Reason, &revealed, &doneAt, &r.Activity, &memory, &r.Failure, &reading, &r.ReadingEdited, &boxes, &notes, &r.UpdatedAt, &r.Rev, &r.BookID)
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
	json.Unmarshal([]byte(rect), &r.Rect)
	json.Unmarshal([]byte(figs), &r.FigRect)
	r.Figures = make([]Figure, len(r.FigRect))
	for i, f := range r.FigRect {
		r.Figures[i] = Figure{Label: f.Label}
	}
	r.Hint, r.Walkthrough, r.Revealed = []cards.Segment{}, []cards.Segment{}, []string{}
	json.Unmarshal([]byte(hint), &r.Hint)
	json.Unmarshal([]byte(walk), &r.Walkthrough)
	json.Unmarshal([]byte(revealed), &r.Revealed)
	r.Memory = []MemoryLine{}
	json.Unmarshal([]byte(memory), &r.Memory)
	r.Reading = []string{}
	json.Unmarshal([]byte(reading), &r.Reading)
	r.Boxes = []Box{}
	json.Unmarshal([]byte(boxes), &r.Boxes)
	r.Notes = []string{}
	json.Unmarshal([]byte(notes), &r.Notes)
	r.Done = doneAt != ""
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
	defer rows.Close()
	out := []Question{}
	for rows.Next() {
		r, err := scanQuestion(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r.Question)
	}
	return out, rows.Err()
}

// savedRounds is a question's saved guide conversation: every message
// after the opening one, which is rebuilt each run.
func savedRounds(ctx context.Context, q queryer, id string) ([]llm.Message, error) {
	var raw string
	if err := q.QueryRowContext(ctx, `SELECT rounds FROM questions WHERE id = ?`, id).Scan(&raw); err != nil {
		return nil, err
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
