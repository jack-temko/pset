# Ask pane: grill

- status: In progress (branch `ask-pane`)
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

| #      | Decision                                                                                                                                                                                                                    | Why                                                                                                                                       | Beat                                                                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1     | One conversation per course, as today's one per book                                                                                                                                                                        | Last week's explanation stays in reach; the chip says which set                                                                           | One per set; separate chats listed                                                                                                                         |
| K2     | While Ask works, only the call in flight shows, on one line that replaces itself ("Searching 'eigenvalue'"). When the answer is done, the calls fold into one line ("Read 3 pages, searched twice") that opens to list them | Jack: "I only want the current tool action to show, not a list of them as they come in. Then a summary folded to one line when its done." | Rows stay, as today; rows hidden once done Amended: the row is a shimmering label with no spinner (K14), and each run folds to its own row in place (K15). |
| ~~K3~~ | ~~The live line and its folded summary sit at the top of the answer, under the question; the live line turns into the summary in place~~ **Reversed by K13.**                                                               | ~~Nothing moves when the answer starts or ends~~                                                                                          | ~~The foot of the answer~~                                                                                                                                 |
| K4     | A preference Ask saves shows as a quiet row in the answer, "Remembered: you use V_0 for node voltages", with Undo and Edit; the memory list shows it as New                                                                 | You see exactly what was kept                                                                                                             | Ask first with Keep; save silently                                                                                                                         |
| K5     | Ask with no history and nothing attached shows one quiet line, "Ask anything about ECE 210. It reads your materials.", above the composer                                                                                   | You came with a question; nothing to dismiss                                                                                              | Suggested questions                                                                                                                                        |
| K6     | The composer takes the problem or selected-line chip, as today, and a pasted or dropped image (your working, a figure)                                                                                                      | Show Ask your handwriting; questions hold images since #53                                                                                | Chips only; also any material page from a picker                                                                                                           |
| K7     | History is endless, with quiet day dividers ("Yesterday", "Sep 12") and Clear at the very top                                                                                                                               | Scroll back to last week                                                                                                                  | Today open, earlier folded                                                                                                                                 |
| K8     | No answer controls in the composer: the box, its chips and Send. "Briefly" in words works; a lasting wish is a memory                                                                                                       | One less control on every question                                                                                                        | A Short / Full switch                                                                                                                                      |
| K9     | A page chip ("p. 142") opens that material on the side not holding Ask, at that page, flashing its box as the work pane's page links do                                                                                     | One behaviour for every page link                                                                                                         | A preview popover                                                                                                                                          |
| K10    | Answer text stops at about 680 wide, left-aligned in the pane; plots and tables may use the full width                                                                                                                      | A readable line in a wide side                                                                                                            | Full pane width                                                                                                                                            |
| K11    | While Ask answers, the box stays editable; the button reads Stop until the answer ends, then Send. Nothing queues                                                                                                           | Keep your thought without a hidden queue                                                                                                  | Queue it; lock the box                                                                                                                                     |
| K12    | "Ask about this" opens Ask scrolled to the latest turn, the chip in the composer and the cursor in the box                                                                                                                  | Type at once; last time's answer stays in view above                                                                                      | A fresh start view with history hidden                                                                                                                     |
| K13    | Steps sit where they happened, interleaved with the answer's text: a paragraph, a step row, more text. The answer has no bubble                                                                                             | Look like the Claude desktop app; the order tells what was done before each claim                                                         | Steps gathered at the top of the answer (K3)                                                                                                               |
| K14    | While a run of steps goes, one row names the current step ("Searching 'eigenvalue'") with a light sweeping across the text, in both themes. Consecutive steps share the one row. No spinner                                 | Keeps K2's "only the current tool action"; the shimmer is how Claude shows work                                                           | A spinner and a list                                                                                                                                       |
| K15    | Each run of steps becomes one quiet row in its place, "Searched twice, read 3 pages", as tall as when it ran. Opening it shows a small timeline, an icon per step on a thin line                                            | Nothing jumps when the row turns; history stays short                                                                                     | One summary for the whole answer                                                                                                                           |
| K16    | While text streams and no step runs, a small PSet mark pulses after the last words, gone when done. No "Writing" label                                                                                                      | Shows life without words; removes the assumed "Writing"                                                                                   | A Writing label                                                                                                                                            |
| K17    | Before the first step or word, a shimmering "Thinking" row, replaced by the first step row or the first words; nothing left behind                                                                                          | The wait is named, then leaves no trace                                                                                                   | A spinner; Thinking left in place                                                                                                                          |
| K18    | Copy is the only action: shown while the pointer is over the answer, its space always reserved; the latest answer always shows it                                                                                           | Quiet history, one action                                                                                                                 | Copy always shown                                                                                                                                          |
| K19    | A quiet "Not from your course" tag on a block the model added on its own; nothing is marked "generated". Cites course-first                                                                                                 | Mark only what is off-course                                                                                                              | Marking every answer                                                                                                                                       |
| K20    | Asking about a selection of an old answer waits for one change for both this pane and the work pane                                                                                                                         | One behaviour for both panes                                                                                                              | Building it for Ask alone                                                                                                                                  |

### The artifact(s)

**Top to bottom**: the conversation (Clear at its very top, day dividers, turns: your question as a compact tinted block on the right with its chip and any image thumbnail; the answer with no bubble, any "Remembered" row, then the document in order with a quiet step row wherever Ask took steps; Copy on hover) · the composer at the foot (chips, the box, Send or Stop).

**States**: empty (the quiet line), opened from "Ask about this" (chip in, focused), thinking (a shimmering "Thinking" row), a step running (one shimmering row), writing (the pulsing mark), streaming, steps done (folded rows, which open to a timeline), a block "Not from your course", remembered (the row with Undo and Edit), stopped (partial answer, a quiet "Stopped" line), failed (one line saying what happened and Try again; setup failures add Open Settings), a pasted image in the composer, long history with day dividers, loading (the Loaded standard).

### Assumed

- A1: The answer stays a document of blocks (paragraphs, math, derivations, statements, plots, tables, code, callouts), as the old spec built it.
- A2: Your question is a compact block on the right; the answer is full width on the pane's ground.
- A3: Past turns offer Copy only; history is append-only, no edit or retry of old turns. (Asking about a selection of an old answer is deferred, K20.)
- A4: Stop keeps the partial answer with a quiet "Stopped" line; a failed turn freezes, says why in one line and offers Try again, plus Open Settings when the key is the cause.
- A5: Clear asks in a confirm beside it, counting the turns that go; memories stay (friction-matches-loss level two).
- A6: Sample data only on `/design`; the server's per-course conversation is part of the wiring change.

### Open

- Asking about a selection of an old answer waits for one change shared with the work pane (K20).
- The server keeps one conversation per book; per course (K1) waits on the courses model.

## Reversals

K3 (steps at the top of the answer) is reversed by Jack's own later answer K13 (steps in order, like Claude), after he asked to restart the tool-call questions on the Claude desktop app's pattern. K2 stands: only the current action shows while it runs.

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

## Batch 4 and 5 (Claude-style)

Jack, 2026-11-04: "So I want this to look like Claude desktop desktop app when talking. So do some research on how tool calls, responses, ect, are shown, streamed, and compacted on the UI. Then restart those particular gril questions"

### Batch 4

- Where do an answer's steps sit? Options: In order, like Claude (Recommended); Top of the answer (K3). Answer: "In order, like Claude (Recommended)"
- How does a running step show? Options: Shimmering label (Recommended); Spinner and list. Answer: "Shimmering label (Recommended)"
- How does a finished run of steps show? Options: Each group to one row (Recommended); One summary for the answer. Answer: "Each group to one row (Recommended)"
- While text streams and no step runs? Options: A small mark at the end (Recommended); A Writing label. Answer: "A small mark at the end (Recommended)"

### Batch 5

- Before the first step or word? Options: "Thinking" shimmer, then gone (Recommended); A spinner. Answer: ""Thinking" shimmer, then gone (Recommended)"
- What actions on an answer? Options: Copy, on hover (Recommended); Always shown. Answer: "Copy, on hover (Recommended)"
- What marks an answer as the model's own? Options: Mark only off-course parts (Recommended); Mark every answer. Answer: "Mark only off-course parts (Recommended)"
- Asking about a selection of an old answer? Options: Later, with the work pane's (Recommended); Now, for Ask alone. Answer: "Later, with the work pane's (Recommended)"
