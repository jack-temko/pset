# Work pane: grill

Status: approved (Jack, 2026-10-21: "work pane spec is gtg"). One problem set being worked, inside the workspace
(`ideas/workspace-grill.md`). From scratch; today's homework view is evidence only.
Desktop only (Jack, 2026-10-21: "remember, we do NOT support mobile or small screens. We do NOT need to include any code or styling related to that.").
Friction to answer: usability findings (`pset-haiku-usability/.dev/lab/findings.md`, 2026-10-09) #4, #7, #8, #13, #14; homework spec F5, F6, F9/F10 (14 controls), Show in book lands on the page only, place not remembered.

## Decisions

| #   | Decision | Why | Beat |
| --- | --- | --- | --- |
| P1  | One problem at a time; above it a strip of numbered chips (done filled, current outlined) jumps anywhere in one click | Jack's pick: focus with the whole set in view | One scrolling list; today's counter menu |
| P2  | Each problem has its own "Mark done"; Next only moves on | Finding #4: Next marked problems done without saying so | Next marks and says so; done on opening the answer |
| P3  | Three help steps, each opened on purpose: hint, walkthrough, answer | Take only as much help as you need | Hint then full solution; one step-by-step reveal |
| P4  | Visible on a problem: Mark done, Next, the help steps, Ask about this, and the page link. Everything else (edit, move, notes, remove, fix) in one menu | Today shows 14 controls (F9/F10) | Also keep notes and "wrong problem" visible |
| P5  | The header is the set line (name, due, "3 of 8", time left, as on Home), then the strip | One compact line; the tab already names the set | Strip only; a big title |
| P6  | Ask about this opens Ask with "About 4.62" as a removable chip over the input; hover quotes the problem | Finding #14: the attachment was invisible | The problem quoted in full in the thread |
| P7  | Parts a note skips ("(c) and (d) only") show dimmed with "Skipped" and get no help | Finding #13 | Hide them; the note only |
| P8  | Remove is immediate, with "Removed 4.62 · Undo" for a few seconds; no confirm | Finding #7 | Confirm and no undo |
| P9  | Turn in warns on an unfinished set ("3 of 8 aren't done. Turn in anyway?"); once turned in, "Take back" sits where Turn in was | Finding #8 | Only when all done; no Turn in |
| P10 | A problem shows as soon as it is found; each help step that is still being written says so and when ("Writing the walkthrough · about 20 s") | F5: waiting gave no place or time | One waiting line for everything |
| P11 | The page link turns the material to the page and outlines the problem briefly, from the box it was found in | Show in book landed on the page only | Page only |
| P12 | Marking the last problem done shows a short finish card: "All 8 done · 2 h 10 m", Turn in, Back to the course | A moment of closure, one place to hand in | Nothing special |
| P13 | Help steps are closed rows under the problem; any can be open at once | Today's model works | Tabs, one open at a time |
| P14 | Beside a problem's number: its label and page link ("3.1 #7 · p. 112"), nothing else | Time and difficulty stay out of the way | Time spent; difficulty |
| P15 | The professor's notes sit above the problem as a quiet bordered note | Read before the problem | Below the problem |
| P16 | A second failure says so ("Still couldn't find 4.62 (2nd try)"), what was tried, and leads with the next fix (box it, paste the text); Try again moves down | F6 | The same message each time |

### Assumed

- The current problem per set is remembered (S8): reopening lands where you left.
- Strip chips: done filled, current outlined, failed marked with the danger colour, skipped parts not counted; hovering a chip shows its label.
- Figures show under the text, click to enlarge; "Check how the figure reads" is in the menu.
- Set menu: Add problems, Box one on the page, Edit, Print worksheet, Turn in, Delete (with undo).
- Next goes to the next unfinished problem; after the last, the finish card if all are done.
- Desktop only: no narrow layout or styling.
- Material pane items from the findings (#6 jump to a page, #9 reading place lost) go to the material pane's grill.

## Log

Jack: **"While it works can we grill on the next step?"**; on the audit: **"remember, we do NOT support mobile or small screens... Also check findings.md for workset page related friction to include in the grill"**

Batch 1: layout **One at a time + strip (Recommended)**; done **Its own Done button (Recommended)**; help **Hint, walkthrough, answer (Recommended)**; controls **Only the work (Recommended)**.

Batch 2: header **Set line + strip (Recommended)**; ask context **A chip in Ask (Recommended)**; parts **Dim the skipped parts (Recommended)**; undo **Undo, no confirm (Recommended)**.

Batch 3: turn in **Warn, and Take back (Recommended)**; waiting **Problem first, help says when (Recommended)**; in book **Page, problem outlined (Recommended)**; finish **A short finish card (Recommended)**.

Batch 4: help look **Rows under the problem (Recommended)**; meta **Label and page link (Recommended)**; notes **A note above the problem (Recommended)**; failure **Says it's the second try (Recommended)**.

Grill ended after batch 4; the rest is under Assumed.
