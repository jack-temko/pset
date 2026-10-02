package homework

import (
	"reflect"
	"testing"
)

func TestQuestionLabel(t *testing.T) {
	for in, want := range map[string]string{
		"3.36":                              "3.36",
		"Problem 3.36.":                     "3.36",
		"Exercise 2.A.4":                    "2.A.4",
		"Problem 1.2.3":                     "1.2.3",
		"10.4.12b":                          "10.4.12b",
		"3.24 (use matlab)":                 "3.24",
		"q 1.2b":                            "1.2b",
		"Prove that 3.36 holds":             "",
		"Show that every linear map is ...": "",
	} {
		got, ok := questionLabel(in)
		if got != want || ok != (want != "") {
			t.Errorf("questionLabel(%q) = %q, %v", in, got, ok)
		}
	}
}

func TestLabelChapterAndCitedPage(t *testing.T) {
	if n, ok := labelChapter("12.A.4"); !ok || n != 12 {
		t.Errorf("chapter %d %v", n, ok)
	}
	if _, ok := labelChapter("x"); ok {
		t.Error("no chapter in x")
	}
	for in, want := range map[string]int{"see p. 143": 143, "Page 7, problem 2": 7, "pg 12": 12, "3.36": 0} {
		got, ok := printedPageOf(in)
		if got != want || ok != (want != 0) {
			t.Errorf("printedPageOf(%q) = %d, %v", in, got, ok)
		}
	}
}

func TestLabelScanFindsStatementsNotReferences(t *testing.T) {
	pages := []string{
		"As Fig. 3.36 shows, the current divides.",
		"Problems\n3.35 Find the current.\n3.36 Find the voltage across R2.",
		"(3.36) is the equation we need.",
		"3.36\nA bare label line, content below.",
	}
	if got := labelScan(pages, "3.36"); !reflect.DeepEqual(got, []int{2}) {
		t.Fatalf("got %v", got)
	}
}

func TestSweepBatchesReadFromTheChaptersEnd(t *testing.T) {
	got := sweepBatchesOf(10, 40)
	if len(got) != 2 || got[0][0] != 33 || got[0][7] != 40 || got[1][0] != 25 || got[1][7] != 32 {
		t.Fatalf("%v", got)
	}
	if got := sweepBatchesOf(5, 7); len(got) != 1 || !reflect.DeepEqual(got[0], []int{5, 6, 7}) {
		t.Fatalf("short chapter: %v", got)
	}
	if sweepBatchesOf(9, 3) != nil {
		t.Fatal("backwards span")
	}
}

func TestRememberedPages(t *testing.T) {
	seen := []Seen{{"3.10", 150}, {"3.30", 154}, {"3.A.2", 170}}
	for _, c := range []struct {
		label string
		want  []int
	}{
		// Halfway between 3.10 and 3.30 is p. 152; out from there.
		{"3.20", []int{152, 151, 153, 150, 154}},
		// Seen before: its page, then either side.
		{"3.30", []int{154, 155, 153}},
		// Past the last numbered one and before 3.A.2: numbers come first.
		{"3.40", []int{154, 155, 156, 157, 158, 159, 160, 161}},
		// Before the first: the pages leading up to it.
		{"3.2", []int{150, 149, 148, 147, 146, 145, 144, 143}},
		{"", nil},
	} {
		got := rememberedPages(seen, c.label)
		if c.label == "3.40" {
			// 3.40 sits between 3.30 (p. 154) and 3.A.2 (p. 170): the eight
			// nearest 154, where it's estimated to be.
			if len(got) != rememberedMax || got[0] != 154 {
				t.Errorf("3.40: %v", got)
			}
			continue
		}
		if !reflect.DeepEqual(got, c.want) {
			t.Errorf("%s: got %v, want %v", c.label, got, c.want)
		}
	}
	if got := rememberedPages([]Seen{{"1.1", 2}}, "1.0"); !reflect.DeepEqual(got, []int{2, 1}) {
		t.Errorf("never below page 1: %v", got)
	}
}

func TestCompareLabels(t *testing.T) {
	ordered := []string{"3.2", "3.10", "3.10a", "3.30", "3.A.2", "3.B.1", "4.1"}
	for i := 1; i < len(ordered); i++ {
		if compareKeys(labelKey(ordered[i-1]), labelKey(ordered[i])) >= 0 {
			t.Errorf("%s should come before %s", ordered[i-1], ordered[i])
		}
	}
}
