# samplegen

Generator for the deterministic sample textbooks committed under `testdata/`
(repo root). Everything it emits is byte-reproducible: fixed dates, seeded
`math/rand`, no map-order iteration, no `time.Now`. `go test ./...` verifies
this by regenerating both books and comparing hashes against the committed
files.

## Usage

```sh
go run ./tools/samplegen -out <dir>   # default: testdata
```

Writes four files into the out dir:

- `sample-digital.pdf` — "Foundations of Brontolithics", 6 pages. Real text
  layer (fpdf core fonts, uncompressed streams), PDF metadata set, footer
  page numbers, a TOC, and a nested PDF bookmark outline (`fpdf.Bookmark`:
  one top-level entry per chapter matching the TOC titles, plus two nested
  sub-entries). Exercises the cheap poppler path and the outline index path.
- `sample-scanned.pdf` — "A Little Primer of Brontolithics", 6 pages. A fake
  scan: every page is one 850x1100 grayscale JPEG (quality 58) drawn with
  `golang.org/x/image/font/opentype` from the embedded Go Regular TTF, over
  off-white paper with a smooth illumination gradient, per-line jitter, and
  mild per-pixel noise. Zero text operators — for vision extraction later.
- `sample-flat.pdf` — "Field Notes on Kettle Weather", 4 pages. Real text
  layer, no bookmarks, and exactly two font sizes: 11pt body and 16pt bold
  headings on pages 1, 3, and 4 (page 2 is body-only). The only oversized
  short lines are the planted headings, so the index inference path must
  find exactly those and nothing else.
- `manifest.json` — expectations for all three files, written last so it
  records the sha256 of the PDFs just written.

## Why the scanned book is not written by fpdf

fpdf assigns image object numbers by iterating a Go map, so a PDF containing
several same-size images is not byte-reproducible across processes
(`SetCatalogSort(true)` does not help: its stable sort ties on equal widths
and preserves the map's random order). `scanpdf.go` therefore writes the
scanned book with a minimal hand-rolled PDF writer: catalog + pages tree +
per page (page dict, tiny content stream, JPEG XObject) + info dict with
pinned dates. The digital book keeps fpdf (text layout for free) with
`SetCatalogSort(true)` for deterministic font objects.

## Manifest contract

```json
{
  "digital": {
    "file": "sample-digital.pdf",
    "sha256": "<hex of file bytes>",
    "pages": 6,
    "title": "Foundations of Brontolithics",
    "author": "H. Marlowe Voss",
    "subject": "Brontolithics: engineered thunder, kettle arrays, and the Voss Register",
    "facts": [{"id": "F1", "text": "<verbatim sentence>", "page": 3}, ...],
    "outline": [{"id": "O1", "title": "What Is Brontolithics?", "page": 3, "level": 1}, ...]
  },
  "scanned": {
    "file": "sample-scanned.pdf",
    "sha256": "<hex>",
    "pages": 6,
    "facts": [{"id": "S1", "...": "..."}]
  },
  "flat": {
    "file": "sample-flat.pdf",
    "sha256": "<hex>",
    "pages": 4,
    "title": "Field Notes on Kettle Weather",
    "author": "Odile Prane",
    "facts": [{"id": "T1", "...": "..."}],
    "headings": [{"id": "H1", "title": "Reading the Sky", "page": 1, "level": 1}, ...]
  }
}
```

- `pages` is the 1-based physical page count (what poppler reports); fact
  `page` values use the same numbering.
- `title`/`author`/`subject` appear only for books with document metadata
  (digital, flat) — the fake scan has none, which is itself a test
  expectation.
- Fact families use stable letter prefixes: `F` digital text, `S` scanned
  text, `T` flat text, `O` digital bookmarks, `H` flat headings.
- `outline`/`headings` record structural entries as
  `{id, title, page, level}` with 1-based levels, matching what the engine
  stores in `sections`: the digital outline nests (`O2` and `O5` at level 2),
  the flat headings are flat at level 1.
- Fact `text` is verbatim on its page after whitespace normalisation (PDF
  extraction inserts line breaks mid-paragraph; collapse all whitespace
  before matching). Every fact sentence contains concrete invented anchors —
  names, numbers, dates, and low-prior tokens like `KAX-4471`, `TVR-09`,
  `Umbel-7` — so extraction and quiz tests can assert on strings no model
  would guess.
- The books are small on purpose (digital and scanned: 6 pages, flat: 4)
  because they are fed to LLMs in the `llm` test tier. All stay far under
  250KB.

## Regenerating

Edit content in `content.go`, then:

```sh
go run ./tools/samplegen
go test ./tools/samplegen/ ./...   # determinism + integrity tests must pass
```

Committed samples must always be exactly what the current generator produces;
the tests fail otherwise.
