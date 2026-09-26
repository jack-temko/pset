package homework

import (
	"slices"
	"strings"
	"testing"
	"time"
)

// A reference the parser can't read is rewritten by the model in the
// book's form; the parser reads the rewrite, and one naming two
// problems becomes two questions in its place.
func TestAnUnreadReferenceIsRewrittenAndSplit(t *testing.T) {
	e := newEnv(t)
	set := e.newSet(t)
	qs := e.add(t, set.ID,
		Draft{Text: "the thirty-fifth and thirty-sixth ones in chapter 3", InBook: true},
		Draft{Text: "3.36", InBook: true},
	)
	e.wait(t, qs[0].ID, StateReady)
	d, err := e.svc.Get(t.Context(), set.ID)
	if err != nil {
		t.Fatal(err)
	}
	var labels []string
	for _, q := range d.Questions {
		labels = append(labels, q.Label)
	}
	if len(d.Questions) != 3 || d.Questions[0].ID != qs[0].ID || !strings.HasPrefix(d.Questions[0].Text, "3.35") ||
		d.Questions[1].Text != "3.36" || d.Questions[2].ID != qs[1].ID {
		t.Fatalf("questions %q %+v", labels, d.Questions)
	}
	if !slices.Equal(d.Questions[0].Notes, []string{"no PSpice"}) {
		t.Fatalf("notes %q", d.Questions[0].Notes)
	}
	for i, q := range d.Questions {
		if q.Position != i+1 {
			t.Fatalf("positions %d at %d", q.Position, i)
		}
	}
}

// What the model can't place, or makes up, is looked for by its words as
// before, and what the parser reads is never asked about.
func TestARewriteThatDoesntReadChangesNothing(t *testing.T) {
	e := newEnv(t)
	set := e.newSet(t)
	qs := e.add(t, set.ID,
		Draft{Text: "the one about the tank from chapter 3", InBook: true},
		Draft{Text: "number 3 made up", InBook: true},
		Draft{Text: "3.36", InBook: true},
	)
	// Whatever the (fake) finder makes of them, once each is past finding.
	for _, q := range qs {
		deadline := time.Now().Add(10 * time.Second)
		for time.Now().Before(deadline) {
			r, _ := getQuestion(t.Context(), e.svc.c.DB, q.ID)
			if r.State != StatePending && r.State != StateLocating {
				break
			}
			time.Sleep(10 * time.Millisecond)
		}
	}
	d, _ := e.svc.Get(t.Context(), set.ID)
	if len(d.Questions) != 3 || d.Questions[0].Text != "the one about the tank from chapter 3" || d.Questions[1].Text != "number 3 made up" {
		t.Fatalf("questions %+v", d.Questions)
	}
	asked := 0
	for _, r := range e.llm.Requests() {
		if len(r.Chat.Messages) > 0 && strings.Contains(r.Chat.Messages[0].Content.Text(), "You rewrite one homework reference") {
			asked++
		}
	}
	// "the one about the tank from chapter 3" and "number 3 made up":
	// "3.36" is read by the parser and never asked about.
	if asked != 2 {
		t.Fatalf("asked %d times", asked)
	}
}
