package library

import (
	"regexp"
	"sort"
	"strings"
	"unicode"

	"github.com/jackt/pset/internal/pdf"
)

// Structure: the book's contents, from the PDF's outline when it has one,
// else as the model reads them (contents.go). What's here is the outline,
// the heading-shaped lines the model picks from, and the end pages.

// A digital book's line is a heading candidate when its font size clears
// 1.25x the coverage-weighted body median and the text stays short.
const (
	headingSizeRatio = 1.25
	headingMaxRunes  = 80
)

// outlineSections converts outline entries; levels become 1-based.
func outlineSections(entries []pdf.XMLOutlineEntry) []section {
	out := make([]section, 0, len(entries))
	for _, e := range entries {
		out = append(out, section{Level: e.Level + 1, Title: strings.TrimSpace(e.Title), StartPage: e.Page})
	}
	return out
}

// largerLines are a digital book's lines set clearly larger than its body
// text and short enough to be headings: candidates for the model to pick
// from. The body median is the font size carrying half of all words.
func largerLines(lines []pdf.XMLLine) []candidate {
	median := bodyMedianSize(lines)
	if median <= 0 {
		return nil
	}
	var out []candidate
	for _, ln := range lines {
		if ln.Size < headingSizeRatio*median || len([]rune(ln.Text)) > headingMaxRunes {
			continue
		}
		out = append(out, candidate{Page: ln.Page, Text: collapseSpaces(ln.Text)})
	}
	return out
}

// bodyMedianSize is the font size at which the cumulative word count
// crosses half the total. Zero when nothing is measured.
func bodyMedianSize(lines []pdf.XMLLine) float64 {
	type sw struct {
		size   float64
		weight int
	}
	var all []sw
	total := 0
	for _, ln := range lines {
		w := len(strings.Fields(ln.Text))
		if w == 0 {
			continue
		}
		all = append(all, sw{ln.Size, w})
		total += w
	}
	if total == 0 {
		return 0
	}
	sort.Slice(all, func(i, j int) bool { return all[i].size < all[j].size })
	acc := 0
	for _, s := range all {
		acc += s.weight
		if 2*acc >= total {
			return s.size
		}
	}
	return 0
}

// assignEndPages fills each section's end page: a section ends one page
// before the next section at the same or a shallower level starts, or at
// the book's last page. An end never precedes its own start.
func assignEndPages(secs []section, pageCount int) {
	order := make([]int, len(secs))
	for i := range order {
		order[i] = i
	}
	sort.SliceStable(order, func(a, b int) bool { return secs[order[a]].StartPage < secs[order[b]].StartPage })
	pos := make([]int, len(secs))
	for q, i := range order {
		pos[i] = q
	}
	for i := range secs {
		end := pageCount
		for q := pos[i] + 1; q < len(order); q++ {
			j := order[q]
			if secs[j].Level <= secs[i].Level {
				end = secs[j].StartPage - 1
				break
			}
		}
		secs[i].EndPage = max(end, secs[i].StartPage)
	}
}

// cleanSections drops entries pointing outside the book and sorts by page,
// keeping outline order among entries on the same page.
func cleanSections(secs []section, pageCount int) []section {
	out := secs[:0]
	for _, s := range secs {
		if s.Title != "" && s.StartPage >= 1 && s.StartPage <= pageCount {
			out = append(out, s)
		}
	}
	sort.SliceStable(out, func(a, b int) bool { return out[a].StartPage < out[b].StartPage })
	return out
}

// Heading-shaped lines, the candidates the model picks from when a book
// has no usable printed contents. Three line shapes qualify:
//
//  1. a leading keyword with a number: "Chapter 3", "Section 2.3 Foo"
//  2. a short numbered line: "3.2 Collar Maintenance"
//  3. a short ALL-CAPS line: "THE KETTLE ARRAY"
//
// The numbering stays in the text: it is how the model tells a chapter
// from a section. A numbered line that reads like a sentence fragment
// doesn't qualify.
const (
	patternKeywordMaxRunes  = 80
	patternNumberedMaxRunes = 80
	patternCapsMaxRunes     = 60
	patternCapsMinLetters   = 3
)

var patternKeywordRe = regexp.MustCompile(`(?i)^\s*(chapter|part|section|appendix)\s+(\d{1,3}(?:\.\d{1,3})*|[A-Z])\b`)

var patternNumberedRe = regexp.MustCompile(`^\s*(\d{1,3}(?:\.\d{1,3}){0,2})\.?\s+(\S.*)$`)

// headingShaped reports whether a line has one of the three shapes.
func headingShaped(line string) bool {
	line = strings.TrimSpace(line)
	if line == "" {
		return false
	}
	if patternKeywordRe.MatchString(line) {
		return runeLen(line) <= patternKeywordMaxRunes
	}
	if m := patternNumberedRe.FindStringSubmatch(line); m != nil && runeLen(line) <= patternNumberedMaxRunes {
		rest := collapseSpaces(m[2])
		return startsWithLetter(rest) && !endsWithSentencePunct(rest)
	}
	return runeLen(line) <= patternCapsMaxRunes && isCapsHeading(line)
}

// isCapsHeading reports whether a line reads as a short ALL-CAPS heading: it
// starts with an uppercase letter and every letter in it is uppercase.
func isCapsHeading(line string) bool {
	rs := []rune(line)
	if len(rs) == 0 || !unicode.IsUpper(rs[0]) {
		return false
	}
	letters := 0
	for _, r := range rs {
		if !unicode.IsLetter(r) {
			continue
		}
		if !unicode.IsUpper(r) {
			return false
		}
		letters++
	}
	return letters >= patternCapsMinLetters
}

func startsWithLetter(s string) bool {
	for _, r := range s {
		return unicode.IsLetter(r)
	}
	return false
}

// endsWithSentencePunct rejects lines that end like prose rather than a
// heading ("... on 17 October 1961." wrapping onto its own line).
func endsWithSentencePunct(s string) bool {
	return strings.HasSuffix(s, ".") || strings.HasSuffix(s, "!") ||
		strings.HasSuffix(s, "?") || strings.HasSuffix(s, ",") || strings.HasSuffix(s, ";")
}

func runeLen(s string) int { return len([]rune(s)) }

func collapseSpaces(s string) string {
	return strings.Join(strings.Fields(s), " ")
}
