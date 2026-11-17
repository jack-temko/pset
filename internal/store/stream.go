package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/httpx"
)

// Event is one event on the stream that is not logged: a document's block
// as it is written, a step's activity line. It reaches only the pages
// connected when it happens; the finished result arrives as a change.
type Event struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data,omitempty"`
}

// liveBuffer is how many unlogged events a slow page may fall behind by
// before the newest are dropped for it.
const liveBuffer = 256

// Publish sends an unlogged event to every connected page.
func (s *Store) Publish(typ string, data any) {
	raw, err := json.Marshal(data)
	if err != nil {
		panic(fmt.Sprintf("store: %s payload: %v", typ, err))
	}
	e := Event{Type: typ, Data: raw}
	s.mu.Lock()
	defer s.mu.Unlock()
	for ch := range s.live {
		select {
		case ch <- e:
		default: // lost, like any unlogged event on a reconnect
		}
	}
}

// wake tells every connected page the log has grown.
func (s *Store) wake() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for ch := range s.subs {
		select {
		case ch <- struct{}{}:
		default: // already woken
		}
	}
}

func (s *Store) subscribe() (<-chan struct{}, <-chan Event, func()) {
	wake, live := make(chan struct{}, 1), make(chan Event, liveBuffer)
	s.mu.Lock()
	s.subs[wake] = struct{}{}
	s.live[live] = struct{}{}
	s.mu.Unlock()
	return wake, live, func() {
		s.mu.Lock()
		delete(s.subs, wake)
		delete(s.live, live)
		s.mu.Unlock()
	}
}

// Latest is the seq of the newest change ever logged, purged or not: what a
// page that has just read everything is up to.
func (s *Store) Latest(ctx context.Context) (int64, error) {
	var n sql.NullInt64
	err := s.DB.QueryRowContext(ctx, `SELECT seq FROM sqlite_sequence WHERE name = 'changes'`).Scan(&n)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return 0, errs.Database.Wrap(err)
	}
	return n.Int64, nil
}

// ErrResync is Since's answer when the log no longer holds what came after
// the page's seq (it keeps a week), or never held it (a database made
// again): the page reads everything on screen again.
var ErrResync = fmt.Errorf("store: the log no longer reaches that far back")

// replayBatch is how many log rows one read of Since takes.
var replayBatch = 1000

// Since is every thing changed after seq, once each, oldest first, read
// from at most limit rows of the log: the caller asks again from the last
// notice's seq until it gets none.
//
// A thing changed several times in the batch is one notice: the newest
// change's op, actor and action, with After merged from them all. After is
// sent only when every change in the batch was the student's to columns the
// student makes, so patching from it leaves nothing stale; otherwise the
// page reads the thing again. A created thing is always read again.
func (s *Store) Since(ctx context.Context, seq int64, limit int) ([]change.Change, error) {
	// One read transaction, so a purge between the reads cannot open a gap
	// that is neither sent nor said. BEGIN by hand: the pool's own BeginTx
	// takes the write lock (_txlock=immediate), which a read must not.
	conn, err := s.DB.Conn(ctx)
	if err != nil {
		return nil, errs.Database.Wrap(err)
	}
	defer cleanup.Close(conn)
	if _, err := conn.ExecContext(ctx, `BEGIN`); err != nil {
		return nil, errs.Database.Wrap(err)
	}
	defer func() {
		_, err := conn.ExecContext(context.WithoutCancel(ctx), `ROLLBACK`)
		cleanup.Log("store: end a replay's read", err)
	}()
	var latest sql.NullInt64
	if err := conn.QueryRowContext(ctx, `SELECT (SELECT seq FROM sqlite_sequence WHERE name = 'changes')`).Scan(&latest); err != nil {
		return nil, errs.Database.Wrap(err)
	}
	if seq > latest.Int64 {
		return nil, ErrResync
	}
	if seq < latest.Int64 {
		var oldest sql.NullInt64
		if err := conn.QueryRowContext(ctx, `SELECT min(seq) FROM changes`).Scan(&oldest); err != nil {
			return nil, errs.Database.Wrap(err)
		}
		if !oldest.Valid || seq < oldest.Int64-1 {
			return nil, ErrResync
		}
	}
	rows, err := conn.QueryContext(ctx, `
SELECT seq, kind, res_id, ifnull(set_id, ''), ifnull(course_id, ''), op, actor, action_id, echo, after
FROM changes WHERE seq > ? ORDER BY seq LIMIT ?`, seq, limit)
	if err != nil {
		return nil, errs.Database.Wrap(err)
	}
	defer cleanup.Close(rows)

	type notice struct {
		change.Change
		after   map[string]json.RawMessage
		partial bool // a change in the batch can't be patched from values
	}
	byRes := map[string]*notice{}
	var order []*notice
	for rows.Next() {
		var c change.Change
		var echo bool
		var after sql.NullString
		if err := rows.Scan(&c.Seq, &c.Kind, &c.ID, &c.SetID, &c.CourseID, &c.Op, &c.Actor, &c.Action, &echo, &after); err != nil {
			return nil, errs.Database.Wrap(err)
		}
		key := string(c.Kind) + "\x00" + c.ID
		n, ok := byRes[key]
		if !ok {
			n = &notice{after: map[string]json.RawMessage{}}
			byRes[key] = n
		} else {
			order = removeNotice(order, n)
		}
		n.Change = c
		order = append(order, n)
		t, known := tableOf(string(c.Kind))
		if !known || echo || c.Op == change.OpCreated || c.Actor != change.ActorStudent || !after.Valid {
			n.partial = true
			continue
		}
		var vals map[string]json.RawMessage
		if err := json.Unmarshal([]byte(after.String), &vals); err != nil {
			return nil, errs.Data.Wrap(err)
		}
		for col, v := range vals {
			if !t.isStudent(col) {
				n.partial = true
				break
			}
			name, val, err := t.wire(col, v)
			if err != nil {
				return nil, err
			}
			n.after[name] = val
		}
	}
	if err := rows.Err(); err != nil {
		return nil, errs.Database.Wrap(err)
	}
	out := make([]change.Change, 0, len(order))
	for _, n := range order {
		c := n.Change
		if !n.partial && len(n.after) > 0 {
			raw, err := json.Marshal(n.after)
			if err != nil {
				return nil, errs.Data.Wrap(err)
			}
			c.After = raw
		}
		if c.Actor != change.ActorStudent {
			c.Action = ""
		}
		out = append(out, c)
	}
	return out, nil
}

func removeNotice[T comparable](s []T, v T) []T {
	for i, x := range s {
		if x == v {
			return append(s[:i], s[i+1:]...)
		}
	}
	return s
}

// wire is a logged column's name and value as the page has them.
func (t Table) wire(col string, v json.RawMessage) (string, json.RawMessage, error) {
	f, ok := t.Wire[col]
	if !ok {
		f = Field{Name: camel(col)}
	}
	isJSON := false
	for _, j := range t.JSON {
		isJSON = isJSON || j == col
	}
	if isJSON {
		// A JSON column's value is logged as its text: send what it holds.
		var text string
		if err := json.Unmarshal(v, &text); err == nil && json.Valid([]byte(text)) {
			v = json.RawMessage(text)
		}
	}
	if f.Value == nil {
		return f.Name, v, nil
	}
	var val any
	if err := json.Unmarshal(v, &val); err != nil {
		return "", nil, errs.Data.Wrap(err)
	}
	if n, ok := val.(float64); ok {
		val = n // JSON numbers decode as float64; truth reads them
	}
	raw, err := json.Marshal(f.Value(val))
	return f.Name, raw, errs.Data.Of(err)
}

// camel is a column's name on the wire: turned_in_at is turnedInAt.
func camel(col string) string {
	parts := strings.Split(col, "_")
	for i := 1; i < len(parts); i++ {
		if parts[i] == "" {
			continue
		}
		r := []rune(parts[i])
		r[0] = unicode.ToUpper(r[0])
		parts[i] = string(r)
	}
	return strings.Join(parts, "")
}

const keepAlive = 15 * time.Second

var noStreaming = errs.Define(errs.Entry{
	ID:     "store.no_streaming",
	What:   "PSet couldn't keep this page up to date.",
	Why:    "The connection can't stream updates.",
	Fix:    "Reload the page.",
	Status: http.StatusInternalServerError,
})

// Handler is GET /api/events: every change after the page's last seq (the
// Last-Event-ID header an EventSource sends again on reconnecting, or
// ?after= on the first connection), then each change as it is logged, and
// the unlogged events while connected. A change is sent with its seq as the
// event id; an unlogged event has none, so a reconnect resumes from the
// last change. A page that sends no seq starts from now.
func (s *Store) Handler(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		httpx.Fail(w, r, noStreaming.New())
		return
	}
	ctx := r.Context()
	wake, live, cancel := s.subscribe()
	defer cancel()

	// A seq the page sends, even 0 (it read an empty library), is where
	// to replay from; no seq at all starts from now.
	last, from := int64(-1), r.Header.Get("Last-Event-ID")
	if from == "" {
		from = r.URL.Query().Get("after")
	}
	if n, err := strconv.ParseInt(from, 10, 64); err == nil && n >= 0 {
		last = n
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)

	send := func(id int64, typ string, data any) bool {
		body, err := json.Marshal(struct {
			Type string `json:"type"`
			Data any    `json:"data,omitempty"`
		}{typ, data})
		if err != nil {
			return false
		}
		if id > 0 {
			_, err = fmt.Fprintf(w, "id: %d\ndata: %s\n\n", id, body)
		} else {
			_, err = fmt.Fprintf(w, "data: %s\n\n", body)
		}
		flusher.Flush()
		return err == nil
	}
	// replay sends everything after last; on a resync it starts the page
	// over from now.
	replay := func() bool {
		for {
			cs, err := s.Since(ctx, last, replayBatch)
			if errors.Is(err, ErrResync) {
				if last, err = s.Latest(ctx); err != nil {
					return false
				}
				return send(last, change.EventResync, nil)
			}
			if err != nil || len(cs) == 0 {
				return err == nil
			}
			for _, c := range cs {
				if !send(c.Seq, change.EventChange, c) {
					return false
				}
				last = max(last, c.Seq)
			}
		}
	}

	if last < 0 {
		var err error
		if last, err = s.Latest(ctx); err != nil {
			return
		}
		if _, err := fmt.Fprintf(w, "id: %d\nretry: 1000\n\n", last); err != nil {
			return
		}
		flusher.Flush()
	} else if !replay() {
		return
	}

	tick := time.NewTicker(keepAlive)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
			if _, err := fmt.Fprint(w, ": keep-alive\n\n"); err != nil {
				return
			}
			flusher.Flush()
		case <-wake:
			if !replay() {
				return
			}
		case e := <-live:
			if !send(0, e.Type, e.Data) {
				return
			}
		}
	}
}
