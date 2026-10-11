package ask

import (
	"database/sql"
	"sync"
	"testing"

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

// Every call a turn makes — the rounds of tools and the repairs — is
// recorded on the turn, and the turn on the wire carries what they added
// up to.
func TestATurnsCallsAreRecordedOnIt(t *testing.T) {
	e := newEnv(t)
	calls := recordCalls(t, e.svc.c.DB)
	e.llm.Script(
		llmtest.Reply{Reasoning: "Search first.", ToolCalls: []llm.ToolCall{call("c1", "search_pages", `{"query":"eigenvalue"}`)}},
		llmtest.Reply{Text: answer},
	)
	var turn Turn
	if code := e.do(t, "POST", "/api/books/b1/turns", Question{Question: "What's an eigenvalue?"}, &turn); code != 201 {
		t.Fatalf("ask %d", code)
	}
	got := e.wait(t, turn.ID, TurnDone)

	made := calls()
	if len(made) == 0 {
		t.Fatal("no calls recorded")
	}
	for _, c := range made {
		if c.SubjectType != usage.SubjectTurn || c.SubjectID != turn.ID {
			t.Fatalf("a call recorded on %s/%s, want turn/%s", c.SubjectType, c.SubjectID, turn.ID)
		}
	}
	// wait() read the turn off the list, so this is the wire contract:
	// usage present, the total covering exactly the calls that were made.
	if got.Usage == nil || got.Usage.Total.Calls != len(made) || len(got.Usage.Rows) == 0 {
		t.Fatalf("usage %+v for %d calls", got.Usage, len(made))
	}
}

// A turn's calls are staged by round, each round naming the tools it
// asked for, and its detail is served at /api/turns/{id}/usage.
func TestATurnsCallsAreStagedByRound(t *testing.T) {
	e := newEnv(t)
	calls := recordCalls(t, e.svc.c.DB)
	e.llm.Script(
		llmtest.Reply{ToolCalls: []llm.ToolCall{call("c1", "search_pages", `{"query":"eigenvalue"}`)}},
		llmtest.Reply{Text: answer},
	)
	var turn Turn
	e.do(t, "POST", "/api/books/b1/turns", Question{Question: "What's an eigenvalue?"}, &turn)
	e.wait(t, turn.ID, TurnDone)

	var rounds []string
	for _, c := range calls() {
		if c.Run == "" {
			t.Fatalf("a call without a run: %+v", c)
		}
		if c.Stage == "Round 1" {
			if c.Tools != "search_pages" {
				t.Fatalf("round 1 tools %q, want search_pages", c.Tools)
			}
		}
		rounds = append(rounds, c.Stage)
	}
	if len(rounds) < 2 || rounds[0] != "Round 1" || rounds[1] != "Round 2" {
		t.Fatalf("stages %v, want Round 1 then Round 2", rounds)
	}
	var d usage.Detail
	if code := e.do(t, "GET", "/api/turns/"+turn.ID+"/usage", nil, &d); code != 200 || len(d.Runs) != 1 || d.Total.Calls != len(rounds) {
		t.Fatalf("detail %d %+v", code, d)
	}
}
