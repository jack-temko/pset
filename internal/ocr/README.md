# ocr

Thin exec wrapper around the local OCR pipeline: `pdftoppm` (poppler)
rasterizes one page at a time (through `pdf.PagePNG`), `tesseract` turns it
into text. Programs are run through `internal/execx`, shared with
`internal/pdf`; the library depends on this surface, not on the binaries.

## Dependencies

- External: `tesseract` (tesseract-ocr, plus the language pack, e.g.
  tesseract-ocr-eng) and `pdftoppm` (poppler-utils) on PATH. No cgo, no
  Python, no network.
- When a tool is absent, calls return an error wrapping `ErrNotInstalled`
  (the same error as `pdf.ErrNotInstalled`; check with `errors.Is`).

## API

- `Page(ctx, pdfPath, n, lang) (string, error)` — rasterizes page n
(1-based) at `DefaultDPI` (300) into a temp dir, runs
`tesseract <img> stdout -l <lang>`, returns the text. Temp files are
removed before returning. A blank page yields empty (whitespace) text —
still a successful result; the engine stores it as the page's done-marker.

## Contracts

- Per-page only: the library owns batching, progress, and resume semantics
  (page rows in the store are the done-marker).
- Pure adapter: no caching, no fallbacks, context-aware (cancelling kills
  the child process).
- Language packs must be installed for the `-l` value used; a missing pack
  surfaces as a tesseract error naming the language.

## Tests

`ocr_test.go` exercises `Page` against the committed scanned sample in
`testdata/` (repo root) and skips when the tools are not installed.
