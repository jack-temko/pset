package homework

import (
	"strings"
	"testing"

	"github.com/jackt/pset/internal/pagenum"
	"github.com/jackt/pset/internal/probnum"
)

// boyceLike is a book whose problems start again in each section, under
// a bare "Problems" at the section's end: both sections have a problem 7.
func boyceLike() (Book, []string) {
	pages := make([]string, 30)
	for i := range pages {
		pages[i] = "Text about differential equations.\nMore text."
	}
	pages[13] = "3.1 Homogeneous Equations\nWorked examples.\nProblems\n1. y'' + 2y' - 3y = 0\n7. 6y'' - y' - y = 0, y(0) = 1"
	pages[19] = "Problems\n1. Find the Wronskian of e^t and e^{2t}.\n7. Find the Wronskian of cos t and sin t."
	book := Book{
		ID: "b", PageCount: len(pages), Pages: pagenum.Single(2),
		Problems: probnum.Style{Form: probnum.FormLocal, Where: probnum.WhereSection, Heading: "Problems"},
		Parts: []probnum.Part{
			{Number: "3", Title: "3 Second-Order Equations", Start: 10, End: 20},
			{Number: "3.1", Title: "3.1 Homogeneous Equations", Start: 10, End: 14},
			{Number: "3.2", Title: "3.2 The Wronskian", Start: 15, End: 20},
		},
	}
	return book, pages
}

func TestScopeFindsTheRightSectionsProblem(t *testing.T) {
	book, pages := boyceLike()
	for _, c := range []struct {
		text  string
		first int
		lo    int
		hi    int
	}{
		{"Chapter 3.1 Problem 7", 14, 10, 15},
		{"3.2 #7", 20, 15, 21},
	} {
		ref, _ := ParseRefs(c.text, book.Problems)
		sc, ok := scopeOf(book, ref[0], pages)
		if !ok || sc.pages[0] != c.first || !sc.exact[c.first] || sc.lo != c.lo || sc.hi != c.hi {
			t.Errorf("%s: %+v", c.text, sc)
		}
		if !strings.Contains(sc.hint, "start again at 1") || !strings.Contains(sc.hint, `"7."`) {
			t.Errorf("%s: hint %q", c.text, sc.hint)
		}
		for _, p := range sc.pages {
			if p < c.lo || p > c.hi {
				t.Errorf("%s: page %d outside the section", c.text, p)
			}
		}
	}
}

func TestScopeOfACitedPage(t *testing.T) {
	book, pages := boyceLike()
	ref, _ := ParseRefs("Page 12 Problem 7", book.Problems)
	sc, ok := scopeOf(book, ref[0], pages)
	if !ok || sc.pages[0] != 14 || sc.lo != 13 || sc.hi != 16 {
		t.Fatalf("scope %+v", sc)
	}
}

func TestScopeOfAChapterNumberedProblem(t *testing.T) {
	pages := make([]string, 20)
	for i := range pages {
		pages[i] = "Text about circuits."
	}
	// Section headings open lines the way problem numbers do.
	pages[2] = "4.25 Summary of the chapter's methods\nMore text."
	pages[9] = "Problems\n4.1 Find the current.\n4.24 Find the voltage."
	pages[10] = "4.25 Obtain vo in the circuit of Fig. 4.93.\n4.26 Use source transformation."
	book := Book{
		ID: "b", PageCount: len(pages), Pages: pagenum.Single(0),
		Problems: probnum.Style{Form: probnum.FormChapter, Where: probnum.WhereChapter},
		Parts:    []probnum.Part{{Number: "4", Title: "Chapter 4 Circuit Theorems", Start: 2, End: 12}},
	}
	ref, _ := ParseRefs("4.25 (no PSpice)", book.Problems)
	sc, ok := scopeOf(book, ref[0], pages)
	if !ok || sc.pages[0] != 11 || sc.exact[3] {
		t.Fatalf("scope %+v: the section heading on p. 3 isn't the problem", sc)
	}
}

func TestNoScopeWithoutTheContents(t *testing.T) {
	book, pages := boyceLike()
	book.Parts = nil
	ref, _ := ParseRefs("3.1 #7", book.Problems)
	if sc, ok := scopeOf(book, ref[0], pages); ok {
		t.Fatalf("scoped without contents: %+v", sc)
	}
}

func TestImageLabel(t *testing.T) {
	book, _ := boyceLike()
	if got := imageLabel(book, 2, 14); got != "Image 2 (p. 12, in 3.1 Homogeneous Equations):" {
		t.Fatalf("label %q", got)
	}
}

// A row naming several problems becomes a question each, labelled the
// book's way; a written-out problem stays one question.
func TestAddSplitsARowIntoItsProblems(t *testing.T) {
	e := newEnv(t)
	h := e.newSet(t)
	qs := e.add(t, h.ID,
		Draft{Text: "3.1: 1, 7 (4 pts each)", InBook: true},
		Draft{Text: "Find the voltage across a 2 Ω resistor.", InBook: false})
	var labels, texts []string
	for _, q := range qs {
		labels = append(labels, q.Label)
		texts = append(texts, q.Text)
	}
	if strings.Join(labels, "|") != "3.1 #1|3.1 #7|Find the voltage across a 2 Ω resistor." ||
		texts[1] != "3.1 #7 (4 pts each)" {
		t.Fatalf("labels %q, texts %q", labels, texts)
	}
}
