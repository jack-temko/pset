package homework

import (
	"github.com/jackt/pset/internal/probnum"
	"reflect"
	"strings"
	"testing"
)

// The notes on Jack's professors' references, as instructions.
func TestNotesOf(t *testing.T) {
	for _, c := range []struct {
		text  string
		style probnum.Style
		want  []string
	}{
		// Math 220, in Boyce.
		{"2.1: 6 (do c, 6 pts each)", perSection, []string{"do c"}},
		{"2.1: 12 (also graph the solution, 9 pts).", perSection, []string{"also graph the solution"}},
		{"1.1: 1, 7, (4 pts each)", perSection, nil},
		{"3.1 #7c", perSection, []string{"Only part (c)."}},
		// EECS 202, in Alexander & Sadiku.
		{"4.25 (no PSpice or MulitSim)", perChapter, []string{"no PSpice or MulitSim"}},
		{"2.23 (find power to the 12-Ohm resistor!)", perChapter, []string{"find power to the 12-Ohm resistor!"}},
		{"1.1 , 1.6 , 1.9 (all on page 24)", perChapter, nil},
		// EECS 461, in Yates & Goodman.
		{"Problem 2.3.4, p. 60. Express your answer in terms of p, which you know to be 0.5 or greater.", bySection,
			[]string{"Express your answer in terms of p, which you know to be 0.5 or greater"}},
	} {
		refs, ok := ParseRefs(c.text, c.style)
		if !ok {
			t.Errorf("%q didn't parse", c.text)
			continue
		}
		if got := notesOf(refs[len(refs)-1]); !reflect.DeepEqual(got, c.want) {
			t.Errorf("notesOf(%q) = %q, want %q", c.text, got, c.want)
		}
	}
}

// A professor's note goes to the guide as an instruction over the book,
// and changing it writes the guide again.
func TestNotesReachTheGuideAndRewriteIt(t *testing.T) {
	e := newEnv(t)
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "3.36 (no PSpice or MultiSim)", InBook: true})[0].ID, StateReady)
	if !reflect.DeepEqual(q.Notes, []string{"no PSpice or MultiSim"}) {
		t.Fatalf("notes %q", q.Notes)
	}
	text := openingText(guideRequests(e)[0])
	if !strings.Contains(text, "Your professor's instructions") || !strings.Contains(text, "- no PSpice or MultiSim") {
		t.Fatalf("the guide wasn't told:\n%s", text)
	}

	notes := []string{"- no PSpice or MultiSim", "", "do it for R2 = 10 Ω"}
	if code := e.do(t, "PATCH", "/api/questions/"+q.ID, QuestionPatch{Notes: &notes}, &q); code != 200 {
		t.Fatalf("patch %d", code)
	}
	if len(q.Notes) != 2 || q.Notes[1] != "do it for R2 = 10 Ω" || len(q.Hint) != 0 {
		t.Fatalf("after editing: %+v", q)
	}
	e.wait(t, q.ID, StateReady)
	reqs := guideRequests(e)
	if !strings.Contains(openingText(reqs[len(reqs)-1]), "- do it for R2 = 10 Ω") {
		t.Fatal("the rewritten guide didn't get the new note")
	}
	// The same notes again change nothing.
	e.do(t, "PATCH", "/api/questions/"+q.ID, QuestionPatch{Notes: &notes}, &q)
	if q.State != StateReady {
		t.Fatalf("unchanged notes rewrote it: %s", q.State)
	}
}

// A reference naming parts says which, as an instruction.
func TestNotesSayWhichParts(t *testing.T) {
	for _, c := range []struct {
		part string
		want string
	}{{"c", "Only part (c)."}, {"ac", "Only parts (a) and (c)."}, {"abc", "Only parts (a), (b) and (c)."}} {
		if got := notesOf(Ref{Number: "7", Part: c.part}); len(got) != 1 || got[0] != c.want {
			t.Errorf("%q: %q", c.part, got)
		}
	}
}
