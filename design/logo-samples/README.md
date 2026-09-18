# PSet mark samples

**Adopted: `folio-spark`** — it now ships as `web/public/pset.svg` (favicon +
sidebar brand). The samples below are kept for reference.

Eleven candidate logo marks for PSet, drawn as clean vectors on the existing
brand system ("ink & paper": fountain-pen blue, warm paper, ink). Each mark
is a 32×32 SVG with the same tile geometry as the current `web/public/pset.svg`
(rx 7 rounded square), so any of them can drop in as a replacement.

## Comparing the samples

- `contact-sheet.png` — every mark at 48/32/16 px on the blue tile, plus
  paper and dark-sidebar variants. Start here.
- `sidebar-preview.png` — every mark in context: the dark sidebar brand
  lockup ("PSet / Study engine") at real sidebar size.
- For close inspection, open any `svg/*.svg` directly in a browser.

## The concepts

| Mark | Idea | What it says |
|---|---|---|
| `folio` | Open book, two facing pages | The library; reading and studying today |
| `folio-spark` | Open book with a spine line and a four-point spark in the top-right corner | The library plus LLM integration — study powered by Ask |
| `bookmark` | Bold bookmark ribbon | Saved place, progress, "pick up where you left off" |
| `pdot` | Letterform "P." with ochre full stop | The name abbreviated and punctuated — problem **set.** |
| `problem-set` | Worksheet with a dog-ear and a check | The namesake: assignments, quizzes, answers |
| `flashcards` | Two stacked cards, checked front | Drills and self-testing; the quiz loop |
| `ink` | Ink drop with a stray droplet | The brand language itself: ink & paper |
| `ask` | Page with a four-point spark | Ask / AI answers — where the platform is going |
| `pencil` | Diagonal pencil | Worked solutions, homework walkthroughs |
| `quill` | Feather quill with an ochre vein | Notes and authorship; the classic study motif |
| `continuity` | Refined version of the current two-panel mark | Evolution, not revolution — the incumbent baseline |

## Files

- `svg/<name>.svg` — blue tile, paper glyph (primary, matches current logo usage)
- `svg/<name>-paper.svg` — card tile with hairline border, ink glyph (light surfaces, favicons on paper)
- `svg/<name>-dark.svg` — ink tile, sidebar-foreground glyph (blends into the dark sidebar)
- `contact-sheet.png` / `contact-sheet.svg` — full comparison grid
- `sidebar-preview.png` / `sidebar-preview.svg` — marks in the sidebar lockup
- `generate.js` — the generator that draws every mark and renders the sheets
  (`npm i @resvg/resvg-js`, then `node generate.js`)

## Palette

Samples use hex for portability; the values are the app's OKLCH tokens:

| Role | Hex | Token |
|---|---|---|
| Tile blue / accent on paper | `#224dac` | `--primary` `oklch(0.45 0.16 263)` |
| Glyph on blue tile | `#fbfaf6` | `--background` `oklch(0.984 0.005 95)` |
| Ink | `#23201a` | `--foreground` `oklch(0.245 0.012 90)` |
| Card / paper tile | `#fffefc` | `--card` `oklch(0.998 0.003 95)` |
| Hairline border | `#e1e0da` | `--border` `oklch(0.905 0.008 95)` |
| Sidebar ink | `#201e18` | `--sidebar` `oklch(0.235 0.012 90)` |
| Accent on dark | `#7ca4f0` | `--sidebar-primary` `oklch(0.72 0.12 263)` |
| Ochre accent | `#dca331` | `--chart-3` `oklch(0.75 0.14 80)` |

## Geometry conventions

- 32×32 viewBox, tile `rx="7"` (same as the current logo).
- Stroke marks: 2 px, round caps and joins — consistent with the lucide
  icons used across the UI. Filled marks (pdot, ink, pencil, quill) carry
  accent details in ochre/blue.
- All marks were verified legible at 16 px and against both themes.

## Trying one in the app

```sh
cp design/logo-samples/svg/<name>.svg web/public/pset.svg
cd web && npm run build && cd ..
go build -o pset ./cmd/pset && ./pset serve
```

(The sidebar renders the logo at 28 px; the `-dark.svg` variants are there if
you prefer the glyph to float on the ink sidebar without a tile.)
