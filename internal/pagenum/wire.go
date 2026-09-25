package pagenum

// Run is a stretch of a book whose printed numbers sit a fixed distance
// from its PDF pages: from PDF page From up to the next run, PDF page =
// printed page + Offset. A scan that drops a page starts a new run after
// the gap, one lower; a book with unnumbered plates starts one higher.
type Run struct {
	From   int `json:"from"`
	Offset int `json:"offset"`
}
