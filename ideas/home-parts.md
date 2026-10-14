# Home's parts: progress bar, section heading, work row, course row, top bar

## Status

In progress, branch `home-parts` (base `design`).

## Information

**Why.** Home is the first view (S12 in `ideas/screens-grill.md`). With button, text
link, tag and tooltip landed, these five units are what Home still needs. Home itself
is the next change.

**Decisions.** Jack's, from a short grill on 2026-10-13. Prior art: Primer's
ProgressBar page ("Default to pairing the ProgressBar with text that explicitly shows
the value(s)"), read that day; Google Classroom's home shows up to five upcoming
assignments. Each unit's decisions go into its `spec.ts`; the questions and answers
below go word for word into each unit's `log.md` (the ones that concern it) and into
`ideas/screens-grill.md`'s log.

| Id              | Unit         | Decision                                                                                                                                      | Why                                                   | Beat                                                        |
| --------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| progress-bar-d1 | progress bar | A segment per problem, done ones in blue, always with "2 of 6" beside it; above 12 problems, one continuous bar                               | Primer: pair a progress bar with its value in text    | One continuous bar; the count alone                         |
| work-row-d1     | work row     | Home lists sets in progress, sorted by due date, plus any set due within 2 days even if not started                                           | Jack; nothing urgent can hide                         | Up to 5 dated sets; only started sets (first said)          |
| work-row-d2     | work row     | A row shows the set, its course, its progress, the time left when known, and when it is due; a set due within 2 days carries an attention tag | Everything needed to pick tonight's work              | Without the course; without the time                        |
| work-row-d3     | work row     | The whole row opens the set in the workspace                                                                                                  | The work comes first                                  | Two small links                                             |
| work-row-d4     | work row     | At most five rows, then a "Show all" link                                                                                                     | Home stays short                                      | All of them; three                                          |
| course-row-d1   | course row   | A row shows the course's name, its materials count and its sets count, and the whole row opens the course and only the course                 | Jack: "the row opens the course, and just the course" | The row opens the current set; unfinished sets and next due |
| top-bar-d1      | top bar      | The wordmark (goes Home), where you are as a path of links, and Settings at the right; nothing else until a screen needs it                   | Enough to know where you are and go up                | An activity indicator; wordmark and Settings only           |

S2 in `ideas/screens-grill.md` is reversed (Jack confirmed it as an explicit reversal):
Home is now an "In progress" list of sets, then a list of courses, with no Continue
band.

Log (verbatim; options in order, recommended first):

- Progress bar: how does it show how far a set is done? A segment per problem, with
  '2 of 6' beside it (Recommended) / One continuous bar, with the count / Just the
  count, no bar. **A segment per problem, with '2 of 6' beside it (Recommended).**
- Course row on Home: what is clickable? The row opens the set; the course name opens
  the course (Recommended) / The row opens the course / Nothing but two links. **"the
  row opens the course, and just the course, but there will be a list of the few that
  are due soon"**
- Course row: which columns? Course, current set, progress, due (Recommended) / Add
  the materials count / Course and due only. **"depends if its the due soon list or
  the course list"**
- The Continue band at the top of Home: what does it show when no set is in progress?
  The next set due, as 'Start' (Recommended) / It disappears / Always 'Continue'.
  **"does not exist with the list of soonly due assignments"**
- This reverses S2. Reverse S2? Yes, reverse it (Recommended) / No, keep S2. **Yes,
  reverse it (Recommended).**
- Which sets appear under 'Due soon'? Up to 5 unfinished sets with a due date, nearest
  first (Recommended) / Also sets in progress without a date / Everything unfinished,
  no cap. **"Lets have it be an in progress instead, sorted by due date, with the chip
  for due soon"**
- A 'Due soon' row shows: Set, course, progress, due (Recommended) / Set, progress,
  due / Add a time estimate. **Add a time estimate.**
- A course row shows: Name, unfinished sets, next due (Recommended) / Name only / Name,
  materials, sets. **Name, materials, sets.**
- One push back: keep it to started sets? Started sets, plus any due within 2 days /
  Keep it to started sets. **Started sets, plus any due within 2 days.**
- How many rows can the list hold? Five, then a 'Show all' link (Recommended) / All of
  them / Three. **Five, then a 'Show all' link (Recommended).**
- The top bar on every screen? Wordmark, where you are, Settings (Recommended) / Add an
  activity indicator / Wordmark and Settings only. **Wordmark, where you are, Settings
  (Recommended).**

Assumed (mine, to flag to Jack): the attention tag reads "Due Fri" (the day), not the
words "Due soon"; a set with no date sorts after dated ones and shows "No date"; the
time left shows only when PSet knows it (`honest-waits`); the sizes and widths below.

### Files

Units under `web/src/units/`, each with `index.tsx`, `spec.ts`, `examples.tsx`,
`log.md`, drawn only with the `ds` tokens and the existing units (Tag, Text link,
Tooltip where useful). Sentence case everywhere. No accessibility work beyond what is
free (Jack's standing instruction). Each spec lists its components (the units it
imports), states, a stress state, actions with targets, priority, sizes, cited rules
and decisions.

- `progress-bar/`: props `done`, `total`. Up to 12: one segment per problem, 12 wide,
  4 high, 2 apart, 2 radius; done in `accent`, the rest in `border`; when every
  problem is done, all segments in `fg-muted`. Above 12: one bar 72 wide, 4 high, the
  done share in `accent`. Then 8 apart, the count "2 of 6" in the `small` step,
  `fg-muted`, tabular numbers. States: none done, some done, all done, one problem,
  twelve, thirty. Stress: thirty problems in a 96px container (the count stays whole;
  the bar shrinks).
- `section-heading/`: props `children` (the title), `count?`, `action?` (a Text link,
  for example "Show all"). The `heading` step (Source Serif 4, 22/28, 500) on the left;
  count and action on the right in `small` `fg-muted`; a 1px `fg` rule 8 below the
  text. It carries no outer margin; its parent applies `room-for-big-type`. States:
  plain, with count, with action, with both. Stress: a 60 character title in 240px
  (wraps; the right side stays on the first line).
- `work-row/`: props: `set` (name), `course` (name), `done`, `total`, `minutesLeft?`,
  `due?` (a date), `href`. One link row, 56 high, 16 sides, a 1px `border-muted` rule
  below. Columns on a fixed grid so rows align down the list: left, flexible, the set
  name (body, 500, `fg`) over the course name (small, `fg-muted`); progress bar, 140
  wide; time left ("About 1 h 10 m left", small, `fg-muted`), 140 wide, empty when
  unknown; due, 104 wide, right-aligned: within 2 days an attention Tag with a clock
  glyph and the day ("Due Fri"), otherwise plain small `fg-muted` text ("Due Mon 20"),
  no date "No date". Hover: the `hover` ground. Narrowest 360: the time column goes
  first, then the progress count. States: in progress with time, in progress without
  time, due soon not started (0 of 6), no date, finished today if relevant (skip if
  not), and a list of five with "Show all" shown through Section heading in the
  examples. Stress: a 70 character set name and a 50 character course name at 360.
  Action `open-set` (target: the workspace, which is not a unit yet: leave the target
  out and say so in the action's text).
- `course-row/`: props `name`, `materials`, `sets`, `href`. One link row, 44 high, 16
  sides, rule below; name (body, 500) flexible; "7 materials" and "3 sets" in small
  `fg-muted`, 120 wide each, right-aligned, singular when one. Hover ground as above.
  States: typical, one material and one set, empty course ("No materials", "No
  sets"). Stress: a 70 character course name at 320. Action `open-course` (target: the
  course screen, not a unit yet: as above).
- `top-bar/`: props `path` (a list of `{label, href?}`; the last item is where you are
  and is not a link), `settingsHref`. 56 high, `bg`, a 1px `border-muted` rule below,
  40 sides, sticky at the top. Left: the wordmark "PSet" in Source Serif 4, 20, 500,
  `fg`, a link to Home; then, when `path` is not empty, each item after a "/" in
  `fg-muted`, items as standalone Text links in `fg-muted` and the last in `fg`.
  Right: "Settings" as a standalone Text link. States: Home (no path), course (one
  item), workspace (course / set). Stress: a 70 character course and a 70 character
  set at 1024 wide (the path truncates from the middle items first; the wordmark and
  Settings never move).
- `web/src/design/rules.ts`: nothing new unless a rule is clearly general (say if you
  add one; prefer local rules).
- `ideas/screens-grill.md`: mark S2 reopened and add S13 (Home is an "In progress"
  list then a course list, no Continue band) with why and beat, and the log above.
  Update its artifact table's Home row.
- `design/design-docs.md`: "The first units" lists the nine units.
- `ideas/README.md`: this file's row.

### Steps

1. Commit this plan and the screens amendment.
2. Progress bar. 3. Section heading. 4. Work row. 5. Course row. 6. Top bar.
3. Docs, Status.

### Tests

- `make check`.
- A behaviour test per unit for what jsdom can show (segment count and the switch to
  a continuous bar above 12; the due tag only within 2 days, with a fixed "today";
  "No date"; singular counts; the last path item is not a link).
- In a real browser, at 1280 and at each unit's narrowest: every state and the stress
  state stay inside their outlined container; rows align down a list of five.

### Acceptance

The Components tab lists nine units. Each new page shows its states live, its spec,
and its decisions with the log. A list of five work rows and three course rows in the
examples align column by column. `make check` passes.

### Out of scope

Home itself, the course screen, the workspace, data from the backend, an activity
indicator.

If a decision is missing or two conflict, stop and report; do not guess.
