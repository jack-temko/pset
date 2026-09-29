package homework

import (
	"context"
	"database/sql"
	"slices"
	"sync"
	"testing"

	"github.com/jackt/pset/internal/llm"
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
