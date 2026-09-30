# Homework panel: redesign grill

status:    awaiting OK
date:      2026-09-30
brief:     redesign the whole homework view, judged from the tired student (hour 7, 1am, Night, glancing between the scan and the panel)
sources:   web/src/views/homework/spec.md, design/workspace.md (Homework), design/design-system.md, the /views scenarios, a measured walk of the current view, internal/homework and internal/activity
wireframes: /views/homework?mode=wireframes (web/src/views/homework/wireframes.tsx), built from the real components
build plan: ideas/homework-redesign.md

## Summary

### In one line
For the student picking up homework after a long day of class, this view puts the current question at the center, hard and long as it is, and shows how far along the set is and how much time is left. It is not for managing homework: adding, importing and editing stay in their dialogs and the menu.

### What you get
- **One header that carries progress.** Its bottom edge is a bar cut into the questions, each as wide as it is hard; "2 of 8" opens a list of the questions and is how you jump; the time left is gray beside it. No extra row.
- **One primary button.** "Next question" marks done and moves to the next unfinished one; on a done question it becomes "Mark incomplete"; on one not ready it is "Skip for now".
- **Help as compact rows** that open in place (Hint, Walkthrough, Answers, each saying how long it is). The frosted Veil is gone.
- **Quieter question.** Memory lines, the figure reading (unless flagged), move and remove, the professor's-instructions prompt and "Not the right problem?" move behind a click; the professor's notes have one way in (the question menu).
- **A finish page** after the last question: a greeting line, total and per-question time, a bar per question, the hardest, Turn in.
- **Focus is two columns**: the question pinned left, the help scrolling right.
- **Opening a book lands on the Homework list**; a set opens on its next unfinished question; Ask and back keeps your place within a visit.
- **One redesigned Menu everywhere**, one open at a time; its hover and attachment get an A/B first.
- **Real backend** (after the UI is judged on mocks): a difficulty ranking step, time per question, the estimate, attempts and failedAt.

### Decisions
Gate 1, purpose and inventory

| # | Decision | Why |
|---|---|---|
| D1 | Open to redesign: Structure, Disclosure, Set management and states. Adding and importing stays as is. | The clutter and extra clicks live in the first three; adding and importing is large, decided and off the main path. |
| D2 | The mission above: the question is the center; progress and time left always in view. | Jack: each question is hard and long, but it is nice to know how far along you are. |
| D3 | Behind a click by default: memory lines, figure reading unless flagged (Check it), move and remove. The usage line stays. | Declutter; the usage line was not ticked. |
| D4 | The front door is a set's walkthrough (Home's due row goes straight in). | Jack: usually arrives straight into a set. |
| D5 | Progress always visible: per-question marks, "n of m", and a time left from the student's pace. | Jack often wants to know how much longer it will take. (Marks replaced by D20; estimate now real per D28.) |
| D6 | One primary button replaces Complete and Next. | The most repeated act was two small targets far apart (F8). |
| D7 | A finish page fills the pane after the last question. | Closes the loop the mission describes. |
| D8 | Behind a click: "Add your professor's instructions" and "Not the right problem?". | Declutter. |
| D9 | The button reads **Next question**; on a done question **Mark incomplete** (undo in place); you move by the count's list. | Jack's label; undo where you are. |
| D10 | Choosing a question never moves the book; a jump-to-the-problem button exists. | The student may have a page open beside it. |
| D11 | The finish page adds the hardest questions only. | Jack picked one extra. |

Gate 2, flow and layout

| # | Decision | Why |
|---|---|---|
| ~~D12~~ | ~~Segment marks as tap targets.~~ Replaced by D20. | Too tall for what "3 of 8" says. |
| D13 | "Show in book" sits on the question's label row. | The chip's spot without its clutter. |
| D14 | Focus is two columns. | The problem never scrolls out of sight of its walkthrough. |
| D15 | Previous and Next arrows removed. | The count's list and the keyboard cover it. |
| D16 | Two menus: the header one for the set, a second on the label row for the question. | Keeps "one menu per thing". |
| D17 | Finish page: greeting, StatTiles, bar per question, the hardest, Turn in. | The shape of the effort at a glance. |
| D18 | List rows carry the bar and "n of m done, time left"; tapping opens the set on its next unfinished question. | Fixes F2. |
| D19 | Professor's notes have one way in: the question menu; the box is read-only. | Jack: two ways to edit; collapse into one. |
| D20 | Progress lives in the header: a difficulty-weighted bar as its bottom edge, the count opening the question list, the time left in gray. | Jack: marks were too tall; mixed the weighted bar with the header option. |
| D21 | Every dropdown is one redesigned Menu: padded radius-lg card, inset 40px rows, 256px minimum, labelled trigger, current row. | Jack: same styles everywhere, more modern and larger. |
| D22 | Menus never stack: opening one closes any other. | Jack asked how to manage them all open at once. |

Gate 3, behavior and states

| # | Decision | Why |
|---|---|---|
| D23 | Help stages are compact rows that open in place; **the Veil component is removed**. | Jack: "I don't like the frosted." |
| D24 | A book always opens to the Homework list; opening a set lands on its next unfinished question; the place is kept within a visit only (Ask and back). | Jack's words. |
| D25 | "Skip for now" on a question being written, failed or with no guide: moves on, does not mark done. | Never marks done what is not done. |
| D26 | Next goes to the next unfinished question (wrapping); the finish page appears when all are done. | A skipped question keeps coming back. |
| D27 | Keys: ← → browse, 1 2 3 toggle the rows, Enter on the primary. Off while typing. | Few keys, the most repeated acts. |

Gate 4, data, backend and acceptance

| # | Decision | Why |
|---|---|---|
| D28 | Build all the backend wants for real: difficulty, time per question, the estimate, attempts and failedAt. | Jack: "Build all of it". |
| D29 | "Show in book" lands on the page now; the problem's position on the page is filed for later. | Needs an engine change this redesign should not depend on. |
| D30 | The acceptance numbers below. | Confirmed. |
| D31 | Difficulty comes from a ranking step after find: one cheap call sees every statement in the set and scores each 1 to 5 against the others; heuristic fallback if the model is down; re-ranks when questions change. | Every question is found before any guide is written; the bar is weighted from the moment a set opens. |
| D32 | Build order: the UI first on mocks so it can be judged in /views, then the real backend swapped in. | Matches the UI-first cycle. |
| D33 | The Menu gets an A/B in the frontend pass: a hover that does not fill the whole row, a menu that reads as attached to its dropdown, colors measured in both themes. | Jack: still does not like it. |
| D34 | Nothing is cut; build all of it. | Jack. |

### The artifacts

**Inventory** (what the view shows, does and links; the front door is a set's walkthrough)

| Element | Shows / does / links | Must, should, never |
|---|---|---|
| Header | Back to the list, set title, the count (opens the question list), the time left in gray, the set menu; the bar as its bottom edge | must |
| The question | Label, statement, figures, professor's notes (read-only when present) | must |
| Show in book | Takes the scan to the problem's page; never moves by itself | must |
| Help rows | Hint, Walkthrough, Answers, each open in place and saying how long | must |
| Status line | Queued, being written, failed with its ways out | must |
| The one button | Next question, Mark incomplete, or Skip for now | must, the one primary |
| Question menu | Move up, move down, remove, "This isn't the right problem", edit the professor's instructions | should, in the menu |
| Set menu | Add questions, Box one on the page, Edit, Print worksheet, Turn in, Delete | should, in the menu |
| Ask about this | Opens Ask with the question as a chip; its tab returns to the same question | should |
| Usage line | Model, time and cost under a finished guide | should, stays for now |
| Finish page | Greeting, total and per-question time, bar per question, the hardest, Turn in, Back to list | must, new |
| The list | Reads on top, each set with bar, count and time left, "+ New homework", turned-in sets | should, secondary |
| Adding and importing | The dialog with four ways in, the import review | unchanged |
| Never by default | Memory lines; figure reading unless flagged; move and remove; the notes prompt; the "Not the right problem?" line | hidden |
| Never on the finish page | Help used, what is due next, pace against earlier sets | left out |

**Wireframes:** live at `/views/homework?mode=wireframes` (source `web/src/views/homework/wireframes.tsx`): the header with progress and the count's list; the walkthrough ready, done, being written, and failed; Focus in two columns; the finish page; the list.

**States**

| State | What shows | Scenario |
|---|---|---|
| List, populated | Reads on top; sets with bar, "n of m", time left, due flag; "+ New homework"; turned-in below | `happy` |
| List, empty | One sentence and New homework | `empty` |
| List with reads | Reading (time left), ready (Review), failed (Try again) | `importing` |
| List, after a break | Overdue and due-today flags with progress | `return-after-break` |
| Opening a set | Lands on the next unfinished question | `handoff-in` |
| Set loading | Skeleton header, bar and rows at real size | `slow` |
| Question, ready | Header; label, Show in book, menu; statement, figure, notes; three rows; Ask about this and Next question | `happy` |
| Question, done | A check; the button reads Mark incomplete | `return-after-break` |
| Question, queued | "Found on p. N. Its guide starts once every question is found."; rows Waiting; Skip for now | `slow` |
| Question, being written | Spinner line with time left; Hint opens when it lands, others Writing; Skip for now | `happy` |
| Question, failed | The failed block by kind; Skip for now | `failed` |
| Question, no guide (old) | "This question has no guide yet." and Write the guide; Skip for now | new: `no-guide` |
| Finish page | As above; reached when the last unfinished question is done; reachable again from the count's list | new: `finish` |
| Turned in | A label in the header; Turn in checked in the set menu | `return-after-break` |
| Focus | Two columns | `?wide=1` |
| Ask and back | Ask about this opens Ask with the chip; its tab returns to the same question | `handoff-in` |
| Opening a book | The Homework tab at the list | harness |
| Long set | 24 questions: the bar and the count's list still work | new: `long-set` |
| Long set title | The title truncates; count and bar never move | new: `long-title` |

**Components.** Reuse: `Box`, `BoxRow`, `BoxBody`, `Button`, `IconButton`, `HomeworkStatusLabel`, `StatTile`, `Spinner`, `Skeleton`, `Runs`, `MathInline`, `FailedQuestion`. Changed: `Menu` (done: D21, D22; A/B under D33). New: a difficulty-weighted progress bar and a disclosure row that opens in place, each with a README and a `/components` section. Removed: `Veil`.

**Data and backend** (wants, in build order; all for real per D28, after the UI is judged on mocks per D32)

| Want | Where it lands | Cost |
|---|---|---|
| `difficulty` per question, from a ranking step after find (D31) | `internal/homework` (rank job, prompt, store column, `wire.go`), an eval on a real model | medium |
| Time per question | `activity.Stretch` gains `questionId`; the workspace tells the store which question is open; `Question.seconds` | low to medium |
| The time-left estimate | computed from difficulty and time, sent on the set; guards below | low, after the two above |
| `attempts` and `failedAt` | new columns set on retry and failure; `wire.go`; the failed and waiting copy | low |
| Queue place ("3rd in line") | derived in the client from the set's questions; no backend | none |
| The problem's position on its page | filed (D29), not built | later |

Reads: `GET /api/books/:id/homework`, `GET /api/homework/:id` (now with difficulty, seconds, estimate, attempts, failedAt). Writes as today, plus `questionId` on study stretches. Events as today. The Panel keeps both tabs mounted so Ask and back needs no place logic.

**Acceptance** (checked on the built view; today's numbers in brackets)
- Open a set from the list and be on its next question: **1 tap**.
- A question with a written guide: at most **4 taps** (three rows and Next), **0 typing**.
- Tab stops from the panel tabs to the first help row: **6 or fewer** (10).
- Controls visible on a ready question: **13 or fewer** (20).
- The header takes **1 row** (2). Count, bar and time left visible at every scroll position.
- Every scenario above loads without errors in Paper and Night at 1280 wide; the main flow works from the keyboard alone.
- **The estimate is never confidently wrong:** a test feeds timed sample sets and checks its error; with fewer than two timed questions it shows nothing, and when the spread is wide it shows a range or nothing.
- `make test` and `npm run build` pass; every menu in the app (including the book menu in the top bar) checked after the Menu change.

### Assumed (overrule any at a glance)
- **A1** The time left appears only after two questions have been timed, reads "about 1 h 40 m left" rounded to 5 minutes, shows a range when the spread is wide, and is never a live countdown or a nag. Mitigates the regret Jack named: the estimate being confidently wrong.
- **A2** The usage line stays as today. **A3** The fixes parked on `homework-keeps-your-place` are inputs, not merged. **A4** Mark incomplete's wording is the agent's.
- **A5** Back returns to the list; the set title is not a menu. **A6** The weighted bar has no upper limit on questions.
- **A7** The Focus toggle is unchanged. **A8** Rows you opened stay open when you return. **A9** Tab switches inside a visit keep the place; only opening the book resets it. **A10** Rows open independently.
- **A11** Moving between questions swaps instantly and resets scroll; the bar fills over 200ms; reduced motion respected. **A12** A question with no guide also takes Skip for now. **A13** A set opened from Home lands on its next unfinished question.
- **A14** Time per question is active time with the question open in the walkthrough, pausing after 5 minutes idle, overlaps counted once. **A15** The finish greeting lines are drafted at build, in Home's seven stretches, for Jack to approve. **A16** Queue place is derived client-side.
- **A17** The previous grill, if any, is archived to `grills/<date>.md`; none existed.

### Open
- The Menu's hover, attachment and colors: an A/B, first thing in the frontend pass (D33).
- The ranking prompt and its eval need a real model: it runs on Jack's Claude-only eval key, never the key in his own library.
- The exact finish greeting lines.
- Whether time left also shows on Home's due rows (not decided, out of scope here).

## Reversals
- **R1** "Complete never advances" (design/workspace.md, 2026-09-18): reversed by D6 and D9.
- **R2** "Done is a fact, not a party" (2026-09-18): softened by D7.
- **R3** "Turned in lives with the set's actions, away from Complete" (2026-09-21): Turn in also appears on the finish page; it stays in the menu.
- **R4** Move up, move down and remove inline beside the page chip (2026-09-24): now in the question menu (D3).
- **R5** "Scan jumps on demand: a page chip in the question header" (2026-09-18): the chip goes; "Show in book" stays; opening a question still never moves the scan.
- **R6** "One question at a time: prev/next plus a position row" (2026-09-18): replaced by the header's count, bar and question list; the arrows go.
- **R7** "The walkthrough header keeps back, title, '3 of 8', and a ⋯ menu" (2026-09-21): count and time left stay in the header row, the bar is its edge, and a second question menu is added.
- **R8** The Menu's "no padding: every pixel of the card belongs to a row" (menu/README.md): reversed by D21 for the modern look.
- **R9** "Three stages, all veiled ... behind frosted glass (the Veil)" (2026-09-29): the veils and the component go (D23).
- **R10** "The panel remembers per book which tab it showed" (2026-09-18): the panel opens on the Homework list every time (D24).

## Disagreements
- **G1** Progress with a time left (D5): recommended against (a wrong estimate at 1am nags; needs new backend data). Jack chose it, and named it the thing he would most regret if wrong, so A1 guards it.
- **G2** Page chip (D10): recommended keeping it in some form. Jack's answer changed the reason: the book may be open beside the panel, so selecting a question must not move it; a jump button remains.

## Frontier
Empty, except the Menu A/B (D33), which Jack asked to run in the frontend pass.

## Log
### Gate 1, batch 1
- Scope, multi-select: "Structure (Recommended), Disclosure (Recommended), Set management and states (Recommended)".
- Mission: "Pickup and finish the set after a long day of class, but each question is quite hard an long, so its the center of attention. But its nice to see how far along you are so you know when your gonna be done or how much is left."
- Never show, multi-select: "Memory lines (Recommended), Figure reading unless flagged (Recommended), Move and remove controls".
- Arrival: "Straight into a set (Recommended)".
### Gate 1, batch 2
- Progress: "Small mark per question, with 3 of 8 done, and a time left, calculated from the pace. I like this because often I want to know how much longer this homework will take. Add this to ideas for the backend, for now, the rewrite, have it just mocked and fake. I want to calculate it smartly, and maybe have the LLM when its writing the walkthrough write some sort of difficulty index when compared to to other questions in the set, then use that number + how long each question took in reference to its index, and calulate the estimated time remaing based on that and the indexes of the remaining questions."
- Primary: "one button, but dont love complete and next".
- End of set: "a new page, that takes up the pane after completing. Shows a little page, with a fun line, following our new greetings. some information on time total and timer per question, and anything else of reference to a hardworking student who cares about their personal performance. That page has a button to turn it in."
- Quiet down, multi-select: "Add your professor's instructions (Recommended), Not the right problem? line (Recommended), Page chip".
### Gate 1, batch 3
- Button label: "Next question (Recommended)".
- Undo and skip: "Ok changes. Mark as completed button, advanced to next question. Jump to questions with the mark. The button turns into mark incomplete or something else so I can undo the turn in from that question. Decided on the wording of the button".
- Page chip (push back): "The student may have a book page open for helping them with homework. So selecting a question should not change where the book is. There should be a jump button somewhere that takes you to the problem/figure".
- Finish page extras, multi-select: "The hardest questions (Recommended)".
### Gate 2, batch 1
- Marks: "Segments in a strip (Recommended)".
- Jump button: "On the question's label row (Recommended)".
- Focus layout: "Two columns (Recommended)".
- Arrows: "Remove them; marks and keyboard (Recommended)".
### Gate 2, review of the wireframes
- Jack: "there are two ways to edit/add prof notes. Collapse into one. Also what are some other options for the marks for each question? We already show 3 of 8 done, we have a glancable status. They take up a lot of room and don't add a ton of meaningful information, but I would like some sort of progress bar or something. Give me some options."
### Gate 2, wireframes redone
- Jack: "Don't love the ascii wireframes, they are all butchered. I'd rather have you make wireframes using my own components." The wireframes were rebuilt from the real component library; the skills were updated to say so (grill/references/frontier.md, pset-view/references/grill-stages.md).
### Gate 2, batch 2
- Menus: "Two menus, each for its thing (Recommended)".
- Finish page: "Greeting, time chart, hardest (Recommended)".
- List rows: "Progress and where to resume (Recommended)".
### Gate 2 confirm
- "Confirmed, on to behavior (Recommended)".
### Gate 3, batch 1
- Help stages: "I don't like the frosted. Remove that component. Go with compact rows that open in place."
- Remembering: "A book should always open to the homework list. We can jump to homework from the list on the home. Opening a homework should jump to the next uncompleted question."
- Not ready: "Say \"Skip for now\" and don't mark it done (Recommended)".
- Order: "Next unfinished, finish when all done (Recommended)".

### Gate 4
- Backend: "Build all of it".
- Show in book: "Page now, exact spot later (Recommended)".
- Acceptance: "Yes, these numbers (Recommended)".
- Difficulty: "A ranking step after find (Recommended)".
- Build order: "UI first on mocks, then the backend (Recommended)".
- Cut first: "Nothing; build all of it".
- Regret, multi-select: "The estimate being confidently wrong".
- Anything else: "Also I still do not like the drop down, can you run some A/B on it and include it with the frontend pass. Particularly that the hover design color does not take up the whole item. And it should show like the menu is attached to the drop down. Make sure the colors look right."

## Build notes (removal of the Veil)
Delete `web/src/components/veil/`, its section and `VeilDemo` in `web/src/pages/components/sections/feedback.tsx`, its use in `web/src/views/homework/walkthrough.tsx` (the `Stage` component), and the mentions in `design/design-system.md`, `design/workspace.md`, `web/src/components/skeleton/README.md`, `web/src/components/dialog/README.md` and `ideas/*` that point at it. Keep the `revealed` field: it now records which rows were opened.
### Gate 3, batch 2
- Keyboard: "Arrows to browse, 1 2 3 to open help (Recommended)".
- Opening (check of my reading): "Yes, that's exactly it (Recommended)".
