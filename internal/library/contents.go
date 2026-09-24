package library

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/pdf"
)

// Contents for a book with no outline, as the model reads them. Spec:
// design/contents.md. First the printed contents pages, read from their
// images and checked against the scan; else the model's pick of the
// heading-shaped lines; else nothing, and the book has no rail.

// model is the chat model the contents step talks to.
type model struct {
	client *llm.Client
	name   string
}

// chatModel is the model the import talks to; a book can't be prepared
// without one.
func (s *Service) chatModel(ctx context.Context) (model, error) {
	cfg, err := s.c.Models.LLM(ctx)
	if err != nil {
		return model{}, err
	}
	if !cfg.ChatReady() {
		return model{}, fail(nil, "There's no chat model set up. Add one in Settings, under Connections, then try again.")
	}
	return model{client: llm.Open(cfg), name: cfg.ChatModel}, nil
}

// readContents is the contents of a book with no outline. pages holds
// every page's text (index i is PDF page i+1); lines are a digital book's
// text lines with their font sizes, nil for a scan; printed are the
// contents pages findContentsPages found.
func (s *Service) readContents(ctx context.Context, m model, b row, path string, pages []string, lines []pdf.XMLLine, printed []int) ([]section, error) {
	if len(printed) > 0 {
		entries, err := s.readPrinted(ctx, m, b, path, printed)
		if err != nil {
			return nil, err
		}
		secs, ok := placeEntries(entries, pages, printed)
		if ok {
			return secs, nil
		}
		slog.Info("contents: the printed contents didn't match the scan", "book", b.ID, "entries", len(entries))
	}
	return pickHeadings(ctx, m, headingCandidates(pages, lines, printed))
}

// ---------------------------------------------------------------- finding

// The printed contents sit in the front of the book: pages where most
// lines end in a page number. A brief and a detailed contents both count.
const (
	contentsFrontMin   = 30   // pages searched at least
	contentsFrontShare = 0.15 // of the book, when that's more
	contentsMaxPages   = 12
	contentsMinLines   = 5   // lines ending in a number, at least
	contentsMinShare   = 0.4 // of the page's lines
)

// contentsLineRe is a contents line: words, then a page number at the end
// (after spaces, dot leaders or an ellipsis).
var contentsLineRe = regexp.MustCompile(`\p{L}{2}.*[\s.·…](\d{1,4})\s*$`)

// findContentsPages are the PDF pages that look like the printed contents.
func findContentsPages(pages []string) []int {
	front := min(len(pages), max(contentsFrontMin, int(contentsFrontShare*float64(len(pages)))))
	var out []int
	for i := 0; i < front && len(out) < contentsMaxPages; i++ {
		lines := nonEmptyLines(pages[i])
		hits := 0
		for _, l := range lines {
			if contentsLineRe.MatchString(l) {
				hits++
			}
		}
		if hits >= contentsMinLines && float64(hits) >= contentsMinShare*float64(len(lines)) {
			out = append(out, i+1)
		}
	}
	return out
}

// ---------------------------------------------------------------- reading

// contentsImageWidth is how wide a contents page is shown to the model:
// small print must stay legible.
const contentsImageWidth = 1200

const contentsPrompt = `You read a textbook's table of contents from images of its pages and return it as JSON.

Answer with {"entries":[{"number":"2.3","title":"Linear Equations","page":49,"level":2}]} and nothing else.

- One entry for each line of the contents that names a part, chapter, section or subsection, in printed order. If the book prints a brief contents and a detailed one, list each entry once, from the detailed one.
- number: the entry's numbering exactly as printed ("3", "3.2", "3.2.1", "A", "A.1"), or "" when it has none. Leave out words like "Chapter" or "Section".
- title: the title as printed, without its number or page number. Fix spacing where the print or scan ran words together, and join a title that wraps onto a second line. Start an appendix's title with "Appendix".
- page: the printed page number, as an integer. Leave out an entry whose page is a roman numeral or missing.
- level: 1 for a part or chapter, 2 for a section, 3 below that. Numbering decides when there is one: "3" is 1, "3.2" is 2, "3.2.1" is 3.
- From the back of the book, include the appendices, answers to problems, glossary, reference tables and index, each at level 1. Leave out front matter (preface, to the student, acknowledgments, the contents itself), the bibliography or references, and credits.
- Never add an entry that isn't printed.`

// contentsEntry is one line of the printed contents, as the model read it.
type contentsEntry struct {
	Number string  `json:"number"`
	Title  string  `json:"title"`
	Page   flexInt `json:"page"`
	Level  int     `json:"level"`
}

// flexInt takes a number or a numeric string; anything else is zero.
type flexInt int

func (n *flexInt) UnmarshalJSON(b []byte) error {
	var v any
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	switch t := v.(type) {
	case float64:
		*n = flexInt(t)
	case string:
		i, _ := strconv.Atoi(strings.TrimSpace(t))
		*n = flexInt(i)
	}
	return nil
}

// readPrinted shows the contents pages to the model.
func (s *Service) readPrinted(ctx context.Context, m model, b row, path string, pages []int) ([]contentsEntry, error) {
	content := llm.PartsContent(llm.TextPart(fmt.Sprintf("The contents pages follow, %d images in order.", len(pages))))
	for i, p := range pages {
		data, err := s.scans.get(ctx, b, path, p, contentsImageWidth)
		if err != nil {
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
			return nil, fail(err, "PSet couldn't render the book's contents pages.")
		}
		content.AppendPart(llm.TextPart(fmt.Sprintf("Image %d:", i+1)))
		content.AppendPart(llm.ImagePart("data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(data)))
	}
	var reply struct {
		Entries []contentsEntry `json:"entries"`
	}
	if err := m.askJSON(ctx, contentsPrompt, content, &reply); err != nil {
		return nil, err
	}
	return reply.Entries, nil
}

// contentsCallTimeout bounds one call. The slowest good answer seen took
// a minute and a half (600 candidate lines); a call past this has stalled.
var contentsCallTimeout = 5 * time.Minute

// askJSON asks once, and once more when the reply isn't the JSON asked
// for or the call stalls. A refused call, or a second bad reply or stall,
// fails the import.
func (m model) askJSON(ctx context.Context, system string, user llm.Content, out any) error {
	for try := 0; ; try++ {
		call, cancel := context.WithTimeout(ctx, contentsCallTimeout)
		reply, err := m.client.ChatOnce(call, llm.ChatRequest{Model: m.name, Messages: []llm.Message{
			llm.TextMessage("system", system),
			{Role: "user", Content: user},
		}})
		stalled := call.Err() != nil
		cancel()
		switch {
		case ctx.Err() != nil:
			return ctx.Err()
		case err != nil && stalled && try == 0:
			continue
		case err != nil && stalled:
			return fail(err, "Your chat model stopped answering while PSet read the book's contents. Try again in a minute.")
		case err != nil:
			return modelDown(err)
		}
		err = json.Unmarshal([]byte(llm.Unfence(reply)), out)
		if err == nil {
			return nil
		}
		if try == 1 {
			return fail(err, "Your chat model's answer about the book's contents couldn't be read. Try again, or try another model in Settings.")
		}
	}
}

// modelDown words a failed call as the failed row's reason.
func modelDown(err error) error {
	if trouble, status := llm.Classify(err); trouble == llm.TroubleRejected {
		return fail(err, "%s Check the chat connection in Settings, then try again.", llm.Refusal(status))
	}
	return fail(err, "Your chat model provider didn't answer while PSet read the book's contents. Try again in a minute.")
}

// ---------------------------------------------------------------- checking

// An entry is looked for on the page its printed number points to, then
// up to placeWindow pages either side, nearest (and earlier) first.
const placeWindow = 3

// Titles are compared by letters and digits only. A title may differ from
// the scan by one slip in every placeSlip characters, and only its first
// placeMaxKey characters are compared.
const (
	placeSlip   = 8
	placeMaxKey = 48
	// voteMinKey keeps short titles ("Index") out of the offset vote: they
	// turn up in running text.
	voteMinKey   = 12
	voteMinVotes = 3
)

// placeEntries turns the printed contents into sections on PDF pages,
// checked against the scan. ok is false when fewer than half the entries
// are found: then the contents isn't this book's.
func placeEntries(entries []contentsEntry, pages []string, printed []int) ([]section, bool) {
	type entry struct {
		level   int
		title   string
		key     string
		printed int
		page    int
		found   bool
	}
	var es []entry
	for _, e := range entries {
		title := collapseSpaces(e.Title)
		key := foldKey(title)
		if key == "" || e.Page <= 0 {
			continue
		}
		es = append(es, entry{level: entryLevel(e), title: numberedTitle(e.Number, title), key: key, printed: int(e.Page)})
	}
	if len(es) == 0 {
		return nil, false
	}
	// An appendix with numbered chapters after it belongs to the chapter
	// before it (a chapter's own appendices), not to the back of the book.
	lastChapter := -1
	for i, e := range es {
		if e.level == 1 && e.title != "" && unicode.IsDigit(rune(e.title[0])) {
			lastChapter = i
		}
	}
	for i := range lastChapter {
		if es[i].level == 1 && strings.HasPrefix(es[i].title, "Appendix") {
			es[i].level = 2
		}
	}

	folded := make([]string, len(pages))
	for i, t := range pages {
		folded[i] = foldKey(t)
	}
	skip := map[int]bool{}
	for _, p := range printed {
		skip[p] = true
	}

	// Where the book's printed pages sit: the difference most titles show
	// between their printed page and the first page they appear on.
	votes := map[int]int{}
	for _, e := range es {
		if len(e.key) < voteMinKey {
			continue
		}
		for i, f := range folded {
			if !skip[i+1] && strings.Contains(f, clip(e.key)) {
				votes[i+1-e.printed]++
				break
			}
		}
	}
	offset, best := 0, 0
	for d, v := range votes {
		if v > best || (v == best && d < offset) {
			offset, best = d, v
		}
	}
	if best < voteMinVotes {
		var ok bool
		if offset, ok = detectOffset(pages); !ok {
			return nil, false
		}
	}

	heads := runningHeads(pages)

	// Each entry is looked for where the last one found says it should
	// be, so a scan that lost a page midway still lines up. The page where
	// its title opens a line beats one where it's only in the text, which
	// beats a running head; among equals the nearest wins. Entries keep
	// their printed order: none lands before the one above it.
	found := 0
	last, floor := offset, 1
	for i := range es {
		key := clip(es[i].key)
		strongest, at := matchNone, 0
		for _, d := range windowOrder() {
			p := es[i].printed + last + d
			if p < floor || p > len(pages) || skip[p] {
				continue
			}
			if m := matchOn(pages[p-1], key, heads); m > strongest {
				strongest, at = m, p
			}
		}
		if strongest == matchNone {
			continue
		}
		es[i].page, es[i].found = at, true
		last, floor = at-es[i].printed, at
		found++
	}
	if found < 2 || 2*found < len(es) {
		return nil, false
	}

	// An entry not found takes the offset of a neighbour that was.
	var out []section
	for i, e := range es {
		if !e.found {
			switch {
			case i > 0 && es[i-1].found:
				e.page = e.printed + es[i-1].page - es[i-1].printed
			case i+1 < len(es) && es[i+1].found:
				e.page = e.printed + es[i+1].page - es[i+1].printed
			default:
				continue
			}
		}
		out = append(out, section{Level: e.level, Title: e.title, StartPage: e.page})
	}
	return out, true
}

// How strongly a page shows an entry's title.
const (
	matchNone    = iota
	matchHead    // only in a running head
	matchText    // in the page's text
	matchHeading // at the start of a line: the heading itself
)

// matchOn is how page text shows the (folded) title key. A heading may
// carry its number ("2.8 The Existence …") and wrap onto a second line.
// heads are the book's running heads, by headKey.
func matchOn(text, key string, heads map[string]bool) int {
	k := len(key) / placeSlip
	lines := nonEmptyLines(text)
	var body strings.Builder
	for i, l := range lines {
		if (i < edgeLines || i >= len(lines)-edgeLines) && (hasEdgeNumber(l) || heads[headKey(l)]) {
			continue
		}
		body.WriteString(l)
		body.WriteByte('\n')
		start := strings.TrimLeft(foldKey(l), "0123456789")
		if i+1 < len(lines) {
			start += foldKey(lines[i+1])
		}
		if fuzzyContains(start[:min(len(start), len(key)+k)], key, k) {
			return matchHeading
		}
	}
	switch {
	case fuzzyContains(foldKey(body.String()), key, k):
		return matchText
	case fuzzyContains(foldKey(text), key, k):
		return matchHead
	}
	return matchNone
}

// runningHeads are the head and foot lines that repeat on more than one
// page, by headKey: a running head whose page number the OCR lost still
// repeats.
func runningHeads(pages []string) map[string]bool {
	seen := map[string]int{}
	for _, text := range pages {
		lines := nonEmptyLines(text)
		page := map[string]bool{}
		for i, l := range lines {
			if i < edgeLines || i >= len(lines)-edgeLines {
				if k := headKey(l); len(k) >= voteMinKey && !page[k] {
					page[k] = true
					seen[k]++
				}
			}
		}
	}
	out := map[string]bool{}
	for k, n := range seen {
		if n > 1 {
			out[k] = true
		}
	}
	return out
}

// headKey is a head line folded, without the page number at either end.
func headKey(line string) string {
	return strings.Trim(foldKey(line), "0123456789")
}

// hasEdgeNumber reports whether a line starts or ends with a number, as a
// running head or foot carrying the page number does.
func hasEdgeNumber(line string) bool {
	f := strings.Fields(strings.Trim(line, pageNumberDress))
	if len(f) < 2 {
		return false
	}
	for _, tok := range []string{f[0], f[len(f)-1]} {
		if _, err := strconv.Atoi(strings.Trim(tok, pageNumberDress)); err == nil {
			return true
		}
	}
	return false
}

// windowOrder is 0, -1, 1, -2, 2, ...: nearest first, earlier on a tie,
// because a running head repeats a title on the pages after its start.
func windowOrder() []int {
	out := []int{0}
	for d := 1; d <= placeWindow; d++ {
		out = append(out, -d, d)
	}
	return out
}

// entryLevel is the numbering's depth ("3.2" is 2), or the model's level
// for an unnumbered entry.
func entryLevel(e contentsEntry) int {
	if n := strings.TrimSpace(e.Number); n != "" {
		return strings.Count(strings.Trim(n, "."), ".") + 1
	}
	return max(e.Level, 1)
}

// numberedTitle puts the entry's number in front of its title, as the
// book prints it: "2.3 Linear Equations". A title that already names it
// ("Appendix A Sets") stays as it is, and a bare "Appendix" takes it
// after the word: "Appendix A".
func numberedTitle(number, title string) string {
	number = strings.Trim(strings.TrimSpace(number), ".")
	if number == "" || slices.Contains(strings.Fields(strings.ReplaceAll(title, ":", " ")), number) {
		return title
	}
	if word, rest, _ := strings.Cut(title, " "); strings.EqualFold(word, "appendix") {
		return strings.TrimSpace("Appendix " + number + " " + rest)
	}
	return number + " " + title
}

// foldKey keeps only lowercase ASCII letters and digits, so spacing,
// punctuation and line breaks don't matter.
func foldKey(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(s) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func clip(key string) string {
	if len(key) > placeMaxKey {
		return key[:placeMaxKey]
	}
	return key
}

// fuzzyContains reports whether pat occurs in text with at most k edits
// (Sellers' approximate substring match).
func fuzzyContains(text, pat string, k int) bool {
	if strings.Contains(text, pat) {
		return true
	}
	if k == 0 || pat == "" {
		return false
	}
	col := make([]int, len(pat)+1)
	for i := range col {
		col[i] = i
	}
	for j := 0; j < len(text); j++ {
		diag := col[0]
		for i := 1; i <= len(pat); i++ {
			up := col[i]
			cost := 1
			if pat[i-1] == text[j] {
				cost = 0
			}
			col[i] = min(col[i]+1, col[i-1]+1, diag+cost)
			diag = up
		}
		if col[len(pat)] <= k {
			return true
		}
	}
	return false
}

// ---------------------------------------------------------------- picking

// candidate is a heading-shaped line and the PDF page it's on.
type candidate struct {
	Page int
	Text string
}

// headingCandidates are the lines the model picks headings from, in page
// order: heading-shaped lines of the page text and, in a digital book,
// lines set larger than the body. A running head's page number is
// stripped, so its repeats merge into one line at its first page. Lines
// with no real word or with an "=" (equations, exercises) are dropped, and
// so are the contents pages.
func headingCandidates(pages []string, lines []pdf.XMLLine, printed []int) []candidate {
	skip := map[int]bool{}
	for _, p := range printed {
		skip[p] = true
	}
	offset, offsetOK := detectOffset(pages)
	var all []candidate
	for i, text := range pages {
		p := i + 1
		if skip[p] {
			continue
		}
		ls := nonEmptyLines(text)
		for li, l := range ls {
			if li < edgeLines || li >= len(ls)-edgeLines {
				l = stripPageNumber(l, p-offset, offsetOK)
			}
			if headingShaped(l) {
				all = append(all, candidate{Page: p, Text: collapseSpaces(l)})
			}
		}
	}
	for _, c := range largerLines(lines) {
		if !skip[c.Page] {
			all = append(all, c)
		}
	}
	sort.SliceStable(all, func(a, b int) bool { return all[a].Page < all[b].Page })

	seen := map[string]bool{}
	var out []candidate
	for _, c := range all {
		key := foldKey(c.Text)
		if seen[key] || !wordy(c.Text) || strings.Contains(c.Text, "=") {
			continue
		}
		seen[key] = true
		out = append(out, c)
	}
	return out
}

// stripPageNumber drops a page number from either end of a head or foot
// line. When the book's offset is known, only a number near the page's
// printed number counts (the offset may drift by a page or two), and at
// the start only the exact number or one before "Chapter …": "1
// Introduction" at the top of printed page 2 is a chapter heading. When
// the offset isn't known, only a number at the end counts.
func stripPageNumber(line string, printed int, known bool) string {
	f := strings.Fields(line)
	if len(f) < 2 {
		return line
	}
	number := func(tok string) (int, bool) {
		n, err := strconv.Atoi(strings.Trim(tok, pageNumberDress))
		return n, err == nil
	}
	near := func(n int) bool { return n-printed <= placeWindow && printed-n <= placeWindow }
	if n, ok := number(f[0]); known && ok && (n == printed || near(n) && patternKeywordRe.MatchString(strings.Join(f[1:], " "))) {
		return strings.Join(f[1:], " ")
	}
	// "Chapter 3" keeps its number.
	if patternKeywordRe.MatchString(strings.Join(f[len(f)-2:], " ")) {
		return line
	}
	if n, ok := number(f[len(f)-1]); ok && (!known || near(n)) {
		return strings.Join(f[:len(f)-1], " ")
	}
	return line
}

// wordyRe is a real word: four letters in a row.
var wordyRe = regexp.MustCompile(`\p{L}{4}`)

func wordy(s string) bool { return wordyRe.MatchString(s) }

// The model sees the candidates pickBatch at a time; fewer than pickMin
// picks is no contents at all.
const (
	pickBatch = 600
	pickMin   = 3
)

const pickPrompt = `You pick a textbook's real chapter and section headings from lines found in its pages. Each line reads "[n] page P | text". Most lines are not headings: running heads repeated at the top of pages, exercises and their equations, figure labels, OCR noise from plots, entries in the answers or the index, sentences that happen to start with a number.

Answer with {"headings":[{"line":12,"level":1}]} and nothing else, in the order given.

- Pick a line only where it opens a part, chapter, section or subsection, or starts an appendix, the answers to problems, the glossary or the index.
- level: 1 for a part, chapter, appendix, the answers, the glossary or the index; 2 for a section; 3 below that. Numbering decides when there is one: "3" is 1, "3.2" is 2, "3.2.1" is 3.
- When the same heading shows up more than once, pick the line where it starts.
- Leave out front matter (preface, acknowledgments, the contents), the bibliography and credits.
- Pick nothing rather than guess.`

// pickHeadings has the model pick the real headings from the candidates.
// It answers with line numbers, so it can't invent one.
func pickHeadings(ctx context.Context, m model, cands []candidate) ([]section, error) {
	if len(cands) < pickMin {
		return nil, nil
	}
	var out []section
	used := map[int]bool{}
	for start := 0; start < len(cands); start += pickBatch {
		end := min(start+pickBatch, len(cands))
		var b strings.Builder
		fmt.Fprintf(&b, "Lines %d to %d of %d:\n\n", start+1, end, len(cands))
		for i := start; i < end; i++ {
			fmt.Fprintf(&b, "[%d] page %d | %s\n", i+1, cands[i].Page, cands[i].Text)
		}
		var reply struct {
			Headings []struct {
				Line  flexInt `json:"line"`
				Level int     `json:"level"`
			} `json:"headings"`
		}
		if err := m.askJSON(ctx, pickPrompt, llm.TextContent(b.String()), &reply); err != nil {
			return nil, err
		}
		for _, h := range reply.Headings {
			i := int(h.Line) - 1
			if i < start || i >= end || used[i] {
				continue
			}
			used[i] = true
			out = append(out, section{Level: max(h.Level, 1), Title: cands[i].Text, StartPage: cands[i].Page})
		}
	}
	if len(out) < pickMin {
		return nil, nil
	}
	return out, nil
}
