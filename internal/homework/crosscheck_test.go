package homework

import (
	"encoding/json"
	"strings"
	"sync"
	"testing"

	"github.com/jackt/pset/internal/doc"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/llm/llmtest"
)

// checkEnv is an env whose Checker solves and whose comparisons answer
// from compares, one a call (the last repeats), and records the guide
// requests' opening text.
func checkEnv(t *testing.T, compares ...string) (*env, func() []string, func() int) {
	e := newEnv(t)
	var mu sync.Mutex
	var openings []string
	n := 0
	e.llm.Fallback(func(req llm.ChatRequest) llmtest.Reply {
		sys := req.Messages[0].Content.Text()
		switch {
		case strings.Contains(sys, "to check a tutor's worked answer"):
			return llmtest.Reply{Text: "a. V = 6 volts"}
		case strings.Contains(sys, "You compare two sets of final answers"):
			mu.Lock()
			defer mu.Unlock()
			c := compares[min(n, len(compares)-1)]
			n++
			return llmtest.Reply{Text: c}
		case isGuide(req):
			mu.Lock()
			var text strings.Builder
			for _, p := range req.Messages[1].Content.Parts() {
				text.WriteString(p.Text)
			}
			openings = append(openings, text.String())
			mu.Unlock()
		}
		return fakeModel(req)
	})
	return e, func() []string {
			mu.Lock()
			defer mu.Unlock()
			return append([]string(nil), openings...)
		}, func() int {
			mu.Lock()
			defer mu.Unlock()
			return n
		}
}

// Answers the check agrees with stand: one guide, no note.
func TestAGuideTheCheckAgreesWithStands(t *testing.T) {
	e, openings, compares := checkEnv(t, `{"agree": true}`)
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID, StateReady)
	if len(openings()) != 1 || compares() != 1 || strings.Contains(mustJSON(q.Walkthrough), checkNote) {
		t.Fatalf("%d guides, %d comparisons, walkthrough %s", len(openings()), compares(), mustJSON(q.Walkthrough))
	}
}

// A guide the check differs with is written again, told what differed;
// when the second agrees, it stands with no note.
func TestAGuideTheCheckDiffersWithIsWrittenAgain(t *testing.T) {
	e, openings, compares := checkEnv(t,
		`{"agree": false, "parts": [{"label": "(a)", "guide": "V = 6 volts", "solve": "V = 12 volts"}]}`,
		`{"agree": true}`)
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID, StateReady)
	o := openings()
	if len(o) != 2 || compares() != 2 {
		t.Fatalf("%d guides, %d comparisons; want the guide written again and compared again", len(o), compares())
	}
	if !strings.Contains(o[1], "independent check of an earlier draft") || !strings.Contains(o[1], "the check got V = 12 volts") || strings.Contains(o[0], "independent check") {
		t.Fatalf("the second guide wasn't told what differed:\n%s", o[1])
	}
	if strings.Contains(mustJSON(q.Walkthrough), checkNote) {
		t.Fatal("a guide the check came to agree with was flagged")
	}
}

// When the guide written again still differs, the part is flagged with a
// quiet note right after its answer.
func TestAGuideThatStillDiffersIsFlagged(t *testing.T) {
	e, openings, _ := checkEnv(t, `{"agree": false, "parts": [{"label": "(a)", "guide": "V = 6 volts", "solve": "V = 12 volts"}]}`)
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID, StateReady)
	if len(openings()) != 2 {
		t.Fatalf("%d guides, want 2", len(openings()))
	}
	var types []string
	for _, b := range q.Walkthrough {
		types = append(types, doc.TypeOf(b))
	}
	got := strings.Join(types, " ")
	if !strings.Contains(got, "answer note") || strings.Count(mustJSON(q.Walkthrough), checkNote) != 1 {
		t.Fatalf("blocks %s: want the note right after the answer", got)
	}
}

func TestFlagPartsMatchesLabels(t *testing.T) {
	block := func(v any) doc.Block { b, _ := json.Marshal(v); return b }
	walk := []doc.Block{
		block(doc.AnswerBlock{Type: doc.TypeAnswer, Label: "(a)", Text: []doc.Run{{T: "1"}}}),
		block(doc.AnswerBlock{Type: doc.TypeAnswer, Label: "(b)", Text: []doc.Run{{T: "2"}}}),
	}
	types := func(w []doc.Block) string {
		var out []string
		for _, b := range w {
			out = append(out, doc.TypeOf(b))
		}
		return strings.Join(out, " ")
	}
	if got := types(flagParts(walk, []difference{{Label: "a."}})); got != "answer note answer" {
		t.Errorf("a.: %s", got)
	}
	if got := types(flagParts(walk, []difference{{Label: "part 7"}})); got != "answer answer note" {
		t.Errorf("an unknown part goes on the last answer: %s", got)
	}
}
