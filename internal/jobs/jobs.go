// Package jobs is PSet's durable work queue. A job is a kind, a lane, a
// subject and a JSON payload; features register a handler per kind and
// publish their own domain events while it runs. The queue has no notion of
// what the UI shows: it never publishes anything.
//
// Lanes bound concurrency. A job may also carry a key, and two jobs with
// the same key never run at once in a lane (one Ask turn per book). A
// job's priority orders its lane's queue: higher starts first, oldest
// first among equals (homework's finds start ahead of its guides). A kind
// whose handler saves its work as it goes can be marked Resumable: a run
// of it gives its slot up to a higher-priority job and resumes later (a
// scan's reading steps aside for a digital book).
package jobs

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"slices"
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
	lane      string
	handler   Handler
	resumable bool
}

type running struct {
	id, kind  string
	lane      string
	key       string
	priority  int
	resumable bool
	cancel    context.CancelFunc
	stopped   atomic.Bool
	// preempted is set when the job is interrupted for a higher-priority
	// one: it settles back to queued, and its slot is promised.
	preempted atomic.Bool
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
	q.kinds[kindName] = kind{lane: lane, handler: h}
}

// Resumable marks a kind whose handler saves its work as it goes, so a
// run can give its slot up to a higher-priority job in its lane: its
// context is cancelled, it settles back to queued, oldest among its
// equals, and resumes where it stopped. The handler treats that as it
// treats a shutdown.
func (q *Queue) Resumable(kindName string) {
	q.conf.Lock()
	defer q.conf.Unlock()
	k, ok := q.kinds[kindName]
	if !ok {
		panic("jobs: unknown kind " + kindName)
	}
	k.resumable = true
	q.kinds[kindName] = k
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
	// start oldest first. Zero is the default. A running job gives way to a
	// higher one only if its kind is Resumable.
	Priority int
	Payload  any
}

// Enqueue adds a job. It wakes the scheduler, which is enough on a *sql.DB;
// inside a transaction the scheduler can't see the job yet, so call Wake
// once it commits, or the job waits for the backstop poll.
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
		// What a full lane can give up: resumable runs not yet asked to,
		// and the slots of interrupted ones still settling.
		var yielding []*running
		promised := 0
		for _, r := range q.running {
			if r.lane != lane {
				continue
			}
			n++
			if r.key != "" {
				busy[r.key] = true
			}
			switch {
			case r.preempted.Load():
				promised++
			case r.resumable:
				yielding = append(yielding, r)
			}
		}
		if n >= limit && len(yielding) == 0 {
			continue
		}
		rows, err := q.db.QueryContext(ctx, `SELECT id, kind, lane, subject, key, priority, state, payload, error, attempts
			FROM jobs WHERE lane = ? AND state = 'queued' ORDER BY priority DESC, created_at, rowid`, lane)
		if err != nil {
			return err
		}
		var next []Job
		for rows.Next() {
			j, err := scanJob(rows)
			if err != nil {
				rows.Close()
				return err
			}
			if _, ok := q.running[j.ID]; ok || (j.Key != "" && busy[j.Key]) {
				continue
			}
			if n+len(next) < limit {
				if j.Key != "" {
					busy[j.Key] = true
				}
				next = append(next, j)
				continue
			}
			// The lane is full. The queue runs highest first, so once a job
			// can't take a slot, none after it can.
			if promised > 0 {
				promised-- // an interrupted job's slot is already this one's
				continue
			}
			v := lowest(yielding)
			if v == nil || v.priority >= j.Priority {
				break
			}
			v.preempted.Store(true)
			v.cancel()
			yielding = slices.DeleteFunc(yielding, func(r *running) bool { return r == v })
			q.log.Debug("jobs: interrupted", "kind", v.kind, "id", v.id, "for", j.Kind)
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

// lowest is the running job with the lowest priority, or nil.
func lowest(rs []*running) *running {
	var out *running
	for _, r := range rs {
		if out == nil || r.priority < out.priority {
			out = r
		}
	}
	return out
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
	r := &running{id: j.ID, kind: j.Kind, lane: j.Lane, key: j.Key, priority: j.Priority, resumable: k.resumable}
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
	// Paused, interrupted or shut down: it runs again later.
	again := q.paused || r.preempted.Load()
	delete(q.running, j.ID)
	q.mu.Unlock()

	state, msg := Done, ""
	switch {
	case stopped:
		state = Cancelled
	case err != nil && (again || q.rootDone()):
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
