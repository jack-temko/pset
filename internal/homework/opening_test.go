package homework

import (
	"testing"

	"github.com/jackt/pset/internal/doc"
)

func blocks(types ...string) []doc.Block {
	out := make([]doc.Block, len(types))
	for i, t := range types {
		out[i] = doc.Block(`{"type":"` + t + `"}`)
	}
	return out
}

// The rule the web shares (web/src/api/opening.ts): which help
// panels' content an opening keeps, and what is always left out.
func TestOpeningKeepsOnlyThePanelsThatWereOpen(t *testing.T) {
	full := Question{
		Hint:          blocks("hint"),
		Walkthrough:   blocks("step", "answer"),
		Reading:       [][]doc.Run{{}},
		ReadingDoubts: [][]doc.Run{{}},
		Boxes:         []Box{{}},
		Statement:     []doc.Run{{}},
	}
	cases := []struct {
		revealed          []string
		hint, walkthrough int
	}{
		{nil, 0, 0},
		{[]string{"hint"}, 1, 0},
		{[]string{"walkthrough"}, 0, 2},
		{[]string{"answers"}, 0, 2},
		{[]string{"hint", "walkthrough"}, 1, 2},
	}
	for _, c := range cases {
		q := full
		q.Revealed = c.revealed
		got := openingQuestion(q)
		if len(got.Hint) != c.hint || len(got.Walkthrough) != c.walkthrough {
			t.Errorf("revealed %v: hint %d walkthrough %d, want %d and %d", c.revealed, len(got.Hint), len(got.Walkthrough), c.hint, c.walkthrough)
		}
		if len(got.Reading) != 0 || len(got.ReadingDoubts) != 0 || len(got.Boxes) != 0 || got.Usage != nil || len(got.Statement) != 1 {
			t.Errorf("revealed %v: the trim left the readings, boxes or usage, or lost the statement: %+v", c.revealed, got)
		}
	}
}

func TestTheAnswersRowIsThereOnlyWhenTheRealViewHasIt(t *testing.T) {
	if !hasAnswers(nil) || !hasAnswers(blocks("step", "answer")) {
		t.Fatal("not yet written, or with an answer, the row is there")
	}
	if hasAnswers(blocks("step", "para")) {
		t.Fatal("a walkthrough without an answer drops the row")
	}
}
