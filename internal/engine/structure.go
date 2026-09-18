package engine

import (
	"sort"
	"strings"

	"github.com/jackt/pset/internal/pdf"
	"github.com/jackt/pset/internal/store"
)

// Heading detection thresholds: a line counts as a heading when its font size
// clears 1.25x the coverage-weighted body median and the text stays short.
const (
	headingSizeRatio = 1.25
	headingMaxRunes  = 80
)

// outlineSections converts pdftohtml outline entries into stored sections.
// Levels shift to 1-based; the end pages are filled in later.
func outlineSections(entries []pdf.XMLOutlineEntry) []store.Section {
	sections := make([]store.Section, 0, len(entries))
	for _, en := range entries {
		sections = append(sections, store.Section{
			Level:     en.Level + 1,
			Title:     en.Title,
			Source:    store.SourceOutline,
			StartPage: en.Page,
		})
	}
	return sections
}

// inferSections finds heading candidates for books without an outline: the
// body median is the font size carrying half of all measured words, and a
// line qualifies when it renders clearly above it and stays short. Inferred
// sections are flat at level 1.
func inferSections(lines []pdf.XMLLine) []store.Section {
	median := bodyMedianSize(lines)
	if median <= 0 {
		return nil
	}
	var sections []store.Section
	for _, ln := range lines {
		if ln.Size < headingSizeRatio*median {
			continue
		}
		if len([]rune(ln.Text)) > headingMaxRunes {
			continue
		}
		sections = append(sections, store.Section{
			Level:     1,
			Title:     ln.Text,
			Source:    store.SourceInferred,
			StartPage: ln.Page,
		})
	}
	return sections
}

// bodyMedianSize returns the font size at which the cumulative word count of
// all lines crosses half of the total, i.e. the size of the text that covers
// most of the book. Zero when there is no measured text.
func bodyMedianSize(lines []pdf.XMLLine) float64 {
	type sizeWeight struct {
		size   float64
		weight int
	}
	sw := make([]sizeWeight, 0, len(lines))
	total := 0
	for _, ln := range lines {
		w := len(strings.Fields(ln.Text))
		if w == 0 {
			continue
		}
		sw = append(sw, sizeWeight{size: ln.Size, weight: w})
		total += w
	}
	if total == 0 {
		return 0
	}
	sort.Slice(sw, func(i, j int) bool { return sw[i].size < sw[j].size })
	acc := 0
	for _, s := range sw {
		acc += s.weight
		if 2*acc >= total {
			return s.size
		}
	}
	return 0
}

// assignEndPages fills every section's end page in place. Sections are
// ordered by (start page, sort order): a section ends where the next section
// at the same or shallower level begins, one page earlier; a section with no
// such successor — including the overall last one — runs to the book's page
// count. An end never precedes its own start page.
func assignEndPages(sections []store.Section, pageCount int) {
	type indexed struct {
		startPage int
		order     int
	}
	order := make([]indexed, len(sections))
	for i, sec := range sections {
		order[i] = indexed{startPage: sec.StartPage, order: i}
	}
	sort.SliceStable(order, func(i, j int) bool {
		if order[i].startPage != order[j].startPage {
			return order[i].startPage < order[j].startPage
		}
		return order[i].order < order[j].order
	})
	pos := make([]int, len(sections))
	for q, o := range order {
		pos[o.order] = q
	}

	for i := range sections {
		end := pageCount
		for q := pos[i] + 1; q < len(order); q++ {
			j := order[q].order
			if sections[j].Level <= sections[i].Level {
				end = sections[j].StartPage - 1
				break
			}
		}
		if end < sections[i].StartPage {
			end = sections[i].StartPage
		}
		sections[i].EndPage = end
	}
}
