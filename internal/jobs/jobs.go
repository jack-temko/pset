// Package jobs is PSet's durable work queue. A job is a kind, a lane, a
// subject and a JSON payload; features register a handler per kind and
// publish their own domain events while it runs. The queue has no notion of
// what the UI shows: it never publishes anything.
//
// Lanes bound concurrency. A job may also carry a key, and two jobs with
// the same key never run at once in a lane (one Ask turn per book). A
// job's priority orders its lane's queue: higher starts first, oldest
// first among equals (homework's finds start ahead of its guides).
package jobs

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"

	"github.com/jackt/pset/internal/db"
)

type State string

const (
	Queued    State = "queued"
	Running   State = "running"
	Done      State = "done"
	Failed    State = "failed"
	Cancelled State = "cancelled"
)

// Job is one row.
type Job struct {
	ID       string
	Kind     string
	Lane     string
	Subject  string
	Key      string
	Priority int
	State    State
	Payload  json.RawMessage
	Error    string
	Attempts int
}

// Decode unmarshals the payload.
func (j Job) Decode(v any) error { return json.Unmarshal(j.Payload, v) }

// Handler does one job. Returning nil marks it done; an error marks it
// failed, unless the job was stopped (cancelled) or the queue is shutting
// down (queued again, to resume on the next start).
type Handler func(ctx context.Context, j Job) error

// Migrations is the queue's one table.
func Migrations() []db.Migration {
	return []db.Migration{{Name: "jobs/1", SQL: `
CREATE TABLE jobs (
	id         TEXT PRIMARY KEY,
	kind       TEXT NOT NULL,
	lane       TEXT NOT NULL,
	subject    TEXT NOT NULL DEFAULT '',
	key        TEXT NOT NULL DEFAULT '',
	state      TEXT NOT NULL,
	payload    TEXT NOT NULL DEFAULT 'null',
	error      TEXT NOT NULL DEFAULT '',
	attempts   INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE INDEX jobs_lane_state ON jobs (lane, state, created_at);
CREATE INDEX jobs_subject ON jobs (subject);`},
		// Which of a lane's queued jobs starts first: the index follows the
		// scheduler's order.
		{Name: "jobs/2", SQL: `
ALTER TABLE jobs ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
DROP INDEX jobs_lane_state;
CREATE INDEX jobs_lane_state ON jobs (lane, state, priority DESC, created_at);`},
	}
}

type kind struct {
	lane    string
	handler Handler
}

type running struct {
	lane    string
	key     string
	cancel  context.CancelFunc
	stopped atomic.Bool
}

// Queue runs jobs. Configure lanes and kinds before Run.
type Queue struct {
	db  *sql.DB
	log *slog.Logger

	// conf guards the lanes and kinds apart from mu, and is never held
	// across a query: Enqueue runs inside its caller's transaction, and
	// waiting there on mu, which the scheduler holds while it writes, would
	// lock the two up until SQLite's busy timeout.
	conf  sync.RWMutex
	lanes map[string]int
	kinds map[string]kind

	mu      sync.Mutex
	running map[string]*running
	paused  bool
	wake    chan struct{}
	wg      sync.WaitGroup
	root    context.Context
}

func New(d *sql.DB, log *slog.Logger) *Queue {
	return &Queue{
		db:      d,
		log:     log,
		lanes:   map[string]int{},
		kinds:   map[string]kind{},
		running: map[string]*running{},
		wake:    make(chan struct{}, 1),
	}
}

// Lane declares a lane and how many of its jobs run at once.
func (q *Queue) Lane(name string, concurrency int) {
	q.conf.Lock()
	defer q.conf.Unlock()
	q.lanes[name] = concurrency
}

// Handle registers the handler for a kind, and the lane it runs in.
func (q *Queue) Handle(kindName, lane string, h Handler) {
	q.conf.Lock()
	defer q.conf.Unlock()
	if _, ok := q.lanes[lane]; !ok {
		panic("jobs: unknown lane " + lane)
	}
	q.kinds[kindName] = kind{lane, h}
}

// Execer is a *sql.DB or a *sql.Tx: enqueue inside the caller's
// transaction, so a row and the job that fills it appear together.
type Execer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

// Spec is what Enqueue needs.
type Spec struct {
	Kind    string
	Subject string // the row this job works on, for StopSubject
	Key     string // jobs sharing a key run one at a time
	// Priority orders a lane's queued jobs: higher starts first, and equals
	// start oldest first. Zero is the default; a running job is never
	// stopped for a higher one.
	Priority int
	Payload  any
}

// Enqueue adds a job. Call Wake after the transaction commits; a backstop
// poll finds it anyway, only later.
func (q *Queue) Enqueue(ctx context.Context, ex Execer, s Spec) (string, error) {
	q.conf.RLock()
	k, ok := q.kinds[s.Kind]
	q.conf.RUnlock()
	if !ok {
		return "", fmt.Errorf("jobs: unknown kind %q", s.Kind)
	}
	payload, err := json.Marshal(s.Payload)
	if err != nil {
		return "", err
	}
	id := uuid.NewString()
	now := db.Now()
	_, err = ex.ExecContext(ctx, `INSERT INTO jobs (id, kind, lane, subject, key, priority, state, payload, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?)`, id, s.Kind, k.lane, s.Subject, s.Key, s.Priority, string(payload), now, now)
	if err != nil {
		return "", err
	}
	q.Wake()
	return id, nil
}

// Wake nudges the scheduler.
func (q *Queue) Wake() {
	select {
	case q.wake <- struct{}{}:
	default:
	}
}

// Get reads one job.
func (q *Queue) Get(ctx context.Context, id string) (Job, error) {
	return scanJob(q.db.QueryRowContext(ctx, `SELECT id, kind, lane, subject, key, priority, state, payload, error, attempts FROM jobs WHERE id = ?`, id))
}

func scanJob(row interface{ Scan(...any) error }) (Job, error) {
	var j Job
	var payload string
	err := row.Scan(&j.ID, &j.Kind, &j.Lane, &j.Subject, &j.Key, &j.Priority, &j.State, &payload, &j.Error, &j.Attempts)
	j.Payload = json.RawMessage(payload)
	return j, err
}

// Stop ends a job: a queued one is cancelled on the spot, a running one
// has its context cancelled and settles as cancelled when it returns.
// Stopping a finished job does nothing.
func (q *Queue) Stop(ctx context.Context, id string) error {
	q.mu.Lock()
	if r, ok := q.running[id]; ok {
		r.stopped.Store(true)
		r.cancel()
		q.mu.Unlock()
		return nil
	}
	q.mu.Unlock()
	_, err := q.db.ExecContext(ctx, `UPDATE jobs SET state = 'cancelled', updated_at = ? WHERE id = ? AND state = 'queued'`, db.Now(), id)
	return err
}

// StopSubject stops every unfinished job working on subject.
func (q *Queue) StopSubject(ctx context.Context, subject string) error {
	rows, err := q.db.QueryContext(ctx, `SELECT id FROM jobs WHERE subject = ? AND state IN ('queued', 'running')`, subject)
	if err != nil {
		return err
	}
	var ids []string
	for rows.Next() {
		var id string
		rows.Scan(&id)
		ids = append(ids, id)
	}
	rows.Close()
	for _, id := range ids {
		if err := q.Stop(ctx, id); err != nil {
			return err
		}
	}
	return nil
}

// Retry queues a failed or cancelled job again, payload unchanged.
func (q *Queue) Retry(ctx context.Context, id string) error {
	res, err := q.db.ExecContext(ctx, `UPDATE jobs SET state = 'queued', error = '', updated_at = ? WHERE id = ? AND state IN ('failed', 'cancelled')`, db.Now(), id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotRetryable
	}
	q.Wake()
	return nil
}

var ErrNotRetryable = errors.New("jobs: only a failed or cancelled job can be retried")

type stopKey struct{}

// Stopped reports whether ctx was cancelled by Stop, as opposed to a
// shutdown. A handler uses it to record "Stopped" on its own row.
func Stopped(ctx context.Context) bool {
	r, ok := ctx.Value(stopKey{}).(*running)
	if !ok {
		return false
	}
	return r.stopped.Load()
}

// Pause lets running jobs go back to queued and starts nothing new until
// Resume. It returns once nothing runs. Reset uses it to wipe safely.
func (q *Queue) Pause() {
	q.mu.Lock()
	q.paused = true
	for _, r := range q.running {
		r.cancel()
	}
	q.mu.Unlock()
	q.wg.Wait()
}

func (q *Queue) Resume() {
	q.mu.Lock()
	q.paused = false
	q.mu.Unlock()
	q.Wake()
}

// poll is the backstop for a Wake that came before its commit.
const poll = 2 * time.Second

// Run schedules jobs until ctx ends, then waits for running handlers to
// return. Jobs left running by a crash go back to queued first.
func (q *Queue) Run(ctx context.Context) error {
	q.mu.Lock()
	q.root = ctx
	q.mu.Unlock()
	if _, err := q.db.ExecContext(ctx, `UPDATE jobs SET state = 'queued', updated_at = ? WHERE state = 'running'`, db.Now()); err != nil {
		return err
	}
	// Finished jobs are only history; a week of it is plenty.
	cutoff := db.At(time.Now().Add(-7 * 24 * time.Hour))
	q.db.ExecContext(ctx, `DELETE FROM jobs WHERE state IN ('done', 'cancelled') AND updated_at < ?`, cutoff)

	t := time.NewTicker(poll)
	defer t.Stop()
	for {
		if err := q.schedule(ctx); err != nil && ctx.Err() == nil {
			q.log.Error("jobs: schedule", "err", err)
		}
		select {
		case <-ctx.Done():
			q.wg.Wait()
			return nil
		case <-q.wake:
		case <-t.C:
		}
	}
}

func (q *Queue) schedule(ctx context.Context) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.paused || ctx.Err() != nil {
		return nil
	}
	q.conf.RLock()
	lanes := maps.Clone(q.lanes)
	q.conf.RUnlock()
	for lane, limit := range lanes {
		busy := map[string]bool{}
		n := 0
		for _, r := range q.running {
			if r.lane == lane {
				n++
				if r.key != "" {
					busy[r.key] = true
				}
			}
		}
		if n >= limit {
			continue
		}
		rows, err := q.db.QueryContext(ctx, `SELECT id, kind, lane, subject, key, priority, state, payload, error, attempts
			FROM jobs WHERE lane = ? AND state = 'queued' ORDER BY priority DESC, created_at, rowid`, lane)
		if err != nil {
			return err
		}
		var next []Job
		for rows.Next() && n+len(next) < limit {
			j, err := scanJob(rows)
			if err != nil {
				rows.Close()
				return err
			}
			if _, ok := q.running[j.ID]; ok || (j.Key != "" && busy[j.Key]) {
				continue
			}
			if j.Key != "" {
				busy[j.Key] = true
			}
			next = append(next, j)
		}
		rows.Close()
		for _, j := range next {
			if err := q.start(ctx, j); err != nil {
				return err
			}
		}
	}
	return nil
}

// start runs j. Called with q.mu held.
func (q *Queue) start(ctx context.Context, j Job) error {
	q.conf.RLock()
	k, ok := q.kinds[j.Kind]
	q.conf.RUnlock()
	if !ok {
		_, err := q.db.ExecContext(ctx, `UPDATE jobs SET state = 'failed', error = ?, updated_at = ? WHERE id = ?`,
			"no handler for "+j.Kind, db.Now(), j.ID)
		return err
	}
	if _, err := q.db.ExecContext(ctx, `UPDATE jobs SET state = 'running', attempts = attempts + 1, updated_at = ? WHERE id = ?`, db.Now(), j.ID); err != nil {
		return err
	}
	j.State = Running
	j.Attempts++
	r := &running{lane: j.Lane, key: j.Key}
	jctx, cancel := context.WithCancel(context.WithValue(ctx, stopKey{}, r))
	r.cancel = cancel
	q.running[j.ID] = r
	q.wg.Add(1)
	go func() {
		defer q.wg.Done()
		err := q.safely(jctx, k.handler, j)
		cancel()
		q.settle(j, r, err)
	}()
	return nil
}

// safely turns a handler panic into a failed job instead of a dead server.
func (q *Queue) safely(ctx context.Context, h Handler, j Job) (err error) {
	defer func() {
		if p := recover(); p != nil {
			q.log.Error("jobs: handler panicked", "kind", j.Kind, "id", j.ID, "panic", p)
			err = fmt.Errorf("panic: %v", p)
		}
	}()
	return h(ctx, j)
}

func (q *Queue) settle(j Job, r *running, err error) {
	q.mu.Lock()
	stopped := r.stopped.Load()
	paused := q.paused
	delete(q.running, j.ID)
	q.mu.Unlock()

	state, msg := Done, ""
	switch {
	case stopped:
		state = Cancelled
	case err != nil && (paused || q.rootDone()):
		state = Queued
	case err != nil:
		state, msg = Failed, err.Error()
		q.log.Warn("jobs: failed", "kind", j.Kind, "id", j.ID, "err", err)
	}
	// The root context may be gone: settle on a fresh one.
	if _, e := q.db.ExecContext(context.Background(), `UPDATE jobs SET state = ?, error = ?, updated_at = ? WHERE id = ?`,
		state, msg, db.Now(), j.ID); e != nil {
		q.log.Error("jobs: settle", "id", j.ID, "err", e)
	}
	q.Wake()
}

func (q *Queue) rootDone() bool {
	q.mu.Lock()
	defer q.mu.Unlock()
	return q.root != nil && q.root.Err() != nil
}
