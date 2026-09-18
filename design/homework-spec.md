# Homework page — UI spec (v1)

Grilled and decided 2026-09-14. Ships as stubbed UI only: every request goes
through a stub layer (`src/lib/stub-data.ts` pattern), the backend is untouched.
Real endpoints drop in later behind the same function signatures.

## Core model

An assignment is a persistent document: book + pasted source text → a
structured outline of questions, each with extracted text (or a question
image), cropped diagrams, page reference, and guide content. Both artifacts
render **deterministically from that outline**:

- The **guide** (walkthrough) renders from stored structured sections.
- The **PDF template** renders from the same question data.

The LLM's job ends when the outline changes. Every edit — LLM command or
manual delete — re-renders both artifacts instantly. No stale states, no
regenerate step, no LLM at render time.

## Navigation

- Study group in the sidebar becomes **Homework** and **Ask**. The
  "Study (soon)" and "Quizzes (soon)" placeholders are removed.
- Routes: `/homework` (dashboard) → `/homework/:id` (workspace).

## Dashboard (`/homework`)

Student-useful data first, archive second:

- **Due soon** strip: overdue first, then the next 7 days, sorted by date.
  Turned-in assignments leave this strip.
- **Stat chips**: due soon · in progress · turned in this week.
- **Archive**: searchable list of all assignments (title + book text match),
  filter chips for book and status (working / open / turned in). Rows show
  title, book cover dot + title, question count, due date, turned-in
  checkmark, relative updated time — the ask history row anatomy.
- **New homework** button opens the creation dialog.
- Empty states: no assignments ("Paste your first assignment" → opens the
  dialog), no books (link to Import), no search hits.

## Creation

- Dialog from the dashboard: book chip (ask's picker), paste area for the
  assignment text, optional due date. Submit creates the assignment and
  routes straight into its workspace.
- Generation starts immediately and runs **both** inline and as a
  **task-center job** (leaving the page is safe; the task center shows
  progress and completion).
- Inline: a staged progress card (Reading the assignment → Found N questions
  → Cropping diagrams → Writing the guide) while question cards stream in
  one by one, each appearing complete.
- No questions found or a failure: inline error state on the workspace with
  retry / adjust-the-text actions. Never a dead spinner.

## Workspace (`/homework/:id`)

Header row: title (inline rename), static book label (locked, like Ask's
dock composer), editable due date chip, turned-in toggle, delete assignment
( confirm dialog). Tabs below: **Guide | PDF**, with an always-visible
**Download** button in the tab row.

### Guide tab

- One card per question, in order:
  - Card head: question number, page chip (deep-links into the reader),
    hover actions — move up/down, delete, redo walkthrough.
  - Body: question text, or the question's image when the page has no
    extractable text; cropped diagram thumbnails underneath.
  - Guide section, **progressive disclosure**: setup + hints render open;
    "Show the work" reveals worked steps; "Show the answer" reveals the
    final answer. Reveal state is remembered per question.
  - Guide content uses the ask envelope cards (equation / steps / theorem /
    definition / note) rendered from structured data, not raw markdown.
- Delete is instant with an undo toast — the LLM can re-add a question, so
  no confirm dialog.
- **Composer** docked at the bottom (ask-style, same muscle memory):
  natural-language commands add, edit, remove, and reorder questions. While
  it works it shows a staged status ("Adding Q7 from p. 82…") and changed
  cards stream in; each touched question's guide regenerates as part of the
  same run. "Redo walkthrough" on a card regenerates just that one.

### PDF tab

- Live print preview: paper sheets rendered from the same outline, so the
  preview is always exactly what downloads.
- **One question per sheet**: question text/image, its cropped diagrams,
  working space fills the rest of the sheet. Questions never split across
  sheets; sheet count ≈ question count.
- **Sheet 1 header band**: assignment title, due date, and the question
  list with page refs (Q1 p. 58 · Q2 p. 59 · …), with Q1 beginning below it
  on the same sheet. Sheets 2+ carry just the question.
- Text renders as text when the book has it; the question image appears
  only where text extraction failed; diagrams are always image crops.
- Download is enabled whenever questions exist; in the stub it toasts a
  placeholder instead of emitting a file.

## Stub protocol

- All data lives in an in-memory stub module with API-shaped functions and
  fake latency; generation is a scripted sequence of timed fake events so
  streaming cards, staged progress, and the task-center job are all
  demonstrable. State resets on reload.
- Seed data: assignments in every state — generating, ready with mixed
  reveal states, turned in, overdue, and one with no due date — spread over
  two books.
- User-facing copy follows the app voice: plain, warm, no AI-tell phrases.

## Explicitly deferred (real build)

- Backend: assignment CRUD + generate job endpoints, LLM command handling,
  persistence in the store, task-center job type for generation.
- Actual PDF emission (the deterministic render contract is set by this
  spec's preview), download wiring, notifications beyond the task center.
- Reader deep links ("make homework from this page"), per-question density
  controls, and any grading/lifecycle beyond the turned-in checkmark.

## Testing

- Stub phase (deterministic, web): the pure render logic — outline → sheet
  layout (header band on sheet 1, one question per sheet, no splits) and
  reveal-state handling — follows the envelope-parser testing pattern.
- Real build: store owns data tests, engine owns generation-pipeline tests,
  api owns wire contracts, per the one-layer rule; prompt conformance lives
  in the token-cost tier.
