# Homework panel

purpose: the student's homework in one place: the book's sets, then one set's walkthrough, a question at a time, each with its guide written and waiting behind veils.

where: the book workspace's right panel, the Homework tab (Ask | Homework). 440px wide, 800px in Focus. Full height, scrolls inside. Code: `web/src/views/homework/` (`index.tsx` list, `walkthrough.tsx`, `failed-question.tsx`). Screen spec and decision history: `design/workspace.md`, "Homework (panel tab)".

## student

hour 7, 1am, Night theme, glancing between the scan and the panel, low patience, low working memory. Opens the panel to answer one thing: what do I do next, and can I trust the guide. Reads a hint, tries, reveals more only when stuck. Wants to tick a question off and move on. Will not read a paragraph to find out why something is waiting.

## flow

1. Panel opens on Homework. The list shows active sets (title, "n of m questions", due line, a flag if soon or overdue), turned-in sets under a quiet label, reads in progress on top.
2. Open a set (one click). It opens on the first question not complete, or from Home's due row, straight here.
3. The question: label, page chip, statement, figure. Below: the professor's notes, the figure's reading, then hint, walkthrough, answers, each veiled.
4. Reveal what is needed (one click a stage), read, work on paper.
5. Tick Complete. It does not advance. Next question (one click), or Previous.
6. Exits: Back (chevron) to the list; "Ask about this" to Ask; a page chip jumps the scan; Open Settings from a setup failure.
7. Re-entry after a break: the list, with counts. The set opens on the first incomplete question, not where the student was.

budget: resume a set in 1 click from the list. Per question with a written guide: at most 4 clicks (hint, walkthrough, Complete, Next), 0 typing, 1 decision. Never more than 1 primary action visible.

## anatomy

- `HomeworkTab` (list or walkthrough by `openId`)
  - `AssignmentReads`: reads in progress, ready, failed (rows with Review, Try again, dismiss)
  - `Box` of `SetRow`s: title, counts and due line, `HomeworkStatusLabel`; last row is the New homework `DoorAction`
  - turned-in `Box`
  - `AddHomeworkDialog`, `HomeworkDialog` (edit title and date)
- `Walkthrough` (one set)
  - header: Back, set title, Turned in label, "n of m", `Menu` (Add questions, Box one on the page, Edit, Print worksheet, Turn in, Delete)
  - question header: label, `PageRef`, done check, move up and down, remove (`ConfirmPopover`)
  - statement (`Runs`), figures, "Show me where it is", `ProfessorNotes`, `FigureReading`
  - `Stage` x3 (hint, walkthrough, answers) each a `Veil` over a `Document`; `StageSkeleton` while writing
  - `FailedQuestion` (title, reason, the ways out by failure kind, paste-the-problem fallback)
  - `WorkingLine` or a waiting sentence; `MemoryLines`; `UsageLine`
  - footer: Ask about this, Previous, Next, Complete

## states

| state | shows | scenario |
|---|---|---|
| list, populated | active sets, turned-in sets | `happy` |
| list, empty | one sentence, New homework | `empty` |
| list with reads | reading (time left), ready (Review), failed (Try again) | `importing` |
| list, back after a break | overdue and due-today flags, counts | `return-after-break` |
| set loading | skeleton at real size | `slow` |
| question queued | statement skeleton (still), "Queued: ..." sentence | `slow` |
| question being found, read, written | spinner line with what it is doing and time left; skeletons that fill in; hint lands before the walkthrough | `happy`, `handoff-in` |
| question ready | veiled stages; revealed ones stay revealed | `handoff-in` |
| question failed, by kind | generation, not found, unavailable, setup, each with its own ways out | `failed` |
| arrived from Home | opens on the first incomplete question | `handoff-in` |
| after reload, mid-write | same as arrival; the write continues | `mid-flow-reload` |

## actions

- Open a set: list row click, walkthrough opens.
- Reveal a stage: click the veil, `PATCH /api/questions/:id {reveal}`, applied at once.
- Complete: checkbox, `PATCH {done}`, applied at once, does not advance (taking it back must be as easy).
- Next, Previous, move up and down: local index (moving follows the question).
- Remove a question: trash asks in place (`ConfirmPopover`), then `DELETE`.
- Try again, Look there, Use this text, Show me where it is: the failed question's ways out; boxing starts a session on the scan.
- Turn in: a check item in the header menu, taken back by choosing it again.
- Ask about a selection: hover washes a guide element (a block, a derivation line, a part or step heading, which takes its whole group), a click outlines it, the toolbar's button composes the About (the question and the exact selection) and hands it up as the chip; Esc, the toolbar's or the chip's ✕, or clicking the outlined element again drops outline and chip together (design/workspace.md, "Asking about a selection").

## handoffs

out:
- Ask about this -> Ask tab -> the question's label and statement as a chip on the composer -> Back: not designed. The tab switch unmounts the Homework tab, so the open set and question are lost (see friction F1).
- page chip, Show me where it is -> page scan, or a boxing session -> the PDF page -> nothing to return, the scan is beside the panel.
- Open Settings (setup failure) -> Settings -> nothing -> leaves the workspace.
- Edit book (numbering unsure) -> the Book dialog.

in:
- Home due row -> `/books/:id/homework/:set` -> opens that set on the first incomplete question.
- Boxing added a question -> opens on it.

## data

reads:
- `useBookHomework` | `GET /api/books/:bookId/homework` | `List`
- `useHomeworkSet` | `GET /api/homework/:id` | `Detail`; polls every 5 s while any question is outstanding, as a backstop for a missed event
- `useAssignmentReads` | `GET /api/books/:bookId/assignments/reads` | `AssignmentReads`
- `useAssignmentSource` | `GET /api/books/:bookId/assignments/source` | `AssignmentSource`
- `useLineReadings` | `POST /api/books/:bookId/references` | `LineReadings`
- `useMemories` | `GET /api/books/:bookId/memories` | memory lines under a guide

writes:
- `useUpdateQuestion` | `PATCH /api/questions/:id` (reveal, done, position, notes, reading) | optimistic
- `useUpdateHomework` | `PATCH /api/homework/:id` | optimistic, rolls back
- `useRemoveQuestion` | `DELETE /api/questions/:id` | optimistic
- `useRetryQuestion`, `useWriteGuide`, `useRedoReading`, `usePointOut` | `POST /api/questions/:id/retry|guide|boxes`, `PATCH reread` | forced to pending at the old rev
- `useNewHomework`, `useAddQuestions`, `useAddBoxed`, `useDeleteHomework`, `useStartRead`, `useImportAssignment`, `useRetryRead`, `useDismissRead`

events:
- `question.changed` -> patch the question into its set, higher `rev` wins
- `question.removed`, `homework.changed`, `homework.removed` -> patch or drop
- `assignment.changed`, `assignment.removed` -> the reads list

## why

- **Every stage is veiled, one click each.** Nothing is spoiled by accident, and no buttons to sequence. Rejected: a stepper that makes the student walk through hint, then approach, then solution.
- **Complete is a checkbox and does not advance.** Done has to be as easy to take back as to claim. Rejected: a Done button that moves on.
- **The guide lands in space already made for it.** Skeletons at a stage's usual size, so nothing moves when text arrives; still while queued, shimmering only for work.
- **A wait shows only once it has lasted** (`useSettled`), so a step that takes a moment never flashes a state.
- **A failure names what failed and offers the way out that fits**, and never blames the student.
- **Opens where you would pick up**: the first question not complete.

## friction

| id | where | what goes wrong for a tired student | severity | fix | status |
|---|---|---|---|---|---|
| F1 | Ask about this, Open Settings, any tab switch | The Homework tab unmounts: the open set, the question and the scroll are gone. Coming back lands on the list. | blocker | keep the panel's homework place (set, question) above the tab, and make Back from an Ask that came from a question return to it | open |
| F2 | list rows | "1 of 4 questions" does not say where to resume. The student opens the set to find out. | friction | say it on the row: "Next: 4.32" | open |
| F3 | question header | Move up, move down and remove sit beside the page chip at the same weight: four small icon targets for actions used once a week. | polish | move them into the header menu | open |
| F4 | walkthrough | With ten questions, the only way to a question is Previous and Next. No view of which are done, waiting or failed. | friction | a strip of the set's questions by label, with state | open |
| F5 | waiting sentence | "Queued: it starts once the questions ahead of it are written" gives no place in line and no time. | friction | "3rd in line, about 4 minutes" from the eta the view already keeps | open |
| F6 | failed, unavailable | Try again with no hint of whether to wait. A second failure reads the same as the first. | friction | say it failed again, and after how long to try | open |
| F7 | tab order | Reaching the hint takes six tab stops (page chip, Show me where it is, notes, figure reading, Correct). | friction | move the veils above the correction tools, or make them the first stops after the statement | open |
| F8 | Complete | Complete, then Next: two clicks and two targets far apart, for the most repeated act. Locked as it is (design/workspace.md), so raise, do not change. | polish | after Complete, promote Next as the primary action | raise with Jack |

## wants

- Ask taking a context reference (a question id) on a turn, so the chip carries the whole question (statement, figure, guide state) and not only its text. Fits the locked "one running conversation per book": the chip is context in that conversation.
- Per-question queue position and an estimate from the job lane, for F5.

## open

- Homework-only helpers still live in `web/src/pages/workspace/` (`add-homework.tsx`, `assignment-reads.tsx`, `reading.tsx`, `notes.tsx`, `import-state.ts`, `memory.tsx`): move them under this view with the next pass.
- How a handoff's return is carried: a `from` in the URL, or router history state. It must survive a reload.

## links

`design/workspace.md` (Homework panel tab, Walkthrough), `design/design-system.md`, components: `box`, `door`, `veil`, `label`, `menu`, `confirm`, `skeleton`, `spinner`, `usage`.
