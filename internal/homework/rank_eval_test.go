package homework

import (
	"context"
	"os"
	"testing"

	"github.com/jackt/pset/internal/llm"
)

// TestRankEvalOnARealModel runs the ranking prompt on the Reader model over
// OpenRouter and checks it separates a short easy question from a long hard
// one. It costs a few cents and needs the eval key, so it only runs when
// PSET_EVAL_KEY is set (never the key in a real library).
func TestRankEvalOnARealModel(t *testing.T) {
	key := os.Getenv("PSET_EVAL_KEY")
	if key == "" {
		t.Skip("set PSET_EVAL_KEY to run the ranking eval against OpenRouter")
	}
	qs := []Question{
		{ID: "easy1", Label: "2.1", Statement: runsOf("A 4 \\(\\Omega\\) resistor is connected across a 12 V source. Find the current through it.")},
		{ID: "easy2", Label: "2.4", Statement: runsOf("Find the equivalent resistance of a 6 \\(\\Omega\\) and a 3 \\(\\Omega\\) resistor in parallel.")},
		{ID: "mid", Label: "3.12", Statement: runsOf("Find \\(v_1\\) and \\(v_2\\) in the circuit of Fig. 3.55 using nodal analysis."), Figures: make([]Figure, 1)},
		{ID: "hard", Label: "4.32", Statement: runsOf("a. Determine the Thevenin equivalent of the circuit in Fig. 4.109 seen from terminals a-b, with \\(V_s = 10\\) V and \\(I_s = 2\\) A. b. Find the load \\(R_L\\) that receives maximum power and that power. c. Verify part (b) with a source transformation and superposition, and state what changes if the dependent source's gain doubles. d. Sketch the load's power against \\(R_L\\) from 0 to \\(5R_{Th}\\)."), Figures: make([]Figure, 2)},
		{ID: "easy3", Label: "1.7", Statement: runsOf("How much charge passes a point in 3 s when the current is 2 A?")},
	}
	cfg := llm.Config{ChatEndpoint: llm.OpenRouter, APIKey: key, ChatModel: llm.Writer.Model}
	scores, err := askRank(context.Background(), llm.Open(cfg), qs)
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("scores: %v", scores)
	if scores["hard"] < scores["easy1"]+2 || scores["hard"] < scores["easy3"]+2 {
		t.Errorf("the long hard question (%d) is not well above the short easy ones (%d, %d)", scores["hard"], scores["easy1"], scores["easy3"])
	}
	if scores["easy1"] > 2 || scores["easy3"] > 2 {
		t.Errorf("the one-step questions should be 1 or 2, got %d and %d", scores["easy1"], scores["easy3"])
	}
}
