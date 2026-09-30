package homework

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"regexp"
	"slices"
	"strings"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/pdf"
)

// ---------------------------------------------------------------- locate

// location is where a question is and what it says.
type location struct {
	Page      int
	Label     string
	Statement string
	Rect      *pdf.Rect
	Figures   []figure
	// FromMemory is the range memory that led to the page, when it was
	// one of its pages and nothing exact had pointed there.
	FromMemory *Problems
}

// locate runs the ladder: a page the student pinned is the only
// candidate; otherwise the exact tiers and search first, a wider search
// second, then a sweep of the chapter's pages as images.
func (s *Service) locate(ctx context.Context, m model, book Book, q row) (location, error) {
	notFound := fail(FailureNotFound, nil, "Searched the book for %s and didn't see it. Show where it is on the page, or give its printed page; if it isn't from this book, paste it below.", problemName(q))
	if q.Pinned != nil {
		loc, ok, err := s.locateOnce(ctx, m, book, q, []int{*q.Pinned}, pinnedHint(book, q))
		if err != nil {
			return location{}, err
		}
		if !ok {
			return location{}, fail(FailureNotFound, nil, "It isn't on %s either. Check the page number, or paste the problem below.", book.Pages.Name(*q.Pinned))
		}
		return loc, nil
	}

	// Memory's pages: where the problems seen so far in this chapter put
	// this one.
	var problems Problems
	var remembered []int
	ref, hasRef := questionRef(book, q)
	labels := []string{q.Text, q.Label}
	if hasRef {
		labels = append([]string{ref.Label(book.Problems)}, labels...)
	}
	if label, chapter, ok := problemLabel(labels...); ok && s.c.Memory != nil {
		if p, err := s.c.Memory.ProblemsSeen(ctx, book.ID, chapter); err == nil {
			problems, remembered = p, rememberedPages(p.Seen, label)
		}
	}

	// A reference the book's numbering can place is looked for where it
	// must be, and only there: the same number elsewhere is another
	// problem.
	if hasRef {
		texts, err := s.c.Library.PageTexts(ctx, book.ID)
		if err != nil {
			return location{}, err
		}
		if sc, ok := scopeOf(book, ref, texts); ok {
			loc, found, err := s.findInScope(ctx, m, book, q, sc, remembered, problems)
			if err != nil {
				return location{}, err
			}
			if !found {
				return location{}, fail(FailureNotFound, nil, "Looked through %s for %s and didn't see it. Show where it is on the page, or give its printed page; if it isn't from this book, paste it below.", sc.where, ref.Name(book.Problems))
			}
			return loc, nil
		}
	}

	// Memory's pages go after the exact tiers: a few in the first round,
	// the rest in the wider one.
	tried := map[int]bool{}
	for i, k := range []int{firstRound, widerRound} {
		take := len(remembered)
		if i == 0 {
			take = min(take, firstRemembered)
		}
		cands, exact, err := s.candidates(ctx, book, q.Text, k, tried, remembered[:take])
		if err != nil {
			return location{}, err
		}
		if len(cands) == 0 {
			break
		}
		fromMemory := map[int]bool{}
		for _, p := range cands {
			tried[p] = true
			if slices.Contains(remembered, p) && !exact[p] {
				fromMemory[p] = true
			}
		}
		if len(fromMemory) > 0 {
			s.setActivity(ctx, q.ID, "Checking pages from memory…")
		}
		loc, ok, err := s.locateOnce(ctx, m, book, q, cands, "")
		if err != nil {
			return location{}, err
		}
		if ok {
			if fromMemory[loc.Page] {
				loc.FromMemory = &problems
			}
			return loc, nil
		}
	}

	// Last: read the chapter's pages, where the text layer may be too poor
	// for search to find the problem at all.
	label, _ := questionLabel(q.Text)
	chapter, ok := labelChapter(label)
	if !ok {
		return location{}, notFound
	}
	start, end, ok := book.span(fmt.Sprint(chapter))
	if !ok {
		return location{}, notFound
	}
	for _, batch := range sweepBatchesOf(start, end) {
		loc, ok, err := s.locateOnce(ctx, m, book, q, batch, "")
		if err != nil {
			return location{}, err
		}
		if ok {
			return loc, nil
		}
	}
	return location{}, notFound
}

// Candidate pool sizes: the first round is small and sharp, the second
// reaches deeper into the ranks the first left out.
const (
	firstRound = 6
	widerRound = 10
	// firstRemembered is how many of memory's pages the first round shows.
	firstRemembered = 3
)

// candidates picks the pages a locate round looks at, exact before
// fuzzy: a printed page the question cites, pages that open a line with
// its label, the pages memory points to, then search. exact is what the
// first two tiers found.
func (s *Service) candidates(ctx context.Context, book Book, text string, k int, exclude map[int]bool, remembered []int) ([]int, map[int]bool, error) {
	var out []int
	exact := map[int]bool{}
	seen := map[int]bool{}
	add := func(p int) {
		if p >= 1 && p <= book.PageCount && !exclude[p] && !seen[p] && len(out) < k {
			seen[p] = true
			out = append(out, p)
		}
	}
	if printed, ok := printedPageOf(text); ok {
		// The page cited, then the pages either side: a problem runs over
		// onto the next page, and a student's page number can be one off.
		at := book.Pages.Nearest(printed)
		exact[at] = true
		add(at)
		add(at + 1)
		add(at - 1)
	}
	if label, ok := questionLabel(text); ok {
		texts, err := s.c.Library.PageTexts(ctx, book.ID)
		if err != nil {
			return nil, nil, err
		}
		for _, p := range labelScan(texts, label) {
			exact[p] = true
			add(p)
		}
	}
	for _, p := range remembered {
		add(p)
	}
	hits, err := s.c.Library.Search(ctx, book.ID, text, k+len(exclude))
	if err != nil {
		return nil, nil, err
	}
	for _, p := range hits {
		add(p)
	}
	return out, exact, nil
}

// pinnedHint is what the model is told about a pinned page's problem: the
// reference, read in the book's style, when there is one.
func pinnedHint(book Book, q row) string {
	if ref, ok := questionRef(book, q); ok {
		return "It is " + ref.Name(book.Problems) + "."
	}
	return ""
}

// locateOnce shows the Finder a handful of pages as images and asks which
// one holds the problem, and where; the Reader then writes the problem
// out. ok is false when no page does, or the answer isn't usable; an
// error is a call that failed.
func (s *Service) locateOnce(ctx context.Context, m model, book Book, q row, pages []int, hint string) (location, bool, error) {
	var b strings.Builder
	fmt.Fprintf(&b, "The problem, as the student gave it:\n\n%s\n", q.Text)
	if hint != "" {
		fmt.Fprintf(&b, "\n%s\n", hint)
	}
	b.WriteString("\nThe pages follow as images, numbered from 1, each with its printed page and the part of the book it's in.")
	content := llm.PartsContent(llm.TextPart(b.String()))
	shown := 0
	var order []int
	var urls []string
	for _, p := range pages {
		url, err := s.pageImage(ctx, book.ID, p, locateWidth)
		if err != nil {
			if ctx.Err() != nil {
				return location{}, false, ctx.Err()
			}
			continue
		}
		shown++
		order, urls = append(order, p), append(urls, url)
		content.AppendPart(llm.TextPart(imageLabel(book, shown, p)))
		content.AppendPart(llm.ImagePart(url))
	}
	if shown == 0 {
		return location{}, false, nil
	}
	reply, err := m.client.ChatOnce(ctx, llm.Finder.Ask(llm.ChatRequest{Messages: []llm.Message{
		llm.TextMessage("system", locatePrompt),
		{Role: "user", Content: content},
	}}))
	if err != nil {
		if ctx.Err() != nil {
			return location{}, false, ctx.Err()
		}
		return location{}, false, modelDown(err, q)
	}
	var pin struct {
		Image   int       `json:"image"`
		Label   string    `json:"label"`
		Rect    *pdf.Rect `json:"question_rect"`
		Figures []struct {
			Label string    `json:"label"`
			Rect  *pdf.Rect `json:"rect"`
		} `json:"figures"`
	}
	if err := decodeReply(reply, &pin); err != nil {
		slog.Warn("locate: reply wasn't JSON", "question", q.ID, "err", err)
		return location{}, false, nil
	}
	if pin.Image < 1 || pin.Image > len(order) {
		return location{}, false, nil
	}
	// A page that only mentions the problem ("See Problem 14") isn't it:
	// the number the Finder read must be the one asked for.
	if ref, ok := questionRef(book, q); ok && !sameNumber(pin.Label, ref.Number) {
		slog.Info("locate: the problem found has another number", "question", q.ID, "label", pin.Label, "want", ref.Number)
		return location{}, false, nil
	}
	loc := location{Page: order[pin.Image-1], Label: strings.TrimSpace(pin.Label)}
	// The boxes fit to what's printed, on the page as the model saw it.
	page, err := s.c.Library.PageJPEG(ctx, book.ID, loc.Page, locateWidth)
	if err != nil {
		return location{}, false, err
	}
	fit := func(r *pdf.Rect) (pdf.Rect, bool) {
		if r == nil {
			return pdf.Rect{}, false
		}
		f := fractions(*r)
		if !f.Valid() {
			return pdf.Rect{}, false
		}
		return pdf.SnapToBlocks(page, f), true
	}
	fitFigure := func(r *pdf.Rect) (pdf.Rect, bool) {
		f, ok := fit(r)
		return f, ok && bigEnough(f)
	}
	if r, ok := fit(pin.Rect); ok {
		loc.Rect = &r
	}
	for _, f := range pin.Figures {
		if r, ok := fitFigure(f.Rect); ok && len(loc.Figures) < maxFigures {
			loc.Figures = append(loc.Figures, figure{Label: strings.TrimSpace(f.Label), Rect: r})
		}
	}
	if loc.Statement, err = s.writeOut(ctx, m, book, loc, urls[pin.Image-1], q); err != nil {
		return location{}, false, err
	}
	loc.Figures = s.checkFigures(ctx, m, book, q, loc)
	if r, ok := s.wholeText(ctx, m, book, q, loc, urls[pin.Image-1], page); ok {
		loc.Rect = &r
	}
	return loc, true, nil
}

// bigEnough is a box that can hold a figure: the Finder has boxed the
// words "Figure 7.1.4" in a problem's text and called that the figure.
func bigEnough(r pdf.Rect) bool { return r.W >= 0.06 && r.H >= 0.04 }

// sameNumber is whether a label the Finder read ("7.1 #14", "*4.68",
// "14.") ends in the problem's number.
func sameNumber(label, number string) bool {
	nums := labelDigits.FindAllString(label, -1)
	return len(nums) > 0 && strings.TrimLeft(nums[len(nums)-1], "0") == strings.TrimLeft(number, "0")
}

var labelDigits = regexp.MustCompile(`\d+`)

// decodeReply reads a model's JSON reply, and when it doesn't parse, once
// more with its brackets balanced: the Finder now and then closes a list
// with a brace ("}}}" for "}]}"), and a find lost to that was found
// again, wrongly, on a page that only mentioned the problem.
func decodeReply(reply string, v any) error {
	s := llm.Unfence(reply)
	err := json.Unmarshal([]byte(s), v)
	if err == nil {
		return nil
	}
	if fixed, changed := balance(s); changed && json.Unmarshal([]byte(fixed), v) == nil {
		return nil
	}
	return err
}

// balance closes what a JSON text leaves open, and whatever a closer
// skips past: each } or ] first closes what's open inside it.
func balance(s string) (string, bool) {
	var b strings.Builder
	var open []byte
	inString, escaped, changed := false, false, false
	for i := 0; i < len(s); i++ {
		c := s[i]
		if inString {
			b.WriteByte(c)
			switch {
			case escaped:
				escaped = false
			case c == '\\':
				escaped = true
			case c == '"':
				inString = false
			}
			continue
		}
		switch c {
		case '"':
			inString = true
		case '{':
			open = append(open, '}')
		case '[':
			open = append(open, ']')
		case '}', ']':
			for len(open) > 0 && open[len(open)-1] != c {
				b.WriteByte(open[len(open)-1])
				open, changed = open[:len(open)-1], true
			}
			if len(open) == 0 {
				changed = true
				continue
			}
			open = open[:len(open)-1]
		}
		b.WriteByte(c)
	}
	for len(open) > 0 {
		b.WriteByte(open[len(open)-1])
		open, changed = open[:len(open)-1], true
	}
	return b.String(), changed
}

// locateWidth is how wide the pages are shown to the Finder.
const locateWidth = 1100

// fractions is a box in fractions of the page. A model now and then gives
// thousandths, as some are trained to, in all four or only some: any
// number over 1 is taken as one.
func fractions(r pdf.Rect) pdf.Rect {
	f := func(v float64) float64 {
		if v > 1 {
			return v / 1000
		}
		return v
	}
	return pdf.Rect{X: f(r.X), Y: f(r.Y), W: f(r.W), H: f(r.H)}
}

// statementName is the problem the Reader writes out, as the book would
// say it: "section 1.1's problem 12", on a page where more than one
// section's problems can share a number.
func statementName(book Book, loc location, q row) string {
	if ref, ok := questionRef(book, q); ok {
		return ref.Name(book.Problems)
	}
	if loc.Label != "" {
		return "problem " + loc.Label
	}
	return problemName(q)
}

// writeOut is a found problem's words, read off its page by the Reader.
func (s *Service) writeOut(ctx context.Context, m model, book Book, loc location, pageURL string, q row) (string, error) {
	content := llm.PartsContent(
		llm.TextPart(fmt.Sprintf("Write out %s, on %s:", statementName(book, loc, q), book.Pages.Name(loc.Page))),
		llm.ImagePart(pageURL),
	)
	reply, err := m.client.ChatOnce(ctx, llm.Reader.Ask(llm.ChatRequest{ReasoningEffort: "low", Messages: []llm.Message{
		llm.TextMessage("system", statementPrompt),
		{Role: "user", Content: content},
	}}))
	if err != nil {
		if ctx.Err() != nil {
			return "", ctx.Err()
		}
		return "", modelDown(err, q)
	}
	return strings.TrimSpace(llm.Unfence(reply)), nil
}

// maxFigures caps the figures one question shows.
const maxFigures = 3
