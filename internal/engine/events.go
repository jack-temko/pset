package engine

import (
	"fmt"
	"sync"
	"time"

	"github.com/jackt/pset/internal/store"
)

type EventKind string

const (
	EventStarted EventKind = "started" // a command began operating on something
	EventPhase   EventKind = "phase"   // a main state transition completed
	EventWarning EventKind = "warning" // anomaly the user should know about
)

// Event is a user-facing progress notification for CLI adapters.
type Event struct {
	Kind    EventKind
	Message string
}

func (e *Engine) notify(kind EventKind, format string, args ...any) {
	if e.progress != nil {
		e.progress(Event{Kind: kind, Message: fmt.Sprintf(format, args...)})
	}
}

// StreamEventType discriminates the SSE payloads of GET /api/events.
type StreamEventType string

const (
	StreamTask        StreamEventType = "task"         // a task-row change; carries the full task with phases
	StreamPhase       StreamEventType = "phase"        // a single phase-row change
	StreamTaskRemoved StreamEventType = "task_removed" // history pruned, or the book removed
)

// StreamEvent is one unit of the shared task event stream.
//
// Seq is the broker's monotonic position, assigned on publication. It is not
// part of the payload — adapters carry it out of band (the SSE `id:` line) so
// a reconnecting client can name the last thing it saw and be caught up from
// there instead of resynced from scratch.
type StreamEvent struct {
	Seq   uint64          `json:"-"`
	Type  StreamEventType `json:"type"`
	Task  *TaskView       `json:"task,omitempty"`
	Phase *Phase          `json:"phase,omitempty"`
	ID    string          `json:"id,omitempty"`
}

// phaseEmitState tracks what the broker last said about a phase, so progress
// and note churn coalesce while status transitions stay immediate.
type phaseEmitState struct {
	status  string
	emitted time.Time
	pending *Phase
	timer   *time.Timer
}

// eventBroker fans task and phase row changes out to SSE subscribers, and
// coalesces progress/note churn to one emission per interval per phase.
//
// Every published event gets a monotonic sequence number and is kept in a
// bounded history, so a subscriber that drops out — because it fell behind,
// or because its connection broke — can rejoin naming the last event it saw
// and receive exactly what it missed. Nothing is ever quietly lost: a
// subscriber that cannot be caught up is told to resync instead.
type eventBroker struct {
	mu        sync.Mutex
	subs      map[*subscriber]struct{}
	lastPhase map[string]*phaseEmitState
	seq       uint64
	history   []StreamEvent // oldest first, at most historyLimit entries
}

func newEventBroker() *eventBroker {
	return &eventBroker{subs: map[*subscriber]struct{}{}, lastPhase: map[string]*phaseEmitState{}}
}

// streamBuffer is how far a subscriber may fall behind before the broker
// stops waiting for it.
const streamBuffer = 128

// historyLimit is how many recent events stay replayable. It is deliberately
// far larger than streamBuffer: a subscriber dropped for falling behind must
// still be resumable when it comes back a moment later, so the history has to
// outreach the buffer that overflowed.
const historyLimit = 1024

// subscriber is one live consumer of the stream.
type subscriber struct {
	ch   chan StreamEvent
	lost chan struct{}
	once sync.Once
}

// drop tells a subscriber it has missed an event. The event channel is left
// open — closing it from the publishing side would race the reader — and the
// adapter watches lost instead, ending the response so the client comes back
// with its last id and is replayed from the history.
func (s *subscriber) drop() { s.once.Do(func() { close(s.lost) }) }

// Subscription is one adapter's handle on the task event stream.
type Subscription struct {
	// Events carries live changes; Lost closes when this subscriber fell too
	// far behind to be fed in place and should reconnect to resume.
	Events <-chan StreamEvent
	Lost   <-chan struct{}
	// Backlog is everything published after the requested resume point,
	// oldest first. It is empty unless Resumed is true.
	Backlog []StreamEvent
	// Resumed reports that the resume point was still in the history, so the
	// backlog is complete. When it is false the caller owes the client a full
	// snapshot before anything else.
	Resumed bool
	// Seq is the broker's position at the moment of subscribing — the id a
	// snapshot is stamped with, because a snapshot describes the world as of
	// exactly that point.
	Seq    uint64
	Cancel func()
}

// subscribe joins the stream, asking to pick up after event number `after`
// (0 to start fresh). Registration and the history read happen under one
// lock, so no event can slip between the backlog and the live channel.
func (b *eventBroker) subscribe(after uint64) *Subscription {
	sub := &subscriber{ch: make(chan StreamEvent, streamBuffer), lost: make(chan struct{})}

	b.mu.Lock()
	b.subs[sub] = struct{}{}
	backlog, resumed := b.since(after)
	seq := b.seq
	b.mu.Unlock()

	return &Subscription{
		Events:  sub.ch,
		Lost:    sub.lost,
		Backlog: backlog,
		Resumed: resumed,
		Seq:     seq,
		Cancel: func() {
			b.mu.Lock()
			delete(b.subs, sub)
			b.mu.Unlock()
		},
	}
}

// since returns everything published after `after`, and whether the history
// actually reached back that far. A resume point of zero, one from the future
// (a restarted server counts from zero again), or one older than the history
// retains cannot be honoured — the caller resyncs instead of being handed a
// gap it cannot see.
//
// Callers hold b.mu.
func (b *eventBroker) since(after uint64) ([]StreamEvent, bool) {
	if after == 0 || after > b.seq {
		return nil, false
	}
	if after == b.seq {
		return nil, true
	}
	if len(b.history) == 0 || b.history[0].Seq > after+1 {
		return nil, false
	}
	out := make([]StreamEvent, 0, b.seq-after)
	for _, ev := range b.history {
		if ev.Seq > after {
			out = append(out, ev)
		}
	}
	return out, true
}

// fan numbers one event, records it for replay, and delivers it to every
// subscriber. A subscriber whose buffer is full is dropped rather than left
// silently missing an event: it reconnects and the history fills the gap.
//
// Callers hold b.mu.
func (b *eventBroker) fan(ev StreamEvent) {
	b.seq++
	ev.Seq = b.seq

	b.history = append(b.history, ev)
	if len(b.history) > historyLimit {
		// Reuse the array rather than re-slicing off the front forever.
		b.history = append(b.history[:0], b.history[len(b.history)-historyLimit:]...)
	}

	for sub := range b.subs {
		select {
		case sub.ch <- ev:
		default:
			sub.drop()
		}
	}
}

func (b *eventBroker) publishTask(view *TaskView) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.fan(StreamEvent{Type: StreamTask, Task: view})
}

func (b *eventBroker) publishRemoved(id string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.fan(StreamEvent{Type: StreamTaskRemoved, ID: id})
}

func (b *eventBroker) publishPhase(ph *Phase) {
	b.mu.Lock()
	defer b.mu.Unlock()

	state := b.lastPhase[ph.ID]
	if state == nil {
		state = &phaseEmitState{}
		b.lastPhase[ph.ID] = state
	}
	if state.status != ph.Status {
		if state.timer != nil {
			state.timer.Stop()
			state.timer = nil
			state.pending = nil
		}
		state.status = ph.Status
		state.emitted = time.Now()
		b.fan(StreamEvent{Type: StreamPhase, Phase: ph})
		if ph.Status == store.PhaseDone || ph.Status == store.PhaseFailed {
			// A phase that settled may still be reopened by a retry, so the
			// timer is dropped but the entry is not left behind either.
			delete(b.lastPhase, ph.ID)
		}
		return
	}
	if time.Since(state.emitted) >= phaseCoalesceInterval {
		state.emitted = time.Now()
		b.fan(StreamEvent{Type: StreamPhase, Phase: ph})
		return
	}
	// Churn: hold the row and flush the latest state when the interval is up.
	state.pending = ph
	if state.timer == nil {
		delay := phaseCoalesceInterval - time.Since(state.emitted)
		state.timer = time.AfterFunc(delay, func() {
			b.mu.Lock()
			defer b.mu.Unlock()
			state.timer = nil
			if state.pending == nil {
				return
			}
			state.emitted = time.Now()
			b.fan(StreamEvent{Type: StreamPhase, Phase: state.pending})
			state.pending = nil
		})
	}
}
