// Package probnum knows how a book numbers its problems: through each
// chapter (4.27), by section (2.1.4), or starting over in every section
// (7.). The same digits mean different things in each, so a reference
// can't be read until the book's style is known. Detected from the book's
// text and contents at import; the student can confirm or correct it.
// Spec: ideas/book-structure.md, part 2.
package probnum

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Part is a numbered chapter ("3") or section ("3.1") of the book, on PDF
// pages Start to End.
type Part struct {
	Number     string
	Title      string
	Start, End int
}

var partNumber = regexp.MustCompile(`(?i)^\s*(?:chapter\s+|section\s+|§\s*)?(\d{1,2}(?:\.\d{1,2}){0,2})(?:[.:\s]|$)`)

// PartNumber is the number a contents title opens with ("3.1
// Homogeneous...", "Chapter 2: Sequential..."), or "".
func PartNumber(title string) string {
	m := partNumber.FindStringSubmatch(title)
	if m == nil {
		return ""
	}
	return m[1]
}

// headingLine is a problem set's heading alone on its line.
var headingLine = regexp.MustCompile(`(?i)^\s*(problems|exercises|exercise set(?:\s+[\d.]+)?|problem set(?:\s+[\d.]+)?|homework problems|review problems)\s*[:.]?\s*$`)

// Detect works out a book's style from its pages' text (index i is PDF
// page i+1) and its numbered chapters and sections. ok is false when the
// book shows no numbered problems at all.
func Detect(pages []string, parts []Part) (Style, bool) {
	var chapters, sections []Part
	subsections := map[string]bool{}
	for _, p := range parts {
		switch strings.Count(p.Number, ".") {
		case 0:
			chapters = append(chapters, p)
		case 1:
			sections = append(sections, p)
		case 2:
			subsections[p.Number] = true
		}
	}
	lines := func(from, to int) []string {
		var out []string
		for p := max(from, 1); p <= min(to, len(pages)); p++ {
			out = append(out, strings.Split(pages[p-1], "\n")...)
		}
		return out
	}
	chapterOf := func(sec Part) Part {
		ch, _, _ := strings.Cut(sec.Number, ".")
		for _, c := range chapters {
			if c.Number == ch {
				return c
			}
		}
		return sec
	}

	heads := map[string]int{}
	type score struct {
		fit, of int
		example *Example
	}

	// Through the chapter: lines opening "4.27 " for problem numbers past
	// the chapter's own sections, which open lines too ("4.1 Introduction").
	var chapter score
	for _, c := range chapters {
		if c.End-c.Start < 2 {
			continue
		}
		chapter.of++
		lastSection := 0
		for _, s := range sections {
			if n, ok := after(s.Number, c.Number); ok && n > lastSection {
				lastSection = n
			}
		}
		re := regexp.MustCompile(`^\s*` + regexp.QuoteMeta(c.Number) + `\.(\d{1,3})\s+\S`)
		ks := map[int]int{}
		for p := c.Start; p <= min(c.End+1, len(pages)); p++ {
			for _, l := range strings.Split(pages[p-1], "\n") {
				if m := re.FindStringSubmatch(l); m != nil {
					if k, _ := strconv.Atoi(m[1]); k > lastSection {
						if _, seen := ks[k]; !seen {
							ks[k] = p
						}
					}
				}
			}
		}
		if len(ks) >= 5 {
			chapter.fit++
			if chapter.example == nil {
				k := smallest(ks)
				chapter.example = &Example{Label: fmt.Sprintf("%s.%d", c.Number, k), Page: ks[k]}
			}
		}
	}

	// By section: lines opening "2.1.4", anywhere in the chapter, that
	// aren't the contents' own subsections.
	var section score
	inOwnPages, atChapterEnd := 0, 0
	for _, s := range sections {
		ch := chapterOf(s)
		section.of++
		re := regexp.MustCompile(`^\s*` + regexp.QuoteMeta(s.Number) + `\.(\d{1,3})\b`)
		ks := map[int]int{}
		for p := ch.Start; p <= min(ch.End+1, len(pages)); p++ {
			for _, l := range strings.Split(pages[p-1], "\n") {
				if m := re.FindStringSubmatch(l); m != nil && !subsections[s.Number+"."+m[1]] {
					k, _ := strconv.Atoi(m[1])
					if _, seen := ks[k]; !seen {
						ks[k] = p
					}
				}
			}
		}
		if len(ks) >= 3 {
			section.fit++
			k := smallest(ks)
			if section.example == nil {
				section.example = &Example{Label: fmt.Sprintf("%s.%d", s.Number, k), Page: ks[k]}
			}
			if ks[k] >= s.Start && ks[k] <= s.End+1 {
				inOwnPages++
			} else {
				atChapterEnd++
			}
		}
	}

	// Starting over: after a Problems heading in the section's pages, the
	// lines opening "1.", "2.", "3.". OCR mangles many of them, so three
	// distinct numbers, one of them 1, make a set.
	var local score
	localNum := regexp.MustCompile(`^\s*(\d{1,2})\.(?:\s|$)`)
	for _, s := range sections {
		local.of++
		ls := lines(s.Start, s.End+1)
		start := -1
		for i, l := range ls {
			if headingLine.MatchString(l) {
				start = i
				break
			}
		}
		if start < 0 {
			continue
		}
		ks := map[int]bool{}
		for _, l := range ls[start+1:] {
			if m := localNum.FindStringSubmatch(l); m != nil {
				k, _ := strconv.Atoi(m[1])
				ks[k] = true
			}
		}
		if len(ks) >= 3 && ks[1] {
			local.fit++
			if local.example == nil && ks[7] {
				local.example = &Example{Label: s.Number + " #7", Page: pageOfLine(pages, s.Start, s.End+1, start)}
			} else if local.example == nil {
				local.example = &Example{Label: s.Number + " #1", Page: pageOfLine(pages, s.Start, s.End+1, start)}
			}
		}
	}
	// Headings count wherever they are, for the heading word.
	for _, text := range pages {
		for _, l := range strings.Split(text, "\n") {
			if m := headingLine.FindStringSubmatch(l); m != nil {
				heads[normHeading(m[1])]++
			}
		}
	}

	type cand struct {
		form  Form
		share float64
		s     score
	}
	share := func(s score) float64 {
		if s.of == 0 {
			return 0
		}
		return float64(s.fit) / float64(s.of)
	}
	cs := []cand{{FormChapter, share(chapter), chapter}, {FormSection, share(section), section}, {FormLocal, share(local), local}}
	sort.SliceStable(cs, func(i, j int) bool { return cs[i].share > cs[j].share })
	best, second := cs[0], cs[1]
	if best.s.fit == 0 {
		return Style{}, false
	}
	st := Style{
		Form:    best.form,
		Heading: mostCommon(heads),
		Example: best.s.example,
		// Plain means most of the book fits one style and clearly more
		// than any other.
		Sure: best.share >= minShare && best.share >= 2*second.share && best.s.fit >= minFit,
	}
	switch best.form {
	case FormLocal:
		st.Where = WhereSection
	case FormChapter:
		st.Where = WhereChapter
	case FormSection:
		st.Where = WhereChapter
		if inOwnPages > atChapterEnd {
			st.Where = WhereSection
		}
	}
	return st, true
}

// How plain a style must be: the share of chapters or sections that fit
// it, and how many at least.
const (
	minShare = 0.4
	minFit   = 3
)

// after is the number following a prefix: "4.11" after "4" is 11.
func after(number, prefix string) (int, bool) {
	rest, ok := strings.CutPrefix(number, prefix+".")
	if !ok || strings.Contains(rest, ".") {
		return 0, false
	}
	n, err := strconv.Atoi(rest)
	return n, err == nil
}

func smallest(m map[int]int) int {
	best := -1
	for k := range m {
		if best < 0 || k < best {
			best = k
		}
	}
	return best
}

func normHeading(h string) string {
	h = strings.Fields(strings.ToLower(h))[0]
	return strings.ToUpper(h[:1]) + h[1:]
}

func mostCommon(m map[string]int) string {
	best, n := "", 0
	for k, v := range m {
		if v > n || (v == n && k < best) {
			best, n = k, v
		}
	}
	return best
}

// pageOfLine is the PDF page the i-th line of pages from..to is on.
func pageOfLine(pages []string, from, to, i int) int {
	for p := max(from, 1); p <= min(to, len(pages)); p++ {
		n := len(strings.Split(pages[p-1], "\n"))
		if i < n {
			return p
		}
		i -= n
	}
	return from
}
