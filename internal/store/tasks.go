package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// Task kinds. Preparing a book, reading an assignment, and working one
// question of it. A question is its own task because questions are
// independent: one that fails, or that you want written again, is retried
// and resumed on its own without touching the other seventeen.
const (
	TaskPrepare  = "prepare"
	TaskHomework = "homework"
	TaskQuestion = "question"
)

// Task statuses. Stopping keeps the work, so paused is where a stopped task
// rests and a retry resumes from — there is no cancelled, and no blocked:
// configuration is checked before a task is ever created.
const (
	TaskQueued  = "queued"
	TaskRunning = "running"
	TaskPaused  = "paused"
	TaskFailed  = "failed"
	TaskDone    = "done"
)

// Failure kinds. The engine classifies; adapters render what they are told
// and never guess from error text. Only permanent suppresses a retry.
const (
	FailTransient   = "transient"
	FailEnvironment = "environment"
	FailPermanent   = "permanent"
)

// finishedRetention caps how many settled tasks the history keeps; older
// ones are pruned as new ones settle, so there is nothing to clear by hand.
const finishedRetention = 25

type Task struct {
	ID         string
	Kind       string
	BookID     *string
	HomeworkID *string
	Status     string
	// FailKind is one of FailTransient, FailEnvironment, FailPermanent;
	// empty unless Status is TaskFailed.
	FailKind string
	Error    string
	// Owner is the runner lease: the process that claimed this task. Only a
	// task whose owner is provably gone may be requeued at boot.
	Owner string
	// QuestionID is set on TaskQuestion: the one question this task works.
	QuestionID *string
	// Params is the task's JSON spec — for a question task, which phases to
	// run and the page or note a repair supplied. Empty means "{}".
	Params     string
	CreatedAt  time.Time
	StartedAt  time.Time // zero means not started
	FinishedAt time.Time // zero means not finished
}

// Settled reports whether the task reached a resting state.
func (t *Task) Settled() bool {
	return t.Status == TaskDone || t.Status == TaskFailed || t.Status == TaskPaused
}

const taskColumns = `id, kind, book_id, homework_id, question_id, params, status, fail_kind, error, owner, created_at, started_at, finished_at`

// CreateTask inserts t as a new queued task, setting its ID and CreatedAt.
func (s *Store) CreateTask(ctx context.Context, t *Task) error {
	if t.Status == "" {
		t.Status = TaskQueued
	}
	t.CreatedAt = time.Now().UTC()
	t.ID = newID()
	if t.Params == "" {
		t.Params = "{}"
	}
	if _, err := s.db.ExecContext(ctx, `INSERT INTO tasks
		(id, kind, book_id, homework_id, question_id, params, status, fail_kind, error, owner, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		t.ID, t.Kind, t.BookID, t.HomeworkID, t.QuestionID, t.Params, t.Status,
		t.FailKind, t.Error, t.Owner, formatTime(t.CreatedAt)); err != nil {
		return fmt.Errorf("insert task: %w", err)
	}
	return nil
}

func (s *Store) TaskByID(ctx context.Context, id string) (*Task, error) {
	row := s.ro().QueryRowContext(ctx,
		`SELECT `+taskColumns+` FROM tasks WHERE id = ?`, id)
	t, err := scanTask(row.Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("task %s: %w", id, err)
	}
	return t, nil
}

// ActiveTasks returns the queued and running tasks in FIFO order.
func (s *Store) ActiveTasks(ctx context.Context) ([]*Task, error) {
	return s.listTasks(ctx, `SELECT `+taskColumns+` FROM tasks
		WHERE status IN ('`+TaskQueued+`', '`+TaskRunning+`') ORDER BY id`)
}

// AttentionTasks returns the settled tasks a student still has to decide
// about — failures and pauses — oldest first.
func (s *Store) AttentionTasks(ctx context.Context) ([]*Task, error) {
	return s.listTasks(ctx, `SELECT `+taskColumns+` FROM tasks
		WHERE status IN ('`+TaskFailed+`', '`+TaskPaused+`') ORDER BY id`)
}

// FinishedTasks returns the completed tasks, newest first, up to limit;
// limit <= 0 returns all.
func (s *Store) FinishedTasks(ctx context.Context, limit int) ([]*Task, error) {
	query := `SELECT ` + taskColumns + ` FROM tasks
		WHERE status = '` + TaskDone + `' ORDER BY id DESC`
	if limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", limit)
	}
	return s.listTasks(ctx, query)
}

// QueuedTask returns the oldest queued task; ErrNotFound when the queue is
// empty. The runner is serial, so the oldest queued task is always next.
func (s *Store) QueuedTask(ctx context.Context) (*Task, error) {
	row := s.ro().QueryRowContext(ctx,
		`SELECT `+taskColumns+` FROM tasks WHERE status = ? ORDER BY id LIMIT 1`, TaskQueued)
	t, err := scanTask(row.Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("next queued task: %w", err)
	}
	return t, nil
}

// TaskForQuestion reports the unsettled task working one question, if any.
// It is what keeps a question from being queued twice: a resumed generation
// re-plans from the outline it already stored, and a second Rewrite click
// finds the first one still running.
func (s *Store) TaskForQuestion(ctx context.Context, questionID string) (*Task, error) {
	row := s.ro().QueryRowContext(ctx,
		`SELECT `+taskColumns+` FROM tasks
		 WHERE question_id = ? AND status IN (?, ?, ?) ORDER BY id DESC LIMIT 1`,
		questionID, TaskQueued, TaskRunning, TaskPaused)
	t, err := scanTask(row.Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("task for question %s: %w", questionID, err)
	}
	return t, nil
}

// TasksForHomework lists every unsettled task of an assignment — the parent
// read and each question being worked — newest last.
func (s *Store) TasksForHomework(ctx context.Context, hwID string) ([]Task, error) {
	rows, err := s.ro().QueryContext(ctx,
		`SELECT `+taskColumns+` FROM tasks WHERE homework_id = ? ORDER BY id`, hwID)
	if err != nil {
		return nil, fmt.Errorf("tasks for homework %s: %w", hwID, err)
	}
	defer rows.Close()
	var out []Task
	for rows.Next() {
		t, err := scanTask(rows.Scan)
		if err != nil {
			return nil, err
		}
		out = append(out, *t)
	}
	return out, rows.Err()
}

// TaskForBook reports the unsettled task targeting a book, if any.
func (s *Store) TaskForBook(ctx context.Context, bookID string) (*Task, error) {
	row := s.ro().QueryRowContext(ctx,
		`SELECT `+taskColumns+` FROM tasks
		 WHERE book_id = ? AND status IN (?, ?, ?, ?) ORDER BY id DESC LIMIT 1`,
		bookID, TaskQueued, TaskRunning, TaskPaused, TaskFailed)
	t, err := scanTask(row.Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("task for book %s: %w", bookID, err)
	}
	return t, nil
}

// TaskForHomework reports the unsettled task generating an assignment.
func (s *Store) TaskForHomework(ctx context.Context, hwID string) (*Task, error) {
	row := s.ro().QueryRowContext(ctx,
		`SELECT `+taskColumns+` FROM tasks
		 WHERE homework_id = ? AND status IN (?, ?, ?, ?) ORDER BY id DESC LIMIT 1`,
		hwID, TaskQueued, TaskRunning, TaskPaused, TaskFailed)
	t, err := scanTask(row.Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("task for homework %s: %w", hwID, err)
	}
	return t, nil
}

// ClaimTask flips one queued task to running under owner's lease, stamping
// started_at. It reports false when the task was no longer queued.
func (s *Store) ClaimTask(ctx context.Context, id, owner string) (bool, error) {
	res, err := s.db.ExecContext(ctx,
		`UPDATE tasks SET status = ?, owner = ?, started_at = ?, error = '', fail_kind = ''
		 WHERE id = ? AND status = ?`,
		TaskRunning, owner, formatTime(time.Now().UTC()), id, TaskQueued)
	if err != nil {
		return false, fmt.Errorf("claim task %s: %w", id, err)
	}
	n, err := res.RowsAffected()
	return n == 1, err
}

// SaveTask persists every mutable field of t, book_id included: an import
// learns which book it is preparing partway through, and the queue has to
// show the book's name from that moment on.
func (s *Store) SaveTask(ctx context.Context, t *Task) error {
	var started, finished any
	if !t.StartedAt.IsZero() {
		started = formatTime(t.StartedAt)
	}
	if !t.FinishedAt.IsZero() {
		finished = formatTime(t.FinishedAt)
	}
	if _, err := s.db.ExecContext(ctx,
		`UPDATE tasks SET status = ?, book_id = ?, homework_id = ?, fail_kind = ?, error = ?,
		 owner = ?, started_at = ?, finished_at = ? WHERE id = ?`,
		t.Status, t.BookID, t.HomeworkID, t.FailKind, t.Error, t.Owner, started, finished, t.ID); err != nil {
		return fmt.Errorf("save task %s: %w", t.ID, err)
	}
	return nil
}

// ReclaimOrphanedTasks requeues tasks left running by a process that is gone,
// identified by an owner lease other than the live one. A second pset on the
// same database therefore cannot yank the first one's running work.
func (s *Store) ReclaimOrphanedTasks(ctx context.Context, owner string) (int64, error) {
	if _, err := s.db.ExecContext(ctx,
		`UPDATE phases SET status = ? WHERE status = ? AND task_id IN
		   (SELECT id FROM tasks WHERE status = ? AND owner != ?)`,
		PhaseWaiting, PhaseRunning, TaskRunning, owner); err != nil {
		return 0, fmt.Errorf("reset orphaned phases: %w", err)
	}
	res, err := s.db.ExecContext(ctx,
		`UPDATE tasks SET status = ?, owner = '' WHERE status = ? AND owner != ?`,
		TaskQueued, TaskRunning, owner)
	if err != nil {
		return 0, fmt.Errorf("reclaim orphaned tasks: %w", err)
	}
	return res.RowsAffected()
}

// PruneFinishedTasks drops all but the newest finishedRetention completed
// tasks, returning the ids removed so adapters can stream the removals.
// History needs no clearing by hand because it prunes itself.
func (s *Store) PruneFinishedTasks(ctx context.Context) ([]string, error) {
	rows, err := s.ro().QueryContext(ctx,
		`SELECT id FROM tasks WHERE status = ? ORDER BY id DESC LIMIT -1 OFFSET ?`,
		TaskDone, finishedRetention)
	if err != nil {
		return nil, fmt.Errorf("find prunable tasks: %w", err)
	}
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, fmt.Errorf("find prunable tasks: %w", err)
		}
		ids = append(ids, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for _, id := range ids {
		if _, err := s.db.ExecContext(ctx, `DELETE FROM tasks WHERE id = ?`, id); err != nil {
			return nil, fmt.Errorf("prune task %s: %w", id, err)
		}
	}
	return ids, nil
}

// DeleteTasksForBook drops every task targeting a book, for Remove book, and
// returns the ids it removed so the caller can tell stream subscribers what
// vanished — the event set matches the delete set by construction.
func (s *Store) DeleteTasksForBook(ctx context.Context, bookID string) ([]string, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("delete tasks of book %s: %w", bookID, err)
	}
	defer tx.Rollback()

	rows, err := tx.QueryContext(ctx, `SELECT id FROM tasks WHERE book_id = ?`, bookID)
	if err != nil {
		return nil, fmt.Errorf("list tasks of book %s: %w", bookID, err)
	}
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan task id: %w", err)
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list tasks of book %s: %w", bookID, err)
	}
	rows.Close()

	if _, err := tx.ExecContext(ctx, `DELETE FROM tasks WHERE book_id = ?`, bookID); err != nil {
		return nil, fmt.Errorf("delete tasks of book %s: %w", bookID, err)
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("delete tasks of book %s: %w", bookID, err)
	}
	return ids, nil
}

// UnsettledTaskCount counts the tasks that are not resting, guarding reset.
func (s *Store) UnsettledTaskCount(ctx context.Context) (int, error) {
	var n int
	if err := s.ro().QueryRowContext(ctx,
		`SELECT COUNT(*) FROM tasks WHERE status IN (?, ?)`,
		TaskQueued, TaskRunning).Scan(&n); err != nil {
		return 0, fmt.Errorf("count unsettled tasks: %w", err)
	}
	return n, nil
}

// FinishedTaskCount counts settled tasks, for the reset preview.
func (s *Store) FinishedTaskCount(ctx context.Context) (int, error) {
	var n int
	if err := s.ro().QueryRowContext(ctx,
		`SELECT COUNT(*) FROM tasks WHERE status NOT IN (?, ?)`,
		TaskQueued, TaskRunning).Scan(&n); err != nil {
		return 0, fmt.Errorf("count finished tasks: %w", err)
	}
	return n, nil
}

func (s *Store) listTasks(ctx context.Context, query string, args ...any) ([]*Task, error) {
	rows, err := s.ro().QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list tasks: %w", err)
	}
	defer rows.Close()

	var out []*Task
	for rows.Next() {
		t, err := scanTask(rows.Scan)
		if err != nil {
			return nil, fmt.Errorf("list tasks: %w", err)
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func scanTask(scan func(dest ...any) error) (*Task, error) {
	var t Task
	var createdAt string
	var startedAt, finishedAt sql.NullString
	if err := scan(&t.ID, &t.Kind, &t.BookID, &t.HomeworkID, &t.QuestionID, &t.Params, &t.Status,
		&t.FailKind, &t.Error, &t.Owner, &createdAt, &startedAt, &finishedAt); err != nil {
		return nil, err
	}
	var err error
	if t.CreatedAt, err = parseTime(createdAt); err != nil {
		return nil, fmt.Errorf("parse created_at: %w", err)
	}
	if startedAt.Valid {
		if t.StartedAt, err = parseTime(startedAt.String); err != nil {
			return nil, fmt.Errorf("parse started_at: %w", err)
		}
	}
	if finishedAt.Valid {
		if t.FinishedAt, err = parseTime(finishedAt.String); err != nil {
			return nil, fmt.Errorf("parse finished_at: %w", err)
		}
	}
	return &t, nil
}
