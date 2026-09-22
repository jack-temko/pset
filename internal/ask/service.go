// Package ask is the book's tutor: one running conversation per book, each
// turn an agent loop over the book (search, read, look, compute) that
// streams its steps and its answer. Spec: design/workspace.md, "Ask".
package ask

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/google/uuid"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/events"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/llm"
)

// Book is what the tutor needs to know about a book.
type Book struct {
	ID         string
	Title      string
	PageCount  int
	PageOffset int
}

// Library is the book, as the tools read it. Pages are PDF pages.
type Library interface {
	Book(ctx context.Context, id string) (Book, error)
	Search(ctx context.Context, bookID, query string, k int) ([]int, error)
	PageText(ctx context.Context, bookID string, page int) (string, error)
	PageJPEG(ctx context.Context, bookID string, page, width int) ([]byte, error)
}

type Settings interface {
	LLM(ctx context.Context) (llm.Config, error)
	Name(ctx context.Context) string
}

type Queue interface {
	Enqueue(ctx context.Context, ex jobs.Execer, s jobs.Spec) (string, error)
	StopSubject(ctx context.Context, subject string) error
	Handle(kind, lane string, h jobs.Handler)
}

type Config struct {
	DB       *sql.DB
	Events   events.Publisher
	Queue    Queue
	Library  Library
	Settings Settings
}

type Service struct{ c Config }

// A turn's job. The lane runs many books at once; the book is the key,
// so each book answers one question at a time.
const (
	JobTurn  = "turn"
	LaneTurn = "turn"
)

func New(c Config) *Service {
	s := &Service{c}
	c.Queue.Handle(JobTurn, LaneTurn, s.runTurn)
	return s
}

const maxQuestion = 8000

// Turns is a book's conversation, oldest first.
func (s *Service) Turns(ctx context.Context, bookID string) ([]Turn, error) {
	if _, err := s.c.Library.Book(ctx, bookID); err != nil {
		return nil, err
	}
	rows, err := listTurns(ctx, s.c.DB, bookID)
	out := make([]Turn, len(rows))
	for i, r := range rows {
		out[i] = r.Turn
	}
	return out, err
}

// Ask starts a turn. It runs as a job, so leaving the workspace doesn't
// stop it; Stop does.
func (s *Service) Ask(ctx context.Context, bookID string, q Question) (Turn, error) {
	if _, err := s.c.Library.Book(ctx, bookID); err != nil {
		return Turn{}, err
	}
	text := strings.TrimSpace(q.Question)
	if text == "" {
		return Turn{}, httpx.Invalid("question", "Ask something.")
	}
	if len(text) > maxQuestion {
		return Turn{}, httpx.Invalid("question", "That's too long for one question.")
	}
	cfg, err := s.c.Settings.LLM(ctx)
	if err != nil {
		return Turn{}, err
	}
	if !cfg.ChatReady() {
		return Turn{}, httpx.Errorf(httpx.CodeNotConfigured, "Set up a chat model in Settings first.")
	}
	about, aboutText := "", ""
	if q.About != nil {
		about, aboutText = strings.TrimSpace(q.About.Label), strings.TrimSpace(q.About.Text)
	}
	id := uuid.NewString()
	now := db.Now()
	err = db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `INSERT INTO turns (id, book_id, question, about, about_text, state, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, 'running', ?, ?)`, id, bookID, text, about, aboutText, now, now); err != nil {
			return err
		}
		_, err := s.c.Queue.Enqueue(ctx, tx, jobs.Spec{Kind: JobTurn, Subject: id, Key: bookID, Payload: turnPayload{TurnID: id}})
		return err
	})
	if err != nil {
		return Turn{}, err
	}
	return s.publish(ctx, id)
}

// Stop ends a running turn. What it had written stays, with a "Stopped"
// note.
func (s *Service) Stop(ctx context.Context, id string) (Turn, error) {
	t, err := getTurn(ctx, s.c.DB, id)
	if errors.Is(err, errNotFound) {
		return Turn{}, httpx.NotFound("turn")
	}
	if err != nil {
		return Turn{}, err
	}
	if t.State != TurnRunning {
		return t.Turn, nil
	}
	if err := s.c.Queue.StopSubject(ctx, id); err != nil {
		return Turn{}, err
	}
	// A turn still waiting its turn never started; one running settles
	// itself as stopped when its handler returns. Either way, say so now.
	if _, err := s.c.DB.ExecContext(ctx, `UPDATE turns SET state = 'stopped', updated_at = ? WHERE id = ? AND state = 'running'`, db.Now(), id); err != nil {
		return Turn{}, err
	}
	return s.publish(ctx, id)
}

// Clear starts the conversation over.
func (s *Service) Clear(ctx context.Context, bookID string) error {
	rows, err := listTurns(ctx, s.c.DB, bookID)
	if err != nil {
		return err
	}
	for _, r := range rows {
		if r.State == TurnRunning {
			s.c.Queue.StopSubject(ctx, r.ID)
		}
	}
	if _, err := s.c.DB.ExecContext(ctx, `DELETE FROM turns WHERE book_id = ?`, bookID); err != nil {
		return err
	}
	s.c.Events.Publish(EventTurnsCleared, TurnsCleared{BookID: bookID})
	return nil
}

func (s *Service) publish(ctx context.Context, id string) (Turn, error) {
	t, err := getTurn(ctx, s.c.DB, id)
	if err != nil {
		return Turn{}, err
	}
	s.c.Events.Publish(EventTurnChanged, TurnChanged{Turn: t.Turn})
	return t.Turn, nil
}
