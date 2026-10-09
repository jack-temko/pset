# Loading standard, part 1: Loaded, the usage dialogs, Reset everything, fonts

## Status

Built on branch `loading-overlays`, awaiting Jack's try (change 2a of the loading standard). Part 2
(every other screen onto `Loaded`, the remaining spots, the CI guard) follows.

## Information

**Why.** The book Usage dialog opens 152px tall with a spinner line and grows to
436px about 470ms later, centred, so it lurches (jump score 0.067, the worst in the
app). Reset everything grows 24px as its counts arrive. JetBrains Mono loads on first
use and reflows once more. Measured by `make jumps`, 2026-10-09.

**Decisions.** The approved grill, `ideas/loading-standard-grill.md` (on branch
`layout-jump-audit`, landing with the audit): D1 overlays prefetch and open at final
size, a sized skeleton if still waiting; D2 content replacing a skeleton fades in
over 150ms, cached content appears at once; D3 one `Loaded` wrapper; D5 a list's
skeleton draws its last known count (3 the first time); D7 numbers in a sentence are
prefetched and hold a fixed-width slot; A1 every font preloaded; A2 the book usage
aggregate prefetches as the pointer reaches the Book actions menu; A3 usage stays
cached and refreshes on events; A4 the fade is opacity only, ease-out, off under
reduced motion; D9 (a height morph for a mismatched skeleton) was tried and dropped: it jittered.
The skeleton and content crossfade in one grid cell instead, skeletons are made
exact, and the jump check enforces it.

### Files

- `web/src/components/loaded/index.tsx` (new): `Loaded<T>({ query, skeleton,
  children: (data: T) => ReactNode, className? })`, taking a TanStack query result.
  - Pending: renders `skeleton` in a layer, so its space is held from the first frame.
    For the first 300ms (`GRACE_MS` from `lib/settled.ts`) it is transparent (still in
    layout); then it fades in over 150ms and shimmers.
  - Data: `children(data)` in a content element that never remounts. Data inside the grace
    or cached at first render shows at once, no fade. Otherwise skeleton and content share
    one grid cell and crossfade over 150ms (content 0 to 1 on top, skeleton 1 to 0
    underneath), then the skeleton unmounts. Reduced motion: instant.
  - Error (only when there is no data): one `role="status"` line, `errorText` (neutral
    default). `aria-busy` on the wrapper while pending.
  - D9, a height morph, was built and dropped: it jittered and flashed.
- `web/src/components/loaded/index.test.tsx` (new): skeleton in layout but hidden
  during the grace and visible after it (fake timers); content fades only after a
  pending first render; cached data renders without the fade; `aria-busy`; error.
- `web/src/components/loaded/README.md` (new), in the README format of
  `components/progress-bar/README.md`: when to use it, the skeleton contract (same
  layout and size as the content), what the caller provides, Don't.
- `web/src/index.css`: a `fade-in` utility (opacity 0 to 1, 150ms, ease-out, none
  under `prefers-reduced-motion`).
- `web/src/lib/last-count.ts` (new) and its test: `useLastCount(key, count?)`
  returns the count a list showed last time (saved per key in localStorage, wrapped
  in try/catch, 3 when nothing is saved) and saves the new count when it arrives.
- `web/src/api/usage.ts`: drop `staleTime: 0, gcTime: 0`, so usage data stays cached;
  add `prefetchBookUsage(client, bookId)` and `prefetchUsageDetail(client, source)`.
- `web/src/api/events.ts`: when an event says a model job finished or a question,
  turn, read or book changed (find the existing events), invalidate the matching
  `['usage', ...]` keys, so cached usage refreshes in place.
- `web/src/components/usage/index.tsx`: rename the internal `Loaded` function (it
  would clash with the new component); prefetch on the trigger's pointerenter and
  focus; the modal body uses `Loaded` with a usage skeleton.
- `web/src/components/usage-modal/index.tsx`: rename the internal `type Loaded<T>`;
  replace Body's spinner line with `Loaded` and a `UsageSkeleton` that mirrors the
  loaded layout: the Totals grid (two rows of four), the "By kind" or "Stages" table
  header and `useLastCount` rows. Empty ("No model calls were made.") stays as is.
- `web/src/pages/workspace/index.tsx`: prefetch the book usage on pointerenter and
  focus of the Book actions trigger and of its Usage item; keep `useBookUsage` for the
  open dialog.
- `web/src/pages/settings/index.tsx` and `web/src/api/settings.ts`: `useResetCounts`
  runs when the Settings page mounts (not gated on the popover) and is invalidated
  when books change; while missing, each count in the sentence is a skeleton whose
  width is the last shown text's length in `ch` (`useLastCount`-style, saved per
  key), so the sentence never reflows.
- `web/src/main.tsx` (or `index.html`): preload the three font families at start
  (`document.fonts.load` for each family's normal style, not awaited; chosen over
  `<link rel=preload>` because it works the same in dev and build). Only the latin and
  latin-ext subsets load at start (the app's text and figures); Greek, Cyrillic and
  Vietnamese load on first use.
- `web/src/pages/components/sections/feedback.tsx`: a `Loaded` entry with a demo
  (buttons for pending, loaded, cached, error; a slow mode) and its README as docs.
  Fix the Skeleton entry's note (:276), which says it doesn't pulse; it shimmers.
- `design/design-system.md`: under Motion (around :224-272), the loading standard: the
  surface table from the grill's Summary, the 150ms fade, `Loaded` as the one way,
  prefetching overlays, last known counts, fixed-width number slots, preloaded fonts.

### Steps

1. `fade-in`, `Loaded`, its test and README; `useLastCount` and its test.
2. Usage: caching, events invalidation, prefetch on both triggers, `UsageSkeleton`
   through `Loaded` in both modals; the internal renames.
3. Reset everything: counts with the page, fixed-width slots.
4. Font preloading.
5. `/components` entry and the Skeleton note fix.
6. Docs: `design/design-system.md`; this file's Status.

### Tests

- New: `components/loaded/index.test.tsx`, `lib/last-count.test.ts`. `make check`
  green.
- The audit, run from `/home/jackt/dev/pset-layout-jump-audit` on this branch:
  `make jumps SRC=/home/jackt/dev/pset-loading-overlays ARGS="--runs 3 --only
  book-book-actions-usage,book-book-actions-usage-second-open,reset-everything-popover"`.
- UI states to photograph, Paper and Night: `/components` Loaded section (pending,
  loaded, error); the book Usage dialog first frame and settled (from the audit's
  shots).

### Acceptance

- Book actions > Usage: 0px growth and jump score 0 in real and slow mode; first open
  either complete or a skeleton the size of the table that fades into it.
- A usage line's dialog, opened twice, shows its data at once the second time.
- Reset everything: 0px growth.
- No font file is first requested after the app's first paint.
- Nothing else in the audit gets worse.

### Out of scope

- Moving other screens onto `Loaded` (Home, Settings sections, the homework set,
  the workspace rail): part 2.
- The CI guard: part 2.
- Any change to what the usage dialogs show.
