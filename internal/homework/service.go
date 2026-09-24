// Package homework is problem sets: a set belongs to a book, its questions
// are located in the book (or not, for one that isn't in it) and given a
// hint and a walkthrough. Spec: design/workspace.md, "Homework".
package homework

import (
	"context"
	"database/sql"
	"errors"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/jackt/pset/internal/agent"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/events"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/llm"
)

// Book is what homework needs to know about a book.
type Book struct {
	ID         string
	Title      string
	PageCount  int
	PageOffset int
}

// Library is what homework reads from books. Page numbers are PDF pages.
type Library interface {
	Book(ctx context.Context, id string) (Book, error)
	Search(ctx context.Context, bookID, query string, k int) ([]int, error)
	PageText(ctx context.Context, bookID string, page int) (string, error)
	PageTexts(ctx context.Context, bookID string) ([]string, error)
	PageJPEG(ctx context.Context, bookID string, page, width int) ([]byte, error)
	ChapterSpan(ctx context.Context, bookID string, chapter int) (start, end int, ok bool, err error)
}

// Settings is the model connection and who's studying.
type Settings interface {
	LLM(ctx context.Context) (llm.Config, error)
	Name(ctx context.Context) string
}

// Memory is the book's memory: the walkthrough writer's notes, and where
// locate has found each chapter's problems. Pages are PDF pages.
type Memory interface {
	agent.Memory
	ProblemsSeen(ctx context.Context, bookID string, chapter int) (Problems, error)
	SawProblem(ctx context.Context, bookID string, offset, chapter int, label string, page int) error
}

// Problems is where a chapter's problems have been found, and the memory
// that says so.
type Problems struct {
	MemoryID string
	Text     string
	Seen     []Seen
}

// Seen is one problem found: its label and page.
type Seen struct {
	Label string
	Page  int
}

type Queue interface {
	Enqueue(ctx context.Context, ex jobs.Execer, s jobs.Spec) (string, error)
	// Wake starts what was enqueued, once its transaction has committed.
	Wake()
	StopSubject(ctx context.Context, subject string) error
	Handle(kind, lane string, h jobs.Handler)
}

type Config struct {
	DB       *sql.DB
	Events   events.Publisher
	Queue    Queue
	Library  Library
	Settings Settings
	// Memory is the book's memory; nil runs without one.
	Memory Memory
}

type Service struct{ c Config }

// A question is two jobs, one per step: finding it in the book, then
// writing its guide. Both share one lane (two at a time), and a queued
// find always starts before a queued guide, so a set's questions are
// found first and its worksheet is whole early.
const (
	JobLocate    = "locate"
	JobGuide     = "guide"
	LaneQuestion = "question"
)

// locateFirst is a find's priority in the lane: ahead of every queued
// guide, even ones queued before the question was added.
const locateFirst = 1

func New(c Config) *Service {
	s := &Service{c}
	c.Queue.Handle(JobLocate, LaneQuestion, s.runLocate)
	c.Queue.Handle(JobGuide, LaneQuestion, s.runGuide)
	return s
}

// Caps: enough for any real assignment, small enough that a paste of a
// whole chapter is caught.
const (
	maxTitle     = 200
	maxDrafts    = 40
	maxDraftText = 4000
)

// ---------------------------------------------------------------- sets

// ForBook lists a book's sets, newest first.
func (s *Service) ForBook(ctx context.Context, bookID string) ([]Summary, error) {
	if _, err := s.c.Library.Book(ctx, bookID); err != nil {
		return nil, err
	}
	return listSummaries(ctx, s.c.DB, `WHERE h.book_id = ? ORDER BY h.created_at DESC`, bookID)
}

// Due lists every set not yet turned in, across books: dated ones by date,
// then the undated, newest first.
func (s *Service) Due(ctx context.Context) ([]Summary, error) {
	return listSummaries(ctx, s.c.DB, `WHERE h.turned_in_at = ''
		ORDER BY h.due_date = '', h.due_date, h.created_at DESC`)
}

func (s *Service) Create(ctx context.Context, bookID string, in Input) (Summary, error) {
	if _, err := s.c.Library.Book(ctx, bookID); err != nil {
		return Summary{}, err
	}
	title, err := cleanTitle(in.Title)
	if err != nil {
		return Summary{}, err
	}
	due, err := cleanDate(in.DueDate)
	if err != nil {
		return Summary{}, err
	}
	id := uuid.NewString()
	now := db.Now()
	if _, err := s.c.DB.ExecContext(ctx, `INSERT INTO homework (id, book_id, title, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
		id, bookID, title, due, now, now); err != nil {
		return Summary{}, err
	}
	return s.publishSet(ctx, id)
}

func cleanTitle(t string) (string, error) {
	t = strings.Join(strings.Fields(t), " ")
	if t == "" {
		return "", httpx.Invalid("title", "Give it a title.")
	}
	if len([]rune(t)) > maxTitle {
		return "", httpx.Invalid("title", "Keep the title under %d characters.", maxTitle)
	}
	return t, nil
}

func cleanDate(d string) (string, error) {
	d = strings.TrimSpace(d)
	if d == "" {
		return "", nil
	}
	if _, err := time.Parse("2006-01-02", d); err != nil {
		return "", httpx.Invalid("dueDate", "That isn't a date.")
	}
	return d, nil
}

func (s *Service) Get(ctx context.Context, id string) (Detail, error) {
	h, err := getSummary(ctx, s.c.DB, id)
	if errors.Is(err, errNotFound) {
		return Detail{}, httpx.NotFound("homework set")
	}
	if err != nil {
		return Detail{}, err
	}
	qs, err := listQuestions(ctx, s.c.DB, id)
	return Detail{Homework: h, Questions: qs}, err
}

func (s *Service) Update(ctx context.Context, id string, p Patch) (Summary, error) {
	h, err := getSummary(ctx, s.c.DB, id)
	if errors.Is(err, errNotFound) {
		return Summary{}, httpx.NotFound("homework set")
	}
	if err != nil {
		return Summary{}, err
	}
	if p.Title != nil {
		if h.Title, err = cleanTitle(*p.Title); err != nil {
			return Summary{}, err
		}
	}
	if p.DueDate != nil {
		if h.DueDate, err = cleanDate(*p.DueDate); err != nil {
			return Summary{}, err
		}
	}
	if p.TurnedIn != nil {
		switch {
		case *p.TurnedIn && h.TurnedInAt == "":
			h.TurnedInAt = db.Now()
		case !*p.TurnedIn:
			h.TurnedInAt = ""
		}
	}
	if _, err := s.c.DB.ExecContext(ctx, `UPDATE homework SET title = ?, due_date = ?, turned_in_at = ?, updated_at = ? WHERE id = ?`,
		h.Title, h.DueDate, h.TurnedInAt, db.Now(), id); err != nil {
		return Summary{}, err
	}
	return s.publishSet(ctx, id)
}

// Delete removes a set and its questions, stopping any still being
// written.
func (s *Service) Delete(ctx context.Context, id string) error {
	h, err := getSummary(ctx, s.c.DB, id)
	if errors.Is(err, errNotFound) {
		return httpx.NotFound("homework set")
	}
	if err != nil {
		return err
	}
	qs, err := listQuestions(ctx, s.c.DB, id)
	if err != nil {
		return err
	}
	for _, q := range qs {
		s.c.Queue.StopSubject(ctx, q.ID)
	}
	if _, err := s.c.DB.ExecContext(ctx, `DELETE FROM homework WHERE id = ?`, id); err != nil {
		return err
	}
	s.c.Events.Publish(EventHomeworkRemoved, HomeworkRemoved{ID: id, BookID: h.BookID})
	return nil
}

// ---------------------------------------------------------------- questions

// Add appends drafts to a set, all at once, and queues each one's first
// step: finding it, or writing the guide of one that isn't in the book.
// Blank drafts are dropped: an empty row in the dialog means nothing.
func (s *Service) Add(ctx context.Context, homeworkID string, drafts []Draft) ([]Question, error) {
	if _, err := getSummary(ctx, s.c.DB, homeworkID); errors.Is(err, errNotFound) {
		return nil, httpx.NotFound("homework set")
	} else if err != nil {
		return nil, err
	}
	var keep []Draft
	for _, d := range drafts {
		d.Text = strings.TrimSpace(d.Text)
		if d.Text == "" {
			continue
		}
		if len(d.Text) > maxDraftText {
			return nil, httpx.Invalid("drafts", "One of these is too long for a single question.")
		}
		keep = append(keep, d)
	}
	if len(keep) == 0 {
		return nil, httpx.Invalid("drafts", "Write at least one question.")
	}
	if len(keep) > maxDrafts {
		return nil, httpx.Invalid("drafts", "That's more than %d questions at once. Add them in smaller batches.", maxDrafts)
	}
	// Each question is read back inside the transaction that made it, so
	// the answer is the questions as added, not whatever a worker has made
	// of them since.
	var out []Question
	err := db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
		var last int
		if err := tx.QueryRowContext(ctx, `SELECT coalesce(max(position), 0) FROM questions WHERE homework_id = ?`, homeworkID).Scan(&last); err != nil {
			return err
		}
		now := db.Now()
		for i, d := range keep {
			id := uuid.NewString()
			label, statement := "", ""
			if !d.InBook {
				// Its own words are its statement; nothing to find.
				label, statement = labelFromText(d.Text), d.Text
			} else {
				label = labelFromText(d.Text)
			}
			if _, err := tx.ExecContext(ctx, `INSERT INTO questions (id, homework_id, position, text, in_book, label, statement, state, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
				id, homeworkID, last+i+1, d.Text, d.InBook, label, statement, now, now); err != nil {
				return err
			}
			if _, err := s.c.Queue.Enqueue(ctx, tx, nextStep(id, d.InBook)); err != nil {
				return err
			}
			q, err := getQuestion(ctx, tx, id)
			if err != nil {
				return err
			}
			out = append(out, q.Question)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	// Said before the worker is woken, so the stream says "added" ahead of
	// what the worker does next. That's the usual order, not a promise (the
	// queue's backstop poll can still get in first), and the client keeps
	// the higher Rev whichever order they land in.
	for _, q := range out {
		s.c.Events.Publish(EventQuestionChanged, QuestionChanged{Question: q})
	}
	s.publishSet(ctx, homeworkID)
	s.c.Queue.Wake()
	return out, nil
}

// labelFromText stands in for the book's own label until the question is
// located: the first line, short.
func labelFromText(text string) string {
	first, _, _ := strings.Cut(strings.TrimSpace(text), "\n")
	first = strings.TrimSpace(first)
	if r := []rune(first); len(r) > 40 {
		return strings.TrimSpace(string(r[:39])) + "…"
	}
	return first
}

// UpdateQuestion applies what the walkthrough changes directly.
func (s *Service) UpdateQuestion(ctx context.Context, id string, p QuestionPatch) (Question, error) {
	q, err := getQuestion(ctx, s.c.DB, id)
	if errors.Is(err, errNotFound) {
		return Question{}, httpx.NotFound("question")
	}
	if err != nil {
		return Question{}, err
	}
	err = db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
		if p.Reveal != nil {
			stage := *p.Reveal
			if stage != "hint" && stage != "walkthrough" {
				return httpx.Invalid("reveal", "There's no stage called %q.", stage)
			}
			if !slices.Contains(q.Revealed, stage) {
				q.Revealed = append(q.Revealed, stage)
			}
			if _, err := tx.ExecContext(ctx, `UPDATE questions SET revealed = ? WHERE id = ?`, mustJSON(q.Revealed), id); err != nil {
				return err
			}
		}
		if p.Done != nil {
			doneAt := ""
			if *p.Done {
				doneAt = db.Now()
			}
			if _, err := tx.ExecContext(ctx, `UPDATE questions SET done_at = ? WHERE id = ?`, doneAt, id); err != nil {
				return err
			}
		}
		if p.Position != nil {
			return move(ctx, tx, q.HomeworkID, id, q.Position, *p.Position)
		}
		return nil
	})
	if err != nil {
		return Question{}, err
	}
	if p.Position != nil {
		// Every question between the two positions moved.
		qs, _ := listQuestions(ctx, s.c.DB, q.HomeworkID)
		for _, other := range qs {
			if other.ID != id {
				s.c.Events.Publish(EventQuestionChanged, QuestionChanged{Question: other})
			}
		}
	}
	out, err := s.publishQuestion(ctx, id)
	if p.Done != nil {
		s.publishSet(ctx, q.HomeworkID)
	}
	return out, err
}

// move puts a question at position to (1-based), shifting the ones in
// between.
func move(ctx context.Context, tx *sql.Tx, homeworkID, id string, from, to int) error {
	var n int
	if err := tx.QueryRowContext(ctx, `SELECT count(*) FROM questions WHERE homework_id = ?`, homeworkID).Scan(&n); err != nil {
		return err
	}
	if to < 1 || to > n {
		return httpx.Invalid("position", "Position %d is outside the set (1 to %d).", to, n)
	}
	if to == from {
		return nil
	}
	shift := `UPDATE questions SET position = position + 1 WHERE homework_id = ? AND position >= ? AND position < ?`
	if to > from {
		shift = `UPDATE questions SET position = position - 1 WHERE homework_id = ? AND position <= ? AND position > ?`
	}
	if _, err := tx.ExecContext(ctx, shift, homeworkID, to, from); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx, `UPDATE questions SET position = ? WHERE id = ?`, to, id)
	return err
}

// RemoveQuestion takes a question out of its set, stopping it if it's
// still being written.
func (s *Service) RemoveQuestion(ctx context.Context, id string) error {
	q, err := getQuestion(ctx, s.c.DB, id)
	if errors.Is(err, errNotFound) {
		return httpx.NotFound("question")
	}
	if err != nil {
		return err
	}
	s.c.Queue.StopSubject(ctx, id)
	err = db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `DELETE FROM questions WHERE id = ?`, id); err != nil {
			return err
		}
		return renumber(ctx, tx, q.HomeworkID)
	})
	if err != nil {
		return err
	}
	s.c.Events.Publish(EventQuestionRemoved, QuestionRemoved{ID: id, HomeworkID: q.HomeworkID})
	qs, _ := listQuestions(ctx, s.c.DB, q.HomeworkID)
	for _, other := range qs {
		if other.Position >= q.Position {
			s.c.Events.Publish(EventQuestionChanged, QuestionChanged{Question: other})
		}
	}
	s.publishSet(ctx, q.HomeworkID)
	return nil
}

// RetryQuestion is a failed question's way out: with the page it's on,
// or with its own text, which makes it a question that isn't in the book.
func (s *Service) RetryQuestion(ctx context.Context, id string, r Retry) (Question, error) {
	q, err := getQuestion(ctx, s.c.DB, id)
	if errors.Is(err, errNotFound) {
		return Question{}, httpx.NotFound("question")
	}
	if err != nil {
		return Question{}, err
	}
	if q.State != StateFailed {
		return Question{}, httpx.Errorf(httpx.CodeInvalid, "Only a question that failed can be tried again.")
	}
	// Memory lines stay with saved rounds, which a retry of the same
	// problem carries on from; the guide clears them with the rounds.
	set := `reason = '', failure = '', hint = '[]', walkthrough = '[]',
		memory = CASE WHEN rounds = '[]' THEN '[]' ELSE memory END, updated_at = ?`
	args := []any{db.Now()}
	// What's left to do, and the state it waits in: the step that failed,
	// unless the retry changes what there is to find.
	st, find := waiting(q), q.InBook && q.Page == nil
	switch {
	case r.Text != nil && strings.TrimSpace(*r.Text) != "":
		text := strings.TrimSpace(*r.Text)
		if len(text) > maxDraftText {
			return Question{}, httpx.Invalid("text", "That's too long for a single question.")
		}
		set += `, text = ?, in_book = 0, statement = ?, label = ?, page = NULL, pinned_page = NULL, rect = 'null', figures = '[]', rounds = '[]'`
		args = append(args, text, text, labelFromText(text))
		st, find = StatePending, false
	case r.Page != nil:
		if !q.InBook {
			return Question{}, httpx.Invalid("page", "This question isn't in the book, so it has no page.")
		}
		b, err := s.c.Library.Book(ctx, q.BookID)
		if err != nil {
			return Question{}, err
		}
		if *r.Page < 1 || *r.Page > b.PageCount {
			return Question{}, httpx.Invalid("page", "The book doesn't have that page.")
		}
		set += `, pinned_page = ?, page = NULL, rounds = '[]'`
		args = append(args, *r.Page)
		st, find = StatePending, true
	default:
		// The same thing again: after a model outage, say. The guide
		// carries on from its saved rounds.
	}
	set += `, state = ?`
	args = append(args, st, id)
	err = db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `UPDATE questions SET `+set+` WHERE id = ?`, args...); err != nil {
			return err
		}
		_, err := s.c.Queue.Enqueue(ctx, tx, nextStep(id, find))
		return err
	})
	if err != nil {
		return Question{}, err
	}
	s.c.Queue.Wake()
	return s.publishQuestion(ctx, id)
}

// ---------------------------------------------------------------- events

func (s *Service) publishSet(ctx context.Context, id string) (Summary, error) {
	h, err := getSummary(ctx, s.c.DB, id)
	if err != nil {
		return Summary{}, err
	}
	s.c.Events.Publish(EventHomeworkChanged, HomeworkChanged{Homework: h})
	return h, nil
}

func (s *Service) publishQuestion(ctx context.Context, id string) (Question, error) {
	q, err := getQuestion(ctx, s.c.DB, id)
	if err != nil {
		return Question{}, err
	}
	s.c.Events.Publish(EventQuestionChanged, QuestionChanged{Question: q.Question})
	return q.Question, nil
}

// QuestionsDoneSince counts questions ticked done since a time, and the
// sets they came from: Home's "questions worked" tile.
func (s *Service) QuestionsDoneSince(ctx context.Context, since time.Time) (questions, sets int, err error) {
	err = s.c.DB.QueryRowContext(ctx, `SELECT count(*), count(DISTINCT homework_id) FROM questions WHERE done_at >= ?`,
		db.At(since)).Scan(&questions, &sets)
	return
}
