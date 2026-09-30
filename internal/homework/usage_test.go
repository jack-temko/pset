package homework

import (
	"context"
	"database/sql"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/llm/llmtest"
	"github.com/jackt/pset/internal/usage"
)

// recordCalls is the db sink plus a net over it: every call the engine
// makes is written into the calls table, as production's sink does, and
// caught for the test to assert on. It stops at the test's end, so no
// other test's calls land here.
func recordCalls(t *testing.T, d *sql.DB) func() []llm.Call {
	write := usage.Sink(d)
	var mu sync.Mutex
	var calls []llm.Call
	llm.OnCall(func(c llm.Call) {
		mu.Lock()
		defer mu.Unlock()
		calls = append(calls, c)
		write(c)
	})
	t.Cleanup(func() { llm.OnCall(nil) })
	return func() []llm.Call {
		mu.Lock()
		defer mu.Unlock()
		return append([]llm.Call(nil), calls...)
	}
}

// Every call a question's production makes — find, figure read, guide —
// is recorded on the question, the wire carries what they added up to,
// and removing the question takes its rows with it.
func TestAQuestionsCallsAreRecordedOnIt(t *testing.T) {
	e := newEnv(t)
	calls := recordCalls(t, e.svc.c.DB)
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID, StateReady)

	made := calls()
	if len(made) == 0 {
		t.Fatal("no calls recorded")
	}
	for _, c := range made {
		if c.SubjectType != usage.SubjectQuestion || c.SubjectID != q.ID {
			t.Fatalf("a call recorded on %s/%s, want question/%s", c.SubjectType, c.SubjectID, q.ID)
		}
	}

	// The wire contract: usage present and shaped on the Question, its
	// total covering exactly the calls that were made.
	var d Detail
	if code := e.do(t, "GET", "/api/homework/"+h.ID, nil, &d); code != 200 {
		t.Fatalf("detail %d", code)
	}
	i := slices.IndexFunc(d.Questions, func(x Question) bool { return x.ID == q.ID })
	if i < 0 {
		t.Fatalf("the question isn't in the set: %+v", d.Questions)
	}
	got := d.Questions[i].Usage
	if got == nil || got.Total.Calls != len(made) || len(got.Rows) == 0 || got.Rows[0].Model == "" {
		t.Fatalf("usage %+v for %d calls", got, len(made))
	}

	// Removing the question removes its spending with it.
	e.do(t, "DELETE", "/api/questions/"+q.ID, nil, nil)
	if u, err := usage.For(context.Background(), e.svc.c.DB, usage.SubjectQuestion, q.ID); err != nil || u != nil {
		t.Fatalf("the removed question's usage %v, %v, want nil, nil", u, err)
	}
}

// A read is one call, recorded on the read and carried on its wire form.
func TestAReadsCallsAreRecordedOnIt(t *testing.T) {
	e := newEnv(t)
	calls := recordCalls(t, e.svc.c.DB)
	newReader(e)
	r := e.read(t, AssignmentText{Text: coursePage})
	if r.State != ReadStateReady {
		t.Fatalf("read %+v", r)
	}

	made := calls()
	if len(made) == 0 {
		t.Fatal("no calls recorded")
	}
	for _, c := range made {
		if c.SubjectType != usage.SubjectRead || c.SubjectID != r.ID {
			t.Fatalf("a call recorded on %s/%s, want read/%s", c.SubjectType, c.SubjectID, r.ID)
		}
	}
	var list AssignmentReads
	if code := e.do(t, "GET", "/api/books/b1/assignments/reads", nil, &list); code != 200 {
		t.Fatalf("reads %d", code)
	}
	if len(list.Reads) != 1 || list.Reads[0].Usage == nil || list.Reads[0].Usage.Total.Calls != len(made) {
		t.Fatalf("reads %+v for %d calls", list.Reads, len(made))
	}
}

// Removing a question while a model call for it is in flight: the job is
// stopped and the call unwinds afterwards, and must not record a row for a
// question that is gone.
func TestACallEndingAfterItsQuestionWasRemovedLeavesNoRow(t *testing.T) {
	e := newEnv(t)
	recordCalls(t, e.svc.c.DB)
	entered, release := make(chan struct{}), make(chan struct{})
	var once, free sync.Once
	e.llm.Fallback(func(req llm.ChatRequest) llmtest.Reply {
		once.Do(func() { close(entered) })
		<-release
		return llmtest.Reply{Text: "{}"}
	})
	t.Cleanup(func() { free.Do(func() { close(release) }) })

	h := e.newSet(t)
	q := e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0]
	select {
	case <-entered:
	case <-time.After(10 * time.Second):
		t.Fatal("no model call was made for the question")
	}
	e.do(t, "DELETE", "/api/questions/"+q.ID, nil, nil)
	free.Do(func() { close(release) })

	// The stopped call ends; give its record time to (wrongly) land.
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		time.Sleep(50 * time.Millisecond)
		var n int
		e.svc.c.DB.QueryRow(`SELECT count(*) FROM calls WHERE subject_type = ? AND subject_id = ?`, usage.SubjectQuestion, q.ID).Scan(&n)
		if n != 0 {
			t.Fatalf("%d call rows outlived the removed question", n)
		}
	}
}

// Removing a book takes its questions' and reads' spending, and what is
// still in flight for them, through the hook library hands to homework.
func TestForgetBookCallsTakesTheQuestionsAndReadsWithIt(t *testing.T) {
	e := newEnv(t)
	calls := recordCalls(t, e.svc.c.DB)
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID, StateReady)
	newReader(e)
	r := e.read(t, AssignmentText{Text: coursePage})
	if len(calls()) == 0 {
		t.Fatal("no calls recorded")
	}
	ctx := context.Background()

	if err := e.svc.ForgetBookCalls(ctx, "b1"); err != nil {
		t.Fatal(err)
	}
	var n int
	e.svc.c.DB.QueryRow(`SELECT count(*) FROM calls`).Scan(&n)
	if n != 0 {
		t.Fatalf("%d rows left after the book's calls were forgotten", n)
	}
	// A call that ends now, for either, records nothing.
	sink := usage.Sink(e.svc.c.DB)
	sink(llm.Call{SubjectType: usage.SubjectQuestion, SubjectID: q.ID, Model: "m"})
	sink(llm.Call{SubjectType: usage.SubjectRead, SubjectID: r.ID, Model: "m"})
	e.svc.c.DB.QueryRow(`SELECT count(*) FROM calls`).Scan(&n)
	if n != 0 {
		t.Fatalf("%d rows recorded for subjects of a removed book", n)
	}
}
