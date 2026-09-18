package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// The tests here are the wire contract: the task snapshot's shape and
// ordering, the SSE stream's first events, and the stop/retry rules.

// importSample imports one testdata book and drains the queue.
func (e *testEnv) importSample(name string) apiBook {
	e.t.Helper()
	rec := do(e.t, e.handler, "POST", "/api/import", map[string]any{"path": samplePath(name)})
	if rec.Code != http.StatusAccepted && rec.Code != http.StatusOK {
		e.t.Fatalf("import %s: status = %d, body %s", name, rec.Code, rec.Body.String())
	}
	if !e.started {
		if err := e.runner.Drain(e.t.Context()); err != nil {
			e.t.Fatalf("drain after importing %s: %v", name, err)
		}
		return e.firstBook()
	}
	// A live runner works in the background: wait for the preparation to
	// settle rather than racing it.
	deadline := time.Now().Add(120 * time.Second)
	for time.Now().Before(deadline) {
		settled := true
		for _, task := range e.tasks() {
			if task.Status == "queued" || task.Status == "running" {
				settled = false
			}
		}
		if settled && len(e.tasks()) > 0 {
			return e.firstBook()
		}
		time.Sleep(20 * time.Millisecond)
	}
	e.t.Fatalf("importing %s never settled", name)
	return apiBook{}
}

func (e *testEnv) firstBook() apiBook {
	e.t.Helper()
	rec := do(e.t, e.handler, "GET", "/api/books", nil)
	var body struct {
		Books []apiBook `json:"books"`
	}
	decode(e.t, rec, &body)
	if len(body.Books) == 0 {
		e.t.Fatal("the library is empty")
	}
	return body.Books[0]
}

func (e *testEnv) getTask(id string) apiTask {
	e.t.Helper()
	rec := do(e.t, e.handler, "GET", "/api/tasks/"+id, nil)
	if rec.Code != http.StatusOK {
		e.t.Fatalf("get task %s: status = %d", id, rec.Code)
	}
	var body struct {
		Task apiTask `json:"task"`
	}
	decode(e.t, rec, &body)
	return body.Task
}

func (e *testEnv) tasks() []apiTask {
	e.t.Helper()
	rec := do(e.t, e.handler, "GET", "/api/tasks", nil)
	if rec.Code != http.StatusOK {
		e.t.Fatalf("list tasks: status = %d", rec.Code)
	}
	var body struct {
		Tasks []apiTask `json:"tasks"`
	}
	decode(e.t, rec, &body)
	return body.Tasks
}

// TestPrepareTaskWireShape pins what one preparation looks like on the wire:
// a flat, four-phase plan with no children and no retry bookkeeping, and a
// book whose readiness is reported as counts rather than as flags.
func TestPrepareTaskWireShape(t *testing.T) {
	env := newTestEnvWithoutRunner(t)
	requirePoppler(t)
	requirePdftohtml(t)
	book := env.importSample("sample-digital.pdf")

	tasks := env.tasks()
	if len(tasks) != 1 {
		t.Fatalf("tasks = %d, want one preparation", len(tasks))
	}
	task := tasks[0]
	if task.Kind != "prepare" {
		t.Errorf("kind = %q, want prepare", task.Kind)
	}
	if task.Status != "done" {
		t.Fatalf("status = %q/%v, want done", task.Status, task.Error)
	}
	if task.Title != book.Title {
		t.Errorf("title = %q, want the book's title %q", task.Title, book.Title)
	}
	if task.FailKind != nil {
		t.Errorf("failKind = %v, want null on a task that did not fail", *task.FailKind)
	}
	if task.Retryable {
		t.Error("a finished task offers no retry")
	}

	want := []string{"examine", "read", "index", "search"}
	if len(task.Phases) != len(want) {
		t.Fatalf("phases = %v, want %v", task.phaseKeys(), want)
	}
	for i, key := range want {
		if task.Phases[i].Key != key {
			t.Errorf("phase %d = %q, want %q", i, task.Phases[i].Key, key)
		}
		if task.Phases[i].Status != "done" {
			t.Errorf("phase %s = %q, want done", key, task.Phases[i].Status)
		}
	}
	// A phase with nothing to do is done with a note, not a fourth outcome.
	if read := task.phase(t, "read"); read.Note == "" {
		t.Error("the read phase of a digital book must say why it had nothing to do")
	}

	// Readiness travels as counts, so the client can say what is missing
	// without asking a second time.
	if !book.Ready {
		t.Fatalf("book = %+v, want ready after a complete preparation", book.Readiness)
	}
	if book.Readiness.Missing != "" {
		t.Errorf("missing = %q, want empty on a ready book", book.Readiness.Missing)
	}
	if book.Readiness.PagesStored != book.PageCount || book.Readiness.Vectors != book.PageCount {
		t.Errorf("readiness = %+v, want a page and a vector for each of %d pages",
			book.Readiness, book.PageCount)
	}
	if book.Readiness.PagesFailed != 0 || len(book.FailedPages) != 0 {
		t.Errorf("failed pages = %+v, want none", book.FailedPages)
	}
}

// TestStopAndRetryRules pins the action contract: stopping keeps the work and
// rests the task, retrying resumes it, and neither is offered where it would
// be a lie.
func TestStopAndRetryRules(t *testing.T) {
	env := newTestEnvWithoutRunner(t)
	requirePoppler(t)
	requirePdftohtml(t)
	env.importSample("sample-digital.pdf")

	finished := env.tasks()[0]

	t.Run("a finished task refuses a stop", func(t *testing.T) {
		if rec := do(t, env.handler, "POST", "/api/tasks/"+finished.ID+"/stop", nil); rec.Code != http.StatusConflict {
			t.Errorf("stop finished: status = %d, want 409", rec.Code)
		}
	})

	t.Run("a queued task refuses a retry and accepts a stop", func(t *testing.T) {
		rec := do(t, env.handler, "POST", "/api/import", map[string]any{"path": samplePath("sample-flat.pdf")})
		if rec.Code != http.StatusAccepted {
			t.Fatalf("import: status = %d, body %s", rec.Code, rec.Body.String())
		}
		var body struct {
			Task apiTask `json:"task"`
		}
		decode(t, rec, &body)
		id := body.Task.ID

		if rec := do(t, env.handler, "POST", "/api/tasks/"+id+"/retry", nil); rec.Code != http.StatusConflict {
			t.Errorf("retry queued: status = %d, want 409", rec.Code)
		}
		if rec := do(t, env.handler, "POST", "/api/tasks/"+id+"/stop", nil); rec.Code != http.StatusAccepted {
			t.Fatalf("stop queued: status = %d", rec.Code)
		}
		stopped := env.getTask(id)
		if stopped.Status != "paused" {
			t.Fatalf("stopped task = %q, want paused", stopped.Status)
		}
		// Stopping keeps the work, so a resume is honest.
		if !stopped.Retryable {
			t.Error("a paused task must offer a resume")
		}

		// Retry resumes it and it runs through.
		if rec := do(t, env.handler, "POST", "/api/tasks/"+id+"/retry", nil); rec.Code != http.StatusAccepted {
			t.Fatalf("retry paused: status = %d, body %s", rec.Code, rec.Body.String())
		}
		if err := env.runner.Drain(t.Context()); err != nil {
			t.Fatalf("drain: %v", err)
		}
		if done := env.getTask(id); done.Status != "done" {
			t.Fatalf("resumed task = %q/%v, want done", done.Status, done.Error)
		}
	})

	t.Run("unknown tasks are 404s", func(t *testing.T) {
		if rec := do(t, env.handler, "POST", "/api/tasks/nope/retry", nil); rec.Code != http.StatusNotFound {
			t.Errorf("retry unknown: status = %d, want 404", rec.Code)
		}
		if rec := do(t, env.handler, "POST", "/api/tasks/nope/stop", nil); rec.Code != http.StatusNotFound {
			t.Errorf("stop unknown: status = %d, want 404", rec.Code)
		}
	})
}

// TestPermanentFailureOffersNoRetry pins the two failure shapes: a corrupt
// PDF fails identically every time, so the wire says so and the client shows
// no Try again.
func TestPermanentFailureOffersNoRetry(t *testing.T) {
	env := newTestEnvWithoutRunner(t)
	requirePoppler(t)

	rec := doUpload(t, env.handler, "file", "not-a-book.pdf", []byte("this is not a pdf at all"))
	if rec.Code != http.StatusAccepted {
		t.Fatalf("import: status = %d, body %s", rec.Code, rec.Body.String())
	}
	var body struct {
		Task apiTask `json:"task"`
	}
	decode(t, rec, &body)
	if err := env.runner.Drain(t.Context()); err != nil {
		t.Fatalf("drain: %v", err)
	}

	task := env.getTask(body.Task.ID)
	if task.Status != "failed" {
		t.Fatalf("task = %q, want failed", task.Status)
	}
	if task.FailKind == nil || *task.FailKind != "permanent" {
		t.Fatalf("failKind = %v, want permanent", task.FailKind)
	}
	if task.Retryable {
		t.Error("a permanent failure must not offer a retry")
	}
	if task.Error == nil || !strings.Contains(*task.Error, "can't be read") {
		t.Errorf("error = %v, want a plain explanation", task.Error)
	}
}

// TestRemoveBookIsTheOnlyDeletingDoor pins that nothing else throws work
// away, and that removing a book takes its tasks with it.
func TestRemoveBookIsTheOnlyDeletingDoor(t *testing.T) {
	env := newTestEnvWithoutRunner(t)
	requirePoppler(t)
	requirePdftohtml(t)
	book := env.importSample("sample-digital.pdf")

	if len(env.tasks()) != 1 {
		t.Fatalf("tasks = %d, want the preparation", len(env.tasks()))
	}
	rec := do(t, env.handler, "DELETE", "/api/books/"+book.SHA256, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("remove: status = %d, body %s", rec.Code, rec.Body.String())
	}

	if rec := do(t, env.handler, "GET", "/api/books/"+book.SHA256, nil); rec.Code == http.StatusOK {
		t.Error("the book survived its removal")
	}
	if n := len(env.tasks()); n != 0 {
		t.Errorf("tasks = %d, want none — a removed book takes its history with it", n)
	}
}

// TestImportRefusedWithoutModelConnection pins the preflight: preparation
// ends in search, so a missing connection is refused at the door.
func TestImportRefusedWithoutModelConnection(t *testing.T) {
	env := newTestEnvWithoutRunner(t)
	requirePoppler(t)
	if err := env.engine.SaveConfig(t.Context(), engineSettingsWithoutEmbed()); err != nil {
		t.Fatal(err)
	}

	rec := do(t, env.handler, "POST", "/api/import", map[string]any{"path": samplePath("sample-digital.pdf")})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	if !strings.Contains(strings.ToLower(rec.Body.String()), "settings") {
		t.Errorf("body = %s, want a Settings hint", rec.Body.String())
	}
	if n := len(env.tasks()); n != 0 {
		t.Errorf("tasks = %d, want none — the refusal happens before any work", n)
	}
}

func TestEventsStreamSnapshotThenDeltas(t *testing.T) {
	env := newTestEnvWithoutRunner(t)
	requirePoppler(t)
	requirePdftohtml(t)
	env.importSample("sample-digital.pdf")

	rec := do(t, env.handler, "POST", "/api/import", map[string]any{"path": samplePath("sample-flat.pdf")})
	var enq struct {
		Task apiTask `json:"task"`
	}
	decode(t, rec, &enq)

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	recorder := runStream(t, env, ctx, "/api/events")

	// First event on connect: the full snapshot.
	deadline := time.Now().Add(5 * time.Second)
	var events []streamFrame
	for time.Now().Before(deadline) {
		events = parseStreamFrames(t, recorder.Body.String())
		if len(events) >= 1 {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
	if len(events) == 0 || events[0].Type != "snapshot" {
		t.Fatalf("first event = %+v, want a snapshot", events)
	}
	var snap struct {
		Tasks []apiTask `json:"tasks"`
	}
	if err := json.Unmarshal([]byte(events[0].Raw), &snap); err != nil {
		t.Fatalf("snapshot payload: %v", err)
	}
	if len(snap.Tasks) != 2 {
		t.Fatalf("snapshot tasks = %d, want the queued and the finished one", len(snap.Tasks))
	}
	if ct := recorder.Header().Get("Content-Type"); ct != "text/event-stream" {
		t.Errorf("content-type = %q, want text/event-stream", ct)
	}

	// Deltas flow: stopping the queued task emits a task event.
	if rec := do(t, env.handler, "POST", "/api/tasks/"+enq.Task.ID+"/stop", nil); rec.Code != http.StatusAccepted {
		t.Fatalf("stop: status = %d", rec.Code)
	}
	deadline = time.Now().Add(5 * time.Second)
	sawPaused := false
	for time.Now().Before(deadline) {
		for _, ev := range parseStreamFrames(t, recorder.Body.String()) {
			if ev.Type != "task" {
				continue
			}
			var payload struct {
				Task apiTask `json:"task"`
			}
			if err := json.Unmarshal([]byte(ev.Raw), &payload); err != nil {
				t.Fatalf("task event payload: %v", err)
			}
			if payload.Task.ID == enq.Task.ID && payload.Task.Status == "paused" {
				sawPaused = true
			}
		}
		if sawPaused {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
	if !sawPaused {
		t.Fatalf("no task event carried the stop; stream:\n%s", recorder.Body.String())
	}
}

// TestEventsStreamResumesFromLastEventID pins the resume contract: a client
// naming the last event it saw is replayed exactly what it missed and gets no
// snapshot — whether it names it the way EventSource does (Last-Event-ID on
// the browser's own reconnects) or the way the frontend does by hand (?after=
// on a socket it replaces itself). A resume point that cannot be honoured
// gets the snapshot instead of a gap it cannot see.
func TestEventsStreamResumesFromLastEventID(t *testing.T) {
	env := newTestEnvWithoutRunner(t)
	requirePoppler(t)
	requirePdftohtml(t)
	book := env.importSample("sample-digital.pdf")

	// First connection: everything arrives as a snapshot, stamped with the
	// broker's position so there is something to resume from.
	ctx, cancel := context.WithCancel(t.Context())
	recorder := runStream(t, env, ctx, "/api/events")
	deadline := time.Now().Add(5 * time.Second)
	var first []streamFrame
	for time.Now().Before(deadline) {
		first = parseStreamFrames(t, recorder.Body.String())
		if len(first) >= 1 {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
	if len(first) == 0 || first[0].Type != "snapshot" {
		t.Fatalf("first event = %+v, want a snapshot", first)
	}
	lastID := first[0].ID
	if lastID == "" {
		t.Fatal("the snapshot carries no id, so a reconnect could never resume")
	}
	cancel()
	recorder.waitDone(t)

	// Something happens while this client is not watching.
	if rec := do(t, env.handler, "DELETE", "/api/books/"+book.SHA256, nil); rec.Code != http.StatusOK {
		t.Fatalf("remove: status = %d, body %s", rec.Code, rec.Body.String())
	}

	// A resumed connection replays the gap and never re-sends the world.
	t.Run("query parameter", func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		recorder := runStream(t, env, ctx, "/api/events?after="+lastID)
		body := waitForStreamEvent(t, recorder, "task_removed")
		events := parseStreamFrames(t, body)
		if events[0].Type == "snapshot" {
			t.Error("a resumed connection was sent a full snapshot")
		}
		var removed bool
		for _, ev := range events {
			if ev.Type == "task_removed" {
				removed = true
			}
		}
		if !removed {
			t.Errorf("the missed event never arrived; stream:\n%s", body)
		}
	})

	// The same contract under the header EventSource itself sends.
	t.Run("Last-Event-ID header", func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		rec := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/api/events", nil).WithContext(ctx)
		req.Header.Set("Last-Event-ID", lastID)
		recorder := runStreamRequest(t, env, ctx, rec, req)
		body := waitForStreamEvent(t, recorder, "task_removed")
		if events := parseStreamFrames(t, body); events[0].Type == "snapshot" {
			t.Error("a resumed connection was sent a full snapshot")
		}
	})

	// A resume point from the future — a restarted server counts from zero
	// again — is answered honestly: a snapshot, not silence.
	t.Run("unhonourable resume point", func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		recorder := runStream(t, env, ctx, "/api/events?after=999999")
		body := waitForStreamEvent(t, recorder, "snapshot")
		if events := parseStreamFrames(t, body); events[0].Type != "snapshot" {
			t.Errorf("first event = %s, want a snapshot for an unhonourable resume point", events[0].Type)
		}
	})
}

// waitForStreamEvent polls a recorded stream until an event of the wanted
// type has been flushed, and returns the body so far.
func waitForStreamEvent(t *testing.T, recorder *streamResponse, want string) string {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		body := recorder.Body.String()
		for _, ev := range parseStreamFrames(t, body) {
			if ev.Type == want {
				return body
			}
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("no %s event arrived; stream:\n%s", want, recorder.Body.String())
	return ""
}

// streamFrame is one parsed event of the events stream.
type streamFrame struct {
	Type string
	ID   string
	Raw  string
}

// parseStreamFrames splits a recorded SSE body into its events. Field lines
// other than data and id — the retry hint, comment keep-alives — carry no
// event of their own and are folded away.
func parseStreamFrames(t *testing.T, body string) []streamFrame {
	t.Helper()
	var out []streamFrame
	for _, chunk := range strings.Split(body, "\n\n") {
		var frame streamFrame
		var hasData bool
		for _, line := range strings.Split(chunk, "\n") {
			switch {
			case strings.HasPrefix(line, "data: "):
				raw := strings.TrimPrefix(line, "data: ")
				var ev struct {
					Type string `json:"type"`
				}
				if err := json.Unmarshal([]byte(raw), &ev); err != nil {
					t.Fatalf("decode event %q: %v", line, err)
				}
				frame.Type = ev.Type
				frame.Raw = raw
				hasData = true
			case strings.HasPrefix(line, "id: "):
				frame.ID = strings.TrimPrefix(line, "id: ")
			}
		}
		if hasData {
			out = append(out, frame)
		}
	}
	return out
}

// streamResponse is a live streaming request served on its own goroutine;
// the body grows as events flush. Cancel ctx to end the handler.
type streamResponse struct {
	*httptest.ResponseRecorder
	done chan struct{}
}

func (s *streamResponse) waitDone(t *testing.T) {
	t.Helper()
	select {
	case <-s.done:
	case <-time.After(5 * time.Second):
		t.Fatal("stream handler did not return after cancel")
	}
}

// runStream serves one streaming request; the caller polls Body.String()
// and cancels ctx when done.
func runStream(t *testing.T, env *testEnv, ctx context.Context, target string) *streamResponse {
	t.Helper()
	return runStreamRequest(t, env, ctx, httptest.NewRecorder(), httptest.NewRequest("GET", target, nil).WithContext(ctx))
}

// runStreamRequest is runStream for callers that need their own recorder or
// request, e.g. to set headers.
func runStreamRequest(t *testing.T, env *testEnv, ctx context.Context, rec *httptest.ResponseRecorder, req *http.Request) *streamResponse {
	t.Helper()
	s := &streamResponse{ResponseRecorder: rec, done: make(chan struct{})}
	go func() {
		defer close(s.done)
		env.handler.ServeHTTP(rec, req)
	}()
	t.Cleanup(func() {
		s.waitDone(t)
	})
	return s
}
