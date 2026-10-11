package homework

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"regexp"
	"slices"
	"strings"

	"github.com/jackt/pset/internal/errs"
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
}

// locate runs the ladder: a page the student pinned is the only
// candidate; otherwise the exact tiers and search first, a wider search
// second, then a sweep of the chapter's pages as images.
func (s *Service) locate(ctx context.Context, m model, book Book, q row) (location, error) {
	notFound := notFoundInBook.New("name", problemName(q), "where", "the book")
	if q.Pinned != nil {
		loc, ok, err := s.locateOnce(ctx, m, book, q, []int{*q.Pinned}, pinnedHint(book, q))
		if err != nil {
			return location{}, err
		}
		if !ok {
			return location{}, notFoundInBook.New("name", problemName(q), "where", book.Pages.Name(*q.Pinned))
		}
		return loc, nil
	}

	ref, hasRef := questionRef(book, q)

	// A reference the book's numbering can place is looked for where it
	// must be, and only there: the same number elsewhere is another
	// problem.
	if hasRef {
		texts, err := s.c.Library.PageTexts(ctx, book.ID)
		if err != nil {
			return location{}, err
		}
		if sc, ok := scopeOf(book, ref, texts); ok {
			loc, found, err := s.findInScope(ctx, m, book, q, sc)
			if err != nil {
				return location{}, err
			}
			if !found {
				return location{}, notFoundInBook.New("name", ref.Name(book.Problems), "where", sc.where)
			}
			return loc, nil
		}
	}

	tried := map[int]bool{}
	for _, k := range []int{firstRound, widerRound} {
		cands, err := s.candidates(ctx, book, q.Text, k, tried)
		if err != nil {
			return location{}, err
		}
		if len(cands) == 0 {
			break
		}
		for _, p := range cands {
			tried[p] = true
		}
		loc, ok, err := s.locateOnce(ctx, m, book, q, cands, "")
		if err != nil {
			return location{}, err
		}
		if ok {
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
)

// candidates picks the pages a locate round looks at, exact before
// fuzzy: a printed page the question cites, pages that open a line with
// its label, then search.
func (s *Service) candidates(ctx context.Context, book Book, text string, k int, exclude map[int]bool) ([]int, error) {
	var out []int
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
		add(at)
		add(at + 1)
		add(at - 1)
	}
	if label, ok := questionLabel(text); ok {
		texts, err := s.c.Library.PageTexts(ctx, book.ID)
		if err != nil {
			return nil, err
		}
		for _, p := range labelScan(texts, label) {
			add(p)
		}
	}
	hits, err := s.c.Library.Search(ctx, book.ID, text, k+len(exclude))
	if err != nil {
		return nil, err
	}
	for _, p := range hits {
		add(p)
	}
	return out, nil
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
				return location{}, false, fmt.Errorf("stopped: %w", ctx.Err())
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
			return location{}, false, fmt.Errorf("stopped: %w", ctx.Err())
		}
		return location{}, false, err
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
	// The Finder's label isn't the check: it echoes the number it was
	// asked for on a page with a practice problem of that number, and
	// copies the prompt's example ("3.36") on the right page (3.2 #19 in
	// the DE book). The Reader is, below.
	if ref, ok := questionRef(book, q); ok && !sameNumber(pin.Label, ref.Number) {
		slog.Info("locate: the Finder's label has another number; the Reader will check", "question", q.ID, "label", pin.Label, "want", ref.Number)
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
	// The Reader, looking at the page to write the problem out, is the
	// check: a page that only mentions the problem ("See Problem 14"), or
	// shows a worked example or practice problem with its number, isn't
	// it. The rest of the batch is asked again without the page: the
	// right one was often beside it (3.2 #4, 9.3 #23 in the DE book).
	if notOnPage(loc.Statement) {
		slog.Info("locate: the Reader didn't see the problem on the page found", "question", q.ID, "page", loc.Page)
		return s.locateWithout(ctx, m, book, q, pages, loc.Page, hint)
	}
	loc.Figures = s.checkFigures(ctx, m, book, q, loc)
	if r, ok := s.wholeText(ctx, m, book, q, loc, urls[pin.Image-1], page); ok {
		loc.Rect = &r
	}
	return loc, true, nil
}

// locateWithout asks the Finder again about a batch less a page it
// picked wrongly; none is found when that was the batch's last page.
func (s *Service) locateWithout(ctx context.Context, m model, book Book, q row, pages []int, wrong int, hint string) (location, bool, error) {
	rest := slices.DeleteFunc(slices.Clone(pages), func(p int) bool { return p == wrong })
	if len(rest) == 0 || len(rest) == len(pages) {
		return location{}, false, nil
	}
	return s.locateOnce(ctx, m, book, q, rest, hint)
}

// notOnPage is a write-out that says the page doesn't show the problem.
func notOnPage(statement string) bool {
	return strings.HasPrefix(strings.ToUpper(strings.Trim(strings.TrimSpace(statement), "*_ ")), notOnPageReply)
}

// notOnPageReply is what the Reader writes when the page doesn't show
// the problem (statementPrompt).
const notOnPageReply = "NOT ON THIS PAGE"

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
	return errs.Data.Of(err)
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
			return "", fmt.Errorf("stopped: %w", ctx.Err())
		}
		return "", err
	}
	return strings.TrimSpace(llm.Unfence(reply)), nil
}

// maxFigures caps the figures one question shows.
const maxFigures = 3
