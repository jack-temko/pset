# testdata

Committed sample textbooks and their machine-readable expectations. All four
files are **generated**: never edit them by hand. Regenerate with

```sh
go run ./tools/samplegen
```

and `go test ./...` will fail if the committed files ever drift from what the
generator produces (see `TestGenerateReproducesCommittedTestdata` in
`tools/samplegen`).

## Files

| File | What it is |
|---|---|
| `sample-digital.pdf` | *Foundations of Brontolithics* by H. Marlowe Voss — 6 pages, ~400 extractable words, real text layer, PDF metadata set, TOC, footer page numbers, and a nested PDF bookmark outline (O1–O6). Feeds the cheap poppler path and the outline index path. |
| `sample-scanned.pdf` | *A Little Primer of Brontolithics* by Odile Prane — 6 pages, one full-page JPEG per page, **zero text operators** (a fake scan: off-white paper, mild illumination gradient, per-line jitter, JPEG q58). Feeds vision extraction later; indexing refuses it. |
| `sample-flat.pdf` | *Field Notes on Kettle Weather* by Odile Prane — 4 pages, real text layer, **no bookmarks**; its only oversized lines are the planted section headings (H1–H3), so indexing fires the font-size inference path. |
| `manifest.json` | sha256, page counts, digital metadata, planted facts (`id`, verbatim `text`, 1-based `page`), the digital `outline` and the flat `headings` (`id`, `title`, 1-based `page`, 1-based `level`). Written last by the generator. See `tools/samplegen/README.md` for the full contract. |

All books describe an invented field (brontolithics — engineered thunder) so
nothing is copyrighted, and they stay small because LLM-backed tests send
their text to real models. Facts contain low-prior anchors (`KAX-4471`,
`TVR-09`, `Umbel-7`, `Mirefill Basin`, "4,006 gavels") that no model would
guess, so tests can assert on exact strings. Fact text matches extracted text
after whitespace normalisation (extraction breaks lines mid-paragraph).

## What uses them

| What | Tests |
|---|---|
| The manifest matches the files | `TestSampleManifestIntegrity` (root, `samples_test.go`) |
| The generator reproduces the committed PDFs | `TestGenerateReproducesCommittedTestdata` (`tools/samplegen`) |
| Metadata and page counts via poppler (skips without it) | `TestSamplePageCountsMatchManifest` (root), `TestMetadataDigitalSampleMatchesManifest` (`internal/pdf`) |
| Text extraction via poppler (skips without it) | `TestDigitalTextContainsPlantedFacts`, `TestScannedTextIsNearEmpty` (`internal/pdf`) |

All of these are deterministic: they run under plain `go test ./...` with
no network and no keys, and the poppler ones `t.Skip` when poppler-utils
is absent. Model calls are tested against the fake server in
`internal/llm/llmtest`, never a real provider.
