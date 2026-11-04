# Ask pane: grill

- status: awaiting OK
- date: 2026-11-04
- brief: the Ask pane in the workspace (a tab on either side), rebuilt in the new design, judged from a tired student stuck on one problem who wants a clear answer from their own course's materials
- sources:
  - `design/workspace.md`, "Ask (panel tab)" (the old spec: the step feed, Thinking, asymmetric turns, the answer as a document of blocks, page chips, Stop, failure lines, day dividers and Clear, asking about a selection), read as evidence; the design restart binds nothing new to it
  - `internal/ask/README.md` (one conversation per book, an agent loop with search, read, look, compute, remember; states running, done, stopped, failed)
  - `ideas/workspace-grill.md` (W5: "Ask about this" opens Ask as a tab on the side not holding the work; W10: the + menu offers Ask), `ideas/screens-grill.md` (S5, S9)
  - `ideas/asking-about-a-selection.md`, `ideas/memory-preferences-only.md` (only Ask saves, preferences only)
  - `ideas/on-hold.md` (ask about part of a page), the memory redesign mocks (layout D, Ask's New rows)
  - #53 (a question can hold an image)

## Summary

### In one line

One running conversation per course: you ask, a single live line says what Ask is doing,
and the answer lands as a readable document under one folded line of what it read, with
page chips that open the material beside it.

### Decisions

| #   | Decision                                                                                                                                                                                                                    | Why                                                                                                                                       | Beat                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| K1  | One conversation per course, as today's one per book                                                                                                                                                                        | Last week's explanation stays in reach; the chip says which set                                                                           | One per set; separate chats listed               |
| K2  | While Ask works, only the call in flight shows, on one line that replaces itself ("Searching 'eigenvalue'"). When the answer is done, the calls fold into one line ("Read 3 pages, searched twice") that opens to list them | Jack: "I only want the current tool action to show, not a list of them as they come in. Then a summary folded to one line when its done." | Rows stay, as today; rows hidden once done       |
| K3  | The live line and its folded summary sit at the top of the answer, under the question; the live line turns into the summary in place                                                                                        | Nothing moves when the answer starts or ends                                                                                              | The foot of the answer                           |
| K4  | A preference Ask saves shows as a quiet row in the answer, "Remembered: you use V_0 for node voltages", with Undo and Edit; the memory list shows it as New                                                                 | You see exactly what was kept                                                                                                             | Ask first with Keep; save silently               |
| K5  | Ask with no history and nothing attached shows one quiet line, "Ask anything about ECE 210. It reads your materials.", above the composer                                                                                   | You came with a question; nothing to dismiss                                                                                              | Suggested questions                              |
| K6  | The composer takes the problem or selected-line chip, as today, and a pasted or dropped image (your working, a figure)                                                                                                      | Show Ask your handwriting; questions hold images since #53                                                                                | Chips only; also any material page from a picker |
| K7  | History is endless, with quiet day dividers ("Yesterday", "Sep 12") and Clear at the very top                                                                                                                               | Scroll back to last week                                                                                                                  | Today open, earlier folded                       |
| K8  | No answer controls in the composer: the box, its chips and Send. "Briefly" in words works; a lasting wish is a memory                                                                                                       | One less control on every question                                                                                                        | A Short / Full switch                            |
| K9  | A page chip ("p. 142") opens that material on the side not holding Ask, at that page, flashing its box as the work pane's page links do                                                                                     | One behaviour for every page link                                                                                                         | A preview popover                                |
| K10 | Answer text stops at about 680 wide, left-aligned in the pane; plots and tables may use the full width                                                                                                                      | A readable line in a wide side                                                                                                            | Full pane width                                  |
| K11 | While Ask answers, the box stays editable; the button reads Stop until the answer ends, then Send. Nothing queues                                                                                                           | Keep your thought without a hidden queue                                                                                                  | Queue it; lock the box                           |
| K12 | "Ask about this" opens Ask scrolled to the latest turn, the chip in the composer and the cursor in the box                                                                                                                  | Type at once; last time's answer stays in view above                                                                                      | A fresh start view with history hidden           |

### The artifact(s)

**Top to bottom**: the conversation (Clear at its very top, day dividers, turns: your question as a compact block on the right with its chip and any image thumbnail; the answer full width under its live line or folded summary, any "Remembered" row, then the document; Copy on a finished answer) · the composer at the foot (chips, the box, Send or Stop).

**States**: empty (the quiet line), opened from "Ask about this" (chip in, focused), thinking (live line "Thinking"), a tool call in flight (live line), streaming, done (folded summary, opens to the list), remembered (the row with Undo and Edit), stopped (partial answer, a quiet "Stopped" line), failed (one line saying what happened and Try again; setup failures add Open Settings), a pasted image in the composer, long history with day dividers, loading (the Loaded standard).

### Assumed

- A1: The answer stays a document of blocks (paragraphs, math, derivations, statements, plots, tables, code, callouts), as the old spec built it.
- A2: Your question is a compact block on the right; the answer is full width on the pane's ground.
- A3: Past turns offer Copy only; history is append-only, no edit or retry of old turns. Asking about a selection of an old answer still works.
- A4: Stop keeps the partial answer with a quiet "Stopped" line; a failed turn freezes, says why in one line and offers Try again, plus Open Settings when the key is the cause.
- A5: Clear asks in a confirm beside it, counting the turns that go; memories stay (friction-matches-loss level two).
- A6: Sample data only on `/design`; the server's per-course conversation is part of the wiring change.

### Open

- The server keeps one conversation per book; per course (K1) waits on the courses model.

## Reversals

None of a locked decision. Against the old `design/workspace.md` spec (not binding after the design restart): the visible step feed of interleaved rows becomes one live line and a folded summary (K2, K3).

## Disagreements

None.

## Frontier

None: the high-weight questions are answered; the rest is under Assumed.

## Log

Jack, 2026-11-03: "lets move on while thats going" (the next item after the list pattern was the Ask pane grill).

### Batch 1

- Ask keeps one conversation per book today. In the course world, what is one conversation? Options: One per course (Recommended); One per set; Separate chats, listed. Answer: "One per course (Recommended)"
- While Ask works, it shows each tool call as a row ("Searched 'eigenvalue' · 6 pages"). After the answer is done, what happens to those rows? Options: Fold into one line (Recommended); Stay as rows, as today; Hide once done. Answer: "So I only want the current tool action to show, not a list of them as they come in. Then a summary folded to one line when its done."
- When you tell Ask to remember a preference ("I use V_0 for node voltages"), how does the answer show it saved? Options: A row with Undo (Recommended); Ask first; Silently. Answer: "A row with Undo (Recommended)"
- Ask opened with nothing attached and no history. What does the pane show? Options: A quiet line + composer (Recommended); Suggested questions. Answer: "A quiet line + composer (Recommended)"

### Batch 2

- Where does the finished answer's folded summary line ("Read 3 pages, searched twice") sit? Options: Top of the answer (Recommended); Foot of the answer. Answer: "Top of the answer (Recommended)"
- What can you attach to a question in Ask's composer? Options: Chips + paste an image (Recommended); Chips only, as today; Chips, images, any page. Answer: "Chips + paste an image (Recommended)"
- A course's conversation grows all term. How does its history show? Options: Endless, day dividers (Recommended); Today open, earlier folded. Answer: "Endless, day dividers (Recommended)"
- Should the composer have controls for how Ask answers (e.g. a Short / Full switch)? Options: None, say it in words (Recommended); A length switch. Answer: "None, say it in words (Recommended)"

### Batch 3

- Clicking a page chip ("p. 142") in an Ask answer does what? Options: Material on the other side (Recommended); A preview popover. Answer: "Material on the other side (Recommended)"
- Ask can sit in a wide side. How wide does an answer run? Options: Capped, about 680 (Recommended); Full pane width. Answer: "Capped, about 680 (Recommended)"
- While Ask is answering, can you type the next question? Options: Type, send when done (Recommended); Queue it; Box locked. Answer: "Type, send when done (Recommended)"
- "Ask about this" opens Ask that already has a long history. What do you see? Options: Bottom, chip in, focused (Recommended); A fresh start view. Answer: "Bottom, chip in, focused (Recommended)"
