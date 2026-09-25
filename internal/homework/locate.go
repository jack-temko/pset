package homework

import (
	"regexp"
	"strconv"
)

// The locate ladder's deterministic half. A question that is nothing but
// a problem number ("3.36") is noise to search, which reads it as the
// digits 3 and 36 on every page of a math book, so exact tiers come first:
// a printed page the question cites, then pages whose text opens a line
// with the label as a problem statement.

// labelShape matches a question that is just a label, with an optional
// kind word and a trailing parenthetical note: "3.36", "Problem 3.36.",
// "Exercise 2.A.4", "1.2.3" (chapter, section, problem), "3.24 (use
// matlab)". Prose after it fails the match.
var labelShape = regexp.MustCompile(
	`(?i)^\s*(?:problem\s+|prob\.?\s*|exercise\s+|ex\.?\s*|question\s+|q\.?\s*)?(\d{1,2}(?:\.(?:[A-Z]|\d{1,2}))?\.\d{1,3}[a-z]?)\.?\s*(?:\([^()]*\))?\s*$`)

// sectionLabel is a label in a book whose problems start again in each
// section, as the app writes it: "3.1 #7".
var sectionLabel = regexp.MustCompile(`^\s*(\d{1,2}\.\d{1,2} #\d{1,3}[a-h]?)\s*$`)

// questionLabel reports the label a question is nothing but.
func questionLabel(text string) (string, bool) {
	if m := sectionLabel.FindStringSubmatch(text); m != nil {
		return m[1], true
	}
	m := labelShape.FindStringSubmatch(text)
	if m == nil {
		return "", false
	}
	return m[1], true
}

var chapterOfLabel = regexp.MustCompile(`^(\d{1,2})\.`)

// labelChapter is the chapter a label lives in: "3.36" and "3.A.4" are in
// chapter 3.
func labelChapter(label string) (int, bool) {
	m := chapterOfLabel.FindStringSubmatch(label)
	if m == nil {
		return 0, false
	}
	n, err := strconv.Atoi(m[1])
	return n, err == nil && n > 0
}

var citedPage = regexp.MustCompile(`(?i)\b(?:page|pg\.?|p\.)\s*(\d{1,4})\b`)

// printedPageOf finds a printed page a question cites ("p. 143").
func printedPageOf(text string) (int, bool) {
	m := citedPage.FindStringSubmatch(text)
	if m == nil {
		return 0, false
	}
	n, err := strconv.Atoi(m[1])
	return n, err == nil && n > 0
}

// labelScanMax keeps an answer key from crowding the candidates: the
// vision round still decides which hit is the assigned problem.
const labelScanMax = 4

// labelScan finds pages (PDF numbers) whose text opens a line with the
// label as a problem statement: the label, an optional dot, then content
// on the same line. References ("Fig. 3.36", "(3.36)") never open a line.
func labelScan(pages []string, label string) []int {
	re := regexp.MustCompile(`(?m)^\s*` + regexp.QuoteMeta(label) + `\.?[ \t]+\S`)
	var out []int
	for i, text := range pages {
		if re.MatchString(text) {
			out = append(out, i+1)
			if len(out) == labelScanMax {
				break
			}
		}
	}
	return out
}

// A sweep reads at most two batches of eight pages, from the end of the
// chapter, where the problems usually are.
const (
	sweepBatch   = 8
	sweepBatches = 2
)

func sweepBatchesOf(start, end int) [][]int {
	if end < start {
		return nil
	}
	if window := sweepBatch * sweepBatches; end-start+1 > window {
		start = end - window + 1
	}
	var batches [][]int
	for p := end; p >= start; p -= sweepBatch {
		var b []int
		for q := max(start, p-sweepBatch+1); q <= p; q++ {
			b = append(b, q)
		}
		batches = append(batches, b)
	}
	return batches
}

// rememberedMax bounds the pages a remembered range offers one locate.
const rememberedMax = 8

// rememberedPages is where memory says a problem should be, most likely
// first: between the nearest problems seen before and after it, nearest
// the page its number suggests. Only a problem seen before is past the
// last page seen; only one seen after, before the first.
func rememberedPages(seen []Seen, label string) []int {
	if label == "" || len(seen) == 0 {
		return nil
	}
	key := labelKey(label)
	var lo, hi *Seen
	for i := range seen {
		s := &seen[i]
		if s.Label == label {
			return []int{s.Page, s.Page + 1, s.Page - 1}
		}
		switch c := compareKeys(labelKey(s.Label), key); {
		case c < 0 && (lo == nil || compareKeys(labelKey(lo.Label), labelKey(s.Label)) < 0):
			lo = s
		case c > 0 && (hi == nil || compareKeys(labelKey(s.Label), labelKey(hi.Label)) < 0):
			hi = s
		}
	}
	var from, to, est int
	switch {
	case lo != nil && hi != nil:
		from, to = min(lo.Page, hi.Page), max(lo.Page, hi.Page)
		est = from
		if a, b, n, ok := lastNumbers(lo.Label, hi.Label, label); ok && b > a {
			est = from + (n-a)*(to-from)/(b-a)
		}
	case lo != nil:
		from, to, est = lo.Page, lo.Page+rememberedMax-1, lo.Page
	case hi != nil:
		from, to, est = hi.Page-rememberedMax+1, hi.Page, hi.Page
	default:
		return nil
	}
	var out []int
	for d := 0; len(out) < rememberedMax && (est-d >= from || est+d <= to); d++ {
		if est-d >= from && est-d >= 1 {
			out = append(out, est-d)
		}
		if d > 0 && est+d <= to && len(out) < rememberedMax {
			out = append(out, est+d)
		}
	}
	return out
}

// labelKey splits a label for ordering: "3.A.12b" is 3, A, 12, b.
func labelKey(label string) []string {
	return labelParts.FindAllString(label, -1)
}

var labelParts = regexp.MustCompile(`\d+|[A-Za-z]+`)

// compareKeys orders labels as the book numbers them: numbers by value,
// letters alphabetically, and a shorter label before its extensions.
func compareKeys(a, b []string) int {
	for i := 0; i < len(a) && i < len(b); i++ {
		x, xerr := strconv.Atoi(a[i])
		y, yerr := strconv.Atoi(b[i])
		switch {
		case xerr == nil && yerr == nil && x != y:
			return x - y
		case (xerr == nil) != (yerr == nil):
			// A number sorts before letters.
			if xerr == nil {
				return -1
			}
			return 1
		case xerr != nil && a[i] != b[i]:
			if a[i] < b[i] {
				return -1
			}
			return 1
		}
	}
	return len(a) - len(b)
}

// lastNumbers is the final number of three labels that differ only
// there, as 3.10, 3.30 and 3.20 do, for interpolating a page.
func lastNumbers(lo, hi, label string) (a, b, n int, ok bool) {
	ka, kb, kn := labelKey(lo), labelKey(hi), labelKey(label)
	if len(ka) != len(kn) || len(kb) != len(kn) || len(kn) == 0 {
		return 0, 0, 0, false
	}
	last := len(kn) - 1
	for i := 0; i < last; i++ {
		if ka[i] != kn[i] || kb[i] != kn[i] {
			return 0, 0, 0, false
		}
	}
	var err1, err2, err3 error
	a, err1 = strconv.Atoi(ka[last])
	b, err2 = strconv.Atoi(kb[last])
	n, err3 = strconv.Atoi(kn[last])
	return a, b, n, err1 == nil && err2 == nil && err3 == nil
}
