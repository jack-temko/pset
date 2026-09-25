package homework

import (
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/jackt/pset/internal/probnum"
)

// Ref is a book problem as a question names it, read in the book's own
// numbering: "Chapter 3.1 Problem 7", "3.1 #7" and "1.1: 1, 7" in a book
// whose problems start again in each section; "4.27" in one numbered
// through each chapter; "Problem 2.1.4, p. 57" in one that prints the
// section. Spec: ideas/finding-problems.md.
type Ref struct {
	// Chapter is the chapter it's in ("3"), always set with a section or a
	// chapter-numbered problem.
	Chapter string
	// Section is the section ("3.1"), when the reference names one.
	Section string
	// Number is the problem's number within its chapter or section ("7",
	// or "27" for 4.27).
	Number string
	// Part is a part of it the reference names ("c" for 7c or 7(c)).
	Part string
	// Page is a printed page the reference cites, or 0.
	Page int
	// Note is what the question says besides the reference, in
	// parentheses or after it ("no PSpice or MultiSim").
	Note string
}

// Label is the reference as the book's style writes it: "3.1 #7",
// "4.27", "2.1.4", or "p. 33 #7" for one known only by its page.
func (r Ref) Label(style probnum.Style) string {
	switch {
	case r.Section != "" && style.Form == probnum.FormSection:
		return r.Section + "." + r.Number
	case r.Section != "":
		return r.Section + " #" + r.Number
	case r.Chapter != "":
		return r.Chapter + "." + r.Number
	case r.Page > 0:
		return fmt.Sprintf("p. %d #%s", r.Page, r.Number)
	}
	return "#" + r.Number
}

// Name is the reference in words, for a sentence: "section 3.1's problem
// 7", "problem 4.27", "problem 7 on p. 33".
func (r Ref) Name(style probnum.Style) string {
	switch {
	case r.Section != "":
		return fmt.Sprintf("section %s's problem %s", r.Section, r.Number)
	case r.Chapter != "":
		return "problem " + r.Chapter + "." + r.Number
	case r.Page > 0:
		return fmt.Sprintf("problem %s on p. %d", r.Number, r.Page)
	}
	return "problem " + r.Number
}

var (
	refPage    = regexp.MustCompile(`(?i)\b(?:page|pg\.?|p\.)\s*(\d{1,4})\b`)
	refPart    = regexp.MustCompile(`(?i)^(\d{1,3})\s*(?:\(([a-h])\)|([a-h]))$`)
	refNote    = regexp.MustCompile(`\(([^()]*)\)`)
	refDotted  = regexp.MustCompile(`^\d{1,2}(?:\.\d{1,3}){1,2}[a-h]?$`)
	refPlain   = regexp.MustCompile(`^\d{1,3}[a-h]?$`)
	refSection = regexp.MustCompile(`(?i)^(?:chapter|chap\.?|ch\.?|section|sect?\.?|§)$`)
	refProblem = regexp.MustCompile(`(?i)^(?:problems?|probs?\.?|exercises?|ex\.?|questions?|q\.?|no\.?|numbers?|nos?\.?|#)$`)
	// The words that join a reference's parts and mean nothing alone.
	refFiller = regexp.MustCompile(`(?i)^(?:in|on|of|from|at|and|the|do|hw|homework|from|book|text(?:book)?)$`)
	// A book problem named inside the professor's own words: "Use MATLAB
	// to do problem 2.5.2 on p. 61, augmented as below".
	refInProse = regexp.MustCompile(`(?i)\bproblems?\s+(\d{1,2}(?:\.\d{1,3}){1,2})\b`)
)

// A range of problems: "1-8" in one word, or "1 – 8" and "1 to 8" in
// three; its ends plain numbers or a book's full ones ("4.27–4.30",
// "4.27–30", "2.1.3-2.1.6"). "odd", "even" or "all" may follow it.
var (
	refRange     = regexp.MustCompile(`^#?(\d{1,2}(?:\.\d{1,3}){1,2}|\d{1,3})[-–—](\d{1,2}(?:\.\d{1,3}){1,2}|\d{1,3})$`)
	refRangeWord = regexp.MustCompile(`(?i)^(?:-|–|—|to|through|thru)$`)
	refRangeEnd  = regexp.MustCompile(`^#?(\d{1,2}(?:\.\d{1,3}){1,2}|\d{1,3})$`)
	refParity    = regexp.MustCompile(`(?i)^(?:odd|even|all)(?:\s+(?:ones|problems))?$`)
)

// maxRange is the most problems one range names: a typo ("1-100")
// shouldn't make a hundred questions.
const maxRange = 40

// rangeAt reads a range starting at words[i]: its ends, and how many
// words it takes (none when it isn't one).
func rangeAt(words []string, i int) (lo, hi string, n int) {
	w := strings.Trim(words[i], ":.")
	if m := refRange.FindStringSubmatch(w); m != nil {
		return m[1], m[2], 1
	}
	if i+2 < len(words) && refRangeWord.MatchString(words[i+1]) {
		a := refRangeEnd.FindStringSubmatch(w)
		b := refRangeEnd.FindStringSubmatch(strings.Trim(words[i+2], ":."))
		if a != nil && b != nil {
			return a[1], b[1], 3
		}
	}
	return "", "", 0
}

// expandRange is every problem a range names, the last part counting up
// under the first end's prefix: "1"–"8" is 1 to 8, "4.27"–"30" is 4.27
// to 4.30. None when the ends don't make a range.
func expandRange(lo, hi string) []string {
	prefix := ""
	if i := strings.LastIndex(lo, "."); i >= 0 {
		prefix, lo = lo[:i+1], lo[i+1:]
	}
	if j := strings.LastIndex(hi, "."); j >= 0 {
		if hi[:j+1] != prefix {
			return nil
		}
		hi = hi[j+1:]
	}
	a, err1 := strconv.Atoi(lo)
	b, err2 := strconv.Atoi(hi)
	if err1 != nil || err2 != nil || b <= a || b-a >= maxRange {
		return nil
	}
	out := make([]string, 0, b-a+1)
	for n := a; n <= b; n++ {
		out = append(out, prefix+strconv.Itoa(n))
	}
	return out
}

// keepParity keeps a range's odd or even problems.
func keepParity(ns []string, word string) []string {
	word = strings.ToLower(strings.Fields(word)[0])
	if word == "all" {
		return ns
	}
	var out []string
	for _, n := range ns {
		last, _ := strconv.Atoi(n[strings.LastIndex(n, ".")+1:])
		if (last%2 == 1) == (word == "odd") {
			out = append(out, n)
		}
	}
	return out
}

// A reference with a note is most of the line: past refLong characters
// only a plain one ("Problem 2.3.2, p. 60." and then a paragraph) is read
// as a reference, since a problem written out can start with a number.
const (
	refLong     = 120
	refLongHead = 60
)

// ParseRefs reads a question as book references, in the book's style.
// One question can name several ("1.1: 1, 7" is two). ok is false when
// it isn't a reference at all: a problem written out, which the finder
// searches for by its words.
func ParseRefs(text string, style probnum.Style) (refs []Ref, ok bool) {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, false
	}
	var notes []string
	for _, m := range refNote.FindAllStringSubmatch(text, -1) {
		// A part in parentheses ("7(c)") belongs to the number, not the
		// notes.
		if len(m[1]) == 1 && m[1][0] >= 'a' && m[1][0] <= 'h' {
			continue
		}
		if n := strings.TrimSpace(m[1]); n != "" {
			notes = append(notes, n)
		}
	}
	rest := refNote.ReplaceAllStringFunc(text, func(m string) string {
		if len(m) == 3 && m[1] >= 'a' && m[1] <= 'h' {
			return m
		}
		return " "
	})
	page := 0
	if m := refPage.FindStringSubmatch(rest); m != nil {
		page, _ = strconv.Atoi(m[1])
		rest = refPage.ReplaceAllString(rest, " ")
	} else if m := refPage.FindStringSubmatch(text); m != nil {
		// A page in a note still says where: "(all on page 24)".
		page, _ = strconv.Atoi(m[1])
	}
	// "7(c)" and "7 (c)" stay one token.
	rest = regexp.MustCompile(`(\d)\s*\(([a-h])\)`).ReplaceAllString(rest, "$1$2")

	// Words, with the punctuation that separates them stripped; a
	// trailing sentence of prose ends the reference, and becomes its note.
	var section string
	var numbers []string
	var dotted []string
	expectSection := false
	// Named as a reference in so many words: "Problem", "Section", "#",
	// or a dotted number, not just a number that could start a sentence.
	plain := false
	words := strings.FieldsFunc(rest, func(r rune) bool { return r == ' ' || r == ',' || r == ';' || r == '\t' })
	// Where each word starts in rest, so a note keeps its own commas.
	cursor := 0
	starts := make([]int, len(words))
	for i, w := range words {
		at := strings.Index(rest[cursor:], w)
		starts[i] = cursor + max(at, 0)
		cursor = starts[i] + len(w)
	}
	// The words a range took past its first, and the range just read,
	// for an "odd" or "even" after it.
	skip := 0
	var ranged []string
	rangedDotted := false
words:
	for i, w := range words {
		if skip > 0 {
			skip--
			continue
		}
		w = strings.Trim(w, ":.")
		if !expectSection {
			if lo, hi, n := rangeAt(words, i); n > 0 {
				if ns := expandRange(lo, hi); ns != nil {
					skip, ranged, rangedDotted = n-1, ns, strings.Contains(ns[0], ".")
					if rangedDotted {
						dotted = append(dotted, ns...)
					} else {
						numbers = append(numbers, ns...)
					}
					plain = true
					continue
				}
			}
		}
		if ranged != nil && refParity.MatchString(w) {
			kept := keepParity(ranged, w)
			if rangedDotted {
				dotted = append(dotted[:len(dotted)-len(ranged)], kept...)
			} else {
				numbers = append(numbers[:len(numbers)-len(ranged)], kept...)
			}
			ranged = nil
			continue
		}
		ranged = nil
		if strings.HasPrefix(w, "#") && len(w) > 1 {
			numbers = append(numbers, w[1:])
			plain = true
			continue
		}
		if strings.HasPrefix(w, "§") && len(w) > len("§") {
			w = strings.TrimPrefix(w, "§")
			expectSection = true
		}
		switch {
		case w == "":
		case refSection.MatchString(w):
			expectSection = true
			plain = true
		case refProblem.MatchString(w):
			plain = true
		case refFiller.MatchString(w):
		case refDotted.MatchString(w) && expectSection && section == "":
			section = w
			expectSection = false
		case refDotted.MatchString(w):
			dotted = append(dotted, w)
			plain = true
		case refPlain.MatchString(w) && expectSection && section == "":
			// "Chapter 3 Problem 12": a chapter, the problem to follow.
			section = w
			expectSection = false
		case refPlain.MatchString(w):
			numbers = append(numbers, w)
		default:
			// Prose: the rest is a note, if a reference came before it.
			if len(numbers)+len(dotted) == 0 && section == "" {
				return refInWords(text, style)
			}
			if len(text) > refLong && (!plain || starts[i] > refLongHead) {
				return nil, false
			}
			notes = append(notes, strings.TrimSpace(strings.TrimRight(strings.TrimSpace(rest[starts[i]:]), ".")))
			break words
		}
	}
	note := strings.Join(notes, "; ")
	mk := func(chapter, sec, num string) Ref {
		r := Ref{Chapter: chapter, Section: sec, Page: page, Note: note}
		if m := refPart.FindStringSubmatch(num); m != nil {
			r.Number, r.Part = m[1], m[2]+m[3]
		} else {
			r.Number = num
		}
		return r
	}
	chapterOf := func(sec string) string {
		c, _, _ := strings.Cut(sec, ".")
		return c
	}

	switch {
	case section != "" && strings.Contains(section, ".") && len(numbers) > 0:
		// "Chapter 3.1 Problem 7", "Section 3.1 #7", "§3.1 1, 7".
		for _, n := range numbers {
			refs = append(refs, mk(chapterOf(section), section, n))
		}
	case section != "" && len(numbers) > 0:
		// "Chapter 4 Problem 27".
		for _, n := range numbers {
			refs = append(refs, mk(section, "", n))
		}
	case len(dotted) == 1 && len(numbers) > 0 && strings.Count(dotted[0], ".") == 1:
		// "3.1 #7", "1.1: 1, 7", "3.1 Problem 7": a section, then its
		// problems.
		for _, n := range numbers {
			refs = append(refs, mk(chapterOf(dotted[0]), dotted[0], n))
		}
	case len(dotted) > 0 && len(numbers) == 0:
		for _, d := range dotted {
			parts := strings.Split(d, ".")
			if len(parts) == 3 {
				// "3.1.7" or "2.1.4": section, then problem.
				sec := parts[0] + "." + parts[1]
				refs = append(refs, mk(parts[0], sec, parts[2]))
				continue
			}
			// "4.27": a chapter's problem where the book numbers them
			// so; where problems start again each section, a bare "3.1"
			// can't be a problem at all.
			if style.Form == probnum.FormLocal {
				return nil, false
			}
			refs = append(refs, mk(parts[0], "", parts[1]))
		}
	case len(numbers) > 0 && page > 0:
		// "p. 33 #7", "Problem 7 on page 33".
		for _, n := range numbers {
			refs = append(refs, mk("", "", n))
		}
	}
	return refs, len(refs) > 0
}

// refInWords is a line in the professor's own words naming one book
// problem ("do problem 2.5.2 on p. 61, but for 500 packets"): that
// problem, the whole line its note. A line naming none, or several, is
// the professor's own problem.
func refInWords(text string, style probnum.Style) ([]Ref, bool) {
	ms := refInProse.FindAllStringSubmatch(text, -1)
	if len(ms) == 0 || slices.ContainsFunc(ms, func(m []string) bool { return m[1] != ms[0][1] }) {
		return nil, false
	}
	refs, ok := ParseRefs(ms[0][0], style)
	if !ok || len(refs) != 1 {
		return nil, false
	}
	if m := refPage.FindStringSubmatch(text); m != nil {
		refs[0].Page, _ = strconv.Atoi(m[1])
	}
	refs[0].Note = strings.TrimRight(text, ". ")
	return refs, true
}
