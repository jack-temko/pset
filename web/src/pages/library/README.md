# Library

Route `/` (index). `/import` redirects here; `/?import=1` arrives with the
import dialog open. This doc is the spec: the page renders exactly what's
described here, and nothing else.

**Purpose:** every book the study engine holds, scannable as a shelf of
covers, with the one action the page owns — importing a PDF — always in the
header.

**Data:** `useBooks()` → `GET /api/books`; live task state from the shared
SSE store (`useTasks()`). The grid refetches when the set of running tasks
**changes identity** — comparing counts would miss one task finishing as
another starts, which is exactly how the old shelf went stale.

## Layout

`PageShell` (`components/page-shell.tsx`, shared by every page): `mx-auto
w-full max-w-6xl space-y-section px-page py-10` with the title row baked
in. Three sections follow at `space-y-section` rhythm:

1. **Title row** — `PageShell`'s header: `Your library` (big serif), lead
   `Every book you've added, ready to open, search and study.`, actions
   right: primary `Import` button (opens the dialog). The button is hidden
   while the library is empty — the empty card owns import then.
2. **Toolbar** — one row, hidden while the library is empty:
   - left: search input, `max-w-sm`, leading `Search` icon (`size-4`),
     `text-sm`, placeholder `Search title, author…`, `aria-label
     "Search library"`. Client-side, no debounce.
   - right: tally `text-xs text-muted-foreground`, right-aligned:
     `{n} books · {N} pages` (page total `toLocaleString`). No library path.
3. **Grid** — `grid grid-cols-3 gap-4 2xl:grid-cols-4`. Server order.

## BookCard

Whole card is a `Link` to `/library/{sha256}`, focus ring `ring-3
ring-ring/50`; cover lift on hover/focus (the sanctioned hover). The cover
is the identity: its plate draws the title and author, so the card body
repeats neither.

```
┌──────────┐  Card: rounded-xl, p-card, h-full, gap-3
│  cover   │  BookCover (aspect-3/4, hue from sha) — the lift target
│  + badge │  spinner roundel top-right ON the cover (see below)
├──────────┤
│ Scanned ·│  text-sm text-muted-foreground: `{Kind} · {pageCount}
│  6 pages │  pages`, the kind word plain, the count mono
└──────────┘
```

`{Kind}` is `Scanned` or `Digital` — preparation's locked classification.
There are no capability tags: a book is **Ready, or Not ready**, and there
is nothing in between to label.

**A shelf that doesn't lie.** A book that is not ready is shown, dimmed
(`opacity-55` on the cover wrapper), with one line under the facts saying
why — the task's headline while it is being prepared, its error in
`text-destructive` when it failed, else `bookMissingLine(book)` from the
derived readiness. The old shelf rendered a failed import as an ordinary
card that had merely lost its spinner; this is the fix.

**The spinner roundel** — while a preparation is queued or running: `size-6
rounded-full` circle pinned `top-2 right-2` **inside the cover's lifting
wrapper** (so it rides the hover lift), `bg-background/90 backdrop-blur`,
containing a `size-4 animate-spin` `LoaderCircle` in `text-primary`. Its
`title` is the task headline. It is not the only signal — the dimming and
the line carry it too, per "never encode meaning in color alone".

## States

| State | Condition | Render |
|---|---|---|
| Loading | `loading` | grid of 4 skeleton cards (aspect-3/4 cover + one line) |
| Error | `error` | card: `Error` destructive badge, `Couldn't load your library.`, message, `Retry` → refetch |
| Empty | no books | title row (no button, no toolbar) + shared `EmptyState` (`components/states.tsx`): `BookOpen` roundel, `Add your first textbook`, `Drop in a PDF and its pages become searchable and ready to study.`, primary `Import a PDF` → dialog |
| No match | books exist, filter empty | centered quiet line `No books match "{query}".` + `Clear search` text button. No import CTA |

Search filter: `title` + `author` (lowercased substring). Subject does not
match — it only feeds the author fallback for display.

## Import dialog

shadcn `Dialog` (`sm:max-w-lg`), triggered by the header `Import` button,
the empty hero button, or `/?import=1` (param consumed on open). The intake
header (`Import a textbook` + description) belongs to the drop-zone view
only — the duplicate and accepted views render their own headings.

**The modal is intake only.** It owns validation and the HTTP upload; the
moment the server accepts, the job belongs to Tasks — no job tracking, no
progress UI, no result view here. The dialog never closes itself: the
standard close button and the user's action own the window's life.

1. **Idle** — intake header, then drop zone: dashed border card, `FileUp`
   icon, `Drop a PDF here` / `or click to browse.`; whole zone opens the
   file picker (`accept="application/pdf,.pdf"`); drag-over highlights
   (`border-primary bg-primary/[0.04]`).
2. **Uploading** — spinner + truncated filename + `Uploading {size}…`
   (`role="status"`). No fake progress bar. Non-PDF rejection stays
   inline in-zone: `That doesn't look like a PDF. Try again with a .pdf
   file.` Upload HTTP errors render as an inline destructive alert.
3. **Accepted** (202 + job) — success roundel (`✓` in a `bg-success/10`
   circle), `Added to the queue`, the book title, then a quiet panel:
   `What happens next` with preparation's four phases in order
   (`Examine the pages` → `Read the pages` → `Index the sections` →
   `Build search`) and the line `Tasks tracks every step, so this window
   can close whenever.` Actions: `View task` (plain link to `/tasks`),
   `Import another` (back to the drop zone, same session), `Done`. The
   sidebar card picks the new task up from the live stream on its own.
4. **Duplicate** (200) — own heading, no intake header:
   `Already in your library` + `Open book` + `Done`.

A failure is never only a toast: it lives on the card itself, on the book's
page, and on `/tasks`. The grid refetches whenever the running set changes,
so a finished book's card settles on its own.

## Deliberately not here

- The Import **page** (route + nav entry + `Recent imports` card + path
  import + `Go to library` button) — replaced by this dialog; see
  `design/removals.md`.
- Library location in the tally; `Ready` pills; the card state tags
  (`Needs OCR`, `Semantic search` — OCR is automatic and mandatory, and
  every import ends semantically indexed, so neither is news; the kind
  label `Scanned`/`Digital` took the tags' place); semantic-search dot;
  import CTA in the no-match state; subject in search; sort/filter
  controls (server order is deliberate); book grid/list toggle.

## Backend surface

`GET /api/books` (read), `GET /api/events` (SSE), `POST /api/import`
multipart only (the `{path}` JSON mode is now web-unused — flagged in the
ledger for the reconciliation pass). No mutations from the grid itself.
