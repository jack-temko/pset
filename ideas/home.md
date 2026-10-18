# Home, the first view

Status: In progress, branch `home` (worktree `../pset-home`, from `design`).
Spec: `ideas/home-info-grill.md` (D1 to D12 and Assumed) and S14 in
`ideas/screens-grill.md`. Jack, 2026-10-16: **"Build it."**

## What to build

Everything lands on `/design` as units with typed `spec.ts`, `examples.tsx` and
`log.md`, like the existing units in `web/src/units/`. Home runs on sample data
(`web/src/design/sample`), as every unit does; wiring it to the server is a later
change, so no Go work here.

1. **`greeting` (component).** A random line for the hour from
   `web/src/lib/greeting.ts` (D4) in the big serif step, then one muted line (D5,
   D11): "Problem set 4 is due Thu." / "Problem set 4 was due Mon." (overdue first)
   / "Nothing due this week." Reuse the due wording in `set-line/dates.ts`. Props
   take the name, the hour (or a `now`) and the next due set; the random pick
   takes a seed so examples are stable. States: each band, no name, nothing due,
   overdue, stress (long name, long set title).
2. **`heatmap` (component).** Minutes studied per day (D1), columns of weeks
   starting Monday (D8), today in the last column, a day ending at 4am (D6: the
   sample data already says which day; the 4am rule belongs to whoever buckets the
   time, so write a small `studyDay(date)` helper with tests). Shades: empty plus
   four accent-blue steps at under 30 m, under 1 h, under 2 h, 2 h or more, as
   tokens in `tokens.css`/`tokens.ts` passing the contrast test where it applies.
   Heading: "41 h studied in the last 6 months" (D10), "No time studied yet" when
   empty. No legend (D12). Hover a square: the Tooltip unit with the day, its
   total, then each course and its time, most first (D7). Span prop: 26 or 53
   weeks (D2). It fits its container: at narrow width it shows fewer weeks, ending
   today, never scrolls sideways, square size fixed.
3. **`stat-tile` (component).** A label, a big figure, and an optional muted line
   ("Last week: 2 h 40 m"). Figures in the figures font (rule
   `figures-follow-text`). Used for "Time this week" and "Questions done".
4. **`home` (view).** Info area (greeting, tiles, heatmap), then the Assignments
   list, then the Courses list (reuse `HomeLists` from
   `web/src/units/assignment-row/home.tsx`, moving it into the view if that's
   cleaner). The three A/B picks are switchable states of the view, so Jack
   compares them on one page (D2, D3, D9):
   - span: 6 months / a year
   - tiles: two (time and questions this week, each with last week) / one (time
     this week)
   - layout: tiles beside the heatmap under the greeting / greeting, tiles row,
     heatmap stacked
     At phone width the tiles sit above the heatmap.
     An older, stale Home view (S13, one list) is in `../pset-home-view/web/src/units/home`;
     read it only to see how a view unit is registered. Do not copy its design.

Sample data: about 6 months of plausible days for a student with five courses
(gaps, weekends lighter, a few late nights, some 3 h days), and a year for the
year span.

## Rules

Follow the rulebook (`web/src/design/rules.ts`) and the checks; no em dashes;
sentence case; no accessibility-only work (Jack's contrast, keyboard and focus rules
still stand). Decisions go into each unit's spec with Jack's words verbatim in
`log.md`, citing `ideas/home-info-grill.md`.

## Done when

`make check` is green; each new unit and the Home view render on `/design` at 1280
and 360 with no overflow, in loaded, loading (skeletons) and stress; the A/B states
switch; you looked at screenshots.
