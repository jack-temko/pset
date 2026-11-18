package work

import (
	"reflect"
	"testing"

	"github.com/jackt/pset/internal/probnum"
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
