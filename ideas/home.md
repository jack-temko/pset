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

## Round 2: stats options (2026-10-21)

Jack: **"I really want this home screen stats to look really cool. I like the heatmap for sure. Can you come up with some other options for this? I want some that look good and don't leave any large empty gaps. Lets go with the 6 months."**

- Span is settled: 6 months (D2 closed). Drop the year span and its states.
- The tiles and layout A/B (D3, D9) give way to four options, each a state of the
  Home view, each filling the content width (1012 at most) with no empty run wider
  than 48px inside the info area, at 1012 and at the design page's default width.
- Every option uses the heatmap, now with month labels above and Mon, Wed, Fri
  labels on the left (as GitHub does), 6 months, hover as before.
  1. **panel**: one bordered panel. Heatmap left; right of it, filling the rest,
     three stats stacked and split by hairlines: time this week, questions done this
     week (each with last week muted and an up or down change), and the course with
     the most time this week.
  2. **courses**: a row of four stats without boxes, big figures, split by vertical
     hairlines, across the full width (time this week, questions this week, time
     this month, active days in the last 30). Below: the heatmap left and, filling
     the rest, "This week by course": one row per course, name, a bar in the
     accent, its time, most first.
  3. **week**: heatmap left; right of it this week as seven vertical bars, Mon to
     Sun, today marked, headed "1 h 35 m this week" with "8 h 55 m last week"
     muted, and questions done beneath.
  4. **sparklines**: three tiles across the full width, each a label, a big figure,
     last week muted and a small 14-day sparkline (time, questions, sets
     finished); below, the heatmap grown to fill the full width (squares size to
     fit, at most 32px).
- New pieces are units if reused (a `stat` without a box, a `bar-chart` of days, a
  `course-bars` list, a `sparkline`); keep them small. Sample data grows a
  per-day questions count and per-course time this week.
- Phone width: every option stacks, nothing scrolls sideways.
- Decisions home-d5 (6 months, Jack's words) and home-d6 (the four options replace
  the tiles and layout A/B) with the quote in `log.md`.

## Where round 2 ended (2026-10-21)

Jack chose the week option and then its sparklines version ("Lets go with spark
lines, drop the other one, and anything else not used anymore."); the panel,
courses and sparklines options, the tiles and layout A/B and the year span are
gone. Home's info area is one outlined box (no fill): the heatmap (month and
Mon/Wed/Fri labels, no ragged end, no outline of its own) beside this week's seven
bars (two-letter labels, today in full colour, no underline), questions done and
questions left, each with a 14-day sparkline. Changes compare with last week up to
the same weekday, in the muted colour. Decisions home-d5 to home-d12, heatmap-d8
and d9, bar-chart-d1. Jack: **"Looks absolutely great, what's next?"**
