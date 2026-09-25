package homework

import (
	"context"
	"fmt"
	"regexp"
	"slices"
	"strings"

	"github.com/jackt/pset/internal/probnum"
)

// scope is where a reference's problem must be, worked out from the
// book's numbering and contents before any model looks: the pages to show
// it, most likely first, and the pages a find may land on. Where the
// reference names a section, a problem with the right number anywhere
// else is someone else's.
type scope struct {
	ref Ref
	// pages are the candidates, the pages whose text has the problem's
	// line first; exact are those.
	pages []int
	exact map[int]bool
	// lo and hi bound where a find may land.
	lo, hi int
	// where says in words which pages these are, for the not-found line.
	where string
	// hint tells the model what it's looking for, in the book's terms.
	hint string
}

// scopeSlack is how far past a span's end a problem may run: the
// contents give the page a section starts on, and its problems can spill
// onto the next.
const scopeSlack = 1

// scopeOf is where a reference's problem must be, or false when the
// reference doesn't say enough to know: then the finder searches.
func scopeOf(book Book, ref Ref, pages []string) (scope, bool) {
	st := book.Problems
	sc := scope{ref: ref}

	if ref.Page > 0 {
		// A cited page: that page, then its neighbours, since a list
		// spills onto the next page and a student's number can be one off.
		at := book.Pages.Nearest(ref.Page)
		sc.lo, sc.hi = max(1, at-1), min(book.PageCount, at+2)
		for _, p := range []int{at, at + 1, at - 1, at + 2} {
			if p >= 1 && p <= book.PageCount {
				sc.pages = append(sc.pages, p)
			}
		}
		sc.where = fmt.Sprintf("p. %d and the pages beside it", ref.Page)
		sc.hint = fmt.Sprintf("It is %s, which the student says is on p. %d.", ref.Name(st), ref.Page)
		return sc, len(sc.pages) > 0
	}

	var start, end int
	var ok bool
	var line *regexp.Regexp
	var name string
	switch {
	case ref.Section != "":
		name = "Section " + ref.Section
		if st.Where == probnum.WhereChapter {
			// Kept together at the chapter's end, grouped by section.
			start, end, ok = book.span(ref.Chapter)
			name = "chapter " + ref.Chapter
		}
		if !ok {
			start, end, ok = book.span(ref.Section)
			name = "Section " + ref.Section
		}
		if !ok {
			start, end, ok = book.span(ref.Chapter)
			name = "chapter " + ref.Chapter
		}
		switch st.Form {
		case probnum.FormSection:
			line = regexp.MustCompile(`^\s*` + regexp.QuoteMeta(ref.Section+"."+ref.Number) + `\b`)
			sc.hint = fmt.Sprintf("It is %s, printed as \"%s.%s\".", ref.Name(st), ref.Section, ref.Number)
		default:
			// Starting over each section (or not known): the number alone,
			// after the section's heading.
			line = regexp.MustCompile(`^\s*` + regexp.QuoteMeta(ref.Number) + `\.(?:\s|$)`)
			heading := st.Heading
			if heading == "" {
				heading = "Problems"
			}
			sc.hint = fmt.Sprintf("It is %s. In this book each section's problems start again at 1 and are printed as just the number (\"%s.\") under the section's %q heading, at the section's end, so the page won't print %s itself: a page from %s with problem %s. on it after that heading is the one.",
				ref.Name(st), ref.Number, heading, ref.Section, name, ref.Number)
		}
	case ref.Chapter != "":
		start, end, ok = book.span(ref.Chapter)
		name = "chapter " + ref.Chapter
		line = regexp.MustCompile(`^\s*` + regexp.QuoteMeta(ref.Chapter+"."+ref.Number) + `\.?\s+\S`)
		sc.hint = fmt.Sprintf("It is %s, printed as \"%s.%s\" among chapter %s's problems.", ref.Name(st), ref.Chapter, ref.Number, ref.Chapter)
	}
	if !ok {
		return scope{}, false
	}
	end = min(end+scopeSlack, book.PageCount, len(pages))
	sc.lo, sc.hi = start, end
	sc.where = fmt.Sprintf("%s (%s to %s)", name, book.Pages.Name(start), book.Pages.Name(end))

	// The problems begin at the span's first problem heading; the
	// problem's own line after it is the best evidence there is.
	from := start
	for p := start; p <= end; p++ {
		if hasHeading(pages[p-1]) {
			from = p
			break
		}
	}
	var hits []int
	for p := from; p <= end; p++ {
		text := pages[p-1]
		if p == from {
			text = afterHeading(text)
		}
		for _, l := range strings.Split(text, "\n") {
			if line.MatchString(l) {
				hits = append(hits, p)
				break
			}
		}
	}
	add := func(p int) {
		if p >= start && p <= end && !slices.Contains(sc.pages, p) {
			sc.pages = append(sc.pages, p)
		}
	}
	sc.exact = map[int]bool{}
	for _, p := range hits {
		add(p)
		sc.exact[p] = true
	}
	for p := from; p <= end; p++ {
		add(p)
	}
	for p := end; p >= start; p-- {
		add(p)
	}
	return sc, true
}

func hasHeading(text string) bool {
	for _, l := range strings.Split(text, "\n") {
		if isHeading(l) {
			return true
		}
	}
	return false
}

func isHeading(line string) bool {
	return problemHeading.MatchString(line)
}

var problemHeading = regexp.MustCompile(`(?i)^\s*(problems|exercises|exercise set(?:\s+[\d.]+)?|problem set(?:\s+[\d.]+)?|homework problems|review problems)\s*[:.]?\s*$`)

// afterHeading is a page's text from its problem heading on.
func afterHeading(text string) string {
	lines := strings.Split(text, "\n")
	for i, l := range lines {
		if isHeading(l) {
			return strings.Join(lines[i+1:], "\n")
		}
	}
	return text
}

// scopeRounds is how the pages of a scope are shown: a small sharp first
// look, then the rest a batch at a time, up to a limit.
const (
	scopeFirst = 4
	scopeBatch = 6
	scopeMax   = 16
)

// findInScope looks for a reference's problem where it must be: the
// pages whose text has its line, then the pages memory points to, then
// the rest, a batch at a time. A pick outside the scope is someone else's
// problem with the same number, and doesn't count.
func (s *Service) findInScope(ctx context.Context, m model, book Book, q row, sc scope, remembered []int, problems Problems) (location, bool, error) {
	var pages []int
	for _, p := range sc.pages {
		if sc.exact[p] {
			pages = append(pages, p)
		}
	}
	fromMemory := map[int]bool{}
	for _, p := range remembered {
		if p >= sc.lo && p <= sc.hi && !slices.Contains(pages, p) {
			pages = append(pages, p)
			fromMemory[p] = true
		}
	}
	for _, p := range sc.pages {
		if !slices.Contains(pages, p) {
			pages = append(pages, p)
		}
	}
	pages = pages[:min(len(pages), scopeMax)]
	for i := 0; i < len(pages); {
		n := scopeBatch
		if i == 0 {
			n = scopeFirst
		}
		batch := pages[i:min(i+n, len(pages))]
		i += len(batch)
		if slices.ContainsFunc(batch, func(p int) bool { return fromMemory[p] }) {
			s.setActivity(ctx, q.ID, "Checking pages from memory…")
		}
		loc, ok, err := s.locateOnce(ctx, m, book, q, batch, sc.hint)
		if err != nil {
			return location{}, false, err
		}
		if ok && loc.Page >= sc.lo && loc.Page <= sc.hi {
			loc.Label = sc.ref.Label(book.Problems)
			if fromMemory[loc.Page] {
				loc.FromMemory = &problems
			}
			return loc, true, nil
		}
	}
	return location{}, false, nil
}

// questionRef is the book problem a question names, in the book's style.
func questionRef(book Book, q row) (Ref, bool) {
	if !q.InBook {
		return Ref{}, false
	}
	refs, ok := ParseRefs(q.Text, book.Problems)
	if !ok {
		return Ref{}, false
	}
	return refs[0], true
}

// imageLabel names a page shown to the model: its printed page and the
// section it's in, which a problems page often doesn't print.
func imageLabel(book Book, n, page int) string {
	label := fmt.Sprintf("Image %d (%s", n, book.Pages.Name(page))
	if part, ok := book.partOf(page); ok {
		label += ", in " + part.Title
	}
	return label + "):"
}
