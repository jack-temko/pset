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
// "Exercise 2.A.4", "3.24 (use matlab)". Prose after it fails the match.
var labelShape = regexp.MustCompile(
	`(?i)^\s*(?:problem\s+|prob\.?\s*|exercise\s+|ex\.?\s*|question\s+|q\.?\s*)?(\d{1,2}(?:\.[A-Z])?\.\d{1,3}[a-z]?)\.?\s*(?:\([^()]*\))?\s*$`)

// questionLabel reports the label a question is nothing but.
func questionLabel(text string) (string, bool) {
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
