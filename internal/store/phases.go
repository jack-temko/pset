package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// Phase statuses. A phase with nothing to do (OCR on a digital book) is
// done with a note, not a fourth outcome.
const (
	PhaseWaiting = "waiting"
	PhaseRunning = "running"
	PhaseDone    = "done"
	PhaseFailed  = "failed"
)

// Phase is one step of a task's plan. Phases are a flat ordered list —
// there are no child rows, so a task's shape is exactly what the student
// sees. Key is stable across resumes and addresses the phase in URLs.
type Phase struct {
	ID     string
	TaskID string
	Seq    int
	Key    string
	Name   string
	Status string
	Done   int
	// Total is the unit count for progress; 0 means uncounted.
	Total int
	Note  string
	Error string
	// Rate is units per second, persisted so "about 2 min left" survives a
	// pause, a resume, and a restart.
	Rate       float64
	CreatedAt  time.Time
	StartedAt  time.Time
	FinishedAt time.Time
}

// Settled reports whether the phase reached a resting state.
func (p *Phase) Settled() bool { return p.Status == PhaseDone || p.Status == PhaseFailed }

const phaseColumns = `id, task_id, seq, key, name, status, done, total, note, error, rate, created_at, started_at, finished_at`

// UpsertPhase declares one phase of a task's plan, preserving the stored
// progress of a phase that already ran. Plans are re-declared on every run,
// so this is how a resumed task finds its completed work.
func (s *Store) UpsertPhase(ctx context.Context, p *Phase) error {
	existing, err := s.PhaseByKey(ctx, p.TaskID, p.Key)
	switch {
	case err == nil:
		// Keep what the earlier run achieved; refresh only the declaration.
		p.ID = existing.ID
		p.Status = existing.Status
		p.Done = existing.Done
		p.Note = existing.Note
		p.Error = existing.Error
		p.Rate = existing.Rate
		p.CreatedAt = existing.CreatedAt
		p.StartedAt = existing.StartedAt
		p.FinishedAt = existing.FinishedAt
		if p.Total == 0 {
			p.Total = existing.Total
		}
		if _, err := s.db.ExecContext(ctx,
			`UPDATE phases SET seq = ?, name = ?, total = ? WHERE id = ?`,
			p.Seq, p.Name, p.Total, p.ID); err != nil {
			return fmt.Errorf("redeclare phase %s: %w", p.Key, err)
		}
		return nil
	case errors.Is(err, ErrNotFound):
		p.ID = newID()
		if p.Status == "" {
			p.Status = PhaseWaiting
		}
		p.CreatedAt = time.Now().UTC()
		if _, err := s.db.ExecContext(ctx, `INSERT INTO phases
			(id, task_id, seq, key, name, status, done, total, note, error, rate, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			p.ID, p.TaskID, p.Seq, p.Key, p.Name, p.Status, p.Done, p.Total,
			p.Note, p.Error, p.Rate, formatTime(p.CreatedAt)); err != nil {
			return fmt.Errorf("declare phase %s: %w", p.Key, err)
		}
		return nil
	default:
		return err
	}
}

// PhasesByTask lists a task's phases in plan order.
func (s *Store) PhasesByTask(ctx context.Context, taskID string) ([]*Phase, error) {
	rows, err := s.ro().QueryContext(ctx,
		`SELECT `+phaseColumns+` FROM phases WHERE task_id = ? ORDER BY seq`, taskID)
	if err != nil {
		return nil, fmt.Errorf("list phases: %w", err)
	}
	defer rows.Close()

	var out []*Phase
	for rows.Next() {
		p, err := scanPhase(rows.Scan)
		if err != nil {
			return nil, fmt.Errorf("list phases: %w", err)
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// PhaseByKey reads one phase; ErrNotFound when the task has no such key.
func (s *Store) PhaseByKey(ctx context.Context, taskID, key string) (*Phase, error) {
	row := s.ro().QueryRowContext(ctx,
		`SELECT `+phaseColumns+` FROM phases WHERE task_id = ? AND key = ?`, taskID, key)
	p, err := scanPhase(row.Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("phase %s of task %s: %w", key, taskID, err)
	}
	return p, nil
}

// SavePhase persists every mutable field of p.
func (s *Store) SavePhase(ctx context.Context, p *Phase) error {
	var started, finished any
	if !p.StartedAt.IsZero() {
		started = formatTime(p.StartedAt)
	}
	if !p.FinishedAt.IsZero() {
		finished = formatTime(p.FinishedAt)
	}
	if _, err := s.db.ExecContext(ctx,
		`UPDATE phases SET status = ?, done = ?, total = ?, note = ?, error = ?, rate = ?,
		 started_at = ?, finished_at = ? WHERE id = ?`,
		p.Status, p.Done, p.Total, p.Note, p.Error, p.Rate, started, finished, p.ID); err != nil {
		return fmt.Errorf("save phase %s: %w", p.Key, err)
	}
	return nil
}

// ResumePhases readies a task for another run: the phase that failed and any
// phase interrupted mid-flight go back to waiting; phases that finished stay
// done and are never re-run.
func (s *Store) ResumePhases(ctx context.Context, taskID string) error {
	if _, err := s.db.ExecContext(ctx,
		`UPDATE phases SET status = ?, error = '', note = '', started_at = NULL, finished_at = NULL
		 WHERE task_id = ? AND status IN (?, ?)`,
		PhaseWaiting, taskID, PhaseFailed, PhaseRunning); err != nil {
		return fmt.Errorf("resume phases of task %s: %w", taskID, err)
	}
	return nil
}

func scanPhase(scan func(dest ...any) error) (*Phase, error) {
	var p Phase
	var createdAt string
	var startedAt, finishedAt sql.NullString
	if err := scan(&p.ID, &p.TaskID, &p.Seq, &p.Key, &p.Name, &p.Status,
		&p.Done, &p.Total, &p.Note, &p.Error, &p.Rate,
		&createdAt, &startedAt, &finishedAt); err != nil {
		return nil, err
	}
	var err error
	if p.CreatedAt, err = parseTime(createdAt); err != nil {
		return nil, fmt.Errorf("parse created_at: %w", err)
	}
	if startedAt.Valid {
		if p.StartedAt, err = parseTime(startedAt.String); err != nil {
			return nil, fmt.Errorf("parse started_at: %w", err)
		}
	}
	if finishedAt.Valid {
		if p.FinishedAt, err = parseTime(finishedAt.String); err != nil {
			return nil, fmt.Errorf("parse finished_at: %w", err)
		}
	}
	return &p, nil
}
