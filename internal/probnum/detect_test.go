package probnum

import (
	"fmt"
	"strings"
	"testing"
)

// book builds a three-chapter book of three sections each, four pages a
// section, with its problems written by problems(chapter, section) onto
// the pages it names.
type page = string

func book(write func(pages []page, ch, sec, start, end int)) ([]page, []Part) {
	pages := make([]page, 3*3*4+2)
	for i := range pages {
		pages[i] = "Some text about the subject.\nMore of it."
	}
	var parts []Part
	p := 3
	for ch := 1; ch <= 3; ch++ {
		chStart := p
		for sec := 1; sec <= 3; sec++ {
			parts = append(parts, Part{Number: fmt.Sprintf("%d.%d", ch, sec), Start: p, End: p + 3})
			pages[p-1] = fmt.Sprintf("%d.%d A Section Title\n%s", ch, sec, pages[p-1])
			write(pages, ch, sec, p, p+3)
			p += 4
		}
		parts = append(parts, Part{Number: fmt.Sprint(ch), Start: chStart, End: p - 1})
	}
	return pages, parts
}

func TestDetectLocal(t *testing.T) {
	// Boyce: a Problems heading at each section's end, then 1., 2., ...
	pages, parts := book(func(pages []page, ch, sec, start, end int) {
		var b strings.Builder
		b.WriteString("Problems\n")
		for k := 1; k <= 8; k++ {
			fmt.Fprintf(&b, "%d. y'' + %dy = 0\n", k, k)
		}
		pages[end-1] += "\n" + b.String()
	})
	st, ok := Detect(pages, parts)
	if !ok || st.Form != FormLocal || st.Where != WhereSection || !st.Sure || st.Heading != "Problems" {
		t.Fatalf("style %+v %v", st, ok)
	}
	if st.Example == nil || st.Example.Label != "1.1 #7" || st.Example.Page != 6 {
		t.Fatalf("example %+v", st.Example)
	}
}

func TestDetectChapter(t *testing.T) {
	// Alexander & Sadiku: problems through the chapter at its end, past
	// the section numbers that also open lines.
	pages, parts := book(func(pages []page, ch, sec, start, end int) {
		if sec != 3 {
			return
		}
		var b strings.Builder
		b.WriteString("Problems\n")
		for k := 1; k <= 20; k++ {
			fmt.Fprintf(&b, "%d.%d Find the current in the circuit.\n", ch, k)
		}
		pages[end-1] += "\n" + b.String()
	})
	st, ok := Detect(pages, parts)
	if !ok || st.Form != FormChapter || st.Where != WhereChapter || !st.Sure {
		t.Fatalf("style %+v %v", st, ok)
	}
	if st.Example == nil || st.Example.Label != "1.4" {
		t.Fatalf("example %+v, want the first past the sections", st.Example)
	}
}

func TestDetectSection(t *testing.T) {
	// Yates & Goodman: 2.1.4, all at the chapter's end.
	pages, parts := book(func(pages []page, ch, sec, start, end int) {
		if sec != 3 {
			return
		}
		var b strings.Builder
		b.WriteString("Problems\n")
		for s := 1; s <= 3; s++ {
			for k := 1; k <= 5; k++ {
				fmt.Fprintf(&b, "%d.%d.%d Suppose you flip a coin.\n", ch, s, k)
			}
		}
		pages[end-1] += "\n" + b.String()
	})
	st, ok := Detect(pages, parts)
	if !ok || st.Form != FormSection || st.Where != WhereChapter || !st.Sure {
		t.Fatalf("style %+v %v", st, ok)
	}
}

func TestDetectNothing(t *testing.T) {
	pages, parts := book(func([]page, int, int, int, int) {})
	if st, ok := Detect(pages, parts); ok {
		t.Fatalf("found %+v in a book without problems", st)
	}
}

func TestPartNumber(t *testing.T) {
	for title, want := range map[string]string{
		"3.1 Homogeneous Differential Equations": "3.1",
		"Chapter 2: Sequential Experiments":      "2",
		"Chapter 1 Basic Concepts":               "1",
		"1.7.1 TV Picture Tube":                  "1.7.1",
		"Preface":                                "",
		"PART 1 DC Circuits":                     "",
	} {
		if got := PartNumber(title); got != want {
			t.Errorf("PartNumber(%q) = %q, want %q", title, got, want)
		}
	}
}
