# Home's info area: grill

Status: Grilled, awaiting Jack's OK. Branch `home`.

## Summary

Home opens with an info area, then Assignments, then Courses (S14).

- **Greeting**: a random generated line for the hour ("Good evening, Jack."), then
  one muted line: what is due next ("Problem set 4 is due Thu."), or "Nothing due
  this week."
- **Heatmap**: time studied per day, weeks from Monday, four accent-blue shades plus
  empty, a day ending at 4am. Heading "41 h studied in the last 6 months". No
  legend. Hover: the day, its total, and each course studied with its time, most
  first.
- **Stat tiles**: A/B two tiles (time and questions this week, each with last week
  muted) against one (time this week).
- **A/B on sight when built**: heatmap span (6 months or a year), tiles (two or
  one), layout (tiles beside the heatmap, or all stacked).
- **From scratch**: what the backend and the old Home do binds nothing.

### Assumed (overrule at a glance)

- Shades are fixed steps: under 30 m, under 1 h, under 2 h, 2 h or more.
- "Due next" means the nearest due date among unfinished sets; a past-due set counts
  first ("Problem set 4 was due Mon.").
- At phone width the heatmap shows fewer weeks, ending today, and the tiles sit
  above it.
- A student with no time yet sees the empty grid and "No time studied yet".
- No name: the greeting line drops its name, as `greeting.ts` already does.

Topic: the info area at the top of Home, above the Assignments and Courses lists
(S14 in `ideas/screens-grill.md`): a big greeting, a stat tile and a GitHub-style
heatmap of work. Point of view: the tired student opening PSet to get to work.

## Gate 0: audit (2026-10-16)

What is true today:

- **Time spent** is recorded as stretches in the `study` table
  (`internal/activity/activity.go`): book, kind (reading, homework, asking),
  start and end, question id. Grain is about 30 seconds. This is enough for minutes
  per day.
- **Questions done** carry `questions.done_at`. Only the current state is kept:
  unticking a question removes it from history.
- **`GET /api/week?since=`** already returns minutes by kind, questions and sets
  done, and minutes by book. There is no per-day endpoint, no streak and no heatmap.
- **Name**: `Profile.Name` in settings; empty means no name.
- **Old Home** (dev) showed a greeting title ("Good evening, Jack."), a row of stat
  tiles (questions worked, time), a by-book bar, then due work. Its stat tile
  deliberately never counted streaks.
- **Prior art, GitHub**: the profile contribution graph is 53 weeks by 7 days, one
  green in four shades plus empty, a "N contributions in the last year" heading and
  a less-to-more legend; no streak count (GitHub removed streaks in 2016).
- `../pset-home-view` holds an older Home build on S13 (one list of courses). S14
  replaced it; it is stale.

Could not determine: whether Jack wants this area to motivate (counts, streaks) or
only orient (what is due).

## Decisions

| Id  | What                                                                                                                                                 | Why                                                                                       | Beat                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------- |
| D1  | A heatmap square counts time studied that day: reading, homework and tutor time                                                                      | Jack's pick                                                                               | Questions done; both, switchable         |
| D2  | Heatmap span is A/B'd when built: about 6 months against a full year                                                                                 | Jack: "pick the two most reasonable options and A/B them once we start building"          | This semester; last 12 weeks (not built) |
| D3  | Stat tiles are A/B'd when built: two tiles (time and questions done this week, each with a muted last-week figure) against one tile (time this week) | Jack's pick                                                                               | A streak tile                            |
| D4  | The greeting is one of the generated lines for the hour (`web/src/lib/greeting.ts`, picked at random), then one muted line under it                  | Jack: "Name + one line, we will reuse the greetings that we generated for randomization." | Name only; a new rotating line           |
| D5  | The muted line names what is due next: "Problem set 4 is due Thu."                                                                                   | Jack's pick                                                                               | Count due this week; time this week      |
| D6  | A study day ends at 4am: work until then counts for the day before                                                                                   | Jack's pick                                                                               | Calendar midnight                        |
| D7  | Hovering a square shows the day, its total, and the courses studied, most time first, each with its time; no split by kind                           | Jack: "courses by time in them. no split"                                                 | Time and kind split; time only           |
| D8  | Weeks start Monday; four shades of the accent blue plus empty                                                                                        | Jack's pick                                                                               | Sunday start; GitHub green               |
| D9  | Layout is A/B'd when built: tiles beside the heatmap under the greeting, against greeting, tiles and heatmap stacked                                 | Jack's pick                                                                               | Either one alone                         |
| D10 | The heatmap has one heading line, its total: "41 h studied in the last 6 months"                                                                     | Jack's pick                                                                               | No heading; total and weekly average     |
| D11 | With nothing due within 7 days the sub-line says "Nothing due this week."                                                                            | Jack's pick                                                                               | Next due however far; no line            |
| D12 | No Less-to-More legend                                                                                                                               | Jack's pick                                                                               | GitHub's legend                          |

## Log

Jack, on the audit (2026-10-16): **"looks right, go ahead. but this is from scratch. so we can disregard what the backend does and what the frontend shows right now. I want this informational at a glance, homey to a student, with enough information for an interested student, but not too much its a slog to read through."**

Batch 1 (heatmap count, span, stat tiles, greeting) was asked; the answers came back as a message that did not arrive. Asked again.

Jack, mid-batch (2026-10-16): **"pick the two most reasonable options and A/B them once we start building"**, then **"Sorry please ask agai"**. Read as: where he has no strong pick, build the top two options side by side and he chooses on sight.

Batch 1, asked again: heatmap count **Time studied**; span **"pick the two most reasonable options and A/B them once we start building"**; stat tiles **A/B two vs one tile**; greeting **"Name + one line, we will reuse the greetings that we generated for randomization."**

Batch 2: sub-line **What's due next (Recommended)**; day ends **At 4am (Recommended)**; hover **"courses by time in them. no split"**; grid **Monday, accent shades (Recommended)**.

Batch 3: layout **A/B two layouts (Recommended)**; heading **Total line (Recommended)**; nothing due **"Nothing due this week." (Recommended)**; legend **No legend (Recommended)**.

Grill ended after batch 3; the rest is under Assumed.
