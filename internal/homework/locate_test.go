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
