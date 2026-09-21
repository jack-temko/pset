package library

import (
	"math"
	"sort"
	"strings"
	"unicode"
)

// rrfK is the reciprocal-rank-fusion smoothing constant.
const rrfK = 60

// searchDepth is how deep each ranking feeds the fusion.
const searchDepth = 20

// rrfMerge fuses two page rankings (each best first, either may be empty):
// score(page) = sum of 1/(rrfK + rank) over the lists holding it. Ties
// break by page number, so the result is deterministic.
func rrfMerge(a, b []int, k int) []int {
	scores := map[int]float64{}
	for _, list := range [][]int{a, b} {
		for i, p := range list {
			scores[p] += 1.0 / float64(rrfK+i+1)
		}
	}
	pages := make([]int, 0, len(scores))
	for p := range scores {
		pages = append(pages, p)
	}
	sort.Slice(pages, func(i, j int) bool {
		if scores[pages[i]] != scores[pages[j]] {
			return scores[pages[i]] > scores[pages[j]]
		}
		return pages[i] < pages[j]
	})
	if len(pages) > k {
		pages = pages[:k]
	}
	return pages
}

func cosine(a, b []float32) float64 {
	if len(a) == 0 || len(a) != len(b) {
		return 0
	}
	var dot, na, nb float64
	for i := range a {
		dot += float64(a[i]) * float64(b[i])
		na += float64(a[i]) * float64(a[i])
		nb += float64(b[i]) * float64(b[i])
	}
	if na == 0 || nb == 0 {
		return 0
	}
	return dot / math.Sqrt(na*nb)
}

// rankByVector orders pages by similarity to q, best first.
func rankByVector(q []float32, rows []vectorRow, limit int) []int {
	type scored struct {
		page  int
		score float64
	}
	s := make([]scored, len(rows))
	for i, r := range rows {
		s[i] = scored{r.Number, cosine(q, r.Vector)}
	}
	sort.Slice(s, func(i, j int) bool {
		if s[i].score != s[j].score {
			return s[i].score > s[j].score
		}
		return s[i].page < s[j].page
	})
	out := make([]int, 0, min(limit, len(s)))
	for i := 0; i < len(s) && i < limit; i++ {
		out = append(out, s[i].page)
	}
	return out
}

// ftsMatches turns free text into safe fts5 MATCH expressions, best first:
// the whole query as one phrase (so "Theorem 2.3" stays adjacent), then its
// word pairs as phrases, then every word as an implicit AND. Everything is
// quoted, so nothing the student typed reaches fts5 as syntax.
func ftsMatches(query string) []string {
	fields := strings.FieldsFunc(query, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	})
	if len(fields) == 0 {
		return nil
	}
	out := []string{`"` + strings.Join(fields, " ") + `"`}
	if len(fields) > 2 {
		var pairs []string
		for i := 0; i+1 < len(fields); i++ {
			if stopwords[strings.ToLower(fields[i])] && stopwords[strings.ToLower(fields[i+1])] {
				continue
			}
			pairs = append(pairs, `"`+fields[i]+" "+fields[i+1]+`"`)
		}
		if len(pairs) > 0 {
			out = append(out, strings.Join(pairs, " OR "))
		}
	}
	if len(fields) > 1 {
		q := make([]string, len(fields))
		for i, f := range fields {
			q[i] = `"` + f + `"`
		}
		out = append(out, strings.Join(q, " "))
	}
	return out
}

// stopwords keep word pairs like "of the" out of the pair pass, where they
// match every page.
var stopwords = map[string]bool{
	"a": true, "an": true, "the": true, "is": true, "are": true, "was": true,
	"were": true, "be": true, "been": true, "of": true, "to": true, "in": true,
	"on": true, "and": true, "or": true, "for": true, "with": true, "as": true,
	"at": true, "by": true, "from": true, "it": true, "its": true, "this": true,
	"that": true, "these": true, "those": true, "what": true, "when": true,
	"where": true, "how": true, "why": true, "which": true, "who": true,
	"does": true, "do": true, "did": true, "can": true, "if": true,
}
