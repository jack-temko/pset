# Courses: the program

The central file for the courses redesign. Every agent working on it, in any
harness, reads this first and leaves it true when it stops. It says where the
work stands; the decisions themselves are in `ideas/courses-grill.md`.

## Status

**In progress.** Track 0 (the spec and this tracker) is in review on the
`courses-spec` branch. Nothing is built.

## Information

### What it is

The course replaces the textbook as the centre of PSet. A course holds
materials (textbooks, slides, assignment sheets, past exams) and the work done
on them (homework, later exam prep). Every job reads all of the course's
materials. Work happens in a dock of panes, with Ask as a floating dialog.
The words are fixed in the grill's Glossary: use them, in code and on screen.

### Rules for agents

- Read the Summary of `ideas/courses-grill.md` before deciding anything. Do
  not decide again what is there. What is not there is Jack's to decide: send
  it back to the orchestrator, who asks him.
- The work lands on the integration branch `courses`, not `dev`. A track is
  one `/change`: its own branch and worktree from `origin/courses`
  (`git worktree add ../pset-<topic> -b <topic> origin/courses`), `make
  check`, a pull request with `--base courses`, and Jack's approval before it
  merges. Everything else in `AGENTS.md` holds.
- The truth is the copy on `courses`:
  `git fetch origin courses && git show origin/courses:ideas/courses.md`.
- Take only a track whose "Needs" tracks are Done. The orchestrator puts your
  branch on its row when you start and the pull request when it opens.
- Leave the row true when you stop: its status, and a note of anything the
  next agent must know that the code does not say.
- Anything that needs Jack goes under "Waiting on Jack", with the question.
- A view track is a `pset-view` run (`redesign`, or `extract` for a view
  still inside its screen): it grills Jack on that view's layout first, builds
  it on `/views` from real components on sample data, and puts new or changed
  components on `/components`.

### Milestones

| #   | Milestone                       | Reached when                                                                                     | Status      |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------ | ----------- |
| 0   | The spec                        | Track 0 is merged into `courses`                                                                 | In progress |
| A   | The course app on sample data   | Tracks 1 to 7: every screen can be clicked through on the real routes, with no backend behind it | Not started |
| 1   | The course app works end to end | Tracks 8 to 13, then `courses` goes into `dev` (Jack)                                            | Not started |
| 2   | What waited                     | Tracks 14 to 17                                                                                  | Not started |
| 3   | Exam prep                       | Its own grill first (D9)                                                                         | Not started |

### Tracks

One track is one pull request into `courses`. Statuses: Not started, In
progress, In review (pull request open), Waiting on Jack, Done, Dropped.
"Try" is what Jack does to approve it.

**Mocks (milestone A).** Tracks 1, 4, 5 and 6 can run side by side; each
needs Jack for its layout grill, so his time sets the pace.

| #   | Track               | What it does                                                                                                                                                                  | Needs  | Try                                                         | Status      | Branch and pull request |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------- | ----------- | ----------------------- |
| 0   | Spec and tracker    | The grill, this file, the `courses` branch and its line in `AGENTS.md`                                                                                                        | none   | Read the grill's Summary                                    | In review   | `courses-spec`          |
| 1   | The dock            | Dock, Pane and pane tabs as components; split, resize, close; the contract a view meets (its tab, what it declares for selection). On `/views` with stand-in views            | 0      | Open, split, switch tabs, resize and close on `/views`      | Not started |                         |
| 2   | Material views      | Scan and Rail leave the page code as components. The textbook view (pages and contents) and the plain view for slides, a sheet and an exam, each in a pane                    | 1      | Read each kind in a pane, Paper and Night                   | Not started |                         |
| 3   | The set view        | The homework view that exists on `/views`, fitted to a pane, with a set beside its material and links that open in the other pane                                             | 1, 2   | Work a problem beside its page                              | Not started |                         |
| 4   | The Ask dialog      | AskTab leaves the page code. Ask as a floating dialog: closed, open, expanded; the tag of a page selection on a message                                                       | 0      | Open it over any mock screen, expand it, read a long answer | Not started |                         |
| 5   | The course overview | Materials with their kind and state, adding one (the kind is picked), changing a kind, removing; the sets; the empty course                                                   | 0      | Add, re-kind and remove a material on sample data           | Not started |                         |
| 6   | Home                | Tonight first, this week, the courses, a new course. A `design/` file for Home, which has none                                                                                | 0      | Find tonight's set in one click                             | Not started |                         |
| 7   | The screens joined  | The real routes (`/`, `/courses/:id`, `/courses/:id/workspace`) show the new screens over one sample data file, the contract for the backend. The book pages leave the routes | 1 to 6 | Click the four main flows end to end                        | Not started |                         |

**Build (milestone 1).** Each track replaces sample data with the real thing
for its part. Track 8 is first; 10, 11 and 12 can run side by side after 9.

| #   | Track                  | What it does                                                                                                                                                                                                                                                   | Needs    | Try                                                              | Status      | Branch and pull request |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------- | ----------- | ----------------------- |
| 8   | Courses and materials  | One baseline schema; the old data folder set aside (D25). Courses; the abstract document and the kind on top (D31); import for each kind; changing a kind; removing. Home's courses, the overview and the material views read the API. `make seed` for courses | 7        | Make a course, add a textbook and slides, read them, re-kind one | Not started |                         |
| 9   | Search across a course | Search and the agent's tools take a course; every result names its material and page (D32)                                                                                                                                                                     | 8        | No screen: approved on its tests                                 | Not started |                         |
| 10  | Homework in a course   | Sets belong to a course; the sheet is kept as a material (D7); a problem is found in any material (D6); guides read everything and name it (D5); removal keeps the work (D29). The set view and Home's Tonight read the API                                    | 9        | Import a sheet, work a problem, see a step cite the slides       | Not started |                         |
| 11  | Ask in a course        | One conversation per course (D17); the tools read every material; a page selection from any kind of material. The dialog reads the API                                                                                                                         | 9        | Ask across the textbook and the slides, follow a citation        | Not started |                         |
| 12  | What the course owns   | Memory, study time, cost, errors and events keyed by the course; this week on Home                                                                                                                                                                             | 8        | Memory and usage dialogs, this week on Home                      | Not started |                         |
| 13  | Clearing out           | The book-centred code and the leftover sample data removed; the test library rebuilt for courses; `design/` rewritten (workspace, backend, import, memory, Home). Jack's scanned textbook carried over (A14)                                                   | 10 to 12 | A full evening's use, then `courses` into `dev`                  | Not started |                         |

**What waited (milestone 2)**, each its own track after milestone 1:

| #   | Track                   | What it does                                                                                | Needs | Status      | Branch and pull request |
| --- | ----------------------- | ------------------------------------------------------------------------------------------- | ----- | ----------- | ----------------------- |
| 14  | Rearranging the dock    | Moving and swapping panes by hand                                                           | 13    | Not started |                         |
| 15  | Selection in every view | Each view's own selection (a step of a guide, a problem), its feed to Ask and its tag (D22) | 13    | Not started |                         |
| 16  | Guessing the kind       | Drop many files; PSet proposes each kind and the student confirms (D26)                     | 13    | Not started |                         |
| 17  | Exam prep's place       | The page and its door on the overview, empty until its grill                                | 13    | Not started |                         |

Tracks 8, 9 and 12 touch the database and the wire types, so they are on the
risk list: planned at least, with a second review.

### Waiting on Jack

- His approval of track 0's pull request.

### Other work touching the same screens

Not part of this program. It lands on `dev` as usual and reaches `courses`
when `courses` takes `dev` in: PR #35 `loading-screens` (open), PR #30
`jumps-guard` (draft), and the `selection-entry-options` and
`haiku-usability` worktrees.

### Log

- 2026-10-11: Jack started the program. The earlier class-rewrite grill
  (untracked, in the `class-rewrite` worktree) was superseded by
  `ideas/courses-grill.md`. Six batches; the spec and the tracks written and
  shown to him.
