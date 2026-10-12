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
	"time"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/llm"
)

// The kinds of thing a call was spent on, as llm.Subject names them.
const (
	SubjectQuestion = "question"
	SubjectRead     = "read"
	SubjectTurn     = "turn"
	SubjectBook     = "book"
	// SubjectSet is a homework set: the difficulty ranking of its questions,
	// which belongs to no one question and is shared among them.
	SubjectSet = "set"
)

// Migrations creates one row per call. The rows go when their subject does; the
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
CREATE INDEX calls_subject ON calls(subject_type, subject_id);`},
		// A subject removed while a model call for it is in flight: the call
		// ends after the removal and would record a row for something that
		// no longer exists, for good. Forget leaves a mark here, in the same
		// write that deletes the rows, and the sink records nothing for a
		// marked subject. Marks are only needed while calls can still be in
		// flight; Sweep clears them.
		{Name: "usage/2", SQL: `
CREATE TABLE forgotten (
	subject_type TEXT NOT NULL,
	subject_id   TEXT NOT NULL,
	at           TEXT NOT NULL,
	PRIMARY KEY (subject_type, subject_id)
);`},
		// What each call was a part of: its stage and run (new columns, old
		// rows keep NULLs and read as unlabelled), the tools its reply asked
		// for, and the reasoning and cached tokens the provider counted.
		{Name: "usage/3", SQL: `
ALTER TABLE calls ADD COLUMN stage TEXT;
ALTER TABLE calls ADD COLUMN run TEXT;
ALTER TABLE calls ADD COLUMN tools TEXT;
ALTER TABLE calls ADD COLUMN reasoning_tokens INTEGER;
ALTER TABLE calls ADD COLUMN cached_tokens INTEGER;`},
		// A failed call names its cause in the error catalog (key.out_of_credit,
		// model.busy). Calls that failed before get the entry their status
		// named; the error text stays as the provider said it.
		{Name: "usage/4", SQL: `
ALTER TABLE calls ADD COLUMN error_id TEXT;
UPDATE calls SET error_id = CASE
	WHEN error LIKE '%(HTTP 402)%' THEN 'key.out_of_credit'
	WHEN error LIKE '%(HTTP 401)%' OR error LIKE '%(HTTP 403)%' THEN 'key.refused'
	WHEN error LIKE '%(HTTP 404)%' THEN 'model.unknown'
	WHEN error LIKE '%(HTTP 429)%' OR error LIKE '%(HTTP 5%' THEN 'model.busy'
	WHEN error LIKE '%(HTTP %' THEN 'model.rejected'
	WHEN error LIKE '%stream was cut%' THEN 'model.cut'
	WHEN error LIKE 'model request failed:%' THEN 'model.unreachable'
	ELSE NULL END
WHERE error IS NOT NULL AND error != ''`}}
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
		var prompt, completion, cost, reasoning, cached any
		if c.Usage != nil {
			prompt, completion, cost = c.Usage.PromptTokens, c.Usage.CompletionTokens, c.Usage.Cost
			// A zero is how Go reads a count the provider left out; it is stored as
			// absent, since a reported zero says no more than that.
			reasoning, cached = zeroIsNull(c.Usage.CompletionDetails.ReasoningTokens), zeroIsNull(c.Usage.PromptDetails.CachedTokens)
		}
		var errText, errID any
		if c.Error != "" {
			errText, errID = c.Error, nullable(c.ErrorID)
		}
		// Nothing is recorded for a subject that was removed while this call
		// ran: the mark and the insert are one statement, so a removal
		// can't slip between checking and writing.
		if _, err := d.ExecContext(ctx, `INSERT INTO calls
			(at, subject_type, subject_id, model, answered, ms, prompt_tokens, completion_tokens, cost, host, session, error,
				stage, run, tools, reasoning_tokens, cached_tokens, error_id)
			SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
			WHERE NOT EXISTS (SELECT 1 FROM forgotten WHERE subject_type = ? AND subject_id = ?)`,
			c.At, c.SubjectType, c.SubjectID, c.Model, nullable(c.Answered), c.Ms,
			prompt, completion, cost, nullable(c.Host), nullable(c.Session), errText,
			nullable(c.Stage), nullable(c.Run), nullable(c.Tools), reasoning, cached, errID,
			c.SubjectType, c.SubjectID); err != nil {
			slog.Error("usage: record call", "subject", c.SubjectType+"/"+c.SubjectID, "err", err)
		}
	}
}

func zeroIsNull(n int) any {
	if n == 0 {
		return nil
	}
	return n
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
	// name its models have. The alias is not called model, the column's
	// name: GROUP BY model would group by the column, the model asked
	// for, and merge a fallback's answers under whichever came first.
	// Rows with usage lead, so the card's headline is who did the work.
	rows, err := q.QueryContext(ctx, `SELECT subject_id, coalesce(nullif(answered, ''), model) AS who,
			sum(ms), sum(cost), sum(coalesce(prompt_tokens, 0) + coalesce(completion_tokens, 0)),
			count(*), count(prompt_tokens), count(nullif(error, ''))
		FROM calls
		WHERE subject_type = ? AND subject_id IN (`+marks+`)
		GROUP BY subject_id, who
		ORDER BY 5 DESC, 3 DESC`, args...)
	if err != nil {
		return nil, err
	}
	defer cleanup.Close(rows)
	for rows.Next() {
		var subjectID, model string
		var ms int64
		var cost sql.NullFloat64
		var tokens sql.NullInt64
		var calls, withUsage, failed int
		if err := rows.Scan(&subjectID, &model, &ms, &cost, &tokens, &calls, &withUsage, &failed); err != nil {
			return nil, errs.Database.Wrap(err)
		}
		u := out[subjectID]
		if u == nil {
			u = &Usage{}
			out[subjectID] = u
		}
		row := Row{Model: model, Ms: ms, Calls: calls, Uncounted: calls - withUsage}
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
		u.Total.Uncounted += row.Uncounted
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
	return out, errs.Database.Of(rows.Err())
}

// Forget deletes one subject's call rows, called as the subject goes, so
// its spending isn't kept after the thing it was spent on. It marks the
// subject first, so a call still in flight for it (the job stopped, the
// request unwinding) records nothing when it ends.
func Forget(ctx context.Context, q execer, subjectType, subjectID string) error {
	if subjectID != "" {
		if _, err := q.ExecContext(ctx, `INSERT OR IGNORE INTO forgotten (subject_type, subject_id, at) VALUES (?, ?, ?)`,
			subjectType, subjectID, db.Now()); err != nil {
			return fmt.Errorf("usage: forget %s/%s: %w", subjectType, subjectID, err)
		}
	}
	if _, err := q.ExecContext(ctx, `DELETE FROM calls WHERE subject_type = ? AND subject_id = ?`, subjectType, subjectID); err != nil {
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

// How long a removal's mark is kept: a call can outlive its subject by as
// long as a request can run (llm.DefaultTimeout is 20 minutes), so a day
// is more than enough.
const forgottenFor = 24 * time.Hour

// How long a call made for nothing in particular is kept: the Settings
// key test, a reference the model read. No removal will ever delete them.
const unattributedFor = 30 * 24 * time.Hour

// Sweep clears what nothing else will: the marks Forget left once no call
// can still be in flight for them, and old calls that were spent on no
// subject. Run at startup.
func Sweep(ctx context.Context, d *sql.DB) error {
	now := time.Now()
	if _, err := d.ExecContext(ctx, `DELETE FROM forgotten WHERE at < ?`, db.At(now.Add(-forgottenFor))); err != nil {
		return fmt.Errorf("usage: sweep marks: %w", err)
	}
	// calls.at is RFC 3339 in UTC to the second, which compares as text.
	if _, err := d.ExecContext(ctx, `DELETE FROM calls WHERE subject_type = '' AND at < ?`,
		now.Add(-unattributedFor).UTC().Format(time.RFC3339)); err != nil {
		return fmt.Errorf("usage: sweep calls: %w", err)
	}
	return nil
}
