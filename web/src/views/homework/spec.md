# Homework panel

purpose: pick up a set after a long day and finish it, one hard question at a time, with how far along you are always in view. The current question is the center; progress and time left sit in the header; everything else is one click away.

where: the book workspace's right panel, the Homework tab (Ask | Homework). 440px wide, 800px in Focus. Full height, scrolls inside. A book always opens on this tab, at the list. Code: `web/src/views/homework/` (`index.tsx` list, `walkthrough.tsx`, `finish.tsx`, `help.tsx`, `progress.ts`, `failed-question.tsx`). How it was decided: `grill.md` beside this file (decisions D1 to D35, reversals R1 to R11). Screen spec and older history: `design/workspace.md`, "Homework (panel tab)".

## student

hour 7, 1am, Night theme, glancing between the scan and the panel, low patience, low working memory. Has been in class all day. Each question is long and hard, so it is the center of attention. Wants to know how far along they are and roughly how long is left, without being nagged. Reads a hint, tries, opens more only when stuck. Wants to finish a question and move on in one step.

## flow

1. The book opens on Homework, at the list. Each set shows a bar (one segment per question, as wide as it is hard), "n of m done", and the time left when that is known, else when it is due. One click opens a set.
2. The set opens on its next unfinished question (from Home's due row too). A set that is already all done opens on its finish page.
3. The question: the header carries the count ("2 of 8", which opens the list of questions), the time left in gray, the set's menu, and the bar as its bottom edge. Below it: the label, Show in book, the question's menu; the statement and figure; the professor's notes (only if there are any); then three rows: Hint, Walkthrough, Answers, each saying how long it is.
4. Open a row (click, or 1 2 3). It stays open. Work on paper.
5. The one button: **Next question** marks it done and goes to the next unfinished one, wrapping round; **Mark incomplete** on a done question takes it back in place; **Skip for now** on a question that cannot be finished yet (being written, failed, no guide) moves on without marking it.
6. When the last unfinished question is done, the finish page fills the pane: a line for the hour, total and per-question time, a bar of time per question with the longest marked, the two hardest, Turn in.
7. Exits: Back to the list; Ask about this to Ask, and its tab back to the same question; Show in book jumps the scan; Open Settings from a setup failure.
8. Re-entry after a break: the list, with bars and counts. The set opens on its next unfinished question.

keys: left and right browse; 1 2 3 open or close the rows; Enter on the focused button. Off while typing, in a menu or in a dialog, and they work while focus is inside the panel.

budget: open a set in 1 click from the list. Per question with a written guide: at most 4 clicks (three rows and Next), 0 typing. Never more than 1 primary action visible.

## anatomy

- `HomeworkTab` (list or walkthrough by `openId`)
  - `AssignmentReads`: reads in progress, ready, failed (rows with Review, Try again, dismiss)
  - `Box` of `SetRow`s: title, `ProgressBar`, "n of m done · time left" (or the due line), `HomeworkStatusLabel`; last row is the New homework `DoorAction`
  - turned-in `Box` (no bars)
  - `AddHomeworkDialog`, `HomeworkDialog` (edit title and date)
- `Walkthrough` (one set), keyed by the set
  - header, one row: Back, set title (truncates), Turned in label, the count as a `Menu` ("Questions": each question with its state word, the current one ringed, "All done" once every one is, which opens the finish page), time left in gray, the set `Menu` (Add questions, Box one on the page, Edit, Print worksheet, Turn in, Delete); the `ProgressBar` is the row's bottom edge
  - question row: label, done check, **Show in book** button (only when it has a page), question `Menu` (Move up, Move down, This isn't the right problem, Edit or Add the professor's instructions, Check how the figure reads, What the guide remembered, Remove this question)
  - statement (`Runs`), figures, `ProfessorNotes` (read-only box; its editing state is opened from the question menu), `FigureReading` (only when flagged "Check it", or asked for)
  - `FailedQuestion` (title, reason, the ways out by failure kind, paste-the-problem fallback)
  - `WorkingLine` or a waiting sentence; `HelpRows` (three `Disclosure` rows; Writing or Waiting while they are not there yet); `MemoryLines` (only when asked for); `UsageLine`
  - footer: Ask about this, and the one primary button (`Button`, primary for Next question, outline for the others)
  - Focus: the same pieces in two columns, the question on the left, the help on the right
- `Finish`: greeting line (`greetings.ts`, Home's seven stretches), two `StatTile`s, the time-per-question bars, `Box` of the hardest, footer with Back to list and Turn in
- pure logic: `progress.ts` (marks, next unfinished, the one button, time left), `keys.ts`, `finish-stats.ts`, `help-meta.ts`; tests beside them

## states

| state | shows | scenario |
|---|---|---|
| list, populated | active sets with bar, count, time left, due flag; "+ New homework"; turned-in sets below | `happy` |
| list, empty | one sentence, New homework | `empty` |
| list with reads | reading (time left), ready (Review), failed (Try again) | `importing` |
| list, back after a break | overdue and due-today flags with progress | `return-after-break` |
| opening a set | lands on the next unfinished question | `handoff-in` |
| set loading | skeleton header and rows at real size | `slow` |
| question ready | header with count, bar, time left; the three rows; Ask about this and Next question | `happy` |
| question done | a check; the button reads Mark incomplete | `return-after-break` |
| question queued | "Found on p. N. Its guide starts once every question is found."; rows Waiting; Skip for now | `slow` |
| question being written | spinner line with time left; Hint opens when it lands, the others say Writing; Skip for now | `happy` |
| question failed, by kind | the failed block with its ways out; Skip for now | `failed` |
| question with no guide | "This question has no guide yet." and Write the guide; Skip for now | `no-guide` |
| finish page | as above; reached by the last Next, from the count's list, or by opening a set that is all done | `finish` |
| turned in | a label in the header; Turn in checked in the set menu; the finish page says Turned in | `return-after-break`, `finish` |
| focus | two columns | `?wide=1` |
| ask and back | Ask about this opens the Ask stub with the chip; its tab returns to the same question | `handoff-in` |
| long set | 24 questions: the bar segments thin, the count's list scrolls | `long-set` |
| long title | the title truncates; count, time left and bar never move | `long-title` |

## actions

- Open a set: list row click; the walkthrough opens on its next unfinished question.
- Open or close a row: click or 1 2 3; `PATCH /api/questions/:id {reveal}` the first time, applied at once.
- Next question: `PATCH {done: true}`, then the next unfinished (wrapping); the finish page when none is left.
- Mark incomplete: `PATCH {done: false}`, stays on the question.
- Skip for now: moves to the next unfinished, marks nothing; disabled when it is the only one left.
- Browse: left and right keys, or pick a question in the count's list. Choosing a question never moves the scan.
- Move up or down, Remove (asks first under its row), This isn't the right problem (starts boxing), Edit the professor's instructions (opens the notes box, prefilled): in the question menu.
- Turn in: on the finish page, or a check item in the set menu; taken back by choosing it again.
- Try again, Look there, Use this text, Show me where it is: the failed question's ways out.

## handoffs

out:
- Ask about this -> Ask tab -> the question's label and statement as a chip on the composer -> the Homework tab is still mounted, so it returns to the same question and scroll within a visit. A reload is a new visit and opens the list.
- Show in book -> page scan -> the question's PDF page -> nothing to return, the scan is beside the panel. (The problem's position on its page is not built yet.)
- Open Settings (setup failure) -> Settings -> nothing -> leaves the workspace.
- Edit book (numbering unsure) -> the Book dialog.

in:
- Home due row -> `/books/:id/homework/:set` -> opens that set on its next unfinished question.
- Boxing added a question -> opens on it.

## data

reads:
- `useBookHomework` | `GET /api/books/:bookId/homework` | `List`; each set will also carry `estimate`, `timed` and `bar` (see wants)
- `useHomeworkSet` | `GET /api/homework/:id` | `Detail`; polls every 5 s while any question is outstanding; each question will also carry `difficulty` and `seconds`
- `useAssignmentReads`, `useAssignmentSource`, `useLineReadings`, `useMemories`: as before

writes:
- `useUpdateQuestion` | `PATCH /api/questions/:id` (reveal, done, position, notes, reading) | optimistic
- `useUpdateHomework` | `PATCH /api/homework/:id` | optimistic, rolls back
- `useRemoveQuestion` | `DELETE /api/questions/:id` | optimistic
- `useRetryQuestion`, `useWriteGuide`, `useRedoReading`, `usePointOut`, `useNewHomework`, `useAddQuestions`, `useAddBoxed`, `useDeleteHomework`, `useStartRead`, `useImportAssignment`, `useRetryRead`, `useDismissRead`: as before

events: `question.changed` (higher `rev` wins), `question.removed`, `homework.changed`, `homework.removed`, `assignment.changed`, `assignment.removed`.

What the view computes itself, from the questions: the marks, "n of m", where Next goes, the queue place, the state words. What the backend will send: difficulty per question, seconds per question, the set's estimate.

## why

- **The question is the center; progress is a thin line, not a row.** The header is one row: the bar is its bottom edge, the count opens the list. Rejected: a strip of tall marks per question (too tall), a second progress row.
- **One primary button.** Next question does what two targets far apart did (Complete, then Next). Rejected: a Complete checkbox beside arrows.
- **Skip for now never marks anything done.** A question that cannot be finished yet is not finished. It keeps coming back until it is done.
- **Rows that open in place, not veils.** The length is said in words before you open it, and what you opened stays open. Rejected: frosted glass (Jack: "I don't like the frosted").
- **One way to edit the professor's notes.** The question's menu; the box is read-only. Rejected: a second Edit button on the box.
- **Hidden until asked:** the figure's reading (unless flagged), the guide's memory lines, move and remove, the notes prompt, "Not the right problem?". The student rarely needs them; the question menu holds them.
- **The estimate must never be confidently wrong.** Nothing until two questions are timed; "about"; rounded to five minutes; a range when the spread is wide; never a live countdown. The guard lives in `timeLeftWords` and in the backend's estimate, and a test feeds timed sets to check its error.
- **A book opens on the Homework list, and both tabs stay mounted.** Ask and back is the same question with nothing to remember; a reload resets, on purpose.
- **A wait shows only once it has lasted** (`useSettled`), so a step that takes a moment never flashes a state.
- **The guide lands in space already made for it.** Skeletons at a row's usual size, still while queued, shimmering only for work.
- **A failure names what failed and offers the way out that fits**, and never blames the student.

## friction

Last walked through 2026-09-30, on the redesigned view. The redesign closed the earlier F1 (both tabs stay mounted), F2 (the list rows), F3 (the question menu), F4 (the count's list), F7 (the row order) and F8 (the one button).

| id | where | what goes wrong for a tired student | severity | fix | status |
|---|---|---|---|---|---|
| F9 | tab order | From the panel tabs to the first help row is 6 stops in `/views` and 7 in the workspace (the Focus toggle is live there); the acceptance number is 6. | polish | accepted (post-build P3): the keys 1 2 3 reach the rows directly | accepted |
| F10 | ready question | 14 controls are visible (13 is the target); the usage line's toggle is the extra one. | polish | accepted (post-build P2): the usage line stays | accepted |
| F5 | waiting sentence | "Queued: it starts once the questions ahead of it are written" still gives no place in line and no time. | friction | "3rd in line", derived from the set's questions | open |
| F6 | failed, unavailable | A second failure reads the same as the first. | friction | say it failed again (needs `attempts`, backend) | open |
| F11 | time left | Shows only when the mock or the backend sends an estimate; until the real backend sends difficulty, seconds and an estimate, the bar is equal segments and there is no time. | friction | phase B of `ideas/homework-redesign.md` | open |

## wants

- Backend (phase B): `difficulty` per question from a ranking step after find; `seconds` per question from study stretches tagged with the question; the set's `estimate` with `low` and `high`; `attempts` and `failedAt`; `timed` and a per-question `bar` on the list's summaries.
- Ask taking a context reference (a question id) on a turn, so the chip carries the whole question and not only its text.
- The problem's position on its page, so Show in book can land on it (filed; needs an engine change).

## open

- Whether the time left also shows on Home's due rows (out of scope here).
- Homework-only helpers still live in `web/src/pages/workspace/` (`add-homework.tsx`, `assignment-reads.tsx`, `reading.tsx`, `notes.tsx`, `import-state.ts`, `memory.tsx`): move them under this view with the next pass.

## links

`grill.md` (this redesign's decisions and log), `design/workspace.md` (Homework panel tab, Walkthrough), `design/design-system.md` (Motion), `ideas/homework-redesign.md` (the build), components: `box`, `door`, `disclosure`, `progress-bar`, `label`, `menu`, `confirm`, `skeleton`, `spinner`, `stat-tile`, `usage`.
