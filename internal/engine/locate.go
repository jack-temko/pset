package engine

import (
	"context"
	"regexp"
	"strconv"
	"strings"

	"github.com/jackt/pset/internal/store"
)

// The locate ladder's deterministic half. Retrieval (FTS + vectors) is
// noise for a question that is nothing but a problem number — "3.36"
// tokenizes to the phrase "3 36", which matches numeric junk on every page
// of a math book — so the ladder puts exact tiers ahead of it: what the
// book has already confirmed, then a scan for the label as a problem
// statement, and only then fused retrieval. When every text tier misses,
// the sweep reads the chapter's pages as images, which works even when the
// text layer is garbage.

// labelQuestionShape matches a transcription that is just a problem label,
// optionally with a leading kind word and a trailing parenthetical note:
// "3.36", "Problem 3.36.", "3.24 (use matlab)". Anything with prose after
// it fails the match, so worded questions keep the retrieval path.
var labelQuestionShape = regexp.MustCompile(
	`(?i)^\s*(?:problem\s+|prob\.?\s*|exercise\s+|ex\.?\s*)?(\d{1,2}\.\d{1,3})\.?\s*(?:\([^()]*\))?\s*$`)

var labelChapterShape = regexp.MustCompile(`^(\d{1,2})\.\d{1,3}$`)

var hintChapterShape = regexp.MustCompile(`(?i)\bchapter\s+(\d{1,3})\b`)

// questionLabel reports the problem label a transcription is nothing but,
// and false for anything carrying prose — a worded question must not take
// the label path on the strength of a leading number.
func questionLabel(text string) (string, bool) {
	m := labelQuestionShape.FindStringSubmatch(text)
	if m == nil {
		return "", false
	}
	return m[1], true
}

// questionChapter resolves the chapter a locate sweep would read: the
// label's own prefix ("3.36" lives in chapter 3), falling back to a
// "Chapter N" in the assignment's hint.
func questionChapter(label, hint string) (int, bool) {
	if m := labelChapterShape.FindStringSubmatch(label); m != nil {
		if n, err := strconv.Atoi(m[1]); err == nil && n > 0 {
			return n, true
		}
	}
	if m := hintChapterShape.FindStringSubmatch(hint); m != nil {
		if n, err := strconv.Atoi(m[1]); err == nil && n > 0 {
			return n, true
		}
	}
	return 0, false
}

// questionQuery splits a transcription into the search text and the
// assignment's trailing hint: "3.36\n(hint: Chapter 3)" becomes "3.36" and
// "Chapter 3".
func questionQuery(transcription string) (query, hint string) {
	query = transcription
	if i := strings.LastIndex(transcription, "\n(hint: "); i >= 0 {
		query = transcription[:i]
		hint = strings.TrimSpace(strings.TrimSuffix(transcription[i+len("\n(hint: "):], ")"))
	}
	return query, hint
}

// labelStatementShape builds the pattern of a problem statement opening a
// text line: the label, an optional trailing dot, then content on the same
// line. References never open the line — "Fig. 3.36", "(3.36)", "Prob. 3.5"
// all carry their label mid-line — and the same-line rule keeps a bare
// label line from borrowing the next line's first word as its content.
func labelStatementShape(label string) (*regexp.Regexp, error) {
	return regexp.Compile(`(?m)^\s*` + regexp.QuoteMeta(label) + `\.?[ \t]+\S`)
}

// labelScanPages walks stored page text for pages whose text opens a line
// with the label as a problem statement, page numbers ascending. The cap
// keeps an answer-key section from crowding the vision call; the vision
// round still judges which hit is the assigned problem.
func labelScanPages(pages []store.Page, label string) []int {
	re, err := labelStatementShape(label)
	if err != nil {
		return nil
	}
	var out []int
	for _, p := range pages {
		if re.MatchString(p.Text) {
			out = append(out, p.Number)
			if len(out) >= hwScanMaxHits {
				break
			}
		}
	}
	return out
}

// factLabelPage reads the book's confirmed-locations fact for one label —
// the "3.36→p143" entries rememberConfirmed writes — so a problem the book
// has already given up goes straight to its page next time.
func (r *hwRunContext) factLabelPage(ctx context.Context, label string) (int, bool) {
	fact, err := r.s.BookFact(ctx, r.book.ID, store.FactConfirmed)
	if err != nil || fact.Value == "" {
		return 0, false
	}
	for _, entry := range strings.Split(fact.Value, ", ") {
		page, ok := strings.CutPrefix(entry, label+"→p")
		if !ok {
			continue
		}
		if n, err := strconv.Atoi(page); err == nil && n > 0 {
			return n, true
		}
	}
	return 0, false
}

// chapterSpanShape matches the section title a chapter number hides in:
// "Chapter 3", "Chapter 3. Methods of Analysis".
func chapterSpanShape(chapter int) *regexp.Regexp {
	return regexp.MustCompile(`(?i)^\s*chapter\s+` + strconv.Itoa(chapter) + `\b`)
}

// chapterSpan maps a chapter number to the page span its section occupies
// in the book. The section's own end page wins when set; otherwise the
// span runs to the next section's start or the book's last page. False
// when no stored section names that chapter — the sweep then refuses
// rather than paging through a guess.
func chapterSpan(sections []store.Section, chapter, pageCount int) (start, end int, ok bool) {
	re := chapterSpanShape(chapter)
	for i, sec := range sections {
		if !re.MatchString(strings.TrimSpace(sec.Title)) {
			continue
		}
		start = sec.StartPage
		if start <= 0 {
			return 0, 0, false
		}
		end = sec.EndPage
		if end < start {
			end = pageCount
			if i+1 < len(sections) && sections[i+1].StartPage > start {
				end = sections[i+1].StartPage - 1
			}
		}
		if end > pageCount {
			end = pageCount
		}
		return start, end, end >= start
	}
	return 0, 0, false
}

// sweepBatches slices a chapter's pages into vision-sized batches for the
// sweep: at most hwSweepBatches batches of hwSweepBatch pages, taken from
// the end of the span where chapter-end problem runs live, in ascending
// order.
func sweepBatches(start, end int) [][]int {
	if end < start {
		return nil
	}
	if window := hwSweepBatch * hwSweepBatches; end-start+1 > window {
		start = end - window + 1
	}
	var pages []int
	for p := start; p <= end; p++ {
		pages = append(pages, p)
	}
	var batches [][]int
	for i := 0; i < len(pages); i += hwSweepBatch {
		j := min(i+hwSweepBatch, len(pages))
		batches = append(batches, pages[i:j])
	}
	return batches
}

// sweepSpan resolves the chapter pages a question's sweep would read, from
// the label's chapter or the assignment hint's, through the book's stored
// sections. It returns the chapter number with the span for progress notes.
func (r *hwRunContext) sweepSpan(ctx context.Context, q *store.HomeworkQuestion) (chapter, start, end int, ok bool) {
	query, hint := questionQuery(q.Transcription)
	label, _ := questionLabel(query)
	chapter, ok = questionChapter(label, hint)
	if !ok {
		return 0, 0, 0, false
	}
	sections, err := r.s.Sections(ctx, r.book.ID)
	if err != nil || len(sections) == 0 {
		return 0, 0, 0, false
	}
	start, end, ok = chapterSpan(sections, chapter, r.book.PageCount)
	if !ok {
		return 0, 0, 0, false
	}
	return chapter, start, end, true
}
