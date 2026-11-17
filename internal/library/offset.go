package library

import (
	"strconv"
	"strings"
)

// Printed page numbers live in running heads and feet: a number alone on
// the first or last few lines of a page, or at either end of such a line
// ("12  CHAPTER 1. VECTOR SPACES", "Section 1.2  13"). Every page whose
// head or foot carries its printed number votes for the same difference
// between its PDF page and that number. Years, equation numbers and stray
// digits vote too, but they scatter, so the offset is the difference that
// wins clearly.
const (
	edgeLines       = 3   // lines checked at the top and at the bottom
	offsetMinVotes  = 5   // fewer agreeing pages than this is not a pattern
	offsetMinShare  = 0.2 // of the pages that have any text
	offsetMaxNumber = 5000
)

// detectOffset finds the offset for PDF page = printed page + offset from
// the pages' text (index i is PDF page i+1). ok is false when no
// difference wins clearly; the book then keeps offset 0 and the student
// can set it in the book dialog.
func detectOffset(pages []string) (offset int, ok bool) {
	votes := map[int]int{}
	withText := 0
	for i, text := range pages {
		lines := nonEmptyLines(text)
		if len(lines) == 0 {
			continue
		}
		withText++
		seen := map[int]bool{}
		for _, n := range edgeNumbers(lines) {
			d := (i + 1) - n
			if !seen[d] {
				seen[d] = true
				votes[d]++
			}
		}
	}
	best, bestVotes, second := 0, 0, 0
	for d, v := range votes {
		switch {
		case v > bestVotes || (v == bestVotes && d < best):
			second = bestVotes
			best, bestVotes = d, v
		case v > second:
			second = v
		}
	}
	if bestVotes < offsetMinVotes || float64(bestVotes) < offsetMinShare*float64(withText) || bestVotes < 2*second {
		return 0, false
	}
	return best, true
}

// pageNumberDress is what surrounds a printed number: dashes of every
// width, bars, dots and bullets.
const pageNumberDress = " -\u2013\u2014|·.•*"

func nonEmptyLines(text string) []string {
	var out []string
	for _, l := range strings.Split(text, "\n") {
		if l = strings.TrimSpace(l); l != "" {
			out = append(out, l)
		}
	}
	return out
}

// edgeNumbers are the candidate printed numbers on a page: an integer at
// the start or end of one of its first or last few lines.
func edgeNumbers(lines []string) []int {
	var edge []string
	if len(lines) <= 2*edgeLines {
		edge = lines
	} else {
		edge = append(append(edge, lines[:edgeLines]...), lines[len(lines)-edgeLines:]...)
	}
	var out []int
	for _, l := range edge {
		// Page numbers often come dressed: "- 12 -", "| 12", "12 ·".
		f := strings.Fields(strings.Trim(l, pageNumberDress))
		if len(f) == 0 {
			continue
		}
		for _, tok := range []string{f[0], f[len(f)-1]} {
			if n, err := strconv.Atoi(strings.Trim(tok, pageNumberDress)); err == nil && n > 0 && n < offsetMaxNumber {
				out = append(out, n)
			}
		}
	}
	return out
}
