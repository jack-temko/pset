# Course view: reverse grill

- status: assumed, awaiting Jack's answers
- date: 2026-10-22
- brief: the course screen (`/courses/:id`), judged from a student checking on one course: what is due, what material it has, and how it is going. A reverse grill: Claude wrote the questions and picked every answer; Jack answers them in the morning and the build changes only where his answer differs
- sources:
  - `ideas/screens-grill.md` (S1, S3, S4, S8, S14, the screens table)
  - `origin/courses:ideas/courses-grill.md` (D1, D2, D4, D11, D12, D13, D18, D26, D27, D29, the glossary)
  - `ideas/home.md`, `ideas/home-info-grill.md` (Home's look: 1012 page width, outlined lists, section headings)
  - `ideas/workspace-grill.md`, `ideas/work-pane-grill.md` (say-it-once, the work pane's summary)
  - memory: one active set per course is the common case; desktop only
  - server today: no course exists on `dev` or `courses`; the book is the root (`internal/library`, `internal/homework`, `internal/memory`, `internal/usage`, `internal/activity`)

## Summary

### In one line

A course page shaped like Home: the course's name and one line of where it stands,
then its Work, then its Materials, then a quiet footer of time, cost and what PSet
remembers, with one Add for any file.

### Decisions (all assumed; Jack confirms or changes each)

| #   | Question                                     | Picked                                                                                                                                         | Why                                                                     | Other options                                                   |
| --- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| C1  | What sits at the top?                        | The course name as the page heading, one muted line under it: "1 set to do · next due Thu" (or "Nothing due"), Add and a ... menu on the right | Answers "how is this course going" before any list                      | A stats box like Home's; the name alone                         |
| C2  | How wide, and where?                         | Home's page width (1012), centred, same top bar with the path "Home / ECE 210"                                                                | One look across views                                                   | Narrower (720) for a calmer page                                |
| C3  | How is the Work list ordered?                | One "Work" list: to do first, by due date; turned-in and finished sets fold under "Done (6)" at its foot                                       | One active set is the common case; old sets stay one click away        | Two lists (To do, Done); newest first, no fold                  |
| C4  | What does a work row show?                   | The same row as Home's Assignments (set line: name, due, progress, time left), minus the course name                                           | Reuse; the course is the page                                           | A bigger card per set                                           |
| C5  | What does a material row show?               | Name, then muted kind and pages: "Griffiths · Textbook · 640 pages"; opens the workspace on it alone (screens table)                          | Enough to tell two materials apart                                      | Name only; a cover thumbnail                                    |
| C6  | Where is Add, and what does it take?         | One Add button by the heading; it takes any file or several (D26) and PSet decides if it is work or a material. Dropping files on the page also adds | One door, no choosing first                                        | Two buttons (Add work, Add material); Add per list              |
| C7  | Course actions                               | The ... menu: Rename, Delete course (danger, a confirm that counts what goes)                                                                  | Rare, so out of sight                                                   | Buttons on the page; in Settings                                |
| C8  | Row actions                                  | Each row's ... menu: work: Open, Rename, Delete (with Undo). Material: Open, Rename, Remove (keeps the work, D29)                              | Same Menu as the work pane                                              | Hover buttons on the row                                        |
| C9  | The footer (S4): what and how                | A quiet "This course" section: time studied (total, and this week), cost so far, and "PSet remembers 8 things" which unfolds the list, each removable | S4; finding #5 asked for a cost total                             | Leave memory in Settings; a stats box like Home                 |
| C10 | A course with nothing in it                  | Centred "Nothing here yet", a line "Add a textbook, slides or an assignment sheet", and Add                                                    | One clear next step                                                     | Empty Work and Materials lists each with a hint                 |
| C11 | A material still being read in               | Its row shows "Reading, about 2 min" muted in place of the pages; it opens to the material pane's wait (M10)                                  | Consistent with M10                                                     | Hidden until ready                                              |
| C12 | Exam prep door (courses grill)                | Not now; added to `ideas/on-hold.md`                                                                                                          | Work is problem sets only for now (S10)                                 | A third list "Exam prep"                                        |
| C13 | Loading                                      | The Loaded standard: a skeleton that matches each section, revealed together                                                                  | No jumps                                                                | Spinner                                                         |

### The artifact(s)

**Top to bottom**: top bar (path) · heading "ECE 210" with Add and ... · muted "1 set to do · next due Thu" · Work (to do rows, then "Done (6)" folded) · Materials · This course (time, cost, remembers) .

**States**: normal (one set to do, three materials, six done), nothing due, empty course, a material reading in, many (12 sets, 9 materials, long names), loading, failed to load.

### Assumed

All of the above, until Jack answers. Also: sample data only, no server work (S12 order; course does not exist on the server yet).

### Open

- The server's course (the courses grill's model) is a separate change; this view is built on sample data.

## Reversals

None.

## Disagreements

None yet.

## Frontier

The thirteen questions above, to ask Jack in the morning in batches of four, my pick first.

## Log

No answers yet.
