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
