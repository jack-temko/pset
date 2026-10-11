# pagenum

PDF pages to the numbers printed on them, and back. Everything else in the
app keeps PDF pages (on the wire too); only this package knows how a book's
printed numbers run, so a scan that lost a page partway is right everywhere
at once. Spec: `design/workspace.md`, "Page numbers". The web mirrors it in
`web/src/lib/pages.ts`.

- **`Run{From, Offset}`** (`wire.go`, generated to TS): from PDF page
  `From` up to the next run, PDF page = printed page + `Offset`. A scan
  that drops a page starts a new run after the gap, one lower; unnumbered
  plates start one higher.
- **`Map`** is a book's runs, tidied by `New`: sorted, one run per start
  page, the first at page 1, a run that changes nothing folded into the one
  before. The zero `Map` is a book whose printed numbers are its PDF
  pages; `Single(offset)` is one run.
- `Printed(pdf)`, `PDF(printed)` (`ok` false for a number the book doesn't
  have), `Nearest(printed)`, `Name(pdf)` (a page as a sentence names it:
  "p. 57", or "a front-matter page (PDF page 7)"), `Gaps()` (each jump
  between runs: the pages the scan lost, or the extra ones the numbering
  skips), `Runs()`, `Offset(pdf)`.
- **`Detect(numbers)`** works the runs out from the candidate numbers read
  off each page's running head or foot (one list per page), for import;
  `ok` is false when no numbering stands out; the library
  keeps them in `books.page_runs`, and the student's own numbering is never
  overwritten by a retried import (`pages_edited`).
