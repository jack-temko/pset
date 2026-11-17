package library

import (
	"context"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/pagenum"
	"github.com/jackt/pset/internal/pdf"
	"github.com/jackt/pset/internal/probnum"
)

// The import's craft, for the new backend's material steps (track 4 of
// ideas/backend-courses.md): each is the old import's own code, unchanged,
// so what was won by an eval carries over word for word. When the old
// service goes at the cut-over, what is left of this package is the craft,
// and it is renamed then.

// Section is one heading of a book's contents, with the pages it spans.
type Section = section

// Model is the chat model the import asks. Wrap, when set, is given every
// request first: the step runner keys its calls so.
func Model(client *llm.Client, name string, wrap func(llm.ChatRequest) llm.ChatRequest) model {
	return model{client: client, name: name, wrap: wrap}
}

// PageImage is one page of the book being read, as a JPEG about width
// pixels across.
type PageImage = pageImage

// Classify says whether a book's pages are "digital" (a text layer worth
// reading) or "scanned".
func Classify(pages []string) string { return classify(pages) }

// SplitPages splits pdftotext's output into exactly n pages.
func SplitPages(text string, n int) []string { return splitPages(text, n) }

// MetaTitle is the PDF's own title, unless it is authoring-tool junk.
func MetaTitle(t string) string { return metaTitle(t) }

// FindContentsPages are the pages holding the printed contents.
func FindContentsPages(pages []string) []int { return findContentsPages(pages) }

// ReadName reads the title and author line off the first pages; empty
// where nothing checked out. id names the book in the log; title and
// author are what it has now, a hint.
func ReadName(ctx context.Context, m model, img PageImage, id, title, author string, pages []string, printed []int) (string, string, error) {
	return readName(ctx, m, img, id, title, author, pages, printed)
}

// ReadContents is the contents of a book with no outline: the printed
// contents placed on the pages, else headings the model picks from the
// lines that look like them. lines is a digital book's text lines, nil for
// a scan.
func ReadContents(ctx context.Context, m model, img PageImage, id string, pages []string, lines []pdf.XMLLine, printed []int) ([]Section, error) {
	return readContents(ctx, m, img, id, pages, lines, printed)
}

// OutlineSections is a PDF's own outline as sections.
func OutlineSections(entries []pdf.XMLOutlineEntry) []Section { return outlineSections(entries) }

// TidySections drops what can't be a heading, sets each section's end page,
// and gives a book with none one section, "Whole book": as the old import
// did after reading the contents.
func TidySections(secs []Section, pageCount int) []Section {
	secs = cleanSections(secs, pageCount)
	assignEndPages(secs, pageCount)
	if len(secs) == 0 {
		secs = []Section{{Level: 1, Title: "Whole book", StartPage: 1, EndPage: pageCount}}
	}
	return secs
}

// DetectProblems is how a book numbers its problems, when it does.
func DetectProblems(secs []Section, pages []string) (probnum.Style, bool) {
	return detectProblems(secs, pages)
}

// DetectRuns is how a book's printed page numbers run, when they can be
// read from its running heads and feet.
func DetectRuns(pages []string) ([]pagenum.Run, bool) { return detectRuns(pages) }

// Search's pieces.
const (
	// EmbedBatch is how many pages go to the embedder at once.
	EmbedBatch = embedBatch
	// SearchDepth is how many pages each ranking contributes.
	SearchDepth = searchDepth
	// RRFK is reciprocal rank fusion's k.
	RRFK = rrfK
	// NameWidth and ContentsWidth are the widths the model reads pages at.
	NameWidth     = nameImageWidth
	ContentsWidth = contentsImageWidth
)

// VectorRow is one page's vector.
type VectorRow = vectorRow

// FTSMatches are the full-text match expressions for a query, most exact
// first; FTSWords quotes a value for a column match.
func FTSMatches(query string) []string { return ftsMatches(query) }

// FTSWords quotes s for an FTS5 column match.
func FTSWords(s string) string { return ftsWords(s) }

// RankByVector ranks pages by cosine to q, best first.
func RankByVector(q []float32, rows []VectorRow, limit int) []int {
	return rankByVector(q, rows, limit)
}

// RRFMerge merges two rankings, best first, keeping k.
func RRFMerge(a, b []int, k int) []int { return rrfMerge(a, b, k) }

// EncodeVector and DecodeVector are a vector as a blob and back.
func EncodeVector(v []float32) []byte { return encodeVector(v) }

// DecodeVector is a blob as a vector; nil when it isn't one.
func DecodeVector(b []byte) []float32 { return decodeVector(b) }

// Pages renders pages through a cache in dir, a few at a time, one render
// per page and size however many ask.
type Pages struct{ c *scanCache }

// NewPages is a page renderer caching in dir.
func NewPages(dir string, render func(context.Context, string, int, int) ([]byte, error)) *Pages {
	return &Pages{c: newScanCache(dir, render)}
}

// Get is page of the PDF at path about width pixels across, cached under
// id. pageCount bounds the page; widthPts is the page's width in points.
func (p *Pages) Get(ctx context.Context, id, path string, pageCount int, widthPts float64, page, width int) ([]byte, error) {
	return p.c.get(ctx, id, path, pageCount, widthPts, page, width)
}

// Drop forgets id's renders.
func (p *Pages) Drop(id string) { p.c.drop(id) }

// FilenameTitle is a file's name tidied into a title, until a real one is
// read: "linear_algebra-notes.pdf" is "linear algebra notes".
func FilenameTitle(name string) string { return filenameTitle(name) }

// PartsOf is the numbered chapters and sections of a book's contents, each
// with where its problems are when an entry says.
func PartsOf(secs []Section) []probnum.Part { return partsOf(secs) }
