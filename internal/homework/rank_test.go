package homework

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/llm/llmtest"
)

func statement(id, text string, figures int) Question {
	return Question{ID: id, Statement: runsOf(text), Figures: make([]Figure, figures)}
}

func TestHeuristicSetsQuestionsAgainstEachOther(t *testing.T) {
	short := statement("short", "Find i.", 0)
	long := statement("long", "a) Find the current i through R1. b) Find the power in R2. c) Find the voltage v across the source in Fig. 4.109, using \\(v = iR\\) and superposition.", 1)
	mid := statement("mid", "Find the current through the 8 ohm resistor and the power it absorbs.", 0)
	got := heuristicScores([]Question{short, mid, long})
	if got[short.ID] != 1 || got[long.ID] != 5 || got[mid.ID] < 1 || got[mid.ID] > 4 {
		t.Fatalf("scores %v: want the shortest 1, the longest 5", got)
	}
	if !(got[short.ID] <= got[mid.ID] && got[mid.ID] < got[long.ID]) {
		t.Fatalf("scores %v are not in order of size", got)
	}
}

func TestHeuristicAllAlikeIsAllMiddle(t *testing.T) {
	a, b := statement("aaa", "Find the current.", 0), statement("bbb", "Find the voltage.", 0)
	// Two words each: the same size.
	got := heuristicScores([]Question{a, b})
	if got["aaa"] != 3 || got["bbb"] != 3 {
		t.Fatalf("scores %v, want all 3", got)
	}
}

func TestParseRankIsStrict(t *testing.T) {
	qs := []Question{{ID: "a"}, {ID: "b"}}
	good, err := parseRank("```json\n{\"scores\":[{\"n\":2,\"d\":5},{\"n\":1,\"d\":1.0}]}\n```", qs)
	if err != nil || good["a"] != 1 || good["b"] != 5 {
		t.Fatalf("good %v %v", good, err)
	}
	for name, reply := range map[string]string{
		"prose":       "They are both easy.",
		"missing one": `{"scores":[{"n":1,"d":3}]}`,
		"twice":       `{"scores":[{"n":1,"d":3},{"n":1,"d":4}]}`,
		"no such one": `{"scores":[{"n":1,"d":3},{"n":3,"d":4}]}`,
		"off the end": `{"scores":[{"n":1,"d":3},{"n":2,"d":6}]}`,
		"below one":   `{"scores":[{"n":1,"d":0},{"n":2,"d":2}]}`,
	} {
		if _, err := parseRank(reply, qs); err == nil {
			t.Errorf("%s: accepted %q", name, reply)
		}
	}
}

// ranker answers the ranking prompt as the test says, and everything else as
// the usual fake model does.
func ranker(answer func(user string) llmtest.Reply) func(llm.ChatRequest) llmtest.Reply {
	return func(req llm.ChatRequest) llmtest.Reply {
		if strings.Contains(req.Messages[0].Content.Text(), "You rate how hard") {
			return answer(req.Messages[1].Content.Text())
		}
		return fakeModel(req)
	}
}

func rankCalls(e *env) int {
	n := 0
	for _, r := range e.llm.Chats() {
		if strings.Contains(r.Messages[0].Content.Text(), "You rate how hard") {
			n++
		}
	}
	return n
}

func (e *env) difficulty(t *testing.T, id string) int {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		q, err := getQuestion(context.Background(), e.svc.c.DB, id)
		if err == nil && q.Difficulty != 0 {
			return q.Difficulty
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("question %s was never ranked", id)
	return 0
}

func TestSetIsRankedOnceEveryQuestionIsFound(t *testing.T) {
	e := newEnv(t)
	e.llm.Fallback(ranker(func(string) llmtest.Reply {
		return llmtest.Reply{Text: `{"scores":[{"n":1,"d":2},{"n":2,"d":5}]}`}
	}))
	h := e.newSet(t)
	qs := e.add(t, h.ID, Draft{Text: "3.35", InBook: true}, Draft{Text: "3.36", InBook: true})
	if qs[0].Difficulty != 0 {
		t.Fatalf("ranked before it was found: %+v", qs[0])
	}
	e.wait(t, qs[0].ID, StateReady)
	e.wait(t, qs[1].ID, StateReady)
	if a, b := e.difficulty(t, qs[0].ID), e.difficulty(t, qs[1].ID); a != 2 || b != 5 {
		t.Fatalf("difficulties %d and %d, want 2 and 5", a, b)
	}
	if n := rankCalls(e); n != 1 {
		t.Fatalf("%d ranking calls, want one for the whole set", n)
	}
	// The wire carries it, and an event said so.
	var d Detail
	e.do(t, "GET", "/api/homework/"+h.ID, nil, &d)
	if d.Questions[1].Difficulty != 5 {
		t.Fatalf("detail %+v", d.Questions[1])
	}
	found := false
	for _, ev := range e.events.all() {
		if strings.HasPrefix(ev, EventQuestionChanged) && strings.Contains(ev, `"difficulty":5`) {
			found = true
		}
	}
	if !found {
		t.Fatal("no question.changed event carried the difficulty")
	}
}

func TestRankWithoutAGoodModelUsesTheHeuristicAndFailsNothing(t *testing.T) {
	for name, reply := range map[string]llmtest.Reply{
		"down":     {Status: 500, Text: "busy"},
		"nonsense": {Text: "They look about the same to me."},
	} {
		t.Run(name, func(t *testing.T) {
			e := newEnv(t)
			e.llm.Fallback(ranker(func(string) llmtest.Reply { return reply }))
			h := e.newSet(t)
			qs := e.add(t, h.ID,
				Draft{Text: "A short one.", InBook: false},
				Draft{Text: "a) Find the current i through R1. b) Find the power in R2. c) Find the voltage across the source, using v = iR and superposition, and explain each step.", InBook: false})
			e.wait(t, qs[0].ID, StateReady)
			e.wait(t, qs[1].ID, StateReady)
			if a, b := e.difficulty(t, qs[0].ID), e.difficulty(t, qs[1].ID); a != 1 || b != 5 {
				t.Fatalf("heuristic gave %d and %d, want 1 and 5", a, b)
			}
		})
	}
}

func TestQuestionsNotFromTheBookAreRankedToo(t *testing.T) {
	e := newEnv(t)
	e.llm.Fallback(ranker(func(string) llmtest.Reply {
		return llmtest.Reply{Text: `{"scores":[{"n":1,"d":4},{"n":2,"d":1}]}`}
	}))
	h := e.newSet(t)
	qs := e.add(t, h.ID, Draft{Text: "Prove the triangle inequality.", InBook: false}, Draft{Text: "Compute 2+2.", InBook: false})
	if a, b := e.difficulty(t, qs[0].ID), e.difficulty(t, qs[1].ID); a != 4 || b != 1 {
		t.Fatalf("difficulties %d and %d", a, b)
	}
}

func TestRemovingAQuestionRanksTheRestAgain(t *testing.T) {
	e := newEnv(t)
	e.llm.Fallback(ranker(func(string) llmtest.Reply {
		return llmtest.Reply{Text: `{"scores":[{"n":1,"d":2},{"n":2,"d":5}]}`}
	}))
	h := e.newSet(t)
	qs := e.add(t, h.ID, Draft{Text: "One, written here.", InBook: false}, Draft{Text: "Two, written here.", InBook: false})
	e.difficulty(t, qs[1].ID)
	if code := e.do(t, "DELETE", "/api/questions/"+qs[0].ID, nil, nil); code != 204 {
		t.Fatalf("remove %d", code)
	}
	// Alone, it is the middle.
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		q, _ := getQuestion(context.Background(), e.svc.c.DB, qs[1].ID)
		if q.Difficulty == 3 {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("the remaining question was not ranked again")
}

func TestRankListCarriesWhatMakesAQuestionLong(t *testing.T) {
	q := statement("q", "Find v_o in Fig. 4.109.", 2)
	q.Label = "4.25"
	q.Notes = runLists([]string{"no PSpice"})
	list := rankList([]Question{q})
	for _, want := range []string{"1. 4.25", "Find", "2 figures", "Professor: no PSpice"} {
		if !strings.Contains(list, want) {
			t.Errorf("list %q lacks %q", list, want)
		}
	}
}

// spent is a Time with a fixed answer.
type spent map[string]int

func (s spent) QuestionSeconds(_ context.Context, ids []string) (map[string]int, error) {
	out := map[string]int{}
	for _, id := range ids {
		if n := s[id]; n > 0 {
			out[id] = n
		}
	}
	return out, nil
}

func TestQuestionsCarryTheTimeSpentOnThem(t *testing.T) {
	e := newEnv(t)
	h := e.newSet(t)
	qs := e.add(t, h.ID, Draft{Text: "First, written here.", InBook: false}, Draft{Text: "Second, written here.", InBook: false})
	e.wait(t, qs[0].ID, StateReady)
	e.wait(t, qs[1].ID, StateReady)
	e.svc.c.Time = spent{qs[0].ID: 1260}
	var d Detail
	e.do(t, "GET", "/api/homework/"+h.ID, nil, &d)
	if d.Questions[0].Seconds != 1260 || d.Questions[1].Seconds != 0 {
		t.Fatalf("seconds %d and %d, want 1260 and none", d.Questions[0].Seconds, d.Questions[1].Seconds)
	}
	// The snapshot an event or a patch carries says it too.
	yes := true
	var q Question
	e.do(t, "PATCH", "/api/questions/"+qs[0].ID, QuestionPatch{Done: &yes}, &q)
	if q.Seconds != 1260 || !q.Done {
		t.Fatalf("patched %+v", q)
	}
}
