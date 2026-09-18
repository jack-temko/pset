# Book view

Route `/library/:bookId`. This doc is the spec: the page renders exactly
what's described here, and nothing else.

**Purpose:** the book's home — identity, readiness, structure, doors,
and what has happened here. The workflows live in their own pages
(reader, ask, homework); this is base camp.

**Decisions from the grill (2026-09-16):**

- The page is the book's home, not a file inspector: activity belongs
  here as real data, not vaporware.
- The old Activity tab's fake "Study sessions / Quizzes" skeleton cards
  are gone; the tabs are gone with them (stacked sections, like
  homework and doctor).
- Chapter rows are doors: picking one opens the reader at its start
  page.
- The hero keeps its cover-poster shape, now on the sanctioned type
  scale (the banned arbitrary title size is gone).

## Layout

PageShell-adjacent container (`max-w-6xl`, `space-y-section`, `px-page`
`py-10`), stacked top to bottom:

1. **Back link** — ghost `Library` link.
2. **Hero** — cover left (`aspect-3/4`, up to `w-52`); right column:
   subject badge, serif title (`text-4xl`), author (falls back to
   subject), one meta line (pages · file size · imported). Doors, ready
   books only: **Open reader** (primary), **Ask about this book**
   (`/ask?book={sha}` — the same deep-link pattern as the reader's
   anchored ask), **Set homework** (`/homework?book={sha}`; the
   new-homework dialog pre-picks the book from that param), and Remove
   book as the quiet destructive door. A book that isn't ready shows no
   doors here — its card below owns the actions, including Remove.
3. **Readiness** — `BookReadiness` unchanged: one green line when
   ready; the not-ready card (state, reason, progress, Resume / Try
   again, Remove) otherwise. Preparation settling refreshes the page.
4. **Chapters** — micro-label with the section count; the contents card
   (sources line kept: outline / inferred mix). Rows are links into
   `/library/{sha}/read?page={startPage}` with hover affordance; indent
   by level, dotted leaders, page ranges, 40-entry preview with
   `Show all`. Loading, error+Retry, not-ready ("Not worked out yet.")
   and empty states as before.
5. **Activity** — micro-label with the item count; one card listing
   this book's **conversations** (book-scoped API, rows →
   `/ask?c={id}`, title + relative time, message icon) and its
   **homework** (filtered from the homework list by `bookSha256`, rows
   → `/homework/{id}`, title + `Building…` or the question count,
   checklist icon). Newest first within each group, asks above
   homework. Loading skeletons, error + Retry, and the quiet empty line
   ("No questions or homework yet.") complete the states.
6. **File details** — micro-label + quiet card: SHA-256, library copy,
   original file, page count, page geometry, PDF version, file size,
   imported.

## Behavior

- Deep links: the hero's Ask and Set homework doors carry the book so
  the target pages open pre-picked; the homework dialog honors
  `?book=` whenever it opens with that param present.
- Preparation settling (task stream) refetches the book and its
  sections; the activity section reads live data on mount.
- 404 and load-error states keep their dedicated cards with Retry.

## Backend surface

Nothing new. `GET /api/books/{sha}`, `GET /api/books/{sha}/sections`,
`GET /api/books/{sha}/conversations` (book-scoped ask history),
`GET /api/homework` (filtered client-side by `bookSha256`), plus the
task stream.

## Deliberately not here

- Study sessions and quizzes — the old coming-soon promise. They land
  as real features when they exist, not as placeholder cards.
- Chapter-level ask anchors, per-chapter reading progress.
- Editing metadata; the library owns import/duplicate handling.
- Mobile (desktop-only rule).

## E2e manifest (web/e2e/states.ts)

`book/home` (ready book: hero doors, chapters, populated activity,
details), `book/not-ready` (preparing book: readiness card, chapters
pending, no hero doors), `book/failed` (failed preparation: reason,
Retry, Remove) — mock mode over the seeded library books.
