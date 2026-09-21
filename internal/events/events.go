// Package events is the in-process bus and the one SSE stream the UI
// listens on. Features publish small typed events naming what changed; the
// UI patches or invalidates exactly those queries. The bus knows no event
// types: each feature declares its own in its wire.go.
package events

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"
)

// Event is one message on the stream. Data is the feature's payload.
type Event struct {
	ID   uint64          `json:"id"`
	Type string          `json:"type"`
	Data json.RawMessage `json:"data,omitempty"`
}

// Reset is sent when a reconnecting client missed more than the ring
// holds: it should refetch everything.
const Reset = "reset"

// Publisher is what a feature needs from the bus.
type Publisher interface {
	Publish(typ string, data any)
}

// ringSize bounds replay. A turn's deltas are the chattiest events, and a
// few thousand covers a reload mid-answer comfortably.
const ringSize = 4096

// subBuffer is how far a client may fall behind before it is dropped. A
// dropped client reconnects and replays from the ring, so nothing is lost.
const subBuffer = 512

// Bus fans events out to subscribers and remembers the last ringSize.
type Bus struct {
	mu   sync.Mutex
	next uint64
	ring []Event
	subs map[chan Event]struct{}
}

func NewBus() *Bus {
	return &Bus{next: 1, subs: map[chan Event]struct{}{}}
}

// Publish sends an event to every subscriber. A payload that can't be
// encoded is a programming error and panics in tests, not in the field:
// every payload is a wire struct.
func (b *Bus) Publish(typ string, data any) {
	raw, err := json.Marshal(data)
	if err != nil {
		panic(fmt.Sprintf("events: %s payload: %v", typ, err))
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	e := Event{ID: b.next, Type: typ, Data: raw}
	b.next++
	if len(b.ring) == ringSize {
		copy(b.ring, b.ring[1:])
		b.ring = b.ring[:ringSize-1]
	}
	b.ring = append(b.ring, e)
	for ch := range b.subs {
		select {
		case ch <- e:
		default:
			// Too slow: let it go and catch up by replay.
			delete(b.subs, ch)
			close(ch)
		}
	}
}

// Subscribe returns a channel of events after lastID, the replay first. If
// events after lastID have already left the ring, the first event is Reset.
// lastID 0 means "from now".
func (b *Bus) Subscribe(lastID uint64) (<-chan Event, func()) {
	b.mu.Lock()
	defer b.mu.Unlock()
	ch := make(chan Event, subBuffer+ringSize)
	if lastID > 0 {
		oldest := b.next
		if len(b.ring) > 0 {
			oldest = b.ring[0].ID
		}
		if lastID+1 < oldest {
			ch <- Event{ID: lastID, Type: Reset}
		}
		for _, e := range b.ring {
			if e.ID > lastID {
				ch <- e
			}
		}
	}
	b.subs[ch] = struct{}{}
	cancel := func() {
		b.mu.Lock()
		defer b.mu.Unlock()
		if _, ok := b.subs[ch]; ok {
			delete(b.subs, ch)
			close(ch)
		}
	}
	return ch, cancel
}

// keepAlive stops proxies and browsers from timing out a quiet stream.
const keepAlive = 15 * time.Second

// Handler serves GET /api/events. EventSource sends Last-Event-ID itself
// on reconnect, so replay needs nothing from the client code.
func (b *Bus) Handler(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	var last uint64
	if v := r.Header.Get("Last-Event-ID"); v != "" {
		last, _ = strconv.ParseUint(v, 10, 64)
	}
	ch, cancel := b.Subscribe(last)
	defer cancel()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	// Tell a fresh client where "now" is, so its first reconnect replays
	// from here rather than from nothing.
	if last == 0 {
		b.mu.Lock()
		now := b.next - 1
		b.mu.Unlock()
		fmt.Fprintf(w, "id: %d\nretry: 1000\n\n", now)
	}
	flusher.Flush()

	tick := time.NewTicker(keepAlive)
	defer tick.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-tick.C:
			fmt.Fprint(w, ": keep-alive\n\n")
			flusher.Flush()
		case e, ok := <-ch:
			if !ok {
				return
			}
			body, _ := json.Marshal(struct {
				Type string          `json:"type"`
				Data json.RawMessage `json:"data,omitempty"`
			}{e.Type, e.Data})
			fmt.Fprintf(w, "id: %d\ndata: %s\n\n", e.ID, body)
			flusher.Flush()
		}
	}
}
