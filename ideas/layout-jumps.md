# Layout jumps: measure, then one loading standard

## Status

In progress, branch `layout-jump-audit` (change 1 of 2: the audit, built; `make jumps`
is documented in `design/design-system.md`). Change 2, the loading standard and its
fixes, waits for the audit's first report and a grill on it.

## Information

**Why.** Parts of PSet jump, resize or fill in out of order when a request returns:
some dialogs open small and grow about half a second later. Jack wants every place
found and measured (how big, how long on average), and then one way of loading that
looks the same everywhere.

**Decisions.**

- Measure first, then decide (Jack, 2026-10-08). The audit's numbers go into a grill
  that settles the standard: skeleton, fade, reserved size, or a mix by case. Change 2
  builds it everywhere and makes the audit a check that fails on any new jump.
- The browser reports jumps itself: the Layout Instability API (`layout-shift`
  entries, what Chrome's CLS is built on) gives each shift's score, time and the
  elements that moved. Shifts within 500ms of a click are flagged `hadRecentInput`
  and left out of CLS, which is exactly when a dialog grows, so the audit records them
  anyway. A `ResizeObserver` on every open dialog, popover and menu catches growth
  that moves nothing else.
- The audit drives the real app with Playwright against its own server on private
  ports and a scratch copy of a library, never 8420 and never Jack's library. Each
  scenario runs twice: **real** (no added latency, the numbers Jack feels) and
  **slow** (every `/api` request held 600ms, so every place that would jump on a slow
  disk or a cold cache shows up). Five runs each by default, reported as median and
  p95.
- What existing rules already say (`design/design-system.md`, "Nothing jumps when
  data arrives"; `design/backend.md`, "Every query draws a skeleton first") stays the
  rule. The audit shows where it is broken. It has no rule yet for dialogs or for a
  fade, which is what the grill settles.

### Files

- `web/package.json`, `web/package-lock.json`: add `playwright` as a devDependency,
  pinned to the release whose Chromium matches the one already in
  `~/.cache/ms-playwright` (chromium-1243), so nothing downloads. No browser is
  installed by `npm ci`; nothing in `make check` launches one.
- `web/src/components/skeleton/index.tsx`: add `data-skeleton` to the rendered
  element, so the audit can tell when a region is still waiting. No visual change.
- `web/scripts/jumps/probe.js`: the init script injected before any app code. A
  buffered `PerformanceObserver` for `layout-shift` (value, `hadRecentInput`,
  `startTime`, each source's node as a short selector with previous and current
  rects); a `MutationObserver` that attaches a `ResizeObserver` to every `dialog`,
  `[role=dialog]`, `[role=alertdialog]` and `[role=menu]` as it appears, logging
  its size each time it changes; the count of `[data-skeleton]` and `[role=status]`
  elements sampled every animation frame. Everything goes into `window.__jumps` with
  `performance.now()` times.
- `web/scripts/jumps/scenarios.mjs`: the scenarios, each a name, a start URL and an
  optional action (a click by role and name). Ids come from `GET /api/books` and
  `GET /api/books/{id}/homework`. Scenarios whose target does not exist in the
  library are reported as skipped, not failed. Never clicks a confirming or
  destructive action: popovers are opened, measured and closed with Escape. The list:
  - Pages, cold load: `/`, `/settings`, `/books/:id`, `/books/:id/homework/:hw`.
  - Client navigation: Home to a book (click its card), homework list to a set.
  - Overlays: the Book actions menu, Edit book, Memory, New homework, the Homework
    actions menu, Edit homework, Add questions, the Questions menu, Question actions,
    and the settings "Clear history" and "Reset everything" popovers.
- `web/scripts/jumps/analyze.mjs`: pure functions from a run's raw log to results:
  t0 (navigation start or the click), shifts after t0 summed and grouped by source
  selector, each overlay's first size, final size, growth in px and settle time
  (its last size change), when skeletons and spinners were last seen, and the settle
  time of the whole scenario. Then median and p95 across runs.
- `web/scripts/jumps/analyze.test.mjs`: vitest for the above with hand-made logs:
  settle detection, growth, grouping by selector, median and p95, a run with no
  shifts, `hadRecentInput` shifts kept.
- `web/scripts/jumps/report.mjs`: writes `report.json` and `report.md`. The Markdown
  has one table, worst first: scenario, mode, jump score, overlay growth (px), settle
  ms (median and p95), skeleton time, the elements that moved. Below it, per scenario,
  the two screenshots of the worst run: its first frame after t0 and its settled
  frame.
- `web/scripts/jumps/run.mjs`: the CLI. `--url` (the app), `--runs` (default 5),
  `--slow-ms` (default 600), `--only <scenario>`, `--out <dir>`. Each run is a fresh
  browser context at 1440x1000 (cold query cache). `/api/events` and image GETs are
  never delayed. A scenario settles after 750ms with no shift, no resize, no skeleton
  and no request in flight, or times out at 8s (reported as a timeout).
- `tools/jumps.sh` and a `jumps` target in `Makefile`: copies a library
  (`DATA=<dir>`, default the worktree's `.dev/data`) to
  `/tmp/pset-jumps-<topic>/data` with `cp -rL`, so no symlink points back into a real
  library; starts the branch's server and Vite on free ports the way
  `.agents/skills/change/references/try.sh` does (server 8430-8499, Vite 5180-5197);
  keeps the API key out of the copy (find where the library stores it and leave that
  file out, or clear it in the copy before the server starts; never print or read it
  into the script's output), then checks through the scratch server's settings API
  that no key is set and stops if one is, so no model call can be made; runs the
  audit; stops both; prints the report path. The source library may be in use by
  Jack's running PSet, so the database is copied consistently (SQLite's backup or
  `VACUUM INTO`, not a plain `cp` of a live file), and the source is only ever read.
  Output defaults to `/tmp/pset-jumps-<topic>/<time>/`, never the repo.

### Steps

1. `data-skeleton` on Skeleton, and its README line.
2. Playwright devDependency, `probe.js`, `run.mjs` running one scenario (`/`) end
   to end and dumping its raw log.
3. `analyze.mjs` and its tests.
4. All scenarios, `report.mjs`, screenshots.
5. `tools/jumps.sh` and `make jumps`.
6. Run it on a copy of Jack's library (`DATA=~/.local/share/pset`, his choice,
   2026-10-08), real and slow, and leave the report in
   `/tmp/pset-jumps-layout-jump-audit/` (not committed).
7. Docs: a paragraph under "Nothing jumps" in `design/design-system.md` on
   `make jumps` (what it measures, how to read the report); this file's Status.

### Tests

- `web/scripts/jumps/analyze.test.mjs` (new) passes under `make check`.
- `make check` green; no browser starts during it.
- UI: none changes visibly. `data-skeleton` is an attribute only.

### Acceptance

- `make jumps DATA=<library>` runs end to end with no manual steps and prints the
  path of a report with every scenario in both modes, or says why one was skipped.
- The report names the add-homework dialog (or whichever overlay it is) with its
  growth in px and its settle time, so the "opens small, grows" case is in numbers.
- Runs repeated on the same library give the same jump list, and medians within
  about 20%.
- Nothing is written to the repo or to the source library; ports 8420 and Jack's
  library are never touched; no model call is made.

### Out of scope

- Any fix to a jump, any new loading component, any fade: change 2, after the grill.
- Running the audit in CI or `make check`: change 2 decides.
- Seeding a library from `testdata/`: the audit runs on a copy of an existing one.
