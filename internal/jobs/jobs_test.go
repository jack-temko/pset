package jobs

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackt/pset/internal/db"
)

func newQueue(t *testing.T) *Queue {
	t.Helper()
	d, err := db.Open(filepath.Join(t.TempDir(), "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	if err := db.Migrate(context.Background(), d, Migrations()); err != nil {
		t.Fatal(err)
	}
	return New(d, slog.New(slog.NewTextHandler(io.Discard, nil)))
}

func run(t *testing.T, q *Queue) context.CancelFunc {
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { q.Run(ctx); close(done) }()
	t.Cleanup(func() { cancel(); <-done })
	return cancel
}

func waitState(t *testing.T, q *Queue, id string, want State) Job {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		j, err := q.Get(context.Background(), id)
		if err == nil && j.State == want {
			return j
		}
		time.Sleep(5 * time.Millisecond)
	}
	j, _ := q.Get(context.Background(), id)
	t.Fatalf("job %s: state %s, want %s", id, j.State, want)
	return j
}

func TestLaneRunsInOrderOneAtATime(t *testing.T) {
	q := newQueue(t)
	q.Lane("import", 1)
	var mu sync.Mutex
	var order []int
	var live, peak atomic.Int32
	q.Handle("imp", "import", func(ctx context.Context, j Job) error {
		n := live.Add(1)
		if n > peak.Load() {
			peak.Store(n)
		}
		var p struct{ N int }
		j.Decode(&p)
		time.Sleep(10 * time.Millisecond)
		mu.Lock()
		order = append(order, p.N)
		mu.Unlock()
		live.Add(-1)
		return nil
	})
	ctx := context.Background()
	var last string
	for i := range 4 {
		last, _ = q.Enqueue(ctx, q.db, Spec{Kind: "imp", Payload: map[string]int{"N": i}})
	}
	run(t, q)
	waitState(t, q, last, Done)
	if peak.Load() != 1 {
		t.Fatalf("peak concurrency %d", peak.Load())
	}
	for i, n := range order {
		if n != i {
			t.Fatalf("order %v", order)
		}
	}
}

func TestHigherPriorityStartsFirstThenOldest(t *testing.T) {
	q := newQueue(t)
	q.Lane("l", 1)
	var mu sync.Mutex
	var order []string
	q.Handle("k", "l", func(ctx context.Context, j Job) error {
		var p struct{ Name string }
		j.Decode(&p)
		mu.Lock()
		order = append(order, p.Name)
		mu.Unlock()
		return nil
	})
	ctx := context.Background()
	var last string
	for _, s := range []struct {
		name     string
		priority int
	}{{"low-a", 0}, {"high-a", 1}, {"low-b", 0}, {"high-b", 1}} {
		last, _ = q.Enqueue(ctx, q.db, Spec{Kind: "k", Priority: s.priority, Payload: map[string]string{"Name": s.name}})
	}
	if j, _ := q.Get(ctx, last); j.Priority != 1 {
		t.Fatalf("priority stored as %d", j.Priority)
	}
	run(t, q)
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		mu.Lock()
		n := len(order)
		mu.Unlock()
		if n == 4 {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
	mu.Lock()
	defer mu.Unlock()
	if got := strings.Join(order, ","); got != "high-a,high-b,low-a,low-b" {
		t.Fatalf("order %s", got)
	}
}

func TestEnqueueInATransactionNeverWaitsOnTheScheduler(t *testing.T) {
	q := newQueue(t)
	q.Lane("l", 1)
	q.Handle("k", "l", func(ctx context.Context, j Job) error { return nil })
	ctx := context.Background()
	run(t, q)
	// Once a job has run, the scheduler is past its start-up writes.
	warm, _ := q.Enqueue(ctx, q.db, Spec{Kind: "k"})
	waitState(t, q, warm, Done)
	q.Pause()
	first, _ := q.Enqueue(ctx, q.db, Spec{Kind: "k"})
	// The caller's transaction takes the write lock, then the scheduler
	// wakes to start the first job and waits on that lock.
	tx, err := q.db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tx.ExecContext(ctx, `UPDATE jobs SET updated_at = updated_at`); err != nil {
		t.Fatal(err)
	}
	q.Resume()
	time.Sleep(50 * time.Millisecond)
	start := time.Now()
	second, err := q.Enqueue(ctx, tx, Spec{Kind: "k"})
	if err != nil {
		t.Fatal(err)
	}
	if waited := time.Since(start); waited > time.Second {
		t.Fatalf("Enqueue waited %v on the scheduler", waited)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	waitState(t, q, first, Done)
	waitState(t, q, second, Done)
}

func TestWakeAfterCommitStartsTheJobWithoutWaitingForThePoll(t *testing.T) {
	q := newQueue(t)
	q.Lane("l", 1)
	started := make(chan time.Time, 1)
	q.Handle("k", "l", func(ctx context.Context, j Job) error {
		started <- time.Now()
		return nil
	})
	ctx := context.Background()
	run(t, q)
	// Once a job has run, the scheduler is past its start-up writes.
	warm, _ := q.Enqueue(ctx, q.db, Spec{Kind: "k"})
	waitState(t, q, warm, Done)
	<-started
	// Enqueue's own wake comes before the commit: the scheduler looks,
	// finds nothing yet, and goes back to waiting.
	tx, err := q.db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := q.Enqueue(ctx, tx, Spec{Kind: "k"}); err != nil {
		t.Fatal(err)
	}
	time.Sleep(100 * time.Millisecond)
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	committed := time.Now()
	q.Wake()
	select {
	case at := <-started:
		if waited := at.Sub(committed); waited > poll/4 {
			t.Fatalf("started %v after the commit", waited)
		}
	case <-time.After(2 * poll):
		t.Fatal("never started")
	}
}

func TestSameKeyNeverRunsTogether(t *testing.T) {
	q := newQueue(t)
	q.Lane("turn", 8)
	var live, peak atomic.Int32
	q.Handle("t", "turn", func(ctx context.Context, j Job) error {
		n := live.Add(1)
		if n > peak.Load() {
			peak.Store(n)
		}
		time.Sleep(20 * time.Millisecond)
		live.Add(-1)
		return nil
	})
	ctx := context.Background()
	var ids []string
	for range 3 {
		id, _ := q.Enqueue(ctx, q.db, Spec{Kind: "t", Key: "book-a"})
		ids = append(ids, id)
	}
	run(t, q)
	for _, id := range ids {
		waitState(t, q, id, Done)
	}
	if peak.Load() != 1 {
		t.Fatalf("same key ran %d at once", peak.Load())
	}
}

func TestStopRunningCancelsAndHandlerSeesIt(t *testing.T) {
	q := newQueue(t)
	q.Lane("l", 1)
	started := make(chan struct{})
	var sawStop atomic.Bool
	q.Handle("k", "l", func(ctx context.Context, j Job) error {
		close(started)
		<-ctx.Done()
		sawStop.Store(Stopped(ctx))
		return ctx.Err()
	})
	id, _ := q.Enqueue(context.Background(), q.db, Spec{Kind: "k"})
	run(t, q)
	<-started
	q.Stop(context.Background(), id)
	waitState(t, q, id, Cancelled)
	if !sawStop.Load() {
		t.Fatal("handler did not see Stopped")
	}
}

func TestStopQueuedAndRetry(t *testing.T) {
	q := newQueue(t)
	q.Lane("l", 1)
	var runs atomic.Int32
	q.Handle("k", "l", func(ctx context.Context, j Job) error { runs.Add(1); return nil })
	ctx := context.Background()
	id, _ := q.Enqueue(ctx, q.db, Spec{Kind: "k"})
	q.Stop(ctx, id)
	waitState(t, q, id, Cancelled)
	if err := q.Retry(ctx, id); err != nil {
		t.Fatal(err)
	}
	run(t, q)
	waitState(t, q, id, Done)
	if err := q.Retry(ctx, id); !errors.Is(err, ErrNotRetryable) {
		t.Fatalf("retry done job: %v", err)
	}
}

func TestFailureRecordsErrorAndPanicIsAFailure(t *testing.T) {
	q := newQueue(t)
	q.Lane("l", 2)
	q.Handle("bad", "l", func(ctx context.Context, j Job) error { return errors.New("boom") })
	q.Handle("panic", "l", func(ctx context.Context, j Job) error { panic("oops") })
	ctx := context.Background()
	a, _ := q.Enqueue(ctx, q.db, Spec{Kind: "bad"})
	b, _ := q.Enqueue(ctx, q.db, Spec{Kind: "panic"})
	run(t, q)
	if j := waitState(t, q, a, Failed); j.Error != "boom" {
		t.Fatalf("error = %q", j.Error)
	}
	waitState(t, q, b, Failed)
}

func TestShutdownRequeuesAndRestartResumes(t *testing.T) {
	q := newQueue(t)
	q.Lane("l", 1)
	started := make(chan struct{}, 2)
	var finish atomic.Bool
	q.Handle("k", "l", func(ctx context.Context, j Job) error {
		started <- struct{}{}
		if finish.Load() {
			return nil
		}
		<-ctx.Done()
		return ctx.Err()
	})
	id, _ := q.Enqueue(context.Background(), q.db, Spec{Kind: "k"})
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { q.Run(ctx); close(done) }()
	<-started
	cancel()
	<-done
	if j, _ := q.Get(context.Background(), id); j.State != Queued {
		t.Fatalf("after shutdown: %s", j.State)
	}
	finish.Store(true)
	run(t, q)
	if j := waitState(t, q, id, Done); j.Attempts != 2 {
		t.Fatalf("attempts = %d", j.Attempts)
	}
}

func TestPauseRequeuesUntilResume(t *testing.T) {
	q := newQueue(t)
	q.Lane("l", 1)
	started := make(chan struct{}, 4)
	var finish atomic.Bool
	q.Handle("k", "l", func(ctx context.Context, j Job) error {
		started <- struct{}{}
		if finish.Load() {
			return nil
		}
		<-ctx.Done()
		return ctx.Err()
	})
	id, _ := q.Enqueue(context.Background(), q.db, Spec{Kind: "k"})
	run(t, q)
	<-started
	q.Pause()
	if j, _ := q.Get(context.Background(), id); j.State != Queued {
		t.Fatalf("after pause: %s", j.State)
	}
	finish.Store(true)
	q.Resume()
	waitState(t, q, id, Done)
}
