package library

import (
	"regexp"
	"sort"
	"strings"
	"unicode"

	"github.com/jackt/pset/internal/pdf"
)

// Structure: the book's contents, from the PDF's outline when it has one,
// else from headings inferred from font sizes (a digital book) or from
// line shapes in the recognized text (a scanned one).

// Heading detection thresholds: a line counts as a heading when its font
// size clears 1.25x the coverage-weighted body median and the text stays
// short.
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

// inferSections finds heading candidates for a digital book with no
// outline: the body median is the font size carrying half of all words,
// and a line qualifies when it renders clearly above it and stays short.
func inferSections(lines []pdf.XMLLine) []section {
	median := bodyMedianSize(lines)
	if median <= 0 {
		return nil
	}
	var out []section
	for _, ln := range lines {
		if ln.Size < headingSizeRatio*median || len([]rune(ln.Text)) > headingMaxRunes {
			continue
		}
		out = append(out, section{Level: 1, Title: strings.TrimSpace(ln.Text), StartPage: ln.Page})
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

// Structural-pattern heading detection for books whose text lives only in
// stored page rows (OCR scans). Three conservative line shapes qualify:
//
//  1. a leading keyword with a number: "Chapter 3", "Appendix 12: Foo"
//  2. a short numbered line: "3.2 Collar Maintenance"
//  3. a short ALL-CAPS line: "THE KETTLE ARRAY"
//
// Matches become flat level-1 sections (source inferred). When in doubt,
// nothing is emitted: lines must stay short, numbered/caps remainders must
// not read like sentence fragments, and duplicate titles dedupe with the
// strongest shape winning: a "Chapter 1. Foo" heading beats an identical
// "1. Foo" table-of-contents entry found on an earlier page.
const (
	patternKeywordMaxRunes  = 80
	patternNumberedMaxRunes = 80
	patternCapsMaxRunes     = 60
	patternCapsMinLetters   = 3
)

var patternKeywordRe = regexp.MustCompile(`(?i)^\s*(chapter|part|section|appendix)\s+(\d{1,3})(.*)$`)

var patternNumberedRe = regexp.MustCompile(`^\s*(\d{1,3}(?:\.\d{1,3}){0,2})\.?\s+(\S.*)$`)

// patternKind ranks duplicate titles; higher wins.
type patternKind int

const (
	kindCaps patternKind = iota + 1
	kindNumbered
	kindKeyword
)

type patternHit struct {
	page  int
	order int
	kind  patternKind
	title string
}

// patternSections scans stored page text line by line and returns the
// structural headings it finds, in document order, with end pages assigned.
func patternSections(pages []storedPage) []section {
	hits := scanPatternLines(pages)
	kept := dedupePatternHits(hits)

	sections := make([]section, 0, len(kept))
	for _, hit := range kept {
		sections = append(sections, section{Level: 1, Title: hit.title, StartPage: hit.page})
	}
	return sections
}

func scanPatternLines(pages []storedPage) []patternHit {
	var hits []patternHit
	order := 0
	for _, page := range pages {
		for _, line := range strings.Split(page.Text, "\n") {
			if kind, title, ok := matchPatternLine(line); ok {
				hits = append(hits, patternHit{page: page.Number, order: order, kind: kind, title: title})
			}
			order++
		}
	}
	return hits
}

// dedupePatternHits collapses repeated titles (case- and space-insensitive),
// keeping the strongest pattern kind, then earliest occurrence.
func dedupePatternHits(hits []patternHit) []patternHit {
	best := map[string]patternHit{}
	for _, hit := range hits {
		key := strings.ToLower(collapseSpaces(hit.title))
		if prev, ok := best[key]; ok && hit.kind <= prev.kind {
			continue
		}
		best[key] = hit
	}
	out := make([]patternHit, 0, len(best))
	for _, hit := range best {
		out = append(out, hit)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].page != out[j].page {
			return out[i].page < out[j].page
		}
		return out[i].order < out[j].order
	})
	return out
}

func matchPatternLine(line string) (patternKind, string, bool) {
	line = strings.TrimRight(line, " \t\r")
	if line == "" {
		return 0, "", false
	}

	if m := patternKeywordRe.FindStringSubmatch(line); m != nil && runeLen(line) <= patternKeywordMaxRunes {
		title := keywordTitle(m[1], m[2], m[3])
		return kindKeyword, title, true
	}
	if m := patternNumberedRe.FindStringSubmatch(line); m != nil && runeLen(line) <= patternNumberedMaxRunes {
		rest := collapseSpaces(m[2])
		if !startsWithLetter(rest) || endsWithSentencePunct(rest) {
			return 0, "", false
		}
		return kindNumbered, rest, true
	}
	if runeLen(line) <= patternCapsMaxRunes && isCapsHeading(line) {
		return kindCaps, collapseSpaces(line), true
	}
	return 0, "", false
}

// keywordTitle renders the heading text after the keyword and number; with
// no remainder the canonical keyword and number stand alone ("Chapter 3").
func keywordTitle(keyword, number, rest string) string {
	rest = strings.TrimLeft(rest, " \t.:-–-")
	rest = collapseSpaces(rest)
	if rest == "" || endsWithSentencePunct(rest) {
		return keywordCanonical(keyword) + " " + number
	}
	return rest
}

func keywordCanonical(keyword string) string {
	switch strings.ToLower(keyword) {
	case "chapter":
		return "Chapter"
	case "part":
		return "Part"
	case "section":
		return "Section"
	case "appendix":
		return "Appendix"
	}
	return keyword
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
