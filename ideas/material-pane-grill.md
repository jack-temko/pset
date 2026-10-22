# Material pane: grill

- status: approved
- date: 2026-10-22
- brief: the inside of the material pane (one document with pages, in a side of the workspace), judged from a tired student reading the book beside a problem set
- sources:
  - `web/src/pages/workspace/index.tsx`, `web/src/pages/workspace/boxing.tsx`, `web/src/api/library.ts`, `internal/library/http.go`, `internal/library/wire.go` (the reader today, on `dev`)
  - `ideas/screens-grill.md` (S7, S8, S11), `ideas/workspace-grill.md` (W6, W9, W11), `ideas/work-pane-grill.md` (P11 page links), `ideas/boxing-on-the-page.md`, `ideas/book-structure.md`
  - the work pane's spec on `design` (page links, "Box one on the page")
  - `pset-haiku-usability/.dev/lab/findings.md` (2026-10-09 testers): #6 no jump to a printed page, #9 reading position lost

## Summary

### In one line

One continuous scroll of the book fitted to the side, with a thin line on top for
Contents, the page and zoom, that keeps your exact spot per tab and takes a box when a
problem needs one.

### Decisions

| #   | Decision                                                                                                                                                                                                         | Why                                                        | Beat                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------- |
| M1  | Pages are one continuous scroll, fitted to the side's width                                                                                                                                                      | Flipping between a figure and its problem stays one scroll | One page at a time                      |
| M2  | A thin line on top holds the controls: Contents on the left, "p. 112 of 640" and the zoom % on the right. Pages scroll under it                                                                                  | Always in the same place, like the work pane's set line    | A floating pill at the bottom (today)   |
| M3  | Contents opens over the pages from its button and closes after a pick                                                                                                                                            | The pages keep the whole half-width side                   | An always-shown rail; no contents       |
| M4  | Clicking the page number turns it into a box: type a printed page, Enter goes there (finding #6)                                                                                                                 | Nothing extra on screen                                    | A page box in a toolbar                 |
| M5  | A page with no printed number shows its PDF page, muted: "PDF 3". Typing still means printed pages                                                                                                               | Honest that it is not a printed number                     | Roman numeral or blank                  |
| M6  | Problem boxes are not drawn while reading; a page link from the work pane flashes the problem's box (P11)                                                                                                        | A clean page                                               | Current problem outlined; every problem |
| M7  | Zoom: opens fitted to width, pinch or ctrl+wheel zooms, the zoom % resets to fit. Remembered per tab                                                                                                             | Small subscripts stay readable without chrome              | + and - buttons; no zoom                |
| M8  | The place is the exact scroll spot, kept per tab across reloads and tab switches (finding #9)                                                                                                                    | keep-the-place                                             | Top of the page only                    |
| M9  | A page still loading is a plain page-shaped box in the surface colour, no shimmer; the image fades in and nothing jumps                                                                                          | Calm while scrolling fast through a book                   | A shimmering skeleton                   |
| M10 | A material still being read in after it is added shows one centred wait: "Reading Griffiths, about 2 min", until the whole book is ready                                                                         | Jack's choice: one wait, then the whole book               | Pages show as they become ready         |
| M11 | Boxing is a mode of the material pane: from "Box one on the page" or a problem not found, the material turns to the page and its top line says "Draw a box around 4.62" with Done and Cancel. One box or several | Stays side by side with the set                            | A separate full-window boxing screen    |
| M12 | Asking about part of a page, and searching the book's text, are on hold: listed in `ideas/on-hold.md`                                                                                                            | Jack: keep a list of improvements on hold                  | Building them now                       |

### The artifact(s)

**States**

| State        | Shows                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------- |
| Reading      | the top line (Contents, "p. 112 of 640", zoom %), pages scrolling under it                |
| Contents     | the list over the pages, the current section marked                                       |
| Go to page   | the page number as a box, typed into                                                      |
| Flash        | the page with the problem's box fading out (1.8 s, as the workspace already does)         |
| Unnumbered   | "PDF 3", muted, in the top line                                                           |
| Boxing       | top line "Draw a box around 4.62", Done and Cancel; boxes drawn on the page               |
| Not ready    | centred "Reading Griffiths, about 2 min"                                                  |
| Page loading | plain page-shaped boxes                                                                   |
| Failed       | a page or the book that could not be read: what failed and what to try (as error catalog) |

**Remembers**: the exact scroll spot and the zoom, per tab (a material open twice keeps two).

### Assumed

- A1: typing a page that does not exist leaves you where you are, and the box says "No p. 900, the book ends at 640".
- A2: Contents shows two levels and folds the rest, as today's rail does.
- A3: Escape cancels boxing; Done with no box is not offered.
- A4: the failed states follow the error catalog's what failed, why, fix.
- A5: the pane is built on `/design` with sample pages first, like the others; wiring to the server comes later.

### Open

- None. The Ask pane grill comes next.

## Reversals

None.

## Disagreements

None. M10 took "One wait screen" over the recommended "Pages show as they are ready".

## Frontier

Empty.

## Log

### Batch 1

1. How do pages flow in the material pane? Options: One continuous scroll (Recommended); One page at a time. Answer: "One continuous scroll (Recommended)"
2. The contents list takes room in a half-width side. Where does it go? Options: Behind a button, over the pages (Recommended); Always-shown rail; No contents. Answer: "Behind a button, over the pages (Recommended)"
3. How do you go to a printed page (finding #6)? Options: Click the page number and type (Recommended); A page box in a toolbar. Answer: "Click the page number and type (Recommended)"
4. Should problem boxes show on the page while you read? Options: Only flash on a page link (Recommended); Current problem faintly outlined; Every problem in the set outlined. Answer: "Only flash on a page link (Recommended)"

### Batch 2

1. Zoom in the material pane? Options: Fit width, pinch to zoom, remembered (Recommended); Fit width, + and - buttons; Fit width only. Answer: "Fit width, pinch to zoom, remembered (Recommended)"
2. What does 'keep the place' mean for a material (finding #9)? Options: Exact scroll spot, per tab (Recommended); Top of the page only. Answer: "Exact scroll spot, per tab (Recommended)"
3. Ask about part of a page (a figure, a paragraph)? Options: Drag a box, then Ask (Recommended); Not now. Answer: "Not now"
4. Search the book's text? Options: Not now (Recommended); Search in the contents panel. Answer: "keep a list somewhere of possible improvements that on hold, including this and the question preceding it"

### Batch 3

1. Where do the pane's few controls (Contents, page number, zoom %) sit? Options: A thin line at the top (Recommended); Floating pill at the bottom. Answer: "A thin line at the top (Recommended)"
2. A page with no printed number (a cover, front matter): what shows? Options: The PDF page, muted: 'PDF 3' (Recommended); Roman or blank. Answer: "The PDF page, muted: 'PDF 3' (Recommended)"
3. While a page image loads, what fills its spot? Options: A plain page-shaped box (Recommended); A shimmering skeleton. Answer: "A plain page-shaped box (Recommended)"
4. A material still being read in after it's added (pages not ready yet)? Options: Pages show as they are ready (Recommended); One wait screen. Answer: "One wait screen"

### Batch 4

1. "Box one on the page" (from the work pane's menu, or a problem that couldn't be found): how does the material pane take the box? Options: A boxing mode in the material pane (Recommended); A separate boxing screen. Answer: "A boxing mode in the material pane (Recommended)"
