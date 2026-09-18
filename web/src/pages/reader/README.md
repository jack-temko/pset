# Reader

Route `/library/:bookId/read`. This doc is the spec: the page renders
exactly what's described here, and nothing else.

**Purpose:** read a finished book. The scan of the page you're on is the
primary surface; the extracted text is one switch away when you want to
copy something.

**Decisions from the grill (2026-09-16):**

- The scan is the default view, fit to the reading column, no zoom UI.
  Browser zoom covers the rare corner that needs a closer look.
- Text demoted to a mode: a `Scan | Text` switch in the toolbar. The
  choice sticks while you flip pages during a visit and resets to Scan
  next visit (component state, not storage).
- A page whose scan is missing gets an explicit empty state with a
  `Read the text` button. Reading never silently pretends.
- Keyboard + resume: arrow keys and PageUp/PageDown flip pages (ignored
  while typing in a field), and the last page you read is remembered per
  book. A `?page=` link always wins over memory.
- No mobile work (desktop-only rule).

## Layout

Full-bleed reading container: `mx-auto w-full max-w-7xl px-page py-10`,
a desktop sidebar (the contents) beside the reading column. The app
header stays.

1. **Top line** — ghost back button with `ArrowLeft` + the book title,
   linking to `/library/{sha256}`. (The `reading` / `not ready` badge is
   gone; the state is obvious from what the page shows.)
2. **Contents sidebar** (desktop, `lg:` up) — sticky, internally
   scrolling (`max-h-[calc(100dvh-6rem)]`, the same family as the ask and
   workspace pages), `Contents` micro-label, indent by level, dotted
   leader to the start page, active chapter highlighted (`aria-current`),
   first 40 entries with `Show all {n}`. Jumping calls the same
   page-setter as the pager. While the book is preparing it shows the
   `Still being prepared…` line. Empty and error states as before.
3. **Toolbar** (hidden while the book is not ready) — one row:
   - Left: `Page {n} of {total}` (tabular figures) + the jump field
     (`aria-label "Go to page"`, numeric, commits on Enter and blur,
     resets when you navigate).
   - Right: the `Scan | Text` switch (segmented, `aria-pressed`), prev /
     next icon buttons (`Previous page` / `Next page`), and
     `Ask about this page` → `/ask?book={sha}&page={n}` (the one door
     from the reader into Ask).
4. **The page, by state:**
   - *Scan mode* (default): the page image
     (`/api/books/{sha}/pages/{n}/image`, cached an hour by the server)
     at the column's width (~`max-w-3xl`), rounded card frame. A
     3:4 skeleton holds the column until the image reports loaded; a
     failed load flips to the no-scan state below.
   - *No scan:* explicit empty state — `This page has no scan.` with
     `Read the text` (switches the mode; if the text is also missing it
     lands on the no-text state, which is honest).
   - *Text mode:* the prose pane — serif, `max-w-prose`, paragraphs
     split on blank lines, selectable/copyable; small title footer (the
     sha line is gone). Loading shows the prose skeleton; a 404 shows
     `This page has no text yet.` with `Retry`; other errors show the
     message with `Retry`.
   - *Not ready:* the book isn't a book yet — the toolbar and pager are
     hidden and a card says so (`Still being prepared.` /
     `This book isn't ready yet.`) with `Open the book's page`. The
     reader refreshes itself the moment preparation settles (task
     stream), same as before.

One door per action: the toolbar's prev/next buttons are the only paging
buttons; there is no bottom pager duplicating them (the keyboard and the
toolbar own paging).

## Behavior

- Paging: buttons, the jump field, the contents, and the keyboard
  (`ArrowLeft` / `ArrowRight` / `PageUp` / `PageDown`; ignored while a
  field or editable region has focus, never with modifier keys). Every
  change clamps to `1..pageCount`, scrolls the window back to the top,
  and writes the last-read page.
- Resume: opening the book without `?page=` lands on the remembered
  page (`localStorage`, key `pset:reader:last-page:{sha}`), clamped to
  the current page count. `?page=N` beats memory and is dropped from
  the URL on the first navigation, like before.
- Mode is a per-visit choice: flipping pages never changes it; a fresh
  open starts on Scan.
- Deep-link and refresh behavior unchanged otherwise: `?page=` always
  shows that page.

## Backend surface

Nothing new. `GET /api/books/{sha}`, `GET /api/books/{sha}/pages/{n}`
(text), `GET /api/books/{sha}/pages/{n}/image` (JPEG,
`private, max-age=3600`), `GET /api/books/{sha}/sections`, plus the
task stream for the settling refresh.

## Deliberately not here

- Zoom / pan controls, continuous-scroll paging — browser zoom covers
  it; revisit if a real book proves otherwise.
- Typography controls, themes — the suite's theme system already
  covers dark.
- Mobile layouts (desktop-only rule).

## E2e manifest (web/e2e/states.ts)

`reader/read` (scan + active chapter), `reader/text` (text mode),
`reader/no-scan` (missing image empty state), `reader/not-ready`
(preparing card), plus keyboard-flip and resume steps exercised inside
`reader/read` — all mock-only over the seeded book
(`reader:book`), with the mock answering sections, page text, and an
SVG page scan.
