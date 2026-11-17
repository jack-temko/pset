package homework

import (
	"context"
	"log/slog"
	"regexp"
	"strconv"
	"strings"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/pdf"
)

// A found problem's text box. The Finder's box for a problem's words is
// its weak spot: on the differential equations book's dense pages it
// boxed another problem's text, or the first two lines of a long one,
// 16 of 30 right. Where each problem starts it finds surely, asked in its
// own boxing mode for every problem on the page at once; the rest of the
// problem is the page's ink down its column (pdf.TextExtent). Together
// they boxed 28 of those 30, and 132 of 138 on the circuits book, whose
// JSON boxes got 17 of 23.

// boxer is the Finder in its own boxing mode: no fallback, since another
// model doesn't box this way.
var boxer = llm.Job{Name: llm.Finder.Name, Model: llm.Finder.Model, Plain: true}

// wholeText is the problem's text box from where it starts on its page;
// ok is false when the Finder doesn't box its start, and the find's own
// box stands.
func (s *Service) wholeText(ctx context.Context, m model, book Book, q row, loc location, pageURL string, page []byte) (pdf.Rect, bool) {
	number := ""
	if ref, ok := questionRef(book, q); ok {
		number = ref.Number
	} else if nums := labelDigits.FindAllString(loc.Label, -1); len(nums) > 0 {
		number = nums[len(nums)-1]
	}
	if number == "" {
		return pdf.Rect{}, false
	}
	reply, err := m.client.ChatOnce(ctx, boxer.Ask(llm.ChatRequest{Messages: []llm.Message{
		llm.TextMessage("system", "<hint>BOX</hint>"),
		{Role: "user", Content: llm.PartsContent(llm.ImagePart(pageURL), llm.TextPart(startsPrompt))},
	}}))
	if err != nil {
		if ctx.Err() == nil {
			slog.Warn("locate: boxing the page's problems", "question", q.ID, "err", err)
		}
		return pdf.Rect{}, false
	}
	starts := problemStarts(reply)
	start, ok := starts[trimZeros(number)]
	if !ok {
		return pdf.Rect{}, false
	}
	var stops []pdf.Rect
	for n, r := range starts {
		if n != trimZeros(number) {
			stops = append(stops, r)
		}
	}
	for _, f := range loc.Figures {
		if f.Page == 0 || f.Page == loc.Page {
			stops = append(stops, f.Rect)
		}
	}
	return pdf.TextExtent(page, start, stops)
}

// problemStarts reads the Finder's boxes, <point_box mention="Problem
// 12"> (x1,y1) (x2,y2) </point_box> on a grid of 1000, into each
// problem's first box by its number. The label can sit on the box or on
// the collection around it, and only "Problem N" counts: it also boxes
// equations, as "Equation (19)", and a part ("12b") or a second box for
// the same number is not where the problem starts.
func problemStarts(reply string) map[string]pdf.Rect {
	out := map[string]pdf.Rect{}
	collections := collectionOf.FindAllStringSubmatchIndex(reply, -1)
	for _, m := range pointBox.FindAllStringSubmatchIndex(reply, -1) {
		label := ""
		if m[2] >= 0 {
			label = reply[m[2]:m[3]]
		}
		if label == "" {
			for _, c := range collections {
				if c[0] <= m[0] && m[1] <= c[1] {
					label = reply[c[2]:c[3]]
				}
			}
		}
		k := startLabel.FindStringSubmatch(label)
		if k == nil {
			continue
		}
		parts := strings.Split(k[1], ".")
		n := trimZeros(parts[len(parts)-1])
		if _, seen := out[n]; seen {
			continue
		}
		var c [4]float64
		for i := range c {
			v, _ := strconv.Atoi(reply[m[2*i+4]:m[2*i+5]])
			c[i] = min(float64(v)/1000, 1)
		}
		r := pdf.Rect{X: min(c[0], c[2]), Y: min(c[1], c[3]), W: abs(c[2] - c[0]), H: abs(c[3] - c[1])}
		if r.Valid() {
			out[n] = r
		}
	}
	return out
}

var (
	collectionOf = regexp.MustCompile(`(?s)<collection\s+mention="([^"]*)"[^>]*>.*?</collection>`)
	startLabel   = regexp.MustCompile(`(?i)^\s*problem\s*\*?\s*(\d+(?:\.\d+)*)\s*$`)
)

var pointBox = regexp.MustCompile(`<point_box(?:\s+mention="([^"]*)")?[^>]*>\s*\((\d+),\s*(\d+)\)\s*\((\d+),\s*(\d+)\)\s*</point_box>`)

func trimZeros(n string) string {
	for len(n) > 1 && n[0] == '0' {
		n = n[1:]
	}
	return n
}

func abs(v float64) float64 {
	if v < 0 {
		return -v
	}
	return v
}
