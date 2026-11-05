package homework

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"regexp"
	"slices"
	"strings"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/pdf"
)

// Figures, checked against the problem's words. The Finder boxes the
// figures on the page it found, and it can box the wrong one: asked for a
// problem whose figure is on another page, it boxed one that is on this
// page and labelled it with the number the problem names (seen on the
// differential equations book, 2026-09-29). So each boxed figure's own
// caption is read, a figure the problem doesn't name is dropped, and one
// it names that isn't on its page is looked for on the pages around it.

// figureNumbers is the figures a problem names, in order: "Figure 7.1.2",
// "Fig. 4.132", "FIGURE 2.5.9(a)". A plural ("Figures 1.1.5 through
// 1.1.10") is the shared text of a run of problems, not this one's own
// figure, and doesn't count.
func figureNumbers(statement string) []string {
	var out []string
	for _, m := range figureRef.FindAllStringSubmatch(statement, -1) {
		if n := figureNumber(m[1]); n != "" && !slices.Contains(out, n) {
			out = append(out, n)
		}
	}
	return out
}

var figureRef = regexp.MustCompile(`(?i)\bfig(?:ure|\.)?\s*~?\s*(\d+(?:\.\d+)*)`)

// figureNumber is a figure's number without its panel or punctuation:
// "7.1.3(a)" and "Figure 7.1.3." are both "7.1.3".
func figureNumber(s string) string {
	m := figureDigits.FindString(s)
	return strings.Trim(m, ".")
}

var figureDigits = regexp.MustCompile(`\d+(?:\.\d+)*`)

// checkFigures keeps the boxed figures the problem names, and looks for
// the ones it names that weren't boxed. A problem that names no figure by
// number can't be checked, and keeps what was boxed.
func (s *Service) checkFigures(ctx context.Context, m model, book Book, q row, loc location) []figure {
	named := figureNumbers(loc.Statement)
	if len(named) == 0 {
		return loc.Figures
	}
	var kept []figure
	have := map[string]bool{}
	if len(loc.Figures) > 0 {
		caps, err := s.captions(ctx, m, book, loc.Page, loc.Figures)
		if err != nil {
			if ctx.Err() == nil {
				slog.Warn("figures: reading the captions", "question", q.ID, "err", err)
			}
			return loc.Figures
		}
		for i, f := range loc.Figures {
			switch c := caps[i]; {
			case c == "":
				// No caption: in a book that numbers its figures, not one
				// of them. The problem's page is looked at again below.
				slog.Info("figures: dropped a box with no caption", "question", q.ID, "named", named)
			case slices.Contains(named, c):
				f.Label = "Figure " + c
				kept = append(kept, f)
				have[c] = true
			default:
				slog.Info("figures: dropped a figure the problem doesn't name", "question", q.ID, "caption", c, "named", named)
			}
		}
	}
	for _, n := range named {
		if have[n] || len(kept) >= maxFigures {
			continue
		}
		s.setActivity(ctx, q.ID, fmt.Sprintf("Looking for Figure %s…", n))
		if f, ok := s.findFigure(ctx, m, book, loc.Page, n); ok {
			kept = append(kept, f)
		}
	}
	return kept
}

// captionWidth is how wide a page is rendered to read captions from.
const captionWidth = 1600

// captions reads the number each figure's own caption prints, "" where
// there's none to read. A figure is cut with room below it and a little
// above, where captions go.
func (s *Service) captions(ctx context.Context, m model, book Book, page int, figs []figure) ([]string, error) {
	content := llm.PartsContent(llm.TextPart("The figures, each cut from its page:"))
	for i, f := range figs {
		p := page
		if f.Page > 0 {
			p = f.Page
		}
		img, err := s.c.Library.PageJPEG(ctx, book.ID, p, captionWidth)
		if err != nil {
			return nil, err
		}
		crop, err := pdf.CropJPEG(img, captionRoom(f.Rect))
		if err != nil {
			return nil, err
		}
		content.AppendPart(llm.TextPart(fmt.Sprintf("Figure %d:", i+1)))
		content.AppendPart(llm.ImagePart("data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(crop)))
	}
	reply, err := m.client.ChatOnce(ctx, llm.Reader.Ask(llm.ChatRequest{ReasoningEffort: "low", Messages: []llm.Message{
		llm.TextMessage("system", captionPrompt),
		{Role: "user", Content: content},
	}}))
	if err != nil {
		return nil, err
	}
	var read struct {
		Captions []string `json:"captions"`
	}
	if err := json.Unmarshal([]byte(llm.Unfence(reply)), &read); err != nil {
		return nil, fmt.Errorf("captions weren't JSON: %w", err)
	}
	out := make([]string, len(figs))
	for i := range out {
		if i < len(read.Captions) {
			out[i] = figureNumber(read.Captions[i])
		}
	}
	return out, nil
}

// captionRoom is a figure's box with the room its caption takes: below
// it, and a little above, for a book that puts captions on top.
func captionRoom(r pdf.Rect) pdf.Rect {
	y := math.Max(0, r.Y-0.02)
	return pdf.Rect{X: math.Max(0, r.X-0.02), Y: y, W: math.Min(1, r.X+r.W+0.02) - math.Max(0, r.X-0.02), H: math.Min(1, r.Y+r.H+0.07) - y}
}

// Where a figure the problem names might be, when it wasn't boxed right:
// the problem's own page, where the caption check guards against boxing
// the wrong one again, then the pages whose text mentions it, then the
// pages around, nearest first. A scan's captions often don't survive
// OCR (the differential equations book's are white on teal), so the
// pages around count even where the text doesn't say.
const (
	mentionReach = 8
	figureReach  = 3
	figurePages  = 7
)

// findFigure looks for figure n on the pages around the problem's, boxes
// it there, and checks its caption.
func (s *Service) findFigure(ctx context.Context, m model, book Book, from int, n string) (figure, bool) {
	texts, err := s.c.Library.PageTexts(ctx, book.ID)
	if err != nil {
		return figure{}, false
	}
	pages := figureCandidates(texts, from, n)
	if len(pages) == 0 {
		return figure{}, false
	}
	content := llm.PartsContent(llm.TextPart(fmt.Sprintf("Find Figure %s. The pages follow as images, numbered from 1.", n)))
	var order []int
	for _, p := range pages {
		url, err := s.pageImage(ctx, book.ID, p, locateWidth)
		if err != nil {
			continue
		}
		order = append(order, p)
		content.AppendPart(llm.TextPart(imageLabel(book, len(order), p)))
		content.AppendPart(llm.ImagePart(url))
	}
	if len(order) == 0 {
		return figure{}, false
	}
	reply, err := m.client.ChatOnce(ctx, llm.Finder.Ask(llm.ChatRequest{Messages: []llm.Message{
		llm.TextMessage("system", figurePrompt),
		{Role: "user", Content: content},
	}}))
	if err != nil {
		slog.Warn("figures: looking on other pages", "figure", n, "err", err)
		return figure{}, false
	}
	var pin struct {
		Image int       `json:"image"`
		Rect  *pdf.Rect `json:"rect"`
	}
	if json.Unmarshal([]byte(llm.Unfence(reply)), &pin) != nil || pin.Image < 1 || pin.Image > len(order) || pin.Rect == nil {
		return figure{}, false
	}
	r := fractions(*pin.Rect)
	if !r.Valid() || !bigEnough(r) {
		return figure{}, false
	}
	page := order[pin.Image-1]
	if img, err := s.c.Library.PageJPEG(ctx, book.ID, page, locateWidth); err == nil {
		r = pdf.SnapToBlocks(img, r)
	}
	f := figure{Label: "Figure " + n, Rect: r, Page: page}
	// The one it boxed must be the one asked for.
	caps, err := s.captions(ctx, m, book, page, []figure{f})
	if err != nil || (caps[0] != "" && caps[0] != n) {
		slog.Info("figures: the figure found elsewhere isn't the one named", "figure", n, "caption", caps)
		return figure{}, false
	}
	return f, true
}

// figureCandidates is where to look for figure n: the problem's own page,
// pages whose text mentions it, then the pages within reach of the
// problem's, nearest first.
func figureCandidates(texts []string, from int, n string) []int {
	mention := regexp.MustCompile(`(^|[^\d.])` + regexp.QuoteMeta(n) + `([^\d]|$)`)
	var out []int
	add := func(p int) {
		if p >= 1 && p <= len(texts) && !slices.Contains(out, p) && len(out) < figurePages {
			out = append(out, p)
		}
	}
	add(from)
	for d := 1; d <= mentionReach; d++ {
		for _, p := range []int{from - d, from + d} {
			if p >= 1 && p <= len(texts) && mention.MatchString(texts[p-1]) {
				add(p)
			}
		}
	}
	for d := 1; d <= figureReach; d++ {
		add(from - d)
		add(from + d)
	}
	return out
}
