// Package pagenum turns PDF pages into the numbers printed on them, and
// back. Everything else in the app keeps PDF pages; only this package
// knows how a book's printed numbers run, so a scan that lost a page
// partway is right everywhere at once. Spec: design/workspace.md, "Page
// numbers".
package pagenum

import (
	"fmt"
	"slices"
)

// Map is a book's printed numbering: its runs, in page order. The first
// run covers every page before the second, from page 1. The zero Map is a
// book whose printed numbers are its PDF pages.
type Map struct {
	runs []Run
}

// New is the map of runs, tidied: sorted, one run per start page, the
// first starting at page 1, and a run that changes nothing folded into the
// one before it.
func New(runs []Run) Map {
	rs := slices.Clone(runs)
	slices.SortStableFunc(rs, func(a, b Run) int { return a.From - b.From })
	var out []Run
	for _, r := range rs {
		if r.From < 1 {
			r.From = 1
		}
		if n := len(out); n > 0 && out[n-1].From == r.From {
			out[n-1] = r
			continue
		}
		out = append(out, r)
	}
	if len(out) > 0 {
		out[0].From = 1
	}
	var folded []Run
	for _, r := range out {
		if n := len(folded); n > 0 && folded[n-1].Offset == r.Offset {
			continue
		}
		folded = append(folded, r)
	}
	return Map{runs: folded}
}

// Single is the map of a book with one offset throughout.
func Single(offset int) Map { return New([]Run{{From: 1, Offset: offset}}) }

// Runs is the map's runs, never empty.
func (m Map) Runs() []Run {
	if len(m.runs) == 0 {
		return []Run{{From: 1}}
	}
	return slices.Clone(m.runs)
}

// Offset is the offset in force on a PDF page.
func (m Map) Offset(pdf int) int {
	off := 0
	for _, r := range m.runs {
		if r.From > pdf {
			break
		}
		off = r.Offset
	}
	return off
}

// Printed is the number printed on a PDF page. ok is false for a page
// before printed page 1: front matter, which has none of its own.
func (m Map) Printed(pdf int) (n int, ok bool) {
	n = pdf - m.Offset(pdf)
	return n, n >= 1
}

// PDF is the PDF page a printed number is on. ok is false when no page in
// the scan carries it: a page the scan lost, or one past the last. Where a
// book repeats a number (a duplicated page), the first wins.
func (m Map) PDF(printed int) (pdf int, ok bool) {
	for i, r := range m.Runs() {
		p := printed + r.Offset
		if p < r.From {
			continue
		}
		if i+1 < len(m.runs) && p >= m.runs[i+1].From {
			continue
		}
		return p, true
	}
	return 0, false
}

// Nearest is the PDF page of a printed number, or of the nearest one the
// scan has: a citation of a lost page lands beside where it would be.
func (m Map) Nearest(printed int) int {
	if p, ok := m.PDF(printed); ok {
		return p
	}
	// A lost page falls in a gap between two runs: the page after the gap
	// is the nearest one printed later.
	for _, r := range m.Runs() {
		if printed+r.Offset < r.From {
			return max(1, r.From)
		}
	}
	return max(1, printed+m.Offset(1<<30))
}

// Name is a PDF page as a sentence names it, for the model and for
// messages: "p. 112", or "a front-matter page (PDF page 7)".
func (m Map) Name(pdf int) string {
	if n, ok := m.Printed(pdf); ok {
		return fmt.Sprintf("p. %d", n)
	}
	return fmt.Sprintf("a front-matter page (PDF page %d)", pdf)
}

// Gap is where the printed numbers jump between two runs: Missing pages
// the scan doesn't have (a lost page), or Extra pages it has that the
// numbering skips (unnumbered plates, a duplicated page).
type Gap struct {
	// At is the first PDF page of the run after the jump.
	At      int
	Missing []int
	Extra   int
}

// Gaps is every jump in the numbering, in page order.
func (m Map) Gaps() []Gap {
	var out []Gap
	for i := 1; i < len(m.runs); i++ {
		prev, cur := m.runs[i-1], m.runs[i]
		g := Gap{At: cur.From}
		switch d := prev.Offset - cur.Offset; {
		case d > 0:
			last := cur.From - 1 - prev.Offset
			for k := 1; k <= d; k++ {
				g.Missing = append(g.Missing, last+k)
			}
		case d < 0:
			g.Extra = -d
		}
		out = append(out, g)
	}
	return out
}
