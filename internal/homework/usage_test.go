package homework

import (
	"context"
	"database/sql"
	"encoding/json"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/llm/llmtest"
	"github.com/jackt/pset/internal/testx"
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
	// The modal's detail: one stage, Read, in one run.
	var d usage.Detail
	if code := e.do(t, "GET", "/api/assignment-reads/"+r.ID+"/usage", nil, &d); code != 200 ||
		len(d.Stages) != 1 || d.Stages[0].Name != "Read" || len(d.Runs) != 1 {
		t.Fatalf("read detail %d %+v", code, d)
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
	e.llm.Fallback(func(_ llm.ChatRequest) llmtest.Reply {
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
		testx.Check(t, e.svc.c.DB.QueryRow(`SELECT count(*) FROM calls WHERE subject_type = ? AND subject_id = ?`, usage.SubjectQuestion, q.ID).Scan(&n))
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
	testx.Check(t, e.svc.c.DB.QueryRow(`SELECT count(*) FROM calls`).Scan(&n))
	if n != 0 {
		t.Fatalf("%d rows left after the book's calls were forgotten", n)
	}
	// A call that ends now, for either, records nothing.
	sink := usage.Sink(e.svc.c.DB)
	sink(llm.Call{SubjectType: usage.SubjectQuestion, SubjectID: q.ID, Model: "m"})
	sink(llm.Call{SubjectType: usage.SubjectRead, SubjectID: r.ID, Model: "m"})
	testx.Check(t, e.svc.c.DB.QueryRow(`SELECT count(*) FROM calls`).Scan(&n))
	if n != 0 {
		t.Fatalf("%d rows recorded for subjects of a removed book", n)
	}
}

// Each step of a question's production names its stage, and the steps of
// one find share a run: the detail the modal fetches has the stages in
// order and one run.
func TestAQuestionsCallsCarryTheirStageAndRun(t *testing.T) {
	e := newEnv(t)
	calls := recordCalls(t, e.svc.c.DB)
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID, StateReady)

	stages := map[string]bool{}
	runs := map[string]bool{}
	for _, c := range calls() {
		if c.Stage == "" || c.Run == "" {
			t.Fatalf("a call without a stage or run: %+v", c)
		}
		stages[c.Stage] = true
		runs[c.Run] = true
	}
	if !stages["Find"] || !stages["Guide"] {
		t.Fatalf("stages %v, want Find and Guide", stages)
	}
	if len(runs) != 1 {
		t.Fatalf("runs %v, want the steps of one find to share one", runs)
	}

	var d usage.Detail
	if code := e.do(t, "GET", "/api/questions/"+q.ID+"/usage", nil, &d); code != 200 {
		t.Fatalf("usage %d", code)
	}
	if len(d.Runs) != 1 || len(d.Stages) < 2 || d.Total.Calls != len(calls()) {
		t.Fatalf("detail %+v", d)
	}

	// A retry is a run of its own.
	e.svc.setFailed(context.Background(), q.ID, FailureGeneration, "Something went wrong.")
	if code := e.do(t, "POST", "/api/questions/"+q.ID+"/retry", Retry{}, nil); code != 200 {
		t.Fatalf("retry %d", code)
	}
	e.wait(t, q.ID, StateReady)
	e.do(t, "GET", "/api/questions/"+q.ID+"/usage", nil, &d)
	if len(d.Runs) < 2 {
		t.Fatalf("runs %d after a retry, want at least 2: %+v", len(d.Runs), calls())
	}
}

// A set's ranking is shared: every question's modal carries an even share
// of it, marked as shared, and the set's own calls stay whole.
func TestARankingIsSharedAmongTheSetsQuestions(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	recordCalls(t, e.svc.c.DB)
	h := e.newSet(t)
	a := e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0]
	b := e.add(t, h.ID, Draft{Text: "3.37", InBook: true})[0]
	e.wait(t, a.ID, StateReady)
	e.wait(t, b.ID, StateReady)
	sink := usage.Sink(e.svc.c.DB)
	cost := 0.0010
	sink(llm.Call{At: "2030-01-01T00:00:00Z", SubjectType: usage.SubjectSet, SubjectID: h.ID, Model: "m", Answered: "m", Ms: 2000,
		Stage: "Rank", Run: "r", Usage: &llm.Usage{PromptTokens: 800, CompletionTokens: 200, Cost: cost}})

	d, err := e.svc.QuestionUsage(ctx, a.ID)
	if err != nil || d == nil {
		t.Fatalf("detail %v, %v", d, err)
	}
	var rank *usage.Stage
	for i := range d.Stages {
		if d.Stages[i].Name == "Rank" {
			rank = &d.Stages[i]
		}
	}
	if rank == nil || rank.Shared != 2 || rank.Cost == nil || *rank.Cost != cost/2 || *rank.TokensIn != 400 {
		t.Fatalf("rank stage %+v, want half of the ranking, shared with 2", rank)
	}
	// The line carries the share too.
	var list Detail
	e.do(t, "GET", "/api/homework/"+h.ID, nil, &list)
	for _, q := range list.Questions {
		// The test model reports no cost of its own, so the line's cost is
		// the share alone.
		if q.Usage == nil || q.Usage.Total.Cost == nil || *q.Usage.Total.Cost != cost/2 {
			t.Fatalf("line %+v does not carry half the ranking", q.Usage)
		}
	}
	// Removing the set takes the ranking with it.
	e.do(t, "DELETE", "/api/homework/"+h.ID, nil, nil)
	if u, err := usage.For(ctx, e.svc.c.DB, usage.SubjectSet, h.ID); err != nil || u != nil {
		t.Fatalf("the removed set's ranking %v, %v", u, err)
	}
}

// A ranking's cost is shared among the set's questions, so after one every
// question's line is published again with its new share, not only the
// questions whose difficulty moved; so are the others when a question is
// removed (each takes a bigger share).
func TestEveryQuestionIsRepublishedAfterARankingAndARemoval(t *testing.T) {
	e := newEnv(t)
	recordCalls(t, e.svc.c.DB)
	h := e.newSet(t)
	qs := e.add(t, h.ID, Draft{Text: "3.36", InBook: true}, Draft{Text: "3.37", InBook: true}, Draft{Text: "3.38", InBook: true})
	for _, q := range qs {
		e.wait(t, q.ID, StateReady)
	}
	cost := 0.0030
	usage.Sink(e.svc.c.DB)(llm.Call{At: "2030-01-01T00:00:00Z", SubjectType: usage.SubjectSet, SubjectID: h.ID, Model: "m", Answered: "m", Ms: 3000,
		Stage: "Rank", Run: "r", Usage: &llm.Usage{PromptTokens: 900, CompletionTokens: 90, Cost: cost}})

	// Every question's latest published line, from the event stream.
	latest := func() map[string]float64 {
		got := map[string]float64{}
		for _, ev := range e.events.all() {
			if !strings.HasPrefix(ev, EventQuestionChanged+" ") {
				continue
			}
			var c QuestionChanged
			if json.Unmarshal([]byte(strings.TrimPrefix(ev, EventQuestionChanged+" ")), &c) == nil && c.Question.Usage != nil && c.Question.Usage.Total.Cost != nil {
				got[c.Question.ID] = *c.Question.Usage.Total.Cost
			}
		}
		return got
	}
	job := jobs.Job{Kind: JobRank, Payload: json.RawMessage(`{"setId":"` + h.ID + `"}`)}
	if err := e.svc.runRank(context.Background(), job); err != nil {
		t.Fatal(err)
	}
	for _, q := range qs {
		if got := latest()[q.ID]; got != cost/3 {
			t.Fatalf("question %s was last published with cost %v, want its third %v", q.ID, got, cost/3)
		}
	}

	e.do(t, "DELETE", "/api/questions/"+qs[2].ID, nil, nil)
	for _, q := range qs[:2] {
		if got := latest()[q.ID]; got != cost/2 {
			t.Fatalf("after a removal question %s was last published with cost %v, want its half %v", q.ID, got, cost/2)
		}
	}
}
