# Courses: grill

- status: approved
- date: 2026-10-11
- brief: the architecture of a course-centred PSet (what a course holds, what homework, Ask and exam prep draw on, the screens and how you move between them), judged from the tired student's point of view. Layouts are not decided here: each view is mocked on `/views` afterwards
- tracker: `ideas/courses.md` is the program's central file (milestones, tracks, who has what)
- sources:
  - Explore report of 2026-10-11 22:00 (data model, import, how features get context, routes, web app, specs and work in flight, the test library)
  - The class-rewrite grill of earlier on 2026-10-11 (`ideas/class-rewrite-grill.md`, untracked in the `class-rewrite` worktree): superseded by this one at Jack's word (Q43). Its Gate 0 facts are reused below; its decisions are not carried
  - The overhaul decisions of 2026-09-17 to 2026-09-21 (`design/workspace.md`, `design/backend.md`)
  - `AGENTS.md`, `.agents/skills/grill`, `.agents/skills/pset-view`, `.agents/skills/change`

## Summary

### In one line

A course, not a textbook, is the centre of PSet: it holds the materials a student puts in and the work done on them, every job reads all of the course's materials, and the work happens in a dock of panes with Ask floating over it.

### Decisions

| #   | Decision                                                                                                                                                                                                            | Why                                                                    | Beat                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| D1  | The course is the main unit of organization, in place of the textbook                                                                                                                                               | The ask                                                                | The book as the centre                                   |
| D2  | A course holds materials of several kinds and the work done on them: homework, and an exam preparation center                                                                                                       | The ask                                                                | A textbook with things hung off it                       |
| D3  | Homework draws on every material, practice exams on the real exams put in, Ask on everything                                                                                                                        | The ask                                                                | Each feature reading one textbook                        |
| D11 | What the student puts in is a **material**: a document with pages that can be read, searched and cited. Each has a **kind**                                                                                         | Jack's word, and a professor's                                         | Sources; resources                                       |
| D12 | Homework and exam prep are not materials. They are **work**: problems the student works through. The assignment sheet is the material, the set made from it is the work                                             | Two words, each meaning one thing                                      | Everything being a material                              |
| D13 | What PSet writes has no umbrella noun. Each thing keeps its name and is marked **generated** where it could be taken for the real one                                                                               | Nothing new to learn                                                   | Artifacts; outputs                                       |
| D14 | **Context** is every material in the course, for every job, with nothing to choose. The kind decides what a job looks at first. Not a word on screen                                                                | Nothing to manage                                                      | Switching a material off; choosing per job               |
| D18 | Four kinds at first: textbook, slides, assignment sheet, past exam. Notes, posted solutions and an "other" kind wait                                                                                                | Jack's choice                                                          | Adding notes and a catch-all now                         |
| D31 | Underneath a material is an abstract imported document (pages, text, page images, search) that knows nothing of kinds. The kind is applied on top and can be changed later; only what the kind adds is done again   | A best guess with a clean way back                                     | Kind-specific imports                                    |
| D32 | Every piece of text PSet retrieves names the material and page it came from. Needed now for D5; later a knowledge space over the whole course builds on it, and is not built now                                    | Jack, in the tail                                                      | Results that name only a page                            |
| D27 | A material belongs to exactly one course. The same PDF may be added again to another course as its own copy                                                                                                         | Simple to explain and to remove                                        | Sharing between courses                                  |
| D26 | A material is added through one door on the overview: drop one PDF or many, PSet proposes each kind, the student confirms or corrects. Until milestone 2 the student picks the kind (D30)                           | A whole term's files in one go                                         | A section per kind with its own add                      |
| D5  | A homework guide reads every material and says which material each step came from                                                                                                                                   | The professor's method and notation                                    | Guides that read the textbook only                       |
| D6  | A problem can be found in any material, with the same page link, figure and boxing                                                                                                                                  | A slide's exercise is a problem too                                    | Problems only in a textbook                              |
| D7  | An uploaded assignment sheet is kept as a material. A problem written on it links to its place on the sheet                                                                                                         | Figures and boxing for problems not in a book                          | The sheet used up, as today                              |
| D28 | A course with several textbooks is not designed for now. A problem number is read against the course's textbook                                                                                                     | Jack does not expect it soon                                           | Working out or naming which textbook                     |
| D29 | Removing a material keeps the work. Problems lose their page link, figure and boxing, and say the material was removed                                                                                              | Tidying never costs finished work                                      | Removing its sets; refusing the removal                  |
| D8  | Sets that PSet writes from materials belong with exam prep, not homework                                                                                                                                            | "comes with the exam"                                                  | Generated sets as homework                               |
| D9  | What exam prep holds is held for later. This grill gives it a place and nothing more                                                                                                                                | "hold on this part for later"                                          | Deciding it now                                          |
| D16 | Home puts tonight first: what is due across all courses, and a due row opens that set directly in the workspace. The courses sit below                                                                              | One click to tonight's work                                            | Courses first; no Home                                   |
| D4  | Opening a course shows a course overview. Work opens from it                                                                                                                                                        | Jack's choice                                                          | Landing in the workspace                                 |
| D15 | The workspace is a **dock**: a display the student can arrange, where each thing is drawn in its own way. Split screen at first; other arrangements (2x1, 1x1) may come later                                       | Jack's design                                                          | One fixed workspace; a screen per job                    |
| D19 | One part of the dock is a **pane**. A pane holds tabs: the things opened there, one shown                                                                                                                           | Switching is one click                                                 | One thing per pane with a switcher                       |
| D20 | PSet arranges the dock when something is opened (a set opens beside the material its problems are in), and the student may then change it                                                                           | Nobody builds a layout to start work                                   | Building it by hand; fixed pairs                         |
| D21 | Ask is not in the dock. It is a floating dialog that can be expanded, reachable from anywhere in the course                                                                                                         | Jack's design: the split keeps the material and the work while you ask | Ask as a tab in a pane                                   |
| D17 | Ask is one running conversation per course                                                                                                                                                                          | Nothing to name or pick                                                | Named conversations; one per material                    |
| D22 | Asking about a selection reaches every view. Each view declares what can be selected, what the selection feeds to Ask, and how its tag on the message looks                                                         | Jack's design                                                          | Selection only on a textbook page                        |
| D25 | A clean slate: nothing is migrated. One new baseline schema, the old data folder set aside as a dated copy, and Jack imports again                                                                                  | No release has shipped                                                 | Wrapping each book in a course                           |
| D10 | The order: this grill, then the UI as mocks from the component library, then the backend and UI logic                                                                                                               | The ask                                                                | Building as the grill goes                               |
| D24 | The work lands on an integration branch, `courses`: every track is a pull request into it, tried and approved by Jack; `dev` stays the working app until a milestone. The tracker lives on `courses`                | One copy for every agent, `dev` never half built                       | Straight into `dev`                                      |
| D23 | The plan is split into tracks, one pull request each, staged so each can be tried and merged alone                                                                                                                  | Jack                                                                   | One large change                                         |
| D30 | Milestone 1 is the course app working end to end. Waiting for milestone 2: rearranging the dock, selection in every view (milestone 1 keeps a region of a page), guessing the kind, and exam prep's place           | Jack's choice, all four                                                | Shipping them together                                   |
| D33 | While the redesign iterates, `courses` runs fast checks only (format, lint, typecheck; `make check-fast`). The Go tests, vitest and the race run are off there until track 13 brings back the full `make check`     | Rapid iteration, and the rewrite upsets the tests                      | No checks at all; the full CI running but never blocking |
| D34 | A track into `courses` keeps three gates: Jack tries it and approves, one review, screenshots in both themes. The second review for risky tracks is dropped until milestone 1, and no ruleset is added on `courses` | Jack's choice                                                          | Keeping the second review                                |

### Glossary

Each word means one thing, in specs, in code and on screen.

| Word      | Means                                                                                              | Examples                                                   |
| --------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Course    | The container. Everything belongs to exactly one                                                   | Circuits II                                                |
| Material  | A document the student puts in. It has pages and can be read, searched and cited                   | A textbook, a slide deck, an assignment sheet, a past exam |
| Kind      | What sort of material it is. Applied to the document, and can be changed                           | Textbook, slides, sheet, exam                              |
| Work      | Something the student works through, made of problems                                              | A homework set, a practice exam                            |
| Problem   | One question inside a piece of work                                                                | Problem 3.4                                                |
| Guide     | What PSet writes for one problem                                                                   | Hint, approach, solution                                   |
| Generated | A mark on anything PSet wrote and the student did not add. An adjective, never a noun              | A generated practice exam                                  |
| Context   | What the tutor may read for a job: every material in the course, plus memory. Not a word on screen |                                                            |
| Workspace | The screen where work happens. Its display is the dock                                             |                                                            |
| Dock      | Panes the student can arrange. Split screen at first                                               |                                                            |
| Pane      | One part of the dock. It holds tabs and shows one                                                  | The left pane shows the textbook                           |
| View      | How one kind of thing is drawn in a pane. Each view is on `/views`                                 | The textbook view, the set view                            |
| Selection | Something in a view the student picks to ask about, shown as a tag on the message                  | A region of a page                                         |

Not used: sources, resources, artifacts, outputs, tile, panel, and book (say textbook, a kind of material).

### What reads what

| Job               | Reads                                                                                         | Writes                                           |
| ----------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Finding a problem | The textbook for a number, the sheet for a problem written on it, any material otherwise (D6) | The problem's page link and figure               |
| A homework guide  | The problem's own page first, then every material, and memory (D5)                            | A guide whose steps name their material and page |
| Ask               | Every material, memory, the last turns, and the selection if there is one (D14, D22)          | An answer that names its material and page       |
| Exam prep, later  | The past exams first (D3)                                                                     | Generated practice exams and sets (D8, D9)       |

### Screens

| Screen          | Route                    | Holds                                                                                                            |
| --------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Home            | `/`                      | Tonight (what is due across courses, a row opens its set in the workspace), this week, the courses, a new course |
| Course overview | `/courses/:id`           | The course's materials (add, kind, remove), its homework sets, the door to exam prep                             |
| Workspace       | `/courses/:id/workspace` | The dock: a material, a set, or a set beside its material. What is open is in the URL                            |
| Exam prep       | `/courses/:id/exam-prep` | Milestone 2: a place only                                                                                        |
| Settings        | `/settings`              | As today                                                                                                         |
| Ask             | none                     | A floating dialog on the course's screens                                                                        |

The main flows:

1. Tonight's homework: Home, the due row, and the set is open beside the material its problems are in. One click.
2. Start of term: Home, new course (a name), the empty overview, add materials and give each its kind, and a sheet becomes a set after its review.
3. Reading: the overview, a material, and it opens alone at full width.
4. Asking: the Ask dialog from any course screen. A selection becomes a tag on the message, and a page named in an answer opens that material at that page in the dock.

### States

- A new course: an empty overview whose first thing is adding a material. No sets.
- A course with no textbook: homework works from sheets and pasted problems; steps that need a textbook's page are skipped.
- A material being imported or failed: listed on the overview with its state, opened once ready.
- A wrong kind: changed on the material; only what the new kind adds is done again (D31).
- A material removed: the work stays, its links go (D29).
- The same PDF again: refused inside one course, allowed in another (D27).
- Two textbooks: can be added, not designed for (D28).
- The first start of the new build on an old library: the data folder is set aside as a dated copy and PSet starts empty (D25).
- The dock: one pane at full width when one thing is open; closing a pane gives the other the full width.

### Milestones and tracks

The tracks, their order and who has each are in `ideas/courses.md`. In short: milestone 0 is the spec; the mock tracks build each view on `/views` and end with the screens joined on sample data (milestone A, the course app on sample data); the build tracks then replace the sample data with the real backend one package at a time; milestone 1 takes `courses` into `dev`; milestone 2 adds the four things that wait (D30); milestone 3 is exam prep, after its own grill.

### Assumed

Taken at my recommendation because Jack did not decide. He overrules any.

- A1: `AskTab`, `Scan` and `Rail`, page code today, become components in the mock tracks that need them.
- A2: New Go code keeps the per-feature package shape (store, service, http, wire, `Migrations()`).
- A3: The word is "course", as in the ask.
- A4: Past exams are a kind of material from the start, though what exam prep does with them is later (D9).
- A5: The overview is its own page. The workspace is entered by opening a material or a set, from the overview or from Home.
- A6: A link in one pane opens in the other: a page named in a guide, or "Show in book", shows that material at that page beside it.
- A7: The split can be resized, and a pane can be closed.
- A8: The dock remembers its arrangement per course.
- A9: Ask belongs to a course, so the dialog is on the course's screens and not on Home or Settings.
- A10: "Selection", "tag" and "document" (the abstract import under a material) are my words; Jack has not confirmed them.
- A11: The course owns what the book owns today beyond its pages: memory, study time and cost.
- A12: A course is a name only, and removing it is the only way to put it away for now.
- A13: Adding a sheet starts today's assignment read, and its review makes the set. Pasting text, a link and making a set by hand stay.
- A14: Jack's scanned textbook is carried into its course once, by an agent with his go-ahead at that moment, so it is not read again. It is not a feature.
- A15: The orchestrator may commit changes to `ideas/courses.md` alone straight to `courses`, so a status never waits on a pull request. Everything else goes by pull request. Agents read `origin/courses:ideas/courses.md`. The file is formatted (`oxfmt`) before such a push, since nothing checks it before it lands, and the check that runs after the push turns `courses` red if it is badly formatted.
- A16: The mock phase ends with the new screens joined on the real routes over one sample data file, which is the contract the backend is built against, as in the September overhaul.
- A17: The exact URLs are the builder's, within the Screens table.
- A18: `courses` takes `dev` in through a pull request from a branch cut from `origin/courses` with `origin/dev` merged into it (`courses-take-dev`), not from `dev` itself, so a conflict can be fixed on that branch. It is merged into `courses` with a merge commit after Jack approves it. Other work in flight (jumps-guard) arrives as it lands on `dev`.
- A19: `courses` ends at milestone 1. The tracks of milestone 2 land on `dev` as ordinary changes.

### Open

- What exam prep holds (D9): its own grill, when Jack says.
- Each view's layout: its own `pset-view` grill in the mock tracks.
- How `courses` reaches `dev` at a milestone (a merge commit or a squash): Jack's, at the milestone. The `dev` ruleset allows only a squash, so a merge commit would need Jack's bypass or a ruleset change; since `courses` ends there (A19), a squash loses nothing but the track history on `dev`.
- Notes, posted solutions and an "other" kind (D18): after milestone 2.

## Reversals

- **"Structure is book-centric, three screens"** (Home, the book workspace at `/books/{id}`, Settings), locked 2026-09-17 in the overhaul grill and written into `design/workspace.md`. Reversed 2026-10-11 by Jack's ask, quoted in the Log. Each document is corrected when its part ships.
- **"One running conversation per book"** and the Ask tab in the panel (`design/workspace.md`, 2026-09-18). Reversed 2026-10-11 by D17 and D21: one conversation per course, in a floating dialog.
- **"A duplicate is refused by sha256"** (`design/import.md:8`, 2026-09-20). Reversed 2026-10-11 by D27: the same PDF is refused only inside one course.
- **"Every change lands on `dev`"** (`AGENTS.md`, since 2026-10-08). Amended 2026-10-11 by D24 for this program only: its tracks land on `courses`, under the same rules (a branch and worktree per track, `make check-fast` (D33), Jack's approval before a merge). `AGENTS.md` gets the line in the first pull request.

## Disagreements

None. On Q44 the recommendation was to land in the workspace; Jack chose the overview, and no push back was made, since a due row on Home still opens the set directly (D16). On Q65 the recommendation was Ask in a pane; Jack proposed the floating dialog, which is better, and it was taken (D21).

## Gate 0: what is true today

Gathered on 2026-10-11, first for the earlier grill and then for this one, and shown to Jack. He corrected no fact.

### True

- The book is the root. `books` owns pages, sections, embeddings, homework, turns, memories, assignment reads and study time, all by `book_id`. Home lists books only. A textbook and a book are the same row.
- Only a book has pages. `pages` holds one text per PDF page, with FTS5 and one vector per page (Ollama, `nomic-embed-text`), fused by reciprocal rank. Search is per book; there is no search across books.
- A homework document (an assignment read) is one text of up to 60,000 characters or a file blob of up to 20 MB. It has no pages, so it cannot be searched, cited or shown page by page.
- Ask is one conversation per book, keyed by the book so one answer runs at a time. Its tools search and read that book's pages. A turn links to nothing but the book.
- Guides and Ask answers are typed document blocks checked by the server, never markdown. The only export is the homework worksheet PDF.
- Reusable as they are: PDF upload and its staged, resumable import; per-book search and page lookup; the agent loop and its tools; document blocks and their stream parser; the job queue with lanes and keys; usage rows per subject; the event bus; generated wire types.
- On the web, shared: transcript, document blocks, math (KaTeX), Box and BoxRow, Door, Dialog, Menu, Loaded, ProgressBar, UnderlineNav. Views on `/views`: the homework panel and the error notice.
- The routes are `/`, `/books/:id`, `/books/:id/homework/:homework` and `/settings`. There is no sidebar.

### Looks wrong for this rewrite

- `AskTab`, `Scan` and `Rail` are page code in `web/src/pages/workspace/index.tsx`, not components.
- Every child table's foreign key is `book_id`, and the `Library` interface, the agent's `Book`, the Ask job key and the tutor's prompt all take a book.
- Closed lists a new owner must be added to by hand: `calls.subject_type` and `usage.ForBook`, the test-library strip list, the migration order in `cmd/pset/main.go`, `tygo.yaml`.

### Could not determine

- How Jack's classes map to his books today: whether any class already has two books in PSet.
- Whether a homework set can exist with no book, and what fails if it tries (asked of the fourth Explore).
- Whether a release has shipped to friends, which decides how careful the data migration must be (asked of the fourth Explore).

### Addendum, from the fourth Explore report

- No release tag exists (`git tag` is empty; the old v0.1.0 was deleted on 2026-10-01). Nobody but Jack has data.
- A set cannot exist with no book today: `homework.book_id` is NOT NULL, creating a set looks the book up first, and the guide job, the tutor's tools and the prompt ("The book is ...") all take a book, even for a problem that is not in it.
- What truly needs a textbook's pages: finding a problem, reading its figures, boxing on the page, "Show in book", page chips, worksheet crops. Ranking, memory, study time and usage need only an id.
- Staying per textbook by nature: page numbering runs, problem numbering style, title and author, the cover. The course page link is kept per set, not per book.
- No migration has ever moved rows to a new parent, and no test runs every migration against an old database.
- Book-shaped and to be rebuilt: the test-library snapshot (`tools/testlib`), `tools/seedusage`, and tests that stub a `books` table.
- Size: 38 Go files and 413 lines name a book id (homework 122, library 135, ask 43, memory 34), plus about 46 tests; 27 web files and 262 lines.
- Written decisions that name the book as the unit: about 30, in `design/workspace.md`, `design/backend.md`, `design/import.md`, `design/memory.md`, `design/model-usage.md`, `design/settings.md` and four idea files. The ones a course changes in substance: one conversation per book (`workspace.md:237`), a duplicate refused by sha256 (`import.md:8`), the + beside "Your books" as the one way to add (`import.md:20`), a book removed only from inside it (`workspace.md:108`), the browser routes `/books/{id}` (`backend.md:112`), usage and memory in the book's menu.

### Addendum 2, from the Explore report of 2026-10-11 22:00

- Correction to "Home lists books only": Home also shows this week's study by book, the homework due across all books (`GET /api/due`) and the shelf (`web/src/pages/home/index.tsx`).
- Nothing exists for practice exams, exam prep, slides or lectures. The only "course" in code is one prompt line and the course web page link on a set.
- The import plumbing takes any PDF (the page is the unit everywhere). What is textbook-shaped is the prompts (naming, contents, heading picks all say "textbook") and the per-book detection of problem numbering and page runs.
- An import is refused when Ollama is down, since search needs local embeddings.
- Figure crops are cut from the book's PDF on request. A problem that is not in the book has no page, so no figure and no boxing.
- As of dev 4b02f3f, before PR #35: the workspace is 19 files and about 4.4k lines; Rail, Scan and AskTab are page code. `/views` holds two views (homework, error notice). `/components` shows about 52 entries from 36 components.
- `design/workspace.md` still says `/books/{sha}`; the code and `design/backend.md` use the book's UUID.
- There is no design file for Home.
- The test library is 3 textbooks (one scanned), 7 sets, 55 questions, 10 turns. It is book-shaped and is rebuilt for courses.
- In flight and touching the same screens: PR #35 loading-screens merged into `dev` on 2026-10-11 after this audit (so it is in `courses` from the start), PR #30 jumps-guard is still a draft, and the `selection-entry-options` and `haiku-usability` worktrees.

## Stage plan

1. Scope and model: what a course holds, the kinds of material, and what homework, Ask and exam prep each draw on. Artifact: a glossary (the one name for each thing a course takes in, holds and writes), a mission sentence and a table of each thing, what it is and what it draws on.
2. Structure and flow: the screens and their routes, what opening a course shows, where materials are added, how you get from Home to tonight's work. In words and a screen map; the layouts are mocked per view afterwards. Artifact: the screen map and the main flows.
3. Behavior and edges: an empty course, removing a material, the same PDF twice, two textbooks and one problem number, the old library. Artifact: a state list.
4. Delivery: the phases, the work items, where work lands during the week, the tracker, acceptance. Artifact: the work-item table in `ideas/courses.md`.

## Frontier

Empty: the grill has ended. Every question was answered, held for later (D9) or assumed.

## Log

### Triage, 2026-10-11

Jack's ask, in full: "I want to make quite a large redesign. I want the main organization member to be courses instead of textbooks. A course will contain many different types of materials (we will start with a few), like textbooks, homework, lecture slides, and exam preparation center. So homeworks can pull from all materials, practice exams can pull from real exams added as context, and ask can use all context added. This will touch the homescreen (complete redesign). And the workspace (compelete redesign, keeping some parts). And a some new pages as well to cover the new functionality. Lets start with grilling on the new architecture that will influence the frontend and user flow, then we will redesign the UI parts via frontend mocks with our component library (which will require some changes too). Finally adding in the actually backend and UI logic. This will happen over a week or so with multiple agents and harnesses acting on it, so keep track of work in a central file that subagents can read off of."

Tier: grilled, from the ask ("Lets start with grilling").

### Batch 1, gates 1 and 2, 2026-10-11

- Q43. Your new ask reverses D7 from earlier today (that grill stops at the course and the move). Keep the other decisions (D5, D6, D8, D10 to D13) and widen this grill to materials and the exam center's place? Options: Keep them, widen (Recommended) / Keep, but revise some / Start over. Answer: "Start over".
- Q44. What does opening a course show? Options: The workspace, pages off it (Recommended) / A course overview first / Everything in the workspace. Answer: "A course overview first".
- Q46. What should homework do with a course's materials? Pick all that apply. Options (multi): Guides read everything (Recommended) / Problems found anywhere (Recommended) / The sheet is kept as a material (Recommended) / Sets written from materials. Answer: "sets written from materials comes with the exam.,Guides read everything (Recommended),Problems found anywhere (Recommended),The sheet is kept as a material (Recommended)".
- Q47. What does exam prep hold in its first version? Pick all that apply. (Asking across all materials is the course's Ask, already decided.) Options (multi): Practice exams from past ones (Recommended) / Working a real past exam (Recommended) / Cheatsheets / Practice exams from scratch. Answer (free text): "hold on this part for later."

### Message during batch 1, 2026-10-11

"I also want to nail down some vocabulary. What each course uses as inputs, outputs, whats generated, e.g. context, artifacts, materials, etc. So we both know exactly what we are talking about."

### Batch 2, gate 1 (vocabulary), 2026-10-11

Asked with a proposed glossary (course, material, kind, work, problem, guide, generated, context).

- Q59. What do we call the documents you put into a course (a textbook, slides, a past exam)? Options: Materials (Recommended) / Sources / Resources. Answer: "Materials (Recommended)".
- Q60. Are homework and exam prep kinds of material, or a second thing? Options: A second thing: work (Recommended) / Everything is a material. Answer: "A second thing: work (Recommended)".
- Q61. What do we call the things PSet writes (a guide, a practice exam, later a cheatsheet)? Options: No umbrella noun (Recommended) / Artifacts / Outputs. Answer: "No umbrella noun (Recommended)".
- Q62. What does "context" mean: can you choose what a job reads? Options: Everything, no choosing (Recommended) / You can switch a material off / You choose per job. Answer: "Everything, no choosing (Recommended)".

### Batch 3, gates 1 and 2, 2026-10-11

- Q51. Behind the course overview, what is the workspace now? Options: One workspace, any material (Recommended) / A screen per job. Answer (free text): "I want to build a type of customizble display/dock system. Where each thing is rendered in a certain way. And we can split screen, and later maybe add support for different combinations of 2x1 and 1x1 tiles. For now just split screen".
- Q52. What is Home for, now that courses are the unit? Options: Tonight first (Recommended) / Courses first / No Home. Answer: "Tonight first (Recommended)".
- Q53. How does Ask work in a course? Options: One running conversation (Recommended) / Several named conversations / One per material. Answer: "One running conversation (Recommended)".
- Q54. Beyond textbooks, slides, assignment sheets and past exams, which kinds of material are in the first version? Pick all that apply. Options (multi): Notes (Recommended) / Other (Recommended) / Posted solutions / None yet. Answer: "None yet".

### Message during batch 3, 2026-10-11

"Make sure to split the plan up into meaniful tracks (PRs) for staged work"

### Batch 4, gate 2 (the dock), 2026-10-11

- Q63. What does one side of the split hold? Options: Tabs (Recommended) / One thing, with a switcher. Answer: "Tabs (Recommended)".
- Q64. Who arranges the dock? Options: PSet arranges, you can change it (Recommended) / You build it / Fixed pairs. Answer: "PSet arranges, you can change it (Recommended)".
- Q65. Where does Ask sit? Options: In the dock, like anything else (Recommended) / Always at hand, outside the dock. Answer (free text): "should this maybe move to some sort of floating/expandable dialog? This way everything else can stay a normal tile, and ask can be reference from anywhere. Then the feature to ask about something can be expanded to each type of tile. So each tile can declare what elements can be selected to be asked about and what they feed to the context of the ask conversation, and what that pinned ask content tag on the message looks like." Jack asked it as a question; the answer given was yes, and it is recorded as D21 and D22 for him to overrule.
- Q66. What do we call one part of the dock? (How a thing is drawn inside it is a "view", the word /views already uses.) Options: Pane (Recommended) / Tile / Panel. Answer: "Pane (Recommended)".

### Batch 5, gates 1 and 4, 2026-10-11

- Q50. Where does the week's work land, and with it the tracker? Options: An integration branch, `courses` (Recommended) / Straight into `dev` / `dev` for mocks, a branch for the switch. Answer: "An integration branch, `courses` (Recommended)".
- Q55. What happens to the books and homework in PSet today? Options: A clean slate (Recommended) / Each book becomes a course. Answer: "A clean slate (Recommended)".
- Q48. How is a material added to a course? Options: Drop it, PSet guesses the kind (Recommended) / You pick the kind first / Add where it belongs. Answer: "Drop it, PSet guesses the kind (Recommended)".
- Q56. Can one material be in more than one course? Options: No, one course each (Recommended) / Yes, shared. Answer: "No, one course each (Recommended)".

### Batch 6, gate 3 and the tail, 2026-10-11

- Q30. A set says "Problem 3.4" and the course has two textbooks. Which one does it point into? Options: PSet works it out, asks when unsure (Recommended) / The set names its textbook. Answer (free text): "I really do not invision a situation anytime soon where this will be required, where a course as multiple textbooks. so for now we can just not worry about it."
- Q37. What happens to homework when a material it points into is removed? Options: The work stays, links go (Recommended) / Its work goes with it / Not while work uses it. Answer: "The work stays, links go (Recommended)".
- Q68. Which of these can wait for a second milestone, after the course app works end to end? Pick all that can wait. Options (multi): Rearranging the dock (Recommended) / Selection in every view (Recommended) / Guessing the kind / Exam prep's place. Answer: "Rearranging the dock (Recommended),Selection in every view (Recommended),Guessing the kind,Exam prep's place".
- Q69. Anything you have not said that this must do, or must never do? Options: No, write it up (Recommended) / Yes. Answer (free text): "Have a pretty abstract view of the imported document so it can be freely applied to one of the types of materials cleanly, with ways to fix it if nessecary. That way we can make a best guess, but can cleanly fallback to another type if a student needs. This will also be great for something in the far future, having a central space for all knowledge of a class, RAG, with each chuck of data naming what material came from."

Not asked, taken at the recommendation and listed under Assumed: Q67 (A8), Q57 (A11), Q58 (A12). Q31, the tracks, is answered in `ideas/courses.md` and shown to Jack with this file.

### After the grill, 2026-10-11

Jack's message: "Can we for now since this these changed will upset some of the tests/CI, turn it off for a bit? And bypass the rules on GitHub. This is rapid iteration development"

- Which checks run on `courses`? Options: Fast checks only (Recommended) / Nothing / Everything, but never blocking. Answer: "Fast checks only (Recommended)".
- Which gates stay? Answer: "You try it and approve (Recommended),Screenshots in both themes,One review (Recommended)". Not kept: a second review for risky tracks.
