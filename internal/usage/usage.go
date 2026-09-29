// Package usage records what each model call cost, on the thing that
// spent it: one row per call in the calls table, written from llm's call
// log by a sink the db side wires in, and the one grouped query any view
// of a subject's spending is. The rows are never summed into summaries —
// any later view (per book, per month) is a query, not a migration.
// Spec: design/model-usage.md.
package usage

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"strings"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/llm"
)

// The kinds of thing a call was spent on, as llm.Subject names them.
const (
	SubjectQuestion = "question"
	SubjectRead     = "read"
	SubjectTurn     = "turn"
	SubjectBook     = "book"
)

// Migrations: one row per call. The rows go when their subject does; the
// subjects belong to other features, which delete what they owe (Forget,
// and each one's removal path calls it).
func Migrations() []db.Migration {
	return []db.Migration{{Name: "usage/1", SQL: `
CREATE TABLE calls (
	id               INTEGER PRIMARY KEY,
	at               TEXT NOT NULL,
	subject_type     TEXT NOT NULL,
	subject_id       TEXT NOT NULL,
	model            TEXT NOT NULL,
	answered         TEXT,
	ms               INTEGER NOT NULL,
	prompt_tokens    INTEGER,
	completion_tokens INTEGER,
	cost             REAL,
	host             TEXT,
	session          TEXT,
	error            TEXT
);
CREATE INDEX calls_subject ON calls(subject_type, subject_id);`}}
}

// execer is what the sink and the cleanup write through, so they can run
// inside the transaction that removes a subject.
type execer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

// queryer is what the aggregation reads through.
type queryer interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

// Sink returns the callback llm hands each finished call to: it writes
// one row. A call with no subject is kept with empty strings, so nothing
// a model did is unrecorded; a failed write is logged, never raised —
// bookkeeping must not fail the job that paid for the call.
func Sink(d *sql.DB) func(llm.Call) {
	return func(c llm.Call) {
		ctx := context.Background()
		var prompt, completion, cost any
		if c.Usage != nil {
			prompt, completion, cost = c.Usage.PromptTokens, c.Usage.CompletionTokens, c.Usage.Cost
		}
		var errText any
		if c.Error != "" {
			errText = c.Error
		}
		if _, err := d.ExecContext(ctx, `INSERT INTO calls
			(at, subject_type, subject_id, model, answered, ms, prompt_tokens, completion_tokens, cost, host, session, error)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			c.At, c.SubjectType, c.SubjectID, c.Model, nullable(c.Answered), c.Ms,
			prompt, completion, cost, nullable(c.Host), nullable(c.Session), errText); err != nil {
			slog.Error("usage: record call", "subject", c.SubjectType+"/"+c.SubjectID, "err", err)
		}
	}
}

// nullable is an empty string as SQL NULL: the column says whether the
// provider said anything at all.
func nullable(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// For is what one subject spent, or nil when it made no call: one row per
// model that served it, ordered by tokens (the headline model first),
// with the total and the failed calls counted.
func For(ctx context.Context, q queryer, subjectType, subjectID string) (*Usage, error) {
	bySubject, err := ForSubjects(ctx, q, subjectType, []string{subjectID})
	if err != nil {
		return nil, err
	}
	return bySubject[subjectID], nil
}

// ForSubjects is For over many subjects of one kind at once: a set's
// questions, a conversation's turns.
func ForSubjects(ctx context.Context, q queryer, subjectType string, ids []string) (map[string]*Usage, error) {
	out := make(map[string]*Usage, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	marks := strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
	args := make([]any, 0, len(ids)+1)
	args = append(args, subjectType)
	for _, id := range ids {
		args = append(args, id)
	}
	// The answered model is who replied — a fallback's, when the one
	// asked for failed — falling back to the model asked for, which is
	// what a call that never got an answer and a provider that doesn't
	// name its models have. Rows with usage lead, so the card's headline
	// is who did the work.
	rows, err := q.QueryContext(ctx, `SELECT subject_id, coalesce(nullif(answered, ''), model) AS model,
			sum(ms), sum(cost), sum(coalesce(prompt_tokens, 0) + coalesce(completion_tokens, 0)),
			count(*), count(prompt_tokens), count(nullif(error, ''))
		FROM calls
		WHERE subject_type = ? AND subject_id IN (`+marks+`)
		GROUP BY subject_id, model
		ORDER BY 5 DESC, 3 DESC`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var subjectID, model string
		var ms int64
		var cost sql.NullFloat64
		var tokens sql.NullInt64
		var calls, withUsage, failed int
		if err := rows.Scan(&subjectID, &model, &ms, &cost, &tokens, &calls, &withUsage, &failed); err != nil {
			return nil, err
		}
		u := out[subjectID]
		if u == nil {
			u = &Usage{}
			out[subjectID] = u
		}
		row := UsageRow{Model: model, Ms: ms, Calls: calls}
		// A model none of whose calls reported usage shows "–", not zero:
		// nothing was counted, which isn't the same as nothing was spent.
		if withUsage > 0 {
			t := int(tokens.Int64)
			row.Tokens = &t
		}
		if cost.Valid {
			c := cost.Float64
			row.Cost = &c
		}
		u.Rows = append(u.Rows, row)
		u.Total.Ms += ms
		u.Total.Calls += calls
		if row.Tokens != nil {
			if u.Total.Tokens == nil {
				u.Total.Tokens = new(int)
			}
			*u.Total.Tokens += *row.Tokens
		}
		if row.Cost != nil {
			if u.Total.Cost == nil {
				u.Total.Cost = new(float64)
			}
			*u.Total.Cost += *row.Cost
		}
		u.Failed += failed
	}
	return out, rows.Err()
}

// Forget deletes one subject's call rows, called as the subject goes, so
// its spending isn't kept after the thing it was spent on.
func Forget(ctx context.Context, q execer, subjectType, subjectID string) error {
	_, err := q.ExecContext(ctx, `DELETE FROM calls WHERE subject_type = ? AND subject_id = ?`, subjectType, subjectID)
	if err != nil {
		return fmt.Errorf("usage: forget %s/%s: %w", subjectType, subjectID, err)
	}
	return nil
}

// ForgetAll is Forget for every subject of a kind in a list: a set's
// questions, a conversation's turns.
func ForgetAll(ctx context.Context, q execer, subjectType string, ids []string) error {
	for _, id := range ids {
		if err := Forget(ctx, q, subjectType, id); err != nil {
			return err
		}
	}
	return nil
}
