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

## Pipeline stages vs tests

| Stage | Status | Tier | Covered by today |
|---|---|---|---|
| Hash / identify | available | deterministic | `TestSampleManifestIntegrity` (root, `samples_test.go`), `TestGenerateReproducesCommittedTestdata` (`tools/samplegen`) |
| Store (book row round-trip) | available | deterministic | `TestSampleBooksRoundTrip` (`internal/store`, `book_sample_test.go`) |
| Metadata via poppler | available | deterministic, skips without poppler | `TestMetadataDigitalSampleMatchesManifest`, `TestSamplePageCountsMatchManifest` (root) |
| Cheap text extraction via poppler | available | deterministic, skips without poppler | `TestDigitalTextContainsPlantedFacts`, `TestScannedTextIsNearEmpty` (`internal/pdf`) |
| Import pipeline (hash → library copy → metadata → page storage, idempotent) | available | deterministic, skips without poppler | `TestImportDigitalSample`, `TestImportDuplicateIsNoop`, `TestImportScannedSampleRegistersNeedsOCR`, `TestImportWithoutPopplerFailsBeforeWriting`, `TestImportLogsStages` (`internal/engine`) |
| OCR of scanned books (tesseract, resumable, state machine) | available | deterministic, skips without tesseract | `TestOcrScannedSample` (asserts S1–S8 modulo OCR confusables), `TestOcrResumesPartiallyStoredBook`, `TestOcrRefusesDigitalBook`, `TestOcrAmbiguousTarget` (`internal/engine`) |
| Structure indexing — outline path | available | deterministic, skips without poppler | `TestIndexDigitalSampleOutline` (asserts O1–O6: titles, pages, levels, derived end pages), `TestIndexReplacesPreviousSections` (`internal/engine`), `TestIndexEndpoint`, `TestSectionsEndpoint` (`internal/api`) |
| Structure indexing — inference path | available | deterministic, skips without poppler | `TestIndexFlatSampleInfersHeadings` (asserts H1–H3 and that the body-only page yields nothing), `TestIndexBookWithoutDetectableHeadings` (zero-sections outcome), classifier + end-page unit tests in `internal/engine/structure_test.go` (no poppler) |
| Structure indexing — guards | available | deterministic | `TestIndexRefusesBooksWithoutPDFTextLayer` (both `none` and `ocr` states), `TestIndexWithoutPdftohtmlFails`, `TestIndexUnknownTarget` (`internal/engine`) |
| LLM walkthrough / quiz / QA | future | `llm` build tag (costs money) | `TestQuizGenerationFromDigitalSample`, `TestQAGenerationFromDigitalSample` (root, `llm_test.go`) — skip: LLM adapter not implemented |
| Vision extraction (scanned book) | future | `llm` build tag (costs money) | `TestVisionExtractionOfScannedSample` (root, `llm_test.go`) — skip: vision adapter not implemented |

Tiers are mechanically separated: deterministic tests run under plain
`go test ./...` with no network and no keys (poppler-dependent ones `t.Skip`
when poppler-utils is absent); anything that would spend tokens lives in
`llm_test.go` behind `//go:build llm` and only runs under
`go test -tags llm`.
