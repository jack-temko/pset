package engine

import (
	"strings"
	"testing"

	"github.com/jackt/pset/internal/store"
)

func pagesOf(texts ...string) []store.Page {
	pages := make([]store.Page, len(texts))
	for i, t := range texts {
		pages[i] = store.Page{Number: i + 1, Text: t}
	}
	return pages
}

func patternTuples(pages []store.Page) []string {
	sections := patternSections(pages)
	return sectionTuple(sections)
}

func TestPatternKeywordLines(t *testing.T) {
	got := patternTuples(pagesOf(
		"Chapter 1. A First Gavel\nbody text follows here.\n",
		"chapter 2: Reading the Register\nmore body.\n",
		"CHAPTER 3 The Families\nAppendix 12\nPart 4\nSection 7. Odds and Ends\n",
	))
	want := []string{
		"A First Gavel inferred L1 1-1",
		"Reading the Register inferred L1 2-2",
		"The Families inferred L1 3-3",
		"Appendix 12 inferred L1 3-3",
		"Part 4 inferred L1 3-3",
		"Odds and Ends inferred L1 3-3",
	}
	for i := range want {
		if i >= len(got) {
			t.Fatalf("missing section %d, got %v", i, got)
		}
		if got[i] != want[i] {
			t.Errorf("section %d = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestPatternNumberedLines(t *testing.T) {
	got := patternTuples(pagesOf(
		"1. Introduction\n2.3 Collar Maintenance\n10.12.2 Deep Nesting\nbody prose continues.\n",
	))
	want := []string{
		"Introduction inferred L1 1-1",
		"Collar Maintenance inferred L1 1-1",
		"Deep Nesting inferred L1 1-1",
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("section %d = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestPatternCapsLines(t *testing.T) {
	got := patternTuples(pagesOf(
		"THE KETTLE ARRAY\nA body line about arrays.\nSTATION UMBEL-7, LAKE VAIR\n",
	))
	want := []string{
		"THE KETTLE ARRAY inferred L1 1-1",
		"STATION UMBEL-7, LAKE VAIR inferred L1 1-1",
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("section %d = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestPatternRejectsNonHeadings(t *testing.T) {
	got := patternTuples(pagesOf(
		strings.Join([]string{
			"",
			"   ",
			"The Kettle Array",
			"a quiet lowercase sentence line.",
			"4006 gavels were recorded.",
			"17 October 1961.",
			"12 345",
			"A C",
			"3.5",
			"By the winter of 1971 the Register held four thousand and six gavels, and the sheds ran out of room for the slips.",
		}, "\n") + "\n",
	))
	if len(got) != 0 {
		t.Errorf("sections = %v, want none from prose, numbers and short non-headings", got)
	}
}

func TestPatternDedupePrefersStrongestShape(t *testing.T) {
	// The TOC entry (page 1, numbered) and the running header (pages 1 and 4,
	// caps) collapse into the chapter heading (page 2, keyword); the repeated
	// header stays at its first page.
	got := patternTuples(pagesOf(
		"Contents\n1. A First Gavel\n2. Reading the Register\nA FIRST GAVEL\n",
		"Chapter 1. A First Gavel\nChapter 2. Reading the Register\n",
		"filler page with ordinary text only.\n",
		"A FIRST GAVEL\n",
	))
	want := []string{
		"A First Gavel inferred L1 2-2",
		"Reading the Register inferred L1 2-4",
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("section %d = %q, want %q", i, got[i], want[i])
		}
	}
	if len(got) != len(want) {
		t.Errorf("got %d sections (%v), want %d", len(got), got, len(want))
	}
}

func TestPatternLongLinesAreIgnored(t *testing.T) {
	long := strings.Repeat("Chapter", 20) + " 3 tail"
	got := patternTuples(pagesOf(long + "\n" + strings.Repeat("LOUD ", 30) + "\n"))
	if len(got) != 0 {
		t.Errorf("sections = %v, want none from overlong lines", got)
	}
}

func TestPatternEndPagesAndOrder(t *testing.T) {
	got := patternTuples(pagesOf(
		"ONE\nbody.\n",
		"Chapter 2. Middle\nbody.\n",
		"TWO\nChapter 4. Last\n",
	))
	want := []string{
		"ONE inferred L1 1-1",
		"Middle inferred L1 2-2",
		"TWO inferred L1 3-3",
		"Last inferred L1 3-3",
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("section %d = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestPatternEmptyPages(t *testing.T) {
	if got := patternSections(nil); len(got) != 0 {
		t.Errorf("sections = %v, want none for no pages", got)
	}
	if got := patternSections(pagesOf("", "\n\n")); len(got) != 0 {
		t.Errorf("sections = %v, want none for blank pages", got)
	}
}
