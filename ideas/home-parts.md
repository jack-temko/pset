# Home's parts: progress bar, section heading, set line, course row, top bar

## Status

Built, branch `home-parts` (base `design`); awaiting Jack's try. Done when merged.

## Information

**Why.** Home is the first view (S12 in `ideas/screens-grill.md`). With button, text
link, tag and tooltip landed, these five units are what Home still needs. Amended the same day (see "Amendment"): the work row became the set line, inside a course row, and Home is one list. Home itself
is the next change.

**Decisions.** Jack's, from a short grill on 2026-10-13. Prior art: Primer's
ProgressBar page ("Default to pairing the ProgressBar with text that explicitly shows
the value(s)"), read that day; Google Classroom's home shows up to five upcoming
assignments. Each unit's decisions go into its `spec.ts`; the questions and answers
below go word for word into each unit's `log.md` (the ones that concern it) and into
`ideas/screens-grill.md`'s log.

| Id              | Unit         | Decision                                                                                                                                                                      | Why                                                                        | Beat                                                       |
| --------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| progress-bar-d1 | progress bar | A segment per problem, done ones in blue, always with "2 of 6" beside it; above 12 problems, one continuous bar                                                               | Primer: pair a progress bar with its value in text                         | One continuous bar; the count alone                        |
| set-line-d1     | set line     | A set is active if it is in progress, or due within 2 days even if not started (was work-row-d1)                                                                              | Jack; nothing urgent can hide                                              | Up to 5 dated sets; only started sets (first said)         |
| set-line-d2     | set line     | A line shows the set, its progress, the time left when known, and when it is due; a set due within 2 days carries an attention tag; no course name                            | Everything needed to pick tonight's work; the course is the row it sits in | Without the time; with the course name                     |
| set-line-d3     | set line     | The whole line opens the set in the workspace                                                                                                                                 | The work comes first                                                       | Two small links                                            |
| course-row-d1   | course row   | A course row shows the course's name (opens the course), its materials and sets counts, and its active sets, each opening its set                                             | Usually one active set per course, so one list names each course once      | A list of sets in progress plus a separate list of courses |
| course-row-d2   | course row   | Home sorts courses by their nearest active due date, then courses with no dated active set, then courses with nothing active; at most five, then "Show all" (was work-row-d4) | Home stays short; the most urgent course first                             | All of them; three                                         |
| progress-bar-d2 | progress bar | When narrow, keep the count and shrink the bar: segments narrow to 4px, then one continuous bar; the bar adapts to its own width (2026-10-14)                                 | Jack: the count always shows                                               | Hide the count when narrow; drop the bar                   |
| set-line-d4     | set line     | A set past its due date shows a red "Overdue" tag with an alert glyph (2026-10-14)                                                                                            | Jack: overdue must not look like a day this week                           | "Overdue Sat" in amber; same as due soon                   |
| set-line-d5     | set line     | A due date is a weekday within 6 days, then month and day ("Due Oct 20"); the attention tag still applies within 2 days (2026-10-14)                                          | Jack                                                                       | Always month and day; as built                             |
| tag-d3          | tag          | A third tone, danger, for overdue work (2026-10-14)                                                                                                                           | Jack: overdue must not look like a day this week                           | Amber for overdue                                          |
| link-d3         | text link    | A link has a tone (accent, text colour, muted) and a weight; settled afterwards, not asked: course names in blue made the list loud (2026-10-14)                              | The orchestrator's                                                         | Every standalone link in the accent colour                 |
| top-bar-d1      | top bar      | The wordmark (goes Home), where you are as a path of links, and Settings at the right; nothing else until a screen needs it                                                   | Enough to know where you are and go up                                     | An activity indicator; wordmark and Settings only          |

S2 in `ideas/screens-grill.md` is reversed (Jack confirmed it as an explicit reversal):
Home was to be an "In progress" list of sets, then a list of courses, with no Continue
band. That two-list version was a step in between: see "Amendment".

**Amendment (Jack, 2026-10-13, mid-build).** "Something to note about my own usage. I
most often only ever have one active assignment in each course." Home is ONE list: the
courses, each holding its active sets (S13 replaces S2). The `work-row` unit became
`set-line`, one active set inside a course row.

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

- Amendment: with usually one active set per course, Home's two lists will mostly name
  the same courses twice. Keep both lists? One list: a course row that holds its
  active set (Recommended) / Keep both lists, as decided / Only the 'In progress'
  list. **One list: a course row that holds its active set (Recommended).**
  (Jack first said: **"Something to note about my own usage. I most often only ever
  have one active assignment in each course."**)

- When a set line is narrow, what gives way? You decided the count '2 of 6' always shows
  beside the bar. Keep the count, shrink the bar (Recommended) / Hide the count when
  narrow / Drop the bar, keep the count. **Keep the count, shrink the bar
  (Recommended).** (2026-10-14)
- A set past its due date: how is that shown? 'Overdue' in red (Recommended) / 'Overdue
  Sat' in amber / Same as due soon. **'Overdue' in red (Recommended).** (2026-10-14)
- How far-off dates are written: Weekday within 6 days, then month and day
  (Recommended) / Always month and day / As built. **Weekday within 6 days, then month
  and day (Recommended).** (2026-10-14)

- Course row: how tight? (2026-10-14, Jack on his phone: **"Unfortunately the course row looks absolutely horrible. More GitHub-ey And it has components that don't exist. We need to package as tightly as possible, this will be used in the window pane for sets likely too."**) "Components that don't exist" means: **Parts drawn by hand, not from units.** How tight is a course row? Two lines, GitHub issue style (Recommended) / One line / Show me both. **Two lines, GitHub issue style (Recommended).**
- The heading (2026-10-14): Jack: **"The heading is bad too. I want to be more similar to my old design."**

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
- `set-line/` (was `work-row/`): props: `set` (name), `done`, `total`, `minutesLeft?`,
  `due?` (a date), `href`, `today?`. One link line, 40 high, 12 sides, no rule of its
  own. Columns on a fixed grid so lines align down the page: the set name (body, 500,
  `fg`) flexible; progress bar with its count, 140 wide; time left ("About 1 h 10 m
  left", small, `fg-muted`), 140 wide, empty when unknown; due, 104 wide,
  right-aligned: within 2 days an attention Tag with a clock glyph and the day ("Due
  Fri"), otherwise plain small `fg-muted` text ("Due Mon 20"), no date "No date".
  Hover: the `hover` ground. Narrower, the time column goes first (below 600), then the
  progress count (below 440). States: in progress with time, in progress without time,
  due soon not started (0 of 6), no date. Stress: a 70 character set name at 360.
  Action `open-set` (target: the workspace, not a unit yet: leave the target out and
  say so in the action's text).
- `course-row/`: props `name`, `materials`, `sets`, `href`, `active` (a list of set
  lines' props), `today?`. A block with a 1px `border-muted` rule below. Left: the
  course name (body, 500) as a link that opens the course, with "7 materials, 3 sets"
  under it in small `fg-muted` (singular when one; "No materials", "No sets"). Right:
  its active sets as stacked set lines (usually one); with none, one muted line
  "Nothing active" where the set line would be. Below 920 wide the right side stacks
  under the left. The name link and each set line are separate links; no link wraps
  another. Home's sort (nearest active due date, then dated-less, then nothing active)
  and the cap of five with "Show all" are Home's, shown in the examples' list.
  States: one active set due soon, one with no date, two active sets, nothing active,
  an empty course, and a list of five that align column by column under a Section
  heading. Stress: a 70 character course name and a 70 character set name at 480.
  Action `open-course` (target not a unit yet), and the set lines' `open-set`.
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
2. Progress bar. 3. Section heading. 4. Set line (first built as the work row). 5. Course row. 6. Top bar.
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
and its decisions with the log. A list of five course rows in the examples aligns column by column. `make check` passes.

### Out of scope

Home itself, the course screen, the workspace, data from the backend, an activity
indicator.

If a decision is missing or two conflict, stop and report; do not guess.

### Review fixes (2026-10-14)

Type steps moved into a cascade layer below Tailwind's utilities, so a utility such as
`font-medium` wins and no `!` override remains. Text link gained `tone`, `weight` and
`size`. Tag gained `danger`. The tokens gained `--ds-radius-segment`, `--ds-topbar` and a
`brand` type step (Source Serif 4, 20/28, 500, the wordmark only). The spec format gained
an optional `exampleWidth`, which the design page's stage uses to open each unit at a
width that suits it. The top bar takes `homeHref` and draws its wordmark and path
through Text link. A due date is a local calendar date; `parseDueDate` builds one.

### Round of 2026-10-14, after Jack's phone

New units: `counter`, `list` (the old Box), `list-row` (the GitHub issue row). `course-row`
and `set-line` are compositions of `list-row`. `section-heading` follows the old Home's
SectionHeader. Proposed, to confirm (`course-row-d3`): the course row no longer shows the
materials and sets counts, reversing Jack's earlier "Name, materials, sets".

### Round of 2026-10-16, Jack on the course list (Agentation)

Three fixes, from `/design/component/course-row?state=list`.

- **The due date is always shown, badges are labels.** Jack: "These look weird because
  it replaces the original text. Can we try to always have the due date, but have badges
  for overdue and due soon? Where is a good place to put them?" Then: "With the date
  always shown, where does the 'Due soon' or 'Overdue' badge go?" Options: After the
  course name, like a GitHub label (Recommended) / Just before the date, on the right /
  In the grey line, after the set name. **After the course name, like a GitHub label
  (Recommended).** So `list-row` gains a `label` slot after the title, the status is
  always the plain date, and `set-line` and `course-row` pass the badge ("Due soon" with
  the clock within 2 days, "Overdue" with the alert glyph when past) as the label. New
  decisions `set-line-d7` and `course-row-d7`, `list-row-d6`, superseding the badge in
  place of the date (`set-line-d2`, `d4`).
- **A fixed bar position.** Jack: "Can we make sure that the progress bar and this text
  are in the same location for every row/ The length of the numbers affects the offset of
  the bar." The count sits in a box as wide as "99 of 99", right-aligned
  (`progress-bar-d6`).
- **The hover target.** Jack, on the course name "Linear algebra" and the "Nothing
  active" line: "The hover target for these links should not expand across the entire
  row, just cover the text." The row takes no hover ground and a title link is as wide as
  its text (`list-row-d7`, superseding the whole-row wash in `list-row-d1`).
- **GitHub-style badges.** Jack: "Can we make them look more like GitHubs badges?" The
  Tag is restyled in every tone as an outlined pill (`tag-d4`, superseding `tag-d1`), with
  a new `label` type step (12/18, 500, tags only).
- **Materials and sets as stats.** Jack, on "The course row no longer shows '7 materials, 3 sets' (they would move to the course screen). Is that OK?" Options: Yes, drop them from the row (Recommended) / Keep them in the grey line. His answer: **"Can we display this with some muted icons and digits somewhere? Kinda how github does the line diffs"** The list row gains a `stats` slot and the course row
  passes materials (`FileText`) and sets (`ListChecks`) (`list-row-d8`, `course-row-d8`,
  superseding `course-row-d3`).
  Jack, on where they go: **"have them be to the right of the course name"**: the stats sit on line one, after the course name and before the label.
  Jack, on which counts and where: **"drop the material count, leave the set count, move it to be on the set line, after everthing, separated by the dot"**: no materials count; the sets count is the last item of the set line, as a
  `MetaStat` in the list row's meta (`course-row-d9`, superseding `course-row-d8`; the
  `stats` slot is gone).
  Jack, next: **"Don't show "No active set" or whatever if there is none, just empty. And drop the dot it looks weird with the icon"**: a course with nothing active shows no words, and a stat follows after a gap, not
  a dot (`course-row-d10`).

### Home reshaped into two lists (2026-10-16)

Jack, reshaping Home (2026-10-16): **"I want to separate them, sorry for making this hard on you. I want two lists on my home screen, plus some info on top (e.g. github style heatmap for work, stat tile, big greeting, this will be done later). The two lists are for assignments and courses. The assignment list will display recently opened, and due soon. With a limit and gate to show more. Due soon at the top. The courses list with just show courses. First from a students perspective, what should be show on each of these two types of list items? Then we will design them."**

Then four answers:

- "This reverses S13 (written 2026-10-14: Home is one list of courses, each holding its active set). New Home: info on top (later), then an assignments list, then a courses list. Reverse S13?" Yes, reverse it (Recommended) / No, keep one list. **Yes, reverse it (Recommended).**
- "Which extras does an assignment item show, beyond name, course, due, progress and time left? Pick any." Last opened / Next problem / Neither. **Last opened.**
- "What does a course item show besides its name?" Sets still to do, as a muted count (Recommended) / Name only / Sets and materials counts. **Sets still to do, as a muted count (Recommended).**
- "Which assignments are in the list, and how many before 'Show all'?" Due within 7 days or opened in the last 7, cap 5 (Recommended) / Every unfinished set, cap 5 / Due within 7 days or opened in the last 7, cap 3. **Due within 7 days or opened in the last 7, cap 5 (Recommended).**

Built as a first version for Jack to react to: new unit `assignment-row`, a lean one-line `course-row` (a `single` mode on `list-row`), `S14` in `ideas/screens-grill.md`, and a Home example on both pages.
