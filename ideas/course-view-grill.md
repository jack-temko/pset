# Course view: reverse grill

- status: approved (Jack answered every question on 2026-10-30; the build follows his answers)
- date: 2026-10-22
- brief: the course screen (`/courses/:id`), judged from a student checking on one course: what is due, what material it has, and how it is going. A reverse grill: Claude wrote the questions and picked every answer; Jack answered them and the build changes only where his answer differed
- sources:
  - `ideas/screens-grill.md` (S1, S3, S4, S8, S14, the screens table)
  - `origin/courses:ideas/courses-grill.md` (D1, D2, D4, D11, D12, D13, D18, D26, D27, D29, the glossary)
  - `ideas/home.md`, `ideas/home-info-grill.md` (Home's look: 1012 page width, outlined lists, section headings)
  - `ideas/workspace-grill.md`, `ideas/work-pane-grill.md` (say-it-once, the work pane's summary)
  - memory: one active set per course is the common case; desktop only
  - server today: no course exists on `dev` or `courses`; the book is the root (`internal/library`, `internal/homework`, `internal/memory`, `internal/usage`, `internal/activity`)

## Summary

### In one line

A course page shaped like Home: the course's name, one muted line of where it stands,
a stats box like Home's, then its Work and its Materials, each with its own Add, and
a small fold of what PSet remembers at the foot.

### Decisions (every one now confirmed by Jack; CHANGE marks where his answer differed from the pick)

| #   | Question                             | Decided                                                                                                                                                                                                                                  | Why                                                                  | Other options                                      |
| --- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------- |
| C1  | What sits at the top?                | CHANGE. The course name, the muted line ("1 set to do · next due Thu" or "Nothing due"), then a stats box like Home's: time studied (heatmap, this week's bars), questions and cost, with sparklines. Jack: "muted line + stats box"     | Answers "how is this course going" first, in Home's own look         | The name alone                                     |
| C2  | How wide, and where?                 | Home's page width (1012), centred, top bar path "Home / ECE 210". Confirmed by Jack: "same as home, we need to keep cross page uniformity where possible."                                                                               | One look across views                                                | Narrower (720)                                     |
| C3  | How is the Work list ordered?        | One "Work" list: to do first, by due date; finished sets folded under "Done (6)". Confirmed by Jack: "One list, Done folded (Recommended)"                                                                                               | One active set is the common case                                    | Two lists; newest first, no fold                   |
| C4  | What does a work row show?           | Home's Assignments row without the course name. Confirmed by Jack: "same as home, we need to keep cross page uniformity where possible."                                                                                                 | Reuse; the course is the page                                        | A bigger card per set                              |
| C5  | What does a material row show?       | Name, then muted kind and pages. Confirmed by Jack: "Name, kind, pages (Recommended)"                                                                                                                                                    | Enough to tell two materials apart                                   | Name only; a cover thumbnail                       |
| C6  | Where is Add, and what does it take? | CHANGE. No Add by the heading: an Add at the foot of the Work list (adds an assignment sheet) and one at the foot of Materials (adds materials). Jack: "An Add on each list". Dropping files on the page still adds (assumed, not asked) | The Add sits where its files will appear                             | One Add by the heading; two buttons by the heading |
| C7  | Course actions                       | The ... menu: Rename, Delete course. Confirmed by Jack: "In ... menus (Recommended)". Delete course is level three of friction-matches-loss: a dialog that counts what goes and asks for the course name (from G9)                       | Rare, so out of sight; wide and irreversible, so it asks most        | Buttons on the page; in Settings                   |
| C8  | Row actions                          | Each row's ... menu: work Open, Rename, Delete (with Undo); material Open, Rename, Remove. Confirmed by Jack: "In ... menus (Recommended)"                                                                                               | Same Menu as the work pane; undoable, so no confirm (level one)      | Hover buttons on the row                           |
| C9  | The footer (S4): what and how        | CHANGE. The quiet footer goes: time and cost live in the top stats box. Jack: "Stats box instead". "PSet remembers 8 things" stays as a small fold at the foot of the page (assumed, not asked)                                          | One place for figures                                                | A quiet "This course" section                      |
| C10 | A course with nothing in it          | CHANGE. Both lists stay, each with a one-line empty message and its Add; the stats box stays at the same height with "No study time yet". Jack: "Both empty lists, each with its Add"                                                    | The page keeps its shape, so nothing jumps when the first file lands | A centred invitation                               |
| C11 | A material still being read in       | Its row shows "Reading, about 2 min" where the pages go. Confirmed by Jack: "Row shows the wait (Recommended)"                                                                                                                           | Consistent with M10                                                  | Hidden until ready                                 |
| C12 | Exam prep door (courses grill)       | Not now; in `ideas/on-hold.md` (not asked, stays)                                                                                                                                                                                        | Work is problem sets only for now (S10)                              | A third list "Exam prep"                           |
| C13 | Loading                              | The Loaded standard: a skeleton that matches each section, revealed together (not asked, stays)                                                                                                                                          | No jumps                                                             | Spinner                                            |

### The artifact(s)

**Top to bottom**: top bar (path) · heading "ECE 210" with ... · muted "1 set to do · next due Thu" · stats box (heatmap and this week, as Home's) · Work (to do rows, "Done (6)" folded, Add) · Materials (rows, Add) · "PSet remembers 8 things" fold.

**States**: normal (one set to do, three materials, six done), nothing due, empty course (both lists empty), a material reading in, many (12 sets, 9 materials, long names), loading, failed to load.

### Assumed

Only what Jack was not asked: dropping files on the page still adds, the memories fold at the foot, the exam prep door and the loading. Also: sample data only, no server work (S12 order; course does not exist on the server yet).

### Open

- The server's course (the courses grill's model) is a separate change; this view is built on sample data.

## Reversals

None.

## Disagreements

None yet.

## Frontier

None: every question is answered.

## Log

Jack answered on 2026-10-30, in batches. His words, verbatim.

### Batch 1 (the top, the footer, the work list, Add)

- Top (C1): "muted line + stats box"
- Footer (C9): "Stats box instead"
- Work list (C3): "One list, Done folded (Recommended)"
- Add (C6): "An Add on each list"

### Batch 2 (rows, menus, the wait, the empty course)

- Material row (C5): "Name, kind, pages (Recommended)"
- Menus (C7, C8): "In ... menus (Recommended)"
- Reading in (C11): "Row shows the wait (Recommended)"
- Empty course (C10): "Both empty lists, each with its Add"

### Batch 3 (width and look)

- Width and look (C2, C4): "same as home, we need to keep cross page uniformity where possible."

### From the Settings grill (G9, the destructive actions)

Jack asked "how does github do this? I know they have two types of verisions, where one is the conformation box where you type the name of the repo. Whats the best option for destructive actions in pset? One type? more than one type?" and chose "Three levels (Recommended)": undoable at once with Undo; a small confirm beside the button that counts what goes; a dialog where the student types the name. Delete course is the third level (rule `friction-matches-loss`).
