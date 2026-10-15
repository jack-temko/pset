# pdf

Thin exec wrapper around the poppler command-line utilities, so the pipeline
stages that depend on them — **metadata**, **cheap text extraction**, and
**structure extraction** — can be called from Go and tested. It is the only
place in the codebase that shells out to poppler; the engine depends on this
package's surface, not on poppler directly.

## Dependencies

- External: `pdfinfo`, `pdftotext`, and `pdftohtml` on PATH
  (poppler-utils). Not Go dependencies; nothing is vendored, nothing is cgo.
- When poppler is absent, calls return an error wrapping `ErrNotInstalled`
  (check with `errors.Is`) — never a panic, never a partial result.

## API

- `PageImage(ctx, path, n, dpi) ([]byte, error)` — rasterizes page n
  (1-based) to PNG bytes via a single-page `pdftoppm -png` run into a temp
  directory; used by the ask pipeline's page-image attachments and the page
  image endpoint. Needs `pdftoppm` on PATH.
- `Metadata(ctx, path) (Info, error)` — runs `pdfinfo <path>`, parsing
  stdout into `Info{Title, Author, Subject, PageCount, PageWidth,
  PageHeight, PDFVersion}` (page dimensions in points, 0 when the line is
  absent or unparseable as "W x H pts"). Note: document metadata, including
  the `PDF version:` line, is printed to **stdout**; `pdfinfo -v` (the
  utility's own version) is what prints to stderr. This package does not use
  `-v`.
- `Text(ctx, path) (string, error)` — runs `pdftotext <path> -` and returns
  the extracted text, page breaks as `\f`. A PDF with no text layer (pure
  image scan) yields only form feeds, so `strings.TrimSpace` on the result is
  the cheap "is this a scan?" probe.
- `XML(ctx, path) (*XMLDoc, error)` — runs `pdftohtml -xml -stdout -i <path>`
  and parses its output. One invocation yields both `Outline`
  (`XMLOutlineEntry{Title, Page, Level}`; level 0 is the top level, nesting
  adds one; empty when the PDF has no bookmarks) and `Lines`
  (`XMLLine{Page, Top, Size, Text}` — one visual text line per element, with
  adjacent `<text>` runs whose tops sit within 2px merged and the line sized
  by its largest font). `ParseXML` is pure and unit-tested on canned XML;
  it preserves the document order of interleaved outline items and nested
  levels, which a plain struct unmarshal would regroup, and reads character
  data through nested `<b>`/`<i>` runs. Font sizes are pdftohtml's own
  (scaled ~1.5x from point sizes) — only ratios matter, never absolute
  values.

Errors from the underlying command are wrapped with the binary name and
stderr output for context.

## Writer and crops (`writer.go`, `crop.go`)

- `SheetDoc`/`Sheet` — a minimal dependency-free PDF writer for the homework
  template: Letter pages, Helvetica base fonts (WinAnsiEncoding), JPEG
  images embedded as DCTDecode XObjects. Callers work in top-down points;
  `Text`, `Rule`, and `ImageFit` (which preserves aspect and reports the
  height used) build pages, and `Bytes` serializes deterministically — no
  timestamps, no map iteration, so the same sheets always produce the same
  bytes.
- `Rect` + `CropJPEG` — a page-normalized rectangle (y from the top) and a
  decoder/cutter for page renderings, used by the homework pipeline for
  question screenshots and diagram crops.

## Contracts

- Pure adapter: no caching, no fallbacks. If poppler is missing, that is
  `ErrNotInstalled` and the caller decides what to do (doctor warns; import
  fails; tests skip). The only transient state is `PageImage`'s temp
  directory, removed before the call returns.
- `Metadata` never fails on missing fields; absent keys stay zero-valued.
- Everything is context-aware; cancelling `ctx` kills the child process.

## Tests

`pdf_test.go` needs the committed samples in `testdata/` (repo root). Tests
that shell out skip with a clear reason when poppler is not installed, so
`go test ./...` stays green on machines without poppler-utils.
