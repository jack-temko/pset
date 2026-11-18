// Package oldwork is the seam the old features' background work goes
// through until each is moved onto the step runner (ideas/backend-courses.md:
// homework in track 5, Ask in track 6). The job queue that ran it went in
// track 3; in the app, main hands each feature Idle, which keeps nothing, so
// that work waits and never runs. Their tests run it on the old queue, kept
// as oldworktest, so what the ports copy stays tested. This package and
// oldworktest go with the last feature ported.
package oldwork

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/jackt/pset/internal/errs"
)

// Queue is what a feature puts its background work on.
type Queue interface {
	// Enqueue adds a job inside the caller's transaction.
	Enqueue(ctx context.Context, ex Execer, s Spec) (string, error)
	// Wake starts what was enqueued, once its transaction has committed.
	Wake()
	// StopSubject stops every unfinished job working on subject.
	StopSubject(ctx context.Context, subject string) error
	// Handle registers the handler for a kind of job, in a lane.
	Handle(kind, lane string, h Handler)
	// Stopped is whether ctx was cancelled by a stop, as opposed to a
	// shutdown: a handler records "Stopped" on its own row only then.
	Stopped(ctx context.Context) bool
	// Waiting is how many jobs of kind are queued on subject.
	Waiting(ctx context.Context, kind, subject string) (int, error)
}

// Execer is a *sql.DB or a *sql.Tx.
type Execer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

// Spec is what Enqueue needs.
type Spec struct {
	Kind    string
	Subject string // the row the job works on, for StopSubject
	Key     string // jobs sharing a key run one at a time
	// Priority orders a lane's queued jobs: higher starts first.
	Priority int
	Payload  any
}

// Job is one job, as its handler gets it.
type Job struct {
	ID       string
	Kind     string
	Lane     string
	Subject  string
	Key      string
	Priority int
	Payload  json.RawMessage
	Attempts int
}

// Decode unmarshals the payload.
func (j Job) Decode(v any) error { return errs.Data.Of(json.Unmarshal(j.Payload, v)) }

// Handler does one job.
type Handler func(ctx context.Context, j Job) error

// Idle is the queue in the app: it keeps nothing and runs nothing.
type Idle struct{}

// Enqueue keeps nothing.
func (Idle) Enqueue(context.Context, Execer, Spec) (string, error) { return "", nil }

// Wake does nothing.
func (Idle) Wake() {}

// StopSubject has nothing to stop.
func (Idle) StopSubject(context.Context, string) error { return nil }

// Handle registers nothing.
func (Idle) Handle(string, string, Handler) {}

// Stopped is never true: nothing runs.
func (Idle) Stopped(context.Context) bool { return false }

// Waiting is none.
func (Idle) Waiting(context.Context, string, string) (int, error) { return 0, nil }
