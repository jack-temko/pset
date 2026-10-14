# Screens: grill

- status: approved
- date: 2026-10-13
- brief: which screens PSet needs, rethought from the job and the course (V10 in `ideas/vision-grill.md`), how a student moves between them, and what gets built first; judged from an ordinary student doing this week's work
- sources:
  - `web/src/pages/home/`, `web/src/pages/workspace/`, `web/src/pages/settings/`, `web/src/App.tsx` (today's three screens)
  - `origin/courses:ideas/courses-grill.md` and `origin/courses:ideas/courses.md` (evidence only: Jack is redoing that work)
  - `origin/dock:web/src/views/dock/spec.md` (the dock as built: two panes, the right one locked)
  - `ideas/vision-grill.md`, `ideas/theme-grill.md`, the rulebook
  - https://primer.style/components/page-layout (content with a side pane of at least 256px; a resizable pane remembers its width)
  - https://primer.style/product/components/underline-nav/guidelines/ ("Avoid more than 2 levels of tab hierarchy"; each tab has its own URL)
  - https://code.visualstudio.com/docs/editing/getting-started/userinterface (a second editor opens beside the first; tabs head each group; layout and open files are restored)
  - https://support.google.com/edu/classroom/answer/6020284 (due work grouped by status; home shows up to 5 upcoming across classes)
  - not read: Apple's split-view page returned no content

## Summary

### In one line

Three screens and Settings: Home lists courses with their current work, a course
shows its work then its materials, and the workspace is two sides with tabs where a
problem set sits beside its material.

### Decisions

| #   | Decision                                                                                                                                                                                                                                             | Why                                                                                                                    | Beat                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| S1  | Three levels: Home, course, workspace. Home's Continue and its work rows open the workspace directly; the course screen is for adding and seeing all                                                                                                 | `work-first`; two levels on the common path, as Primer advises                                                         | Home and workspace only; Home to course to work, in order      |
| S2  | Replaced by S13: Home was a list of courses, each showing its current work, under one Continue for the set in progress                                                                                                                               | The course stays the centre; nothing is listed twice                                                                   | Work due first, then courses; only what to do next             |
| S3  | The course screen shows work first, then materials, with one Add that takes any file                                                                                                                                                                 | Its main action is the current set                                                                                     | Materials first; tabs for Work, Materials, Details             |
| S4  | Memory, cost and study time are a quiet section at the foot of the course screen                                                                                                                                                                     | Out of the way, on the screen about the course                                                                         | A menu on the course; their own side in the workspace          |
| S5  | The workspace has two sides, both the student's: either can hold work, a material or Ask, and either can be swapped or closed                                                                                                                        | `student-decides`                                                                                                      | Work fixed on one side (the dock as built); three sides        |
| S6  | Each side has tabs                                                                                                                                                                                                                                   | Jack's choice: flipping between two materials is fast                                                                  | One thing a side with a picker (recommended); tabs on one side |
| S7  | On opening a set, PSet puts its material on the left at the current problem's page and the set on the right                                                                                                                                          | Nothing to set up                                                                                                      | Work alone until a page link; as the student left it           |
| S8  | Remembered: the arrangement and split per course; the problem per set and the page per material                                                                                                                                                      | `keep-the-place`                                                                                                       | The place only; everything in the address                      |
| S9  | Ask is a pane beside the work, usually opened from "Ask about this" with the problem attached                                                                                                                                                        | Asking serves the work; PSet is not a general chatbot                                                                  | A floating dialog (the courses spec); inline under the problem |
| S10 | Work is problem sets only, for now                                                                                                                                                                                                                   | One kind, designed well; it is the job                                                                                 | Also exam practice; also readings                              |
| S11 | A material has one kind, for now: a document with pages                                                                                                                                                                                              | Nothing to pick when adding; kinds come with a real difference                                                         | Four kinds (the courses spec); two kinds                       |
| S12 | Build order: Home (a view), then the workspace (the pane view), then the work pane (a pane). Then the spec format is locked                                                                                                                          | Home proves the view format cheaply                                                                                    | The workspace first; the work pane first                       |
| S13 | Home is one list of courses, each holding its active sets (in progress, or due within 2 days), sorted by the nearest due date, five then "Show all"; no Continue band. An intermediate version had an "In progress" list of sets above a course list | Jack, 2026-10-13: "I most often only ever have one active assignment in each course", so two lists name a course twice | The Continue band over a course list (S2); two lists           |

### The artifact(s)

**The screens**

| Screen    | Kind | Address             | Shows, top to bottom                                                                                                                | Main action          |
| --------- | ---- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Home      | view | `/`                 | an "In progress" list of sets (set, course, progress, time left, due), then a list of courses (name, materials, sets); Add a course | open a set           |
| Course    | view | `/courses/:id`      | the course's name; its work with progress and dates; its materials; Add; memory, cost and study time                                | open the current set |
| Workspace | view | `/courses/:id/work` | two sides, each with tabs: work, materials, Ask                                                                                     | the open set's own   |
| Settings  | view | `/settings`         | as today, redrawn later                                                                                                             | none                 |

**The panes** (what a side of the workspace can hold): the work pane (one problem set),
the material pane (a document's pages), the Ask pane.

**How a student moves.** Home: Continue or a work row opens the workspace on that
set; a course's name opens the course. Course: a set opens the workspace on it; a
material opens the workspace on it alone. Workspace: a page link in the work opens or
turns the material on the other side; "Ask about this" opens Ask on the other side
with the problem attached; the wordmark returns Home; the course's name returns to the
course.

**Components Home needs** (each gets its own short grill before it is built): top bar,
button, text link, course row, progress bar, tag, section heading, set line (the Continue band is gone, S13).

### Assumed

- A1: closing one side gives the other the full width; that replaces today's Focus.
- A2: a thing is open at most once across both sides; opening it again shows its tab.
- A3: each side is at least 360px wide; below a width where two do not fit, one side
  shows with a switch to the other.
- A4: printing a worksheet is an action in the work pane.
- A5: health, errors, updates, the key and appearance stay in Settings.
- A6: the addresses above; a set, a material and the page are in the workspace's
  query, so a link reproduces what was open.
- A7: the old screens keep running until each new one replaces it (D19 of the gallery
  docs grill); the backend still stores books, so courses, materials and work need
  their own backend change before a new screen reads real data. Until then new units
  run on typed sample data in `/design`.

### Open

- The backend for courses, materials and work: its own grill, before a new screen
  goes live.
- Exam practice and material kinds (S10, S11), when a real need shows.
- What Settings becomes.

## Reversals

- `origin/courses:ideas/courses-grill.md`, read as evidence: its D21 (Ask as a
  floating dialog), D18 (four kinds), D16 (tonight first on Home) and the dock's
  locked right pane are not carried over (S9, S11, S2, S5).

## Disagreements

- Switching: recommended one thing a side with a picker. Jack chose tabs on each side
  (S6).

## Frontier

Empty.

## Log

### Gate 0

Audit and prior art shown to Jack. No corrections.

### Batch 1, gate 1 (which screens)

- How many levels to reach the work? **Home, course, workspace, with a shortcut
  (Recommended).**
- What is Home mostly a list of? **Courses, each showing its current work
  (Recommended).**
- Where does asking live? **A pane beside the work (Recommended).**
- What does the course screen show? **Work, then materials, one add door
  (Recommended).**

### Batch 2, gate 2 (the working screen)

- Who controls what sits on each side? **Two sides, both the student's
  (Recommended).**
- How does a side switch between things? One thing a side, with a picker (Recommended)
  / Tabs on each side / Tabs on the reference side only. **Tabs on each side.**
- When a student opens a problem set? **Material left, work right, at the problem's
  page (Recommended).**
- What does the working screen remember? **The arrangement per course, the place per
  thing (Recommended).**

### Batch 3, gates 3 and 4

- Where do memory, cost and study time live? **A quiet section at the foot of the
  course screen (Recommended).**
- What counts as work in this first version? **Problem sets only (Recommended).**
- Do materials have kinds? **One kind for now (Recommended).**
- Which goes first? **Home, then the workspace, then the work pane (Recommended).**

### Home parts (2026-10-13, `ideas/home-parts.md`)

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
- Amendment, mid-build: with usually one active set per course, Home's two lists will
  mostly name the same courses twice. Keep both lists? One list: a course row that
  holds its active set (Recommended) / Keep both lists, as decided / Only the 'In
  progress' list. **One list: a course row that holds its active set (Recommended).**
  (Jack first said: **"Something to note about my own usage. I most often only ever
  have one active assignment in each course."**)
