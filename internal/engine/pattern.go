package engine

import (
	"regexp"
	"sort"
	"strings"
	"unicode"

	"github.com/jackt/pset/internal/store"
)

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
// strongest shape winning — a "Chapter 1. Foo" heading beats an identical
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
func patternSections(pages []store.Page) []store.Section {
	hits := scanPatternLines(pages)
	kept := dedupePatternHits(hits)

	sections := make([]store.Section, 0, len(kept))
	for _, hit := range kept {
		sections = append(sections, store.Section{
			Level:     1,
			Title:     hit.title,
			Source:    store.SourceInferred,
			StartPage: hit.page,
		})
	}
	assignEndPages(sections, maxPageNumber(pages))
	return sections
}

func scanPatternLines(pages []store.Page) []patternHit {
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
	rest = strings.TrimLeft(rest, " \t.:—–-")
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

func maxPageNumber(pages []store.Page) int {
	max := 0
	for _, p := range pages {
		if p.Number > max {
			max = p.Number
		}
	}
	return max
}
