# Homework panel: redesign grill

status:    grilling (gate 2 recap awaiting confirm; wireframes rebuilt from the real components)
date:      2026-09-30
brief:     redesign the whole homework view, judged from the tired student (hour 7, 1am, Night, glancing between the scan and the panel)
sources:   web/src/views/homework/spec.md, design/workspace.md (Homework), design/design-system.md, the /views scenarios, a measured walk of the current view

## Summary

### In one line
For the student picking up homework after a long day of class, this view puts the current question at the center, hard and long as it is, and shows how far along the set is and how much time is left.

### Decisions
| # | Decision | Why | Beat |
|---|---|---|---|
| D1 | Open to redesign: Structure, Disclosure, Set management and states. Adding and importing stays exactly as it is. | Jack: the first three are where the clutter and the extra clicks are; adding and importing is large, heavily decided and off the main path. | Opening all four |
| D2 | Mission as above: pick up and finish the set; the question is the center; progress and time left are always in view. | Jack's words: each question is hard and long, but it is nice to know how far along you are and how much is left. | "Pick up and get unstuck" alone, "Finish the set" alone, "One question, fully" alone |
| D3 | Never shown by default (reachable with a click): memory lines, the figure reading unless flagged (Check it), move and remove controls. The usage line stays for now. | Declutter: they matter rarely; the usage line was not ticked. | Showing all of them |
| D4 | The front door is straight into a set (Home's due row, or reopening the tab). The list is where you go to switch sets, one Back away. | Jack: usually arrives straight into a set. | List as front door; both equal |
| D5 | Progress at the top, always visible: a small mark per question, "3 of 8 done", and a time left computed from the student's pace. **Mocked and fake for now**; the real estimate is ideas/time-remaining-estimate.md (a difficulty index the LLM writes per question, and time per question). | Jack: often wants to know how much longer the homework will take. | Count and strip without time; count and bar |
| D6 | One primary button replaces Complete and Next. It marks the question done and moves on. | Jack: one button; two small targets far apart were the most repeated act (F8). | Complete then Next takes over; both quiet |
| D9 | The button reads **Next question**. On a completed question it becomes **Mark incomplete** (undo in place); you move between questions by tapping the marks. No undo toast, no separate Complete checkbox. | Jack chose the label and the mark-based undo; he left the second wording to the agent. | Done with 4.25; Got it, next; an undo toast; keeping a checkbox |
| D7 | After the last question, a page that fills the pane: a greeting-style line (like Home's), total time and time per question, anything else a hardworking student who cares about their performance would want, and a Turn in button. | Jack: closes the loop the mission describes. | A quiet Turn in row; nothing; offer the next set |
| D8 | Behind a click, not always shown: "Add your professor's instructions" and "Not the right problem? Show me where it is". | Jack: declutter. | Keeping them visible |
| D10 | Choosing a question never moves the book: the student may have a page open beside it. A jump-to-the-problem button exists somewhere (its place is a layout question, gate 2); the always-visible page chip goes. | Jack: "selecting a question should not change where the book is". | Chip only when the scan is elsewhere; chip behind a menu; a quieter chip |
| ~~D12~~ | ~~Progress marks are **segments in a strip**~~ (reopened: Jack found them too tall for what they say; see D20 once chosen), full strip height as the tap target; done filled, current ringed, waiting hollow, failed in warning ink. | Real tap targets for jumping; scales to about 24 questions. | Numbered chips; dots |
| D19 | **Professor's notes have one way in.** The question menu's "Edit the professor's instructions" ("Add" when there are none) is the only place to edit; the notes box is read-only. The box's Edit button goes. | Jack: two ways to edit or add; collapse into one. Notes are edited rarely, so a menu item is enough. | The Edit button on the box; both |
| D13 | The jump button is **"Show in book"** on the question's label row, always visible, one tap. | It replaces the page chip's spot without the chip's clutter; "Show me where it is" already means boxing a wrong find. | Under the statement; on the figure only |
| D14 | **Focus is two columns**: the question, the jump button and the notes pinned on the left, the three help stages scrolling on the right. | The problem never scrolls out of sight of its own walkthrough. | One wider column |
| D15 | **Previous and Next arrows are removed.** Moving is the marks, the one button and the arrow keys when the panel has focus. | Fewest controls; the marks cover it. | Keep a Previous arrow; keep both |
| D16 | **Two menus**, each for its thing: the header ⋯ acts on the set; a second ⋯ on the question's label row acts on the question (move, remove, "This isn't the right problem", add the professor's instructions). | Keeps "one menu per thing". | One menu with two sections |
| D17 | The **finish page**: a greeting line (serif), total time, a small bar per question with the hardest marked, the hardest questions listed, Turn in as the one primary, Back to list. | Shows the shape of the effort at a glance. | Numbers without a chart |
| D18 | **List rows** carry the mini strip and "3 of 8 done · about 1 h 40 m left"; tapping opens the set on the first incomplete question. | Fixes F2 without a new control. | A Continue button; the row as today |
| D11 | The finish page adds **the hardest questions** to total time and time per question. Help used, what is due next and pace against earlier sets are left out. | Jack picked one extra. | The other three extras |

### The artifact(s)

**Gate 1: inventory** (what the view shows, does and links; the front door is a set's walkthrough)

| Element | Shows / does / links | Must, should, never | Why |
|---|---|---|---|
| Progress | A small mark per question (done, current, waiting, failed), "3 of 8 done", a time left (mocked). Tapping a mark jumps to that question. | must, always visible | The mission: how far along, how much is left |
| The question | Label, statement, figures | must | It is the center |
| Professor's notes | The box, when there are notes | must when present | The guide follows them |
| Jump to the problem | A button that takes the scan to the problem and its figure | must, placement in gate 2 | The scan never moves on its own (D10) |
| Hint, walkthrough, answers | Three veiled stages | must | The help |
| Status line | Queued, being written, failed, with its ways out | must | Trust and recovery |
| The one button | Next question, or Mark incomplete on a completed question | must, the one primary | D6, D9 |
| Header | Back to the list (to switch sets), the set's title | must | D4 |
| Set and question menu | Add questions, Box one on the page, Edit, Print worksheet, Turn in, Delete, and per question: move up, move down, remove, "This isn't the right problem", add the professor's instructions | should, in the menu | Rare actions leave the surface |
| Ask about this | Opens Ask with the question as a chip; Back returns to this question | should | The escape hatch |
| Usage line | Model, time and cost under a finished guide | should, stays for now | Not ticked in D3 |
| Finish page | A greeting-style line, total time, time per question, the hardest questions, a Turn in button; fills the pane after the last question | must, new | D7, D11 |
| The list | Reads in progress, the sets with due flags, "+ New homework", turned-in sets | should, secondary | Switching sets |
| Adding and importing | The dialog with four ways in, the import review | unchanged | D1 |
| Memory lines | What the guide saved to memory | never by default | D3 |
| Figure reading | The words the guide was written from | never unless flagged (Check it) | D3 |
| Move and remove controls | Reorder, remove a question | never by default, in the menu | D3 |
| Finish page extras | Help used, what is due next, pace against earlier sets | never | D11 |

**Gate 2: wireframes** (built from the real components, not drawn)

Open them at `/views/homework?mode=wireframes` (source: `web/src/views/homework/wireframes.tsx`). They are the app's own `Box`, `Button`, `Menu`, `Veil`, `StatTile` and the rest, on static sample data, in the real pane at 440px and 800px (Focus), so veils lift and menus open. What they show:

- **Walkthrough, panel width:** set header (back, title, set menu), the pinned progress strip (a segment per question, "n of m done", time left), the question row (label, "Show in book", question menu), statement, figure, the professor's notes box, the three veiled stages, and the pinned footer with Ask about this and the one primary. A second frame shows a completed question, where the primary reads Mark incomplete.
- **Focus (800px):** two columns, the question pinned left and the help scrolling right; strip and footer unchanged.
- **Finish page:** the greeting line, total time and per-question time (StatTiles), a bar per question with the hardest marked, the hardest listed, Turn in as the one primary, Back to list.
- **The list:** reads on top, each set with the same strip and time left, "+ New homework", turned-in sets.

Counts (simulated): Next question 1 click (was 2); most help on one question plus Next 4 clicks (was 5); about 5 tab stops to the first veil (was 10). Candidates dropped in the walkthrough simulation: progress in the footer (a mis-tap jumps a question), everything in the header row (a long set title collides), a left rail of marks (splits progress in two, costs reading width).

### Mission (confirm)
For the student picking up homework after a long day of class, this view puts the current question at the center, hard and long as it is, and shows how far along the set is and how much time is left. It is not for managing homework: adding, importing and editing sets stay in their dialogs and the menu.

### Assumed
- **A1** The time left appears only after at least two questions have been timed, reads "about 1 h 40 m left", and is never a live countdown or a nag.
- **A2** The usage line stays visible as today until gate 3.
- **A4** On a completed question the button reads "Mark incomplete" (Jack left this wording to the agent). Moving between questions, including forward from a completed one, is by the marks and the keyboard.
- **A5** Back returns to the list; the set's title is not a menu. **A6** Above about 24 questions the strip collapses to one bar with a menu. **A7** The Focus toggle itself is unchanged.
- **A3** The previous fixes parked on `homework-keeps-your-place` (keep your place across Ask; the question menu) are inputs to this design, not merged with it.

### Open
- Where the jump-to-the-problem button sits (gate 2).
- Whether Previous and Next arrows remain besides the marks, and the keyboard for moving (gates 2 and 3).
- What "Next question" does on a question still being written or failed (gate 3).

## Reversals
- **R1** "Complete never advances" (design/workspace.md, 2026-09-18, Jack): reversed by D6 and D9, Jack's choice of one button that marks done and moves on, with undo by Mark incomplete.
- **R2** "Done is a fact, not a party" (2026-09-18): softened by D7, a greeting-style line on the finish page, at Jack's request.
- **R3** "Turned in ... lives with the set's actions, away from Complete, so the two are never confused" (2026-09-21): Turn in also appears on the finish page (D7); it stays in the menu too.
- **R4** Locked list of set actions "inline move, move down and remove beside the page chip" (2026-09-24 and earlier): move and remove leave the always-visible row (D3).
- **R5** "Scan jumps on demand: a page chip in the question header" (2026-09-18): the always-visible chip goes; a jump button stays, placed in gate 2 (D10). "Opening a question never moves the scan" is kept and strengthened.

- **R6** "One question at a time: prev/next plus a '3 of 8' position row" (2026-09-18): replaced by the progress strip and the marks; the arrows go (D12, D15). The one-question-at-a-time rule itself is kept.
- **R7** "The walkthrough header keeps what you read: back, the set's title, '3 of 8', and a ⋯ menu" (2026-09-21): '3 of 8 done' moves into the strip under the header, and a second question menu is added (D12, D16).

## Disagreements
- **G1** Progress with a time left (D5): recommended against (a wrong estimate at 1am nags; needs new backend data). Jack chose it anyway, with a design for it (difficulty index and per-question time). Recorded, with A1 as the mitigation.
- **G2** Page chip (D10): recommended keeping it in some form (one tap to the problem). Jack's answer changes the reason: the book may be open beside the panel, so the scan must not move on selecting a question; a jump button remains.

## Frontier
- D20 (gate 2): the progress display: four options built at `/views/homework?mode=wireframes` (A in the header, B one slim row, C weighted by difficulty, D a ring). Awaiting the choice; with the marks gone, the count opens a list of the questions and is how you jump (revisits D12, D15).
- Gate 2: awaiting the user's confirm of the wireframes.
- Gate 3 (behavior and states) and gate 4 (data, backend, acceptance): not yet asked.

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
