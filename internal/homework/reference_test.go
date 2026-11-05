package homework

import (
	"reflect"
	"testing"

	"github.com/jackt/pset/internal/probnum"
)

var (
	perSection = probnum.Style{Form: probnum.FormLocal, Where: probnum.WhereSection}
	perChapter = probnum.Style{Form: probnum.FormChapter, Where: probnum.WhereChapter}
	bySection  = probnum.Style{Form: probnum.FormSection, Where: probnum.WhereChapter}
)

// The references Jack's professors and Jack write, in each book's style.
func TestParseRefs(t *testing.T) {
	for _, c := range []struct {
		text  string
		style probnum.Style
		want  []Ref
	}{
		// Typed, in Boyce.
		{"Chapter 3.1 Problem 7", perSection, []Ref{{Chapter: "3", Section: "3.1", Number: "7"}}},
		{"Chapter 3.2 Problem 1", perSection, []Ref{{Chapter: "3", Section: "3.2", Number: "1"}}},
		{"Section 3.1 #7", perSection, []Ref{{Chapter: "3", Section: "3.1", Number: "7"}}},
		{"3.1 #7", perSection, []Ref{{Chapter: "3", Section: "3.1", Number: "7"}}},
		{"§3.1 7c", perSection, []Ref{{Chapter: "3", Section: "3.1", Number: "7", Part: "c"}}},
		{"3.1.7", perSection, []Ref{{Chapter: "3", Section: "3.1", Number: "7"}}},
		{"Page 33 Problem 7", perSection, []Ref{{Number: "7", Page: 33}}},
		{"7 on page 33", perSection, []Ref{{Number: "7", Page: 33}}},
		// The Math 220 sheet.
		{"1.1: 1, 7, (4 pts each)", perSection, []Ref{
			{Chapter: "1", Section: "1.1", Number: "1", Note: "4 pts each"},
			{Chapter: "1", Section: "1.1", Number: "7", Note: "4 pts each"}}},
		{"2.1: 1, 4, 6 (do c, 6 pts each)", perSection, []Ref{
			{Chapter: "2", Section: "2.1", Number: "1", Note: "do c, 6 pts each"},
			{Chapter: "2", Section: "2.1", Number: "4", Note: "do c, 6 pts each"},
			{Chapter: "2", Section: "2.1", Number: "6", Note: "do c, 6 pts each"}}},
		{"2.1: 12 (also graph the solution, 9 pts).", perSection, []Ref{
			{Chapter: "2", Section: "2.1", Number: "12", Note: "also graph the solution, 9 pts"}}},
		// The EECS 461 sheet.
		{"Problem 2.1.4, p. 57.", bySection, []Ref{{Chapter: "2", Section: "2.1", Number: "4", Page: 57}}},
		// The EECS 202 page, and typed circuits references.
		{"4.27", perChapter, []Ref{{Chapter: "4", Number: "27"}}},
		{"4.25 (no PSpice or MulitSim)", perChapter, []Ref{{Chapter: "4", Number: "25", Note: "no PSpice or MulitSim"}}},
		{"1.1 , 1.6 , 1.9 (all on page 24)", perChapter, []Ref{
			{Chapter: "1", Number: "1", Page: 24, Note: "all on page 24"},
			{Chapter: "1", Number: "6", Page: 24, Note: "all on page 24"},
			{Chapter: "1", Number: "9", Page: 24, Note: "all on page 24"}}},
		{"2.23 (find power to the 12-Ohm resistor!)", perChapter, []Ref{{Chapter: "2", Number: "23", Note: "find power to the 12-Ohm resistor!"}}},
		{"Problem 4.27", perChapter, []Ref{{Chapter: "4", Number: "27"}}},
		{"Chapter 4 Problem 27", perChapter, []Ref{{Chapter: "4", Number: "27"}}},
		// The EECS 461 sheet's long lines: a reference, then a paragraph.
		{"Problem 2.3.2, p. 60. This problem relates to one of the most dominant streaks in sports history since the Celtics won eight straight titles.",
			bySection, []Ref{{Chapter: "2", Section: "2.3", Number: "2", Page: 60,
				Note: "This problem relates to one of the most dominant streaks in sports history since the Celtics won eight straight titles"}}},
		// Ranges.
		{"3.1: 1-4 all.", perSection, []Ref{
			{Chapter: "3", Section: "3.1", Number: "1"}, {Chapter: "3", Section: "3.1", Number: "2"},
			{Chapter: "3", Section: "3.1", Number: "3"}, {Chapter: "3", Section: "3.1", Number: "4"}}},
		{"3.2: 1-7 odd, 24", perSection, []Ref{
			{Chapter: "3", Section: "3.2", Number: "1"}, {Chapter: "3", Section: "3.2", Number: "3"},
			{Chapter: "3", Section: "3.2", Number: "5"}, {Chapter: "3", Section: "3.2", Number: "7"},
			{Chapter: "3", Section: "3.2", Number: "24"}}},
		{"2.3 #2 to 6 even", perSection, []Ref{
			{Chapter: "2", Section: "2.3", Number: "2"}, {Chapter: "2", Section: "2.3", Number: "4"},
			{Chapter: "2", Section: "2.3", Number: "6"}}},
		{"4.27–4.29, 4.35", perChapter, []Ref{
			{Chapter: "4", Number: "27"}, {Chapter: "4", Number: "28"}, {Chapter: "4", Number: "29"}, {Chapter: "4", Number: "35"}}},
		{"4.27 - 29", perChapter, []Ref{{Chapter: "4", Number: "27"}, {Chapter: "4", Number: "28"}, {Chapter: "4", Number: "29"}}},
		{"2.1.3-2.1.5", bySection, []Ref{
			{Chapter: "2", Section: "2.1", Number: "3"}, {Chapter: "2", Section: "2.1", Number: "4"}, {Chapter: "2", Section: "2.1", Number: "5"}}},
		// Two sections on one line, each with its own list.
		{"1.1 #1, 1.2 #3", perSection, []Ref{{Chapter: "1", Section: "1.1", Number: "1"}, {Chapter: "1", Section: "1.2", Number: "3"}}},
		{"1.1: 1, 7; 1.2: 3", perSection, []Ref{
			{Chapter: "1", Section: "1.1", Number: "1"}, {Chapter: "1", Section: "1.1", Number: "7"}, {Chapter: "1", Section: "1.2", Number: "3"}}},
		{"Section 1.1 #1, section 1.2 #3", perSection, []Ref{{Chapter: "1", Section: "1.1", Number: "1"}, {Chapter: "1", Section: "1.2", Number: "3"}}},
		// Several parts of one problem.
		{"3.1 #7abc", perSection, []Ref{{Chapter: "3", Section: "3.1", Number: "7", Part: "abc"}}},
		{"3.1 #7(a),(b)", perSection, []Ref{{Chapter: "3", Section: "3.1", Number: "7", Part: "ab"}}},
		{"3.1 #7a-c", perSection, []Ref{{Chapter: "3", Section: "3.1", Number: "7", Part: "abc"}}},
		{"3.1 #7 (a-c)", perSection, []Ref{{Chapter: "3", Section: "3.1", Number: "7", Part: "abc"}}},
		{"4.27(a and c)", perChapter, []Ref{{Chapter: "4", Number: "27", Part: "ac"}}},
		// Prefixes run into the number, a page run into its "p".
		{"P4.27", perChapter, []Ref{{Chapter: "4", Number: "27"}}},
		{"Prob4.27", perChapter, []Ref{{Chapter: "4", Number: "27"}}},
		{"p45 #12", perSection, []Ref{{Number: "12", Page: 45}}},
		// Numbers in words, after a word that expects one.
		{"Problem one in 2.1", perSection, []Ref{{Chapter: "2", Section: "2.1", Number: "1"}}},
		{"Chapter four, problem twenty", perChapter, []Ref{{Chapter: "4", Number: "20"}}},
		// And a book problem in the professor's own words.
		{"Use MATLAB or any other computer language/platform to do problem 2.5.2 on p. 61, augmented as below. HOWEVER, use 500 packets.",
			bySection, []Ref{{Chapter: "2", Section: "2.5", Number: "2", Page: 61,
				Note: "Use MATLAB or any other computer language/platform to do problem 2.5.2 on p. 61, augmented as below. HOWEVER, use 500 packets"}}},
	} {
		got, ok := ParseRefs(c.text, c.style)
		if !ok || !reflect.DeepEqual(got, c.want) {
			t.Errorf("ParseRefs(%q) = %+v %v\n want %+v", c.text, got, ok, c.want)
		}
	}
}

func TestParseRefsLeavesProseAlone(t *testing.T) {
	for _, text := range []string{
		"Find the voltage across a 2 Ω resistor carrying 3 A.",
		"There are 24 letters in the Greek alphabet.",
		"",
		// A long problem written out that starts with a number, and one
		// that names two problems.
		"3 resistors of 4, 6 and 12 ohms are in parallel across a 24 V source. Find the current through each one and the power the source delivers.",
		"Compare your answers to problem 2.1.4 and problem 2.2.4, and explain the difference.",
		// Problems from a set the book numbers on its own: not the
		// chapter's problems of the same number.
		"Supplementary problem 3.5",
		"Review question 4.3",
		"Review problem 4 in chapter 2",
		// "one" not after a word that expects a number.
		"the one with the tank",
		// A range too long to be meant, and one backwards.
		"1.1: 1-500",
		"3.1: 9-2",
	} {
		if refs, ok := ParseRefs(text, perSection); ok {
			t.Errorf("ParseRefs(%q) = %+v", text, refs)
		}
	}
	// Where problems start again each section, a bare "3.1" names no
	// problem.
	if refs, ok := ParseRefs("3.1", perSection); ok {
		t.Errorf("a bare section read as %+v", refs)
	}
}

func TestRefLabels(t *testing.T) {
	r := Ref{Chapter: "3", Section: "3.1", Number: "7"}
	if r.Label(perSection) != "3.1 #7" || r.Label(bySection) != "3.1.7" {
		t.Fatalf("labels %q %q", r.Label(perSection), r.Label(bySection))
	}
	if l := (Ref{Chapter: "4", Number: "27"}).Label(perChapter); l != "4.27" {
		t.Fatalf("label %q", l)
	}
	if l := (Ref{Number: "7", Page: 33}).Label(perSection); l != "p. 33 #7" {
		t.Fatalf("label %q", l)
	}
}
