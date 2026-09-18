package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// Homework (assignment) statuses: an assignment is generating from the
// moment it is created until its job reaches a terminal state.
const (
	HomeworkGenerating = "generating"
	HomeworkReady      = "ready"
)

// Question statuses along the extract → locate → guide pipeline.
const (
	QuestionPending  = "pending"
	QuestionLocating = "locating"
	QuestionWriting  = "writing"
	QuestionReady    = "ready"
	QuestionFailed   = "failed"
	// QuestionStale marks a walkthrough that no longer matches its question:
	// the text was edited, or the location moved. The card says so and
	// offers a rewrite rather than silently spending a model call.
	QuestionStale = "stale"
)

// HomeworkRect is a region of a rendered page image, normalized to the page:
// x and w are fractions of the page width, y and h of the page height, with
// y measured from the top.
type HomeworkRect struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	W float64 `json:"w"`
	H float64 `json:"h"`
}

// Valid reports whether the rect lies inside the page with positive size.
func (r HomeworkRect) Valid() bool {
	const eps = 1e-6
	return r.W > eps && r.H > eps &&
		r.X >= -eps && r.Y >= -eps &&
		r.X+r.W <= 1+eps && r.Y+r.H <= 1+eps
}

// HomeworkDiagram is one cropped figure a question refers to.
type HomeworkDiagram struct {
	Label string       `json:"label"`
	Rect  HomeworkRect `json:"rect"`
}

// HomeworkEquation is one display equation inside a guide.
type HomeworkEquation struct {
	Title string `json:"title"`
	Tex   string `json:"tex"`
	Note  string `json:"note,omitempty"`
}

// HomeworkReading is how the model read the problem before solving it: the
// quantities it took as given, what it believes is being asked, and how it
// read the figure. It is shown to the student ungated — a wrong reading is
// the failure that makes a whole walkthrough wrong, and it is the fastest
// thing to check.
type HomeworkReading struct {
	Given  []string `json:"given"`
	Find   string   `json:"find"`
	Figure string   `json:"figure,omitempty"`
}

// HomeworkGuide is the walkthrough content of one question. The engine
// validates it against an embedded schema before storing; text fields may
// carry [p. N] citations. Reading is nil on guides written before it
// existed.
type HomeworkGuide struct {
	Reading   *HomeworkReading   `json:"reading,omitempty"`
	Setup     string             `json:"setup"`
	Hints     []string           `json:"hints"`
	Steps     []string           `json:"steps"`
	Equations []HomeworkEquation `json:"equations"`
	Answer    string             `json:"answer"`
}

// Homework is one assignment: a book, pasted source text, and the question
// outline generated from it. QuestionCount is only filled by the list and
// by-ID reads.
type Homework struct {
	ID            string
	BookID        string
	Title         string
	DueDate       *string // YYYY-MM-DD or nil
	Status        string
	TurnedIn      bool
	SourceText    string
	QuestionCount int
	// Printed-sheet sizes in percent of the template's designed layout.
	QuestionScale int
	FigureScale   int
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// HomeworkRef is a homework joined with its book's identity — the dashboard
// row.
type HomeworkRef struct {
	Homework
	BookSHA256 string
	BookTitle  string
}

// UnderstandingNote is one durable correction the chat pinned on a
// question ("the 2A source points up"). Notes feed walkthrough rewrites and
// never print on the sheet.
type UnderstandingNote struct {
	Note string    `json:"note"`
	At   time.Time `json:"at"`
}

// HomeworkQuestion is one question of the outline: pinned to a page and a
// region rect (the printed screenshot), with its transcription (LLM context
// only, never printed), its validated guide, and the understanding notes
// the chat has pinned on it.
type HomeworkQuestion struct {
	ID                 string
	HomeworkID         string
	Position           int // 1-based, dense after every mutation
	Page               *int
	Status             string
	Error              string
	Standalone         bool // self-contained: the book is not consulted, no page is pinned
	QuestionRect       *HomeworkRect
	Transcription      string
	Diagrams           []HomeworkDiagram
	UnderstandingNotes []UnderstandingNote
	Guide              *HomeworkGuide
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

// CreateHomework inserts h as generating, setting its ID and timestamps.
func (s *Store) CreateHomework(ctx context.Context, h *Homework) error {
	h.ID = newID()
	if h.Status == "" {
		h.Status = HomeworkGenerating
	}
	now := time.Now().UTC()
	h.CreatedAt = now
	h.UpdatedAt = now
	due := nullableDateString(h.DueDate)
	if _, err := s.db.ExecContext(ctx, `INSERT INTO homeworks
		(id, book_id, title, due_date, status, turned_in, source_text, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		h.ID, h.BookID, h.Title, due, h.Status, h.TurnedIn, h.SourceText, formatTime(now), formatTime(now)); err != nil {
		return fmt.Errorf("create homework: %w", err)
	}
	return nil
}

const homeworkCount = `(SELECT COUNT(*) FROM homework_questions q WHERE q.homework_id = h.id)`

func scanHomework(scan func(dest ...any) error) (*Homework, error) {
	var h Homework
	var due, createdAt, updatedAt sql.NullString
	if err := scan(&h.ID, &h.BookID, &h.Title, &due, &h.Status, &h.TurnedIn,
		&h.SourceText, &h.QuestionCount, &h.QuestionScale, &h.FigureScale,
		&createdAt, &updatedAt); err != nil {
		return nil, err
	}
	if due.Valid {
		v := due.String
		h.DueDate = &v
	}
	var err error
	if h.CreatedAt, err = parseTime(createdAt.String); err != nil {
		return nil, fmt.Errorf("parse homework created_at: %w", err)
	}
	if h.UpdatedAt, err = parseTime(updatedAt.String); err != nil {
		return nil, fmt.Errorf("parse homework updated_at: %w", err)
	}
	return &h, nil
}

const homeworkColumns = `h.id, h.book_id, h.title, h.due_date, h.status, h.turned_in,
	h.source_text, ` + homeworkCount + `, h.question_scale, h.figure_scale, h.created_at, h.updated_at`

// Homeworks lists every assignment with its book identity and question
// count, most recently updated first.
func (s *Store) Homeworks(ctx context.Context) ([]HomeworkRef, error) {
	rows, err := s.ro().QueryContext(ctx, `SELECT `+homeworkColumns+`,
			b.sha256, b.title
		FROM homeworks h JOIN books b ON b.id = h.book_id
		ORDER BY h.updated_at DESC, h.id DESC`)
	if err != nil {
		return nil, fmt.Errorf("list homeworks: %w", err)
	}
	defer rows.Close()

	var out []HomeworkRef
	for rows.Next() {
		var r HomeworkRef
		var createdAt, updatedAt string
		var due sql.NullString
		if err := rows.Scan(&r.ID, &r.BookID, &r.Title, &due, &r.Status, &r.TurnedIn,
			&r.SourceText, &r.QuestionCount, &r.QuestionScale, &r.FigureScale,
			&createdAt, &updatedAt,
			&r.BookSHA256, &r.BookTitle); err != nil {
			return nil, fmt.Errorf("list homeworks: %w", err)
		}
		if due.Valid {
			v := due.String
			r.DueDate = &v
		}
		if r.CreatedAt, err = parseTime(createdAt); err != nil {
			return nil, fmt.Errorf("list homeworks: %w", err)
		}
		if r.UpdatedAt, err = parseTime(updatedAt); err != nil {
			return nil, fmt.Errorf("list homeworks: %w", err)
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// HomeworkByID returns one assignment; ErrNotFound when absent.
func (s *Store) HomeworkByID(ctx context.Context, id string) (*Homework, error) {
	row := s.ro().QueryRowContext(ctx,
		`SELECT `+homeworkColumns+` FROM homeworks h WHERE h.id = ?`, id)
	h, err := scanHomework(row.Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("homework %s: %w", id, err)
	}
	return h, nil
}

// HomeworkRefByID resolves one assignment with its book identity; ErrNotFound
// when absent.
func (s *Store) HomeworkRefByID(ctx context.Context, id string) (*HomeworkRef, error) {
	row := s.ro().QueryRowContext(ctx, `SELECT `+homeworkColumns+`,
			b.sha256, b.title
		FROM homeworks h JOIN books b ON b.id = h.book_id WHERE h.id = ?`, id)
	var r HomeworkRef
	var due, createdAt, updatedAt sql.NullString
	err := row.Scan(&r.ID, &r.BookID, &r.Title, &due, &r.Status, &r.TurnedIn,
		&r.SourceText, &r.QuestionCount, &r.QuestionScale, &r.FigureScale,
		&createdAt, &updatedAt,
		&r.BookSHA256, &r.BookTitle)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("homework %s: %w", id, err)
	}
	if due.Valid {
		v := due.String
		r.DueDate = &v
	}
	if r.CreatedAt, err = parseTime(createdAt.String); err != nil {
		return nil, fmt.Errorf("homework %s: %w", id, err)
	}
	if r.UpdatedAt, err = parseTime(updatedAt.String); err != nil {
		return nil, fmt.Errorf("homework %s: %w", id, err)
	}
	return &r, nil
}

// UpdateHomework patches the mutable fields; nil pointers and false flags
// keep their column. An empty dueDate string clears it. The fresh row comes
// back; ErrNotFound when absent. updated_at moves: these are content edits.
func (s *Store) UpdateHomework(ctx context.Context, id string, title, dueDate *string, turnedIn *bool, questionScale, figureScale *int) (*Homework, error) {
	var sets []string
	var args []any
	if title != nil {
		sets = append(sets, "title = ?")
		args = append(args, *title)
	}
	if dueDate != nil {
		sets = append(sets, "due_date = ?")
		args = append(args, nullableDateString(dueDate))
	}
	if turnedIn != nil {
		sets = append(sets, "turned_in = ?")
		args = append(args, *turnedIn)
	}
	if questionScale != nil {
		sets = append(sets, "question_scale = ?")
		args = append(args, *questionScale)
	}
	if figureScale != nil {
		sets = append(sets, "figure_scale = ?")
		args = append(args, *figureScale)
	}
	if len(sets) > 0 {
		sets = append(sets, "updated_at = ?")
		args = append(args, formatTime(time.Now().UTC()))
		args = append(args, id)
		if _, err := s.db.ExecContext(ctx,
			"UPDATE homeworks SET "+joinComma(sets)+" WHERE id = ?", args...); err != nil {
			return nil, fmt.Errorf("update homework %s: %w", id, err)
		}
	}
	return s.HomeworkByID(ctx, id)
}

// TouchHomework bumps updated_at without changing anything else.
func (s *Store) TouchHomework(ctx context.Context, id string) error {
	if _, err := s.db.ExecContext(ctx,
		`UPDATE homeworks SET updated_at = ? WHERE id = ?`,
		formatTime(time.Now().UTC()), id); err != nil {
		return fmt.Errorf("touch homework %s: %w", id, err)
	}
	return nil
}

// SetHomeworkStatus moves an assignment between generating and ready.
func (s *Store) SetHomeworkStatus(ctx context.Context, id, status string) error {
	if _, err := s.db.ExecContext(ctx,
		`UPDATE homeworks SET status = ?, updated_at = ? WHERE id = ?`,
		status, formatTime(time.Now().UTC()), id); err != nil {
		return fmt.Errorf("set homework %s status: %w", id, err)
	}
	return nil
}

// DeleteHomework removes an assignment; its questions go with it via
// cascade. ErrNotFound when absent.
func (s *Store) DeleteHomework(ctx context.Context, id string) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM homeworks WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete homework %s: %w", id, err)
	}
	if n, err := res.RowsAffected(); err == nil && n == 0 {
		return ErrNotFound
	}
	return nil
}

// --- questions -----------------------------------------------------------------

const questionColumns = `id, homework_id, position, page, status, error,
	standalone, question_rect, transcription, diagrams, understanding_notes, guide, created_at, updated_at`

func scanQuestion(scan func(dest ...any) error) (*HomeworkQuestion, error) {
	var q HomeworkQuestion
	var page sql.NullInt64
	var errMsg, rect, guide, createdAt, updatedAt sql.NullString
	var diagrams, notes string
	if err := scan(&q.ID, &q.HomeworkID, &q.Position, &page, &q.Status, &errMsg,
		&q.Standalone, &rect, &q.Transcription, &diagrams, &notes, &guide, &createdAt, &updatedAt); err != nil {
		return nil, err
	}
	if page.Valid {
		n := int(page.Int64)
		q.Page = &n
	}
	q.Error = errMsg.String
	if rect.Valid {
		q.QuestionRect = &HomeworkRect{}
		if err := json.Unmarshal([]byte(rect.String), q.QuestionRect); err != nil {
			return nil, fmt.Errorf("decode question rect: %w", err)
		}
	}
	if err := json.Unmarshal([]byte(diagrams), &q.Diagrams); err != nil {
		return nil, fmt.Errorf("decode question diagrams: %w", err)
	}
	if q.Diagrams == nil {
		q.Diagrams = []HomeworkDiagram{}
	}
	if err := json.Unmarshal([]byte(notes), &q.UnderstandingNotes); err != nil {
		return nil, fmt.Errorf("decode understanding notes: %w", err)
	}
	if q.UnderstandingNotes == nil {
		q.UnderstandingNotes = []UnderstandingNote{}
	}
	if guide.Valid {
		q.Guide = &HomeworkGuide{}
		if err := json.Unmarshal([]byte(guide.String), q.Guide); err != nil {
			return nil, fmt.Errorf("decode question guide: %w", err)
		}
	}
	var err error
	if q.CreatedAt, err = parseTime(createdAt.String); err != nil {
		return nil, fmt.Errorf("parse question created_at: %w", err)
	}
	if q.UpdatedAt, err = parseTime(updatedAt.String); err != nil {
		return nil, fmt.Errorf("parse question updated_at: %w", err)
	}
	return &q, nil
}

// InsertQuestion appends q to its homework's outline; a zero Position lands
// at the end. Sets ID and timestamps.
func (s *Store) InsertQuestion(ctx context.Context, q *HomeworkQuestion) error {
	if q.Position <= 0 {
		if err := s.ro().QueryRowContext(ctx,
			`SELECT COALESCE(MAX(position), 0) + 1 FROM homework_questions WHERE homework_id = ?`,
			q.HomeworkID).Scan(&q.Position); err != nil {
			return fmt.Errorf("next question position: %w", err)
		}
	}
	q.ID = newID()
	now := time.Now().UTC()
	q.CreatedAt = now
	q.UpdatedAt = now
	rect, diagrams, notes, guide, err := marshalQuestionJSON(q)
	if err != nil {
		return err
	}
	if _, err := s.db.ExecContext(ctx, `INSERT INTO homework_questions
		(id, homework_id, position, page, status, error, standalone, question_rect, transcription, diagrams, understanding_notes, guide, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		q.ID, q.HomeworkID, q.Position, nullableInt(q.Page), q.Status, nullableString(q.Error),
		q.Standalone, rect, q.Transcription, diagrams, notes, guide, formatTime(now), formatTime(now)); err != nil {
		return fmt.Errorf("insert question: %w", err)
	}
	if err := s.TouchHomework(ctx, q.HomeworkID); err != nil {
		return err
	}
	return nil
}

// Questions returns a homework's outline in order.
func (s *Store) Questions(ctx context.Context, homeworkID string) ([]HomeworkQuestion, error) {
	rows, err := s.ro().QueryContext(ctx,
		`SELECT `+questionColumns+` FROM homework_questions WHERE homework_id = ? ORDER BY position`,
		homeworkID)
	if err != nil {
		return nil, fmt.Errorf("list questions of homework %s: %w", homeworkID, err)
	}
	defer rows.Close()

	out := []HomeworkQuestion{}
	for rows.Next() {
		q, err := scanQuestion(rows.Scan)
		if err != nil {
			return nil, fmt.Errorf("list questions of homework %s: %w", homeworkID, err)
		}
		out = append(out, *q)
	}
	return out, rows.Err()
}

// QuestionByID returns one question; ErrNotFound when absent.
func (s *Store) QuestionByID(ctx context.Context, id string) (*HomeworkQuestion, error) {
	row := s.ro().QueryRowContext(ctx,
		`SELECT `+questionColumns+` FROM homework_questions WHERE id = ?`, id)
	q, err := scanQuestion(row.Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("question %s: %w", id, err)
	}
	return q, nil
}

// UpdateQuestionContent persists everything a pipeline step produces: page,
// rects, transcription, diagrams, notes, guide, status, and error.
// updated_at moves.
func (s *Store) UpdateQuestionContent(ctx context.Context, q *HomeworkQuestion) error {
	q.UpdatedAt = time.Now().UTC()
	rect, diagrams, notes, guide, err := marshalQuestionJSON(q)
	if err != nil {
		return err
	}
	if _, err := s.db.ExecContext(ctx, `UPDATE homework_questions SET
		page = ?, status = ?, error = ?, standalone = ?, question_rect = ?, transcription = ?,
		diagrams = ?, understanding_notes = ?, guide = ?, updated_at = ? WHERE id = ?`,
		nullableInt(q.Page), q.Status, nullableString(q.Error), q.Standalone, rect, q.Transcription,
		diagrams, notes, guide, formatTime(q.UpdatedAt), q.ID); err != nil {
		return fmt.Errorf("update question %s: %w", q.ID, err)
	}
	return s.TouchHomework(ctx, q.HomeworkID)
}

// DeleteQuestion removes one question and densifies the remaining positions,
// returning the removed row; ErrNotFound when absent.
func (s *Store) DeleteQuestion(ctx context.Context, id string) (*HomeworkQuestion, error) {
	q, err := s.QuestionByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := s.deleteQuestion(ctx, id, q.HomeworkID); err != nil {
		return nil, err
	}
	if err := s.TouchHomework(ctx, q.HomeworkID); err != nil {
		return nil, err
	}
	return q, nil
}

// deleteQuestion does the deletion inside a caller-owned transaction.
func (s *Store) deleteQuestion(ctx context.Context, id, homeworkID string) error {
	if _, err := s.db.ExecContext(ctx, `DELETE FROM homework_questions WHERE id = ?`, id); err != nil {
		return fmt.Errorf("delete question %s: %w", id, err)
	}
	return s.densifyPositions(ctx, homeworkID)
}

// MoveQuestion reorders one question to position (1-based, clamped); the
// other positions shift to stay dense.
func (s *Store) MoveQuestion(ctx context.Context, homeworkID, questionID string, position int) error {
	if err := s.moveQuestion(ctx, homeworkID, questionID, position); err != nil {
		return err
	}
	return s.TouchHomework(ctx, homeworkID)
}

// moveQuestion does the reorder inside a caller-owned transaction.
func (s *Store) moveQuestion(ctx context.Context, homeworkID, questionID string, position int) error {
	questions, err := s.Questions(ctx, homeworkID)
	if err != nil {
		return err
	}
	from := -1
	for i := range questions {
		if questions[i].ID == questionID {
			from = i
			break
		}
	}
	if from == -1 {
		return ErrNotFound
	}
	if position < 1 {
		position = 1
	}
	if position > len(questions) {
		position = len(questions)
	}
	q := questions[from]
	rest := append(questions[:from], questions[from+1:]...)
	at := position - 1 // 1-based target → 0-based insertion index
	rest = append(rest[:at], append([]HomeworkQuestion{q}, rest[at:]...)...)
	return s.applyPositions(ctx, rest)
}

// applyPositions writes a full ordering; positions are 1-based and dense.
// Two-phase: every row steps aside to a negative slot first, so reordering
// never trips the (homework_id, position) uniqueness.
func (s *Store) applyPositions(ctx context.Context, questions []HomeworkQuestion) error {
	for i := range questions {
		if _, err := s.db.ExecContext(ctx,
			`UPDATE homework_questions SET position = -? WHERE id = ?`,
			i+1, questions[i].ID); err != nil {
			return fmt.Errorf("stage question %s: %w", questions[i].ID, err)
		}
	}
	for i := range questions {
		if _, err := s.db.ExecContext(ctx,
			`UPDATE homework_questions SET position = ? WHERE id = ?`,
			i+1, questions[i].ID); err != nil {
			return fmt.Errorf("reposition question %s: %w", questions[i].ID, err)
		}
	}
	return nil
}

// densifyPositions renumbers 1..n in the stored order.
func (s *Store) densifyPositions(ctx context.Context, homeworkID string) error {
	rows, err := s.ro().QueryContext(ctx,
		`SELECT id FROM homework_questions WHERE homework_id = ? ORDER BY position`, homeworkID)
	if err != nil {
		return fmt.Errorf("read positions of homework %s: %w", homeworkID, err)
	}
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		ids = append(ids, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	out := make([]HomeworkQuestion, len(ids))
	for i, id := range ids {
		out[i] = HomeworkQuestion{ID: id}
	}
	return s.applyPositions(ctx, out)
}

// InTx runs fn inside one transaction; an error rolls everything back. The
// callback receives a transactional view of the store.
func (s *Store) InTx(ctx context.Context, fn func(tx *Store) error) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()
	inner := &Store{db: txView{tx}, path: s.path}
	if err := fn(inner); err != nil {
		return err
	}
	return tx.Commit()
}

// txView adapts *sql.Tx to the dbtx interface (a tx cannot nest).
type txView struct{ tx *sql.Tx }

func (v txView) Exec(q string, args ...any) (sql.Result, error) {
	return v.tx.Exec(q, args...)
}
func (v txView) ExecContext(ctx context.Context, q string, args ...any) (sql.Result, error) {
	return v.tx.ExecContext(ctx, q, args...)
}
func (v txView) QueryContext(ctx context.Context, q string, args ...any) (*sql.Rows, error) {
	return v.tx.QueryContext(ctx, q, args...)
}
func (v txView) QueryRowContext(ctx context.Context, q string, args ...any) *sql.Row {
	return v.tx.QueryRowContext(ctx, q, args...)
}
func (v txView) BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error) {
	return nil, errors.New("transactions cannot nest")
}

// --- json helpers ----------------------------------------------------------------

func marshalQuestionJSON(q *HomeworkQuestion) (rect, diagrams, notes, guide any, err error) {
	if q.QuestionRect != nil {
		data, merr := json.Marshal(q.QuestionRect)
		if merr != nil {
			return nil, nil, nil, nil, fmt.Errorf("encode question rect: %w", merr)
		}
		rect = string(data)
	}
	if q.Diagrams == nil {
		q.Diagrams = []HomeworkDiagram{}
	}
	data, merr := json.Marshal(q.Diagrams)
	if merr != nil {
		return nil, nil, nil, nil, fmt.Errorf("encode question diagrams: %w", merr)
	}
	diagrams = string(data)
	if q.UnderstandingNotes == nil {
		q.UnderstandingNotes = []UnderstandingNote{}
	}
	ndata, nerr := json.Marshal(q.UnderstandingNotes)
	if nerr != nil {
		return nil, nil, nil, nil, fmt.Errorf("encode understanding notes: %w", nerr)
	}
	notes = string(ndata)
	if q.Guide != nil {
		gdata, gerr := json.Marshal(q.Guide)
		if gerr != nil {
			return nil, nil, nil, nil, fmt.Errorf("encode question guide: %w", gerr)
		}
		guide = string(gdata)
	}
	return rect, diagrams, notes, guide, nil
}

func nullableInt(n *int) any {
	if n == nil {
		return nil
	}
	return *n
}

func nullableString(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func nullableDateString(s *string) any {
	if s == nil || *s == "" {
		return nil
	}
	return *s
}

func joinComma(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += ", "
		}
		out += p
	}
	return out
}
