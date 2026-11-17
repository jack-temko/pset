package material

import (
	"github.com/jackt/pset/internal/pagenum"
	"github.com/jackt/pset/internal/probnum"
	"github.com/jackt/pset/internal/step"
)

// Material is a document with pages in one course, as the course screen
// lists it and the material pane shows it. Page numbers on the wire are PDF
// pages; PageRuns turns them into printed ones.
type Material struct {
	// ID is the material's id.
	ID string `json:"id"`
	// Seq is the change-log sequence of its last change.
	Seq int64 `json:"seq"`
	// CourseID is the course it belongs to.
	CourseID string `json:"courseId"`
	// Title is its name as the student sees it: the file's own title, until
	// the student renames it.
	Title string `json:"title"`
	// PageCount is how many pages it has; 0 until it has been examined.
	PageCount int `json:"pageCount"`
	// Aspect is a page's height over its width, so a page holds its box
	// before its image arrives.
	Aspect float64 `json:"aspect"`
	// PageRuns is how its printed page numbers run against its PDF pages.
	// Never null: the store leaves it [] until numbering has run.
	PageRuns []pagenum.Run `json:"pageRuns"`
	// Problems is how it numbers its problems, once worked out; absent for a
	// material with no numbered problems.
	Problems *probnum.Style `json:"problems,omitempty"`
	// Textbook is true for the course's textbook: where a reference like
	// "3.1 #7" is looked for first. One material in a course at most; PSet
	// picks the first that numbers its problems, and the student can change
	// it.
	Textbook bool `json:"textbook"`
	// Progress is how far its import has got, while it is being read in;
	// absent once its pages are all read.
	Progress *Progress `json:"progress,omitempty"`
	// Steps is its import, in order: examine, read pages, contents,
	// numbering, search. Never null.
	Steps []step.Step `json:"steps"`
	// AddedAt is when it was added (RFC 3339).
	AddedAt string `json:"addedAt"`
	// RemovedAt is when the student removed it (RFC 3339). A removed
	// material is hidden from the course but stays readable while any set
	// uses it, so page links and figures keep working. Absent while it is
	// there.
	RemovedAt string `json:"removedAt,omitempty"`
}

// Progress is how far a material's import has got, for "Reading Griffiths,
// about 2 min" on its row and in its pane.
type Progress struct {
	// Done is how many pages have been read.
	Done int `json:"done"`
	// Total is how many pages there are to read.
	Total int `json:"total"`
	// SecondsLeft is about how long the rest will take, from how long pages
	// have taken so far; absent until there is enough to guess from.
	SecondsLeft int `json:"secondsLeft,omitempty"`
}

// Materials is a course's materials, in the order they were added. Never
// null.
type Materials struct {
	// Materials is every material not removed.
	Materials []Material `json:"materials"`
}

// ContentsEntry is one heading of a material's contents, at its PDF page,
// and the headings under it, however deep the material goes.
type ContentsEntry struct {
	// ID is the heading's id.
	ID string `json:"id"`
	// Title is the heading as the material prints it.
	Title string `json:"title"`
	// Page is the PDF page it starts on.
	Page int `json:"page"`
	// Children is the headings under it. Never null.
	Children []ContentsEntry `json:"children"`
}

// Contents is a material's contents: the top-level headings. Empty when its
// structure could not be read, and then the pane has no Contents button.
type Contents struct {
	// MaterialID is the material they belong to.
	MaterialID string `json:"materialId"`
	// Entries is the top-level headings. Never null.
	Entries []ContentsEntry `json:"entries"`
}
