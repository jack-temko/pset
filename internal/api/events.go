package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackt/pset/internal/engine"
)

// streamKeepAlive is how often a heartbeat keeps idle connections warm.
const streamKeepAlive = 15 * time.Second

// streamRetryHint is the reconnect delay handed to EventSource. The frontend
// runs its own backoff on top; this only sets the floor the browser uses when
// it retries a dropped stream by itself.
const streamRetryHint = time.Second

// handleEvents streams every job and step change on one connection. Job rows
// (with their steps folded in) and single step rows flow as they change, each
// stamped with the broker's sequence number on the SSE `id:` line. A client
// that names its last id resumes exactly where it stopped; one that cannot be
// resumed — a first connection, or a gap longer than the broker retains —
// gets a full snapshot first. Payloads are JSON discriminated by their "type"
// field, parsed like the ask stream.
func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeErrorMsg(w, http.StatusInternalServerError, "streaming is not supported here")
		return
	}

	// Subscribe before reading the snapshot so a change that lands in
	// between is only ever duplicated, never lost; folds are
	// last-write-wins by id.
	sub := s.eng.SubscribeEvents(resumeFrom(r))
	defer sub.Cancel()

	// The snapshot is read before any header goes out, so a database failure
	// is still an ordinary JSON error rather than an error event on a stream
	// the client has already committed to.
	var tasks []taskJSON
	if !sub.Resumed {
		views, err := s.eng.TaskViews(r.Context())
		if err != nil {
			writeError(w, err)
			return
		}
		tasks = make([]taskJSON, 0, len(views))
		for _, v := range views {
			tasks = append(tasks, taskJSONFromView(v))
		}
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(http.StatusOK)
	if _, err := fmt.Fprintf(w, "retry: %d\n\n", streamRetryHint.Milliseconds()); err != nil {
		return
	}
	flusher.Flush()

	// A snapshot describes the world as of the moment of subscribing, so it
	// carries that sequence number: a client that reconnects having seen only
	// the snapshot resumes from exactly there.
	if !sub.Resumed {
		if err := writeStreamEvent(w, flusher, sub.Seq, map[string]any{"type": "snapshot", "tasks": tasks}); err != nil {
			return
		}
	}
	for _, ev := range sub.Backlog {
		if err := writeEngineEvent(w, flusher, ev); err != nil {
			return
		}
	}

	ping := time.NewTicker(streamKeepAlive)
	defer ping.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-sub.Lost:
			// This connection fell too far behind to be fed in place. Ending
			// the response is the repair: the client comes straight back with
			// its last id and the broker replays what it missed.
			return
		case <-ping.C:
			// A real event, not an SSE comment. A comment keeps proxies from
			// timing the socket out, but it is invisible to EventSource — so a
			// client watching for silence cannot tell an idle-but-healthy
			// stream from a dead one. This is the signal it watches, and on a
			// resumed connection it is the only traffic an idle server sends.
			if _, err := w.Write([]byte("data: {\"type\":\"ping\"}\n\n")); err != nil {
				return
			}
			flusher.Flush()
		case ev, open := <-sub.Events:
			if !open {
				return
			}
			if err := writeEngineEvent(w, flusher, ev); err != nil {
				return
			}
		}
	}
}

// resumeFrom reads the client's resume point. EventSource only sends the
// Last-Event-ID header on reconnects it makes itself — a connection the
// frontend replaces by hand carries the same value as a query parameter, so
// both are honoured. Anything unparseable means start fresh.
func resumeFrom(r *http.Request) uint64 {
	raw := r.URL.Query().Get("after")
	if raw == "" {
		raw = r.Header.Get("Last-Event-ID")
	}
	n, err := strconv.ParseUint(strings.TrimSpace(raw), 10, 64)
	if err != nil {
		return 0
	}
	return n
}

// writeEngineEvent marshals one engine stream event onto the wire.
func writeEngineEvent(w http.ResponseWriter, flusher http.Flusher, ev engine.StreamEvent) error {
	var payload map[string]any
	switch ev.Type {
	case engine.StreamTask:
		payload = map[string]any{"type": "task", "task": taskJSONFromView(ev.Task)}
	case engine.StreamPhase:
		payload = map[string]any{"type": "phase", "phase": phaseJSONFrom(ev.Phase)}
	case engine.StreamTaskRemoved:
		payload = map[string]any{"type": "task_removed", "id": ev.ID}
	default:
		return nil
	}
	return writeStreamEvent(w, flusher, ev.Seq, payload)
}

// writeStreamEvent writes one identified event. A zero sequence number is an
// event with no place in the history and so carries no id.
func writeStreamEvent(w http.ResponseWriter, flusher http.Flusher, seq uint64, payload map[string]any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	var frame []byte
	if seq > 0 {
		frame = append(frame, "id: "...)
		frame = strconv.AppendUint(frame, seq, 10)
		frame = append(frame, '\n')
	}
	frame = append(frame, "data: "...)
	frame = append(frame, data...)
	frame = append(frame, '\n', '\n')
	if _, err := w.Write(frame); err != nil {
		return err
	}
	flusher.Flush()
	return nil
}
