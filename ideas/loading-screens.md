# Loading standard, part 2: every screen through Loaded

## Status

In progress, branch `loading-screens` (change 2b of the loading standard, after
`loading-overlays`). The guard (part 3, `jumps-guard`) lands after this.

## Information

**Why.** Only the usage dialogs and Reset everything follow the standard. Every other
screen draws its own skeleton: wrong counts (Home 3 rows and 5 covers, homework list
2 short rows), wrong shapes (the walkthrough skeleton has no header, answers or
footer; the Ask skeleton is top-aligned while the real prompt sits at the bottom),
content that arrives late and pushes (Home's key banner and greeting name, counts in
headings, "Turned in", the assignment reads box, the rail vanishing for a book with
no contents, the Remove popover reading "0 homework sets"), and a failed query keeps
its skeleton forever on five screens.

**Decisions.** The grill, `ideas/loading-standard-grill.md` (D1 to D8, D9 dropped),
plus two from research (2026-10-09):

- **Reveal together.** Like React's Suspense, which reveals loaded content at most
  once every 300ms so nearby sections appear together: a `Loaded` whose skeleton has
  been seen reveals on a shared train. If no reveal happened in the last 300ms it
  reveals at once; otherwise it joins the next reveal, 300ms after the last. Data
  inside the grace still shows at once. This is what stops "loads out of order".
- **Keep the last data on a key change.** Where a mounted query's key changes
  (add-homework's live readings, a set switch), keep showing the previous data until
  the new data arrives (TanStack `placeholderData: keepPreviousData`, or the list's
  cached summary as placeholder), instead of going back to a skeleton.
- Static parts stay real (titles, labels, column headers); only data gets
  placeholders (Polaris). Late facts that change layout (the key banner, first run,
  the rail's presence) are decided inside the page's `Loaded`, not after it.

- **Variant first (D10 to D13, added 2026-10-09 after the finished-set flash).** `Loaded`
  takes `variant`, `skeletons`, `neutral` and `variantOf`; list rows seed the detail
  (`useListedSet`, the book from the shelf); the walkthrough, Home, the homework list
  and Ask pick their screen in render; `web/src/variants.ts` is the manifest the guard imports;
  the `pset-view` skill gets a Loading and variants gate.

### Files

- `web/src/components/loaded/index.tsx` (+ test, README): the reveal train (a small
  module-level scheduler, injectable clock for tests); `Loaded` takes an optional
  `queries` array so one box can wait on several queries and reveal once.
- `web/src/pages/home/index.tsx`: one page `Loaded` over settings, books, due and
  the week, so the greeting name, the key banner, first run, the week tiles (no
  "nothing yet" under skeletons), the due rows and the shelf reveal together. Due rows
  and covers use `useLastCount`; the due count in the heading is part of it.
- `web/src/pages/settings/index.tsx`, `updates.tsx`: each section through `Loaded`
  with an error line; the Updates skeleton matches its rows; the double scroll to
  `#connections` goes if nothing shifts.
- `web/src/pages/workspace/index.tsx`: the book frame draws a skeleton of its real
  layout (top bar, rail, page, panel) instead of an empty frame; the rail's presence
  per book is remembered (`useLastShape`), so a book with no contents does not show a
  rail and then remove it; the homework count for Remove is prefetched with the page
  and holds a fixed-width slot; RailSkeleton draws the last shape.
- `web/src/views/homework/index.tsx`, `walkthrough.tsx`, `help.tsx`,
  `pages/workspace/assignment-reads.tsx`: list rows' skeleton matches SetRow (two
  lines and the bar), last known count; reads box and "Turned in" inside the list's
  `Loaded`; the walkthrough skeleton matches the loaded layout (header with menu, time
  and progress bar; statement; three help rows; answers row; footer); a set switch
  uses the list's cached summary as placeholder for the header.
- `web/src/pages/workspace/index.tsx` (Ask tab): the skeleton sits where the real
  content sits (bottom-aligned like the prompt).
- `web/src/pages/workspace/memory.tsx`: through `Loaded` with an error line.
- `web/src/pages/workspace/add-homework.tsx`, `reads-as.tsx`: the remembered source is
  prefetched with the homework tab so the URL is filled when the dialog opens;
  `useLiveReadings` uses `keepPreviousData` instead of its `last` ref.
- The 1-second re-render: `lib/eta.ts` (`useNow`, `useTimeLeft`), `api/activity.ts`
  and the study timer tick every second, and the whole workspace (pages, KaTeX, the
  transcript cards) re-renders with them: an 0.8 to 1.1s long task every second in
  dev, which stalls every fade and click on a book page. Move each ticking value into
  the smallest leaf that shows it (the timer text, an ETA line), so a tick re-renders
  only that leaf; memoize the heavy panes if needed. Prove it with a Chrome trace or a
  long-task observer on an idle homework page: no long task over 50ms from the tick,
  in dev and in a production build.
- `web/src/pages/components/sections/feedback.tsx`: the Loaded demo gains "three
  sections, out of order" (three boxes with different latencies) to show the reveal
  train, and an error replay.
- `design/design-system.md`: the reveal train, keep-last-data, static parts real,
  errors never shimmer forever; this file's Status.

Model work and busy states stay as they are (spinners for Thinking, Working, Adding,
Checking, ReadingNote, streaming blocks).

### Steps

1. Reveal train and multi-query `Loaded`, with tests and the demo.
   1a. The 1-second re-render moved into leaves (it skews every measurement after it).
2. Home.
3. Settings.
4. Workspace frame, rail, Remove count, Ask tab.
5. Homework list, reads, walkthrough, set switch.
6. Memory, add-homework.
7. Full `make jumps` (hand-written plus discovery, 3 runs) on the test library: every
   row 0px growth and jump at most 0.001, no timeouts; fix until it is.
8. Docs.
9. Variants: the typed API, seeding from lists, choosing in render, the manifest, the skill gate; then the full audit again.

### Tests

- Loaded: the reveal train (two boxes resolving 100ms apart reveal together; one
  alone reveals at once; data inside the grace bypasses it), multi-query.
- Existing page tests updated; `make check` green.
- Full audit as in step 7, report attached to the PR.
- Shots, Paper and Night: Home, Settings, a book, a homework set mid-load and loaded.

### Acceptance

- Every scenario in the full audit: 0px overlay growth, jump score at most 0.001,
  no timeout, both modes.
- A failed query anywhere shows one line, never a permanent skeleton.
- Sections that load close together appear together.
- An idle book page has no long task from the one-second tick.

### Out of scope

- The CI guard (part 3).
- Wire changes (usage kind counts for the book dialog's first open).
