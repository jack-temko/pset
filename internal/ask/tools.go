package ask

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackt/pset/internal/cards"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/mathx"
)

// The tools: as few as cover what a student needs. Pages are the printed
// numbers the model sees in the book and cites; the library speaks PDF
// pages, so each tool converts once.
var tools = []llm.Tool{
	llm.NewTool("search_pages", "Search the book for pages about something. Returns the best pages with a snippet of each.",
		json.RawMessage(`{"type":"object","properties":{"query":{"type":"string","description":"What to look for, in a few words."}},"required":["query"]}`)),
	llm.NewTool("read_page", "Read the text of a page, or of up to three pages in a row.",
		json.RawMessage(`{"type":"object","properties":{"page":{"type":"integer","description":"The printed page number."},"to":{"type":"integer","description":"The last page, to read a range."}},"required":["page"]}`)),
	llm.NewTool("view_page", "Look at a page as an image: for figures, diagrams, tables, or text the page's text layer garbles.",
		json.RawMessage(`{"type":"object","properties":{"page":{"type":"integer","description":"The printed page number."}},"required":["page"]}`)),
	llm.NewTool("compute", "Evaluate an arithmetic expression exactly: fractions stay fractions. Use it for every calculation instead of doing it in your head. Syntax: + - * / ^, parentheses, sqrt, exp, ln, log10, sin, cos, tan, pi, e.",
		json.RawMessage(`{"type":"object","properties":{"expression":{"type":"string"}},"required":["expression"]}`)),
}

const maxReadPages = 3

// tool runs one call and returns what to tell the model, plus any page
// images it should see. Every call is a step on the feed.
func (r *run) tool(ctx context.Context, call llm.ToolCall) (string, []llm.Part) {
	var args struct {
		Query      string `json:"query"`
		Page       int    `json:"page"`
		To         int    `json:"to"`
		Expression string `json:"expression"`
	}
	if err := json.Unmarshal([]byte(call.Function.Arguments), &args); err != nil {
		return "Error: the arguments weren't valid JSON.", nil
	}
	b := r.book
	switch call.Function.Name {
	case "search_pages":
		q := strings.TrimSpace(args.Query)
		r.step(ctx, fmt.Sprintf("Searching ‘%s’…", q), true)
		hits, err := r.s.c.Library.Search(ctx, b.ID, q, 6)
		if err != nil {
			r.step(ctx, fmt.Sprintf("Searched ‘%s’ · failed", q), false)
			return "Error: search failed: " + err.Error(), nil
		}
		var out strings.Builder
		fmt.Fprintf(&out, "Pages matching %q, best first:\n", q)
		for _, p := range hits {
			text, _ := r.s.c.Library.PageText(ctx, b.ID, p)
			fmt.Fprintf(&out, "\n%s:\n%s\n", pageName(p, b.PageOffset), snippet(text, q))
		}
		r.step(ctx, fmt.Sprintf("Searched ‘%s’ · %s", q, plural(len(hits), "page")), false)
		return out.String(), nil

	case "read_page":
		from, to := args.Page, args.To
		if to < from {
			to = from
		}
		to = min(to, from+maxReadPages-1)
		label := "p. " + fmt.Sprint(from)
		if to > from {
			label = fmt.Sprintf("p. %d–%d", from, to)
		}
		r.step(ctx, "Reading "+label+"…", true)
		var out strings.Builder
		for p := from; p <= to; p++ {
			pdf := p + b.PageOffset
			if pdf < 1 || pdf > b.PageCount {
				fmt.Fprintf(&out, "p. %d: the book has no such page.\n", p)
				continue
			}
			text, _ := r.s.c.Library.PageText(ctx, b.ID, pdf)
			fmt.Fprintf(&out, "p. %d:\n%s\n\n", p, clip(text, 5000))
		}
		r.step(ctx, "Read "+label, false)
		return out.String(), nil

	case "view_page":
		p := args.Page
		r.step(ctx, fmt.Sprintf("Looking at p. %d…", p), true)
		pdf := p + b.PageOffset
		if pdf < 1 || pdf > b.PageCount {
			r.step(ctx, fmt.Sprintf("Looked for p. %d · not in the book", p), false)
			return fmt.Sprintf("The book has no p. %d.", p), nil
		}
		img, err := r.s.c.Library.PageJPEG(ctx, b.ID, pdf, 1400)
		if err != nil {
			r.step(ctx, fmt.Sprintf("Looked at p. %d · couldn't render it", p), false)
			return "Error: the page couldn't be rendered.", nil
		}
		r.step(ctx, fmt.Sprintf("Looked at p. %d", p), false)
		return fmt.Sprintf("The image of p. %d follows.", p), []llm.Part{
			llm.TextPart(fmt.Sprintf("p. %d:", p)),
			llm.ImagePart("data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(img)),
		}

	case "compute":
		e := strings.TrimSpace(args.Expression)
		r.step(ctx, "Computing…", true)
		v, err := mathx.Eval(e)
		if err != nil {
			r.step(ctx, "Computed · error", false)
			return "Error: " + err.Error(), nil
		}
		r.step(ctx, "Computed "+clip(e, 40)+" = "+clip(v.String(), 30), false)
		return v.String(), nil
	}
	return "Error: there's no tool called " + call.Function.Name + ".", nil
}

func pageName(pdf, offset int) string {
	if p := pdf - offset; p >= 1 {
		return fmt.Sprintf("p. %d", p)
	}
	return fmt.Sprintf("front matter (not citable, PDF page %d)", pdf)
}

// snippet is a window of a page around the first word of the query it
// contains, or its opening.
func snippet(text, query string) string {
	lower := strings.ToLower(text)
	at := -1
	for _, w := range strings.Fields(strings.ToLower(query)) {
		if len(w) > 2 {
			if i := strings.Index(lower, w); i >= 0 {
				at = i
				break
			}
		}
	}
	start := max(0, at-150)
	if at < 0 {
		start = 0
	}
	end := min(len(text), start+400)
	return strings.Join(strings.Fields(text[start:end]), " ")
}

func clip(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

func plural(n int, w string) string {
	if n == 1 {
		return "1 " + w
	}
	return fmt.Sprintf("%d %ss", n, w)
}

const repairPrompt = `You fix one malformed card for a rendering pipeline. You get its kind, the
card as written, what is wrong with it, and the JSON schema it must satisfy. Reply with only the
corrected JSON object: no prose, no code fence, no comments.`

func systemPrompt(title, name string) string {
	who := "Be warm and encouraging, like a good tutor sitting beside the student."
	if name != "" {
		who = fmt.Sprintf("You're talking with %s. Be warm and encouraging, like a good tutor sitting beside them, and use their name now and then where it's natural, never in every reply.", name)
	}
	return fmt.Sprintf(`You are the tutor for the textbook %q, answering a student's questions about it. %s

Use the book. Search it, read the pages you need, look at a page when a figure or the layout
matters, and use compute for every calculation. Then answer: focused, in short paragraphs, the way
the book would put it, and no longer than the question needs.

- Cite the book as [p. N], N the printed page number the tools give, right where a page supports
  what you say. Cite only pages you read or searched.
- If the book doesn't cover something, say so, then answer from general knowledge and say that's
  what you did.

%s`, title, who, cards.Prompt)
}
