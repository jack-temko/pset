# Homework panel: redesign grill

status:    grilling (gate 1 of 4)
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
| D6 | One primary button in place of Complete plus Next, **not labelled "Complete and next"**. Label and undo still to settle. | Jack: one button, and does not like that label. | Complete then Next takes over; both quiet |
| D7 | After the last question, a page that fills the pane: a greeting-style line (like Home's), total time and time per question, anything else a hardworking student who cares about their performance would want, and a Turn in button. | Jack: closes the loop the mission describes. | A quiet Turn in row; nothing; offer the next set |
| D8 | Behind a click, not always shown: "Add your professor's instructions", "Not the right problem? Show me where it is", and the page chip. | Jack: declutter. | Keeping them visible |

### The artifact(s)
Not yet: the inventory table is written when gate 1 ends.

### Assumed
- **A1** The time left appears only after at least two questions have been timed, reads "about 1 h 40 m left", and is never a live countdown or a nag.
- **A2** The usage line stays visible as today until gate 3.
- **A3** The previous fixes parked on `homework-keeps-your-place` (keep your place across Ask; the question menu) are inputs to this design, not merged with it.

### Open
- The label and undo of the one primary button (D6).
- What the finish page shows besides total time and time per question.
- Whether the page chip stays reachable in one click or moves into a menu (asked with a reason).

## Reversals
- **R1** "Complete never advances" (design/workspace.md, 2026-09-18, Jack): reversed by D6, Jack's choice of one button. Its label and undo are still to settle.
- **R2** "Done is a fact, not a party" (2026-09-18): softened by D7, a greeting-style line on the finish page, at Jack's request.
- **R3** "Turned in ... lives with the set's actions, away from Complete, so the two are never confused" (2026-09-21): Turn in also appears on the finish page (D7); it stays in the menu too.
- **R4** Locked list of set actions "inline move, move down and remove beside the page chip" (2026-09-24 and earlier): move and remove leave the always-visible row (D3).
- **R5** "Scan jumps on demand: a page chip in the question header" (2026-09-18): the chip goes behind a click (D8), pending the question below.

## Disagreements
None yet.

## Frontier
- Q9 (gate 1) The one button: label, and how a completed question is un-done. weight high.
- Q10 (gate 1) The page chip: one click away, but in which place? (asked with a reason). weight medium.
- Q11 (gate 1) What the finish page shows. weight medium-high.
- Gate 2 to 4: not yet built.

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
