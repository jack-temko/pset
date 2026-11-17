package runner

import (
	"context"

	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/step"
	"github.com/jackt/pset/internal/usage"
)

// Steps is a subject's steps in order, as the page has them: with what
// their calls spent, across every run, and how long a step of that name
// usually takes here.
func (r *Runner) Steps(ctx context.Context, kind change.Resource, id string) ([]step.Step, error) {
	rows, err := r.store.DB.QueryContext(ctx, `
SELECT s.id, s.seq, s.subject_kind, s.subject_id, s.name, s.state, s.attempts, s.retry_at, s.incident_id, s.started_at, s.ended_at,
	ifnull((SELECT CAST(round(avg((julianday(d.ended_at) - julianday(d.started_at)) * 86400)) AS INTEGER) FROM steps d
		WHERE d.name = s.name AND d.state = 'done' AND d.started_at != '' AND d.ended_at != ''), 0)
FROM steps s WHERE s.subject_kind = ? AND s.subject_id = ? ORDER BY s.position`, kind, id)
	if err != nil {
		return nil, errs.Database.Wrap(err)
	}
	out := []step.Step{}
	for rows.Next() {
		var s step.Step
		if err := rows.Scan(&s.ID, &s.Seq, &s.SubjectKind, &s.SubjectID, &s.Name, &s.State, &s.Attempts, &s.RetryAt,
			&s.IncidentID, &s.StartedAt, &s.EndedAt, &s.TypicalSeconds); err != nil {
			cleanup.Close(rows)
			return nil, errs.Database.Wrap(err)
		}
		out = append(out, s)
	}
	cleanup.Close(rows)
	if err := rows.Err(); err != nil {
		return nil, errs.Database.Wrap(err)
	}
	for i := range out {
		u, err := r.usage(ctx, out[i].ID)
		if err != nil {
			return nil, err
		}
		out[i].Usage = u
	}
	return out, nil
}

// usage is a step's calls added up per model that answered, nil when it
// made none.
func (r *Runner) usage(ctx context.Context, stepID string) (*usage.Usage, error) {
	rows, err := r.store.DB.QueryContext(ctx, `
SELECT CASE answered WHEN '' THEN model ELSE answered END AS m, sum(ms), count(*),
	sum(CASE WHEN counted THEN prompt_tokens + completion_tokens END), sum(CASE WHEN counted THEN cost END),
	sum(NOT counted), sum(error_id != '')
FROM calls WHERE step_id = ? GROUP BY m ORDER BY m`, stepID)
	if err != nil {
		return nil, errs.Database.Wrap(err)
	}
	defer cleanup.Close(rows)
	u := &usage.Usage{Rows: []usage.Row{}}
	for rows.Next() {
		var row usage.Row
		var failed int
		if err := rows.Scan(&row.Model, &row.Ms, &row.Calls, &row.Tokens, &row.Cost, &row.Uncounted, &failed); err != nil {
			return nil, errs.Database.Wrap(err)
		}
		u.Rows = append(u.Rows, row)
		u.Total.Ms += row.Ms
		u.Total.Calls += row.Calls
		u.Total.Uncounted += row.Uncounted
		u.Failed += failed
		if row.Tokens != nil {
			n := *row.Tokens
			if u.Total.Tokens != nil {
				n += *u.Total.Tokens
			}
			u.Total.Tokens = &n
		}
		if row.Cost != nil {
			c := *row.Cost
			if u.Total.Cost != nil {
				c += *u.Total.Cost
			}
			u.Total.Cost = &c
		}
	}
	if err := rows.Err(); err != nil {
		return nil, errs.Database.Wrap(err)
	}
	if len(u.Rows) == 0 {
		return nil, nil //nolint:nilnil // a step that made no calls has no usage, and says so with nil
	}
	return u, nil
}
