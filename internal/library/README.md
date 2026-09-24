# library

Books: importing a PDF into one, its pages and scans, its contents, and
search over it. Specs: `design/import.md`, `design/workspace.md`.

## Tables

`books` (one row per PDF, keyed by a UUID, `sha256` unique), and
everything read out of a book, all cascading from it: `pages` (text and a
status: text, blank or failed) with the `pages_fts` index kept by
triggers, `sections` (the contents, in order, with levels), and
`embeddings` (one vector per page, in one model's space).

`edited` is set when the student changes title, author or offset, and a
retried import never writes over those again.

## Import

`POST /api/books` (multipart, field `file`) stages the upload while
hashing it, refuses a non-PDF (`invalid` on `file`), a duplicate
(`duplicate_book` with the existing id) and a missing embeddings server
(`not_configured`), then inserts the book `queued` and enqueues its first job in
one transaction.

Two jobs in the `import` lane, one at a time, publishing `book.changed`
with the whole book at each step, and progress at most four times a
second. **examine** (priority 2; the kind keeps the old job's name,
`import`, so one queued before the split still runs) is phase 1, and
queues **prepare** in the same write: priority 1 for a digital book, 0
for a scan. prepare runs phases 2 to 4 and is resumable: a book ahead of
it interrupts it, it goes back to `queued` (a scan with its count read so
far, `phase: read`, `done`, `total`) and resumes later, having lost at
most the page it was on. The book's `kind` (empty until examined,
`digital` or `scanned`) is on the wire, so Home orders the queue as it
runs. The phases:

1. **examine**: metadata (a real title and author replace the tidied
   filename, unless the metadata is authoring-tool junk), the text layer,
   and the digital or scanned call. A digital book's pages are stored here.
2. **read**: a scanned book, page by page through OCR, counted. Pages
   already read are skipped, so a retry picks up where it stopped. A page
   the tools choke on fails the import with the list; a blank page doesn't.
3. **index**: the contents (the outline, else headings inferred from font
   sizes, else line shapes in OCR text; always at least one section) and
   the **page offset**, from printed numbers in running heads and feet
   (`offset.go`).
4. **search**: a vector per page with text, in batches, counted. Vectors
   from another model are dropped first; the count is checked at the end.

Stop (`POST /api/books/{id}/stop`) leaves the book `failed` with
"Stopped." (or "Cancelled before it started." for one not examined yet);
Retry (`.../retry`) queues it again from examine, skipping what's done; `DELETE` removes it, which is also Dismiss. A shutdown
puts a running import back to `queued` and it resumes.

## Reading

- `GET /api/books`, `GET /api/books/{id}`, `PATCH` (title, author,
  pageOffset, which must land inside the book).
- `GET /api/books/{id}/contents`: top-level entries as chapters, one
  level down as sections; a book whose only section is the whole-book
  fallback gets none, and so no rail.
- `GET /api/books/{id}/pages/{n}/image?w=`: rendered on demand at the
  nearest width bucket (600 to 2400), cached under `cache/pages`, at most
  three renders at once, one render per page and size however many ask,
  served `immutable`.

## For other features

Primitives only, so a consumer's interface needs no library types:
`Search(ctx, book, query, k) []int` (full text and vectors fused by
reciprocal rank), `PageText(ctx, book, page)`, `PageJPEG(ctx, book, page,
width)`, `PDFPath(book)`, and `Count` for Reset.

Page numbers are PDF pages everywhere in this package and on the wire.
