package engine

import (
	"strconv"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/pdf"
	"github.com/jackt/pset/internal/store"
)

// sectionTuple renders sections as compact "title source L<level> <start>-<end>"
// strings so test expectations stay readable.
func sectionTuple(sections []store.Section) []string {
	out := make([]string, len(sections))
	for i, s := range sections {
		out[i] = strings.Join([]string{
			s.Title, s.Source,
			"L" + strconv.Itoa(s.Level),
			strconv.Itoa(s.StartPage) + "-" + strconv.Itoa(s.EndPage),
		}, " ")
	}
	return out
}

func outlineSec(title string, level, start int) store.Section {
	return store.Section{Title: title, Source: store.SourceOutline, Level: level, StartPage: start}
}

func TestAssignEndPagesNested(t *testing.T) {
	sections := []store.Section{
		outlineSec("ch1", 1, 1),
		outlineSec("ch1.sec", 2, 2),
		outlineSec("ch2", 1, 3),
		outlineSec("ch2.sec", 2, 4),
	}
	assignEndPages(sections, 5)
	want := []string{
		"ch1 outline L1 1-2",
		"ch1.sec outline L2 2-2",
		"ch2 outline L1 3-5",
		"ch2.sec outline L2 4-5",
	}
	got := sectionTuple(sections)
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("section %d = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestAssignEndPagesFlat(t *testing.T) {
	sections := []store.Section{
		outlineSec("a", 1, 1),
		outlineSec("b", 1, 3),
		outlineSec("c", 1, 5),
	}
	assignEndPages(sections, 6)
	want := []string{"a outline L1 1-2", "b outline L1 3-4", "c outline L1 5-6"}
	got := sectionTuple(sections)
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("section %d = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestAssignEndPagesLastSectionReachesBookEnd(t *testing.T) {
	sections := []store.Section{outlineSec("only", 2, 4)}
	assignEndPages(sections, 30)
	if sections[0].EndPage != 30 {
		t.Errorf("end page = %d, want 30 (the book's last page)", sections[0].EndPage)
	}
}

func TestAssignEndPagesSamePageStartNeverGoesBackwards(t *testing.T) {
	sections := []store.Section{
		outlineSec("ch1", 1, 2),
		outlineSec("ch1.sec", 2, 2),
		outlineSec("ch2", 1, 2),
	}
	assignEndPages(sections, 9)
	for i, sec := range sections {
		if sec.EndPage < sec.StartPage {
			t.Errorf("section %d (%s) end %d precedes start %d", i, sec.Title, sec.EndPage, sec.StartPage)
		}
	}
	// ch1's boundary is ch2 on the same page; the range clamps to that page
	// instead of collapsing to an empty span.
	if sections[0].EndPage != 2 {
		t.Errorf("ch1 end = %d, want 2", sections[0].EndPage)
	}
	if sections[2].EndPage != 9 {
		t.Errorf("ch2 end = %d, want 9", sections[2].EndPage)
	}
}

func TestAssignEndPagesSortsByStartPage(t *testing.T) {
	// Defensive path: input whose page order does not match slice order must
	// still bound each section by the next one that starts later.
	sections := []store.Section{
		outlineSec("late", 1, 5),
		outlineSec("early", 1, 1),
	}
	assignEndPages(sections, 8)
	if sections[1].EndPage != 4 {
		t.Errorf("early end = %d, want 4", sections[1].EndPage)
	}
	if sections[0].EndPage != 8 {
		t.Errorf("late end = %d, want 8", sections[0].EndPage)
	}
}

func TestAssignEndPagesEmpty(t *testing.T) {
	assignEndPages(nil, 10) // must not panic
}

// flatXML is canned pdftohtml output for a book with no outline: 24pt
// headings and 17pt body text, one heading per page.
const flatXML = `<pdf2xml producer="poppler" version="24.02.0">
<page number="1" height="1262" width="892">
<fontspec id="0" size="24" family="Helvetica"/>
<fontspec id="1" size="17" family="Helvetica"/>
<text top="98" left="100" width="187" height="22" font="0"><b>Reading the Sky</b></text>
<text top="146" left="100" width="300" height="15" font="1">eleven body words sit on the first measured line here</text>
<text top="170" left="100" width="182" height="15" font="1">another nine body words fill the second body line</text>
</page>
<page number="2" height="1262" width="892">
<text top="98" left="100" width="220" height="22" font="0"><b>Collar Maintenance</b></text>
<text top="146" left="100" width="300" height="15" font="1">twelve more body words are waiting on this particular line</text>
</page>
</pdf2xml>`

func parseFlatXML(t *testing.T) *pdf.XMLDoc {
	t.Helper()
	doc, err := pdf.ParseXML([]byte(flatXML))
	if err != nil {
		t.Fatalf("parse fixture: %v", err)
	}
	if len(doc.Outline) != 0 {
		t.Fatalf("fixture unexpectedly carries %d outline entries", len(doc.Outline))
	}
	return doc
}

func TestInferSectionsFindsExactlyTheHeadings(t *testing.T) {
	doc := parseFlatXML(t)
	sections := inferSections(doc.Lines)
	want := []string{
		"Reading the Sky inferred L1 1-0",
		"Collar Maintenance inferred L1 2-0",
	}
	got := sectionTuple(sections)
	if len(got) != len(want) {
		t.Fatalf("sections = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("section %d = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestInferSectionsIgnoresLongOversizedLines(t *testing.T) {
	doc := parseFlatXML(t)
	// Oversized but far too long to be a heading; few words so the body
	// median stays at 17.
	doc.Lines = append(doc.Lines, pdf.XMLLine{
		Page: 2, Top: 300, Size: 24, Text: strings.Repeat("supercalifragilistic ", 5),
	})
	sections := inferSections(doc.Lines)
	if len(sections) != 2 {
		t.Fatalf("sections = %v, want only the two short headings", sectionTuple(sections))
	}
}

func TestInferSectionsMergesSplitLinesBeforeMeasuring(t *testing.T) {
	// A heading set in two font runs on one visual line (tops within 2px)
	// must be measured — and stored — as a single section, sized by the
	// larger run.
	splitXML := `<pdf2xml producer="poppler" version="24.02.0">
<page number="1" height="1262" width="892">
<fontspec id="0" size="24" family="Helvetica"/>
<fontspec id="1" size="17" family="Helvetica"/>
<text top="98" left="100" font="1">Part</text>
<text top="99" left="150" font="0">One</text>
<text top="146" left="100" font="1">eleven body words sit on the first measured line here</text>
<text top="170" left="100" font="1">another nine body words fill the second body line</text>
</page>
<page number="2" height="1262" width="892">
<text top="146" left="100" font="1">twelve more body words are waiting on this particular line</text>
</page>
</pdf2xml>`
	doc, err := pdf.ParseXML([]byte(splitXML))
	if err != nil {
		t.Fatalf("parse fixture: %v", err)
	}
	if len(doc.Lines) != 4 {
		t.Fatalf("parsed %d lines, want 4 (the heading runs merged into one)", len(doc.Lines))
	}
	sections := inferSections(doc.Lines)
	if len(sections) != 1 {
		t.Fatalf("sections = %v, want one merged heading", sectionTuple(sections))
	}
	if sections[0].Title != "Part One" {
		t.Errorf("merged title = %q, want %q", sections[0].Title, "Part One")
	}
}

func TestInferSectionsUniformTextHasNoHeadings(t *testing.T) {
	doc := parseFlatXML(t)
	for i := range doc.Lines {
		doc.Lines[i].Size = 17
	}
	if sections := inferSections(doc.Lines); len(sections) != 0 {
		t.Fatalf("sections = %v, want none for uniform body text", sectionTuple(sections))
	}
}

func TestInferSectionsNoLines(t *testing.T) {
	if sections := inferSections(nil); sections != nil {
		t.Fatalf("sections = %v, want nil", sections)
	}
	blank := []pdf.XMLLine{{Page: 1, Size: 17, Text: "   "}}
	if sections := inferSections(blank); sections != nil {
		t.Fatalf("sections = %v, want nil for whitespace-only lines", sections)
	}
}

func TestBodyMedianSize(t *testing.T) {
	cases := []struct {
		name  string
		lines []pdf.XMLLine
		want  float64
	}{
		{"no lines", nil, 0},
		{"one line", []pdf.XMLLine{{Size: 17, Text: "hello"}}, 17},
		{
			"body dominates",
			[]pdf.XMLLine{
				{Size: 24, Text: "a heading"},
				{Size: 17, Text: "one two three four five"},
				{Size: 17, Text: "six seven eight nine ten"},
			},
			17,
		},
		{
			"larger size carries the median once it covers half the words",
			[]pdf.XMLLine{
				{Size: 24, Text: "one two three four"},
				{Size: 17, Text: "one two three"},
			},
			24,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := bodyMedianSize(tc.lines); got != tc.want {
				t.Errorf("bodyMedianSize = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestOutlineSectionsShiftLevelsToOneBased(t *testing.T) {
	sections := outlineSections([]pdf.XMLOutlineEntry{
		{Title: "Chapter 1", Page: 3, Level: 0},
		{Title: "1.1 Beta", Page: 3, Level: 1},
		{Title: "Chapter 2", Page: 5, Level: 0},
	})
	want := []string{
		"Chapter 1 outline L1 3-0",
		"1.1 Beta outline L2 3-0",
		"Chapter 2 outline L1 5-0",
	}
	got := sectionTuple(sections)
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("section %d = %q, want %q", i, got[i], want[i])
		}
	}
}
