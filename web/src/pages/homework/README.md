# Homework

Route `/homework`. This doc is the spec: the page renders exactly what's
described here, and nothing else.

**Purpose:** the assignment dashboard. What's due soon, what's open, and
the door to new homework. Watching a build and working the questions live
in the workspace (`/homework/{id}`), which owns every mutation: turn in,
delete, reorder, repair.

**Decisions from the grill (2026-09-15):**

- One urgent strip (due within 7 days, overdue included, turned-in and
  still-generating excluded) over one complete list. The strip disappears
  when it is empty; the list always shows everything.
- No stat chips. Counts live in the section labels, Tasks-style.
- Rows are read-only links. Turn-in and delete happen in the workspace.
- Filters: status segments (All / Open / Turned in) + text search over
  title and book. No filter-by-book dropdown.
- Create lands in the workspace, watching the build start. The due field
  stays a bare optional date; no presets.
- The list refetches whenever a homework task that was running stops
  running, so the walkthrough count flips to a
  question count without a reload.

## Layout

`PageShell`: title `Homework`, lead `Paste an assignment and get a
walkthrough plus a template to hand in.`, actions: `New homework`
(primary, `Plus`) — hidden while the empty state shows, per the one-door
rule in `design/ui-rules.md` (the empty card carries the button there).

1. **Loading** — skeleton mirroring the shape: a micro-label bar, two
   strip-card blocks, then four list rows.
2. **Load error** — card: destructive `Error` badge, `Couldn't load your
   homework.`, the server message, `Retry` (outline).
3. **Empty** (no homework at all) — card: icon roundel (`NotebookPen`),
   `No homework yet.`, the paste-assignment pitch, `New homework`
   (primary).
4. **Due soon strip** — only when `dueSoon()` is non-empty: micro-label
   `Due soon` with mono count, `sm:grid-cols-2 lg:grid-cols-3` grid of
   cards (`rounded-xl border bg-card p-4`, hover lift). Card: title row
   (truncate + `DueChip`), book line (cover dot + title, truncate).
   Whole card links to the workspace.
5. **All homework** — micro-label `All homework` with mono count, then a
   controls row: search input (`Search title or book…`, aria-label
   `Search homework`) left, status segments `All | Open | Turned in`
   right. List: `ul divide-y rounded-xl border bg-card` of rows, newest
   updated first, always the complete set before filters. No match →
   quiet card `Nothing matches.` + `Try a different search, or clear the
   filters.` + `Clear filters` (resets search and status).

Micro-labels follow the Tasks convention: `text-xs font-medium uppercase
tracking-widest text-muted-foreground`, count in mono.

## Row

One anatomy for every state; the whole row is a `Link` to
`/homework/{id}`.

- Line 1: title (truncated; `title` attr carries the full text) + a state
  badge (`HomeworkStateBadge`), which **counts rather than labels**: an
  assignment is a list, so seventeen of eighteen walkthroughs is genuinely
  useful and the row says `{done} of {total} walkthroughs` while it builds.
  A task that failed shows `Needs you` in destructive. A finished one shows
  nothing — the question count on line 2 already says how big it is.
- Line 2: turned-in `CircleCheck` (success, aria `Turned in`) when
  applicable · cover dot + book title (truncated) · `{n} questions` ·
  `relTime(updatedAt)`.
- Right edge: `DueChip`.

`DueChip` tones (from `dueInfo`): overdue destructive, today warning,
≤7 days primary, later/none muted. Text: `Overdue · Sep 12`, `Due
today`, `Due tomorrow`, `Due Sep 21`.

Generating homework never enters the strip (`dueSoon` requires
`status === 'ready'`); turned-in homework leaves it but stays in the
list, where the Open filter hides it.

## New homework dialog

`NewHomeworkDialog`, standard X, `max-w-lg`.

- **Book** — `BookSelect` (components/book-chip.tsx): a select-look field
  over a cover list, matching the Input/Select language (`h-8`,
  `border-input`, muted `Choose a book` placeholder; never blue when
  empty). Required. With no books at all: `No books yet.` + `Import a
  textbook first and come back.` + link to `/library`; Create stays
  disabled.
- **Title** — optional text, placeholder `Problem set 3`. Used verbatim
  as the assignment's name; the server falls back to its own default.
- **Due** — optional bare date input.
- **Assignment text** — required textarea (`max-h-64 min-h-36`),
  placeholder `Paste the assignment here. Every question it finds gets a
  walkthrough and a page of working space.`

Footer: `Cancel` (ghost), `Create homework` (primary) — disabled until a
book is picked and the text is non-empty, spinner while in flight.
Create POSTs and navigates to `/homework/{id}` on success; failures land
in an error toast and keep the dialog open with the draft intact.

## Live updates

`useRefetchOnHomeworkSettle(refetch)` (hooks/use-homeworks.ts): watches
the shared task stream, and when a homework task that was running stops
running, calls `refetch()`. The row flips from its walkthrough count
to its question count in place.

## Backend surface

- `GET /api/homework` — the full list with book identity + question
  counts.
- `POST /api/homework` `{bookSha256, title?, dueDate, sourceText}` →
  `{homework, task}`.

Nothing else. No PATCH/DELETE/retry from this page.

## Deliberately not here

- Turn-in, delete, question reorder, retries — workspace.
- Book filtering — the list is short; search covers it.
- Due-date presets — the bare field is enough.
- Stat chips — the section labels carry the counts.

## E2e manifest (web/e2e/states.ts)

`homework/empty`, `homework/dashboard`, `homework/filters`,
`homework/dialog`, `homework/dialog-filled`, `homework/dialog-no-books`,
`homework/creating`, `homework/create-fail`, `homework/live`,
`homework/error` — over the `homework:week` seed (six assignments:
overdue, due today, due in 3 days, due later, turned in, generating)
plus `library:empty` for the empty/no-books states.
