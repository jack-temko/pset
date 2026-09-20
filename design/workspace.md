# The book workspace

`/books/{sha}` — the app's heart, and its one filled screen
(`AppShell scroll="fill"`). Decisions from the 2026-09-18 grill; each is
settled, not open.

## Frame

Three panes under the top bar: contents rail (256) · page scan (flex) ·
panel (440). Each scrolls independently; the frame never moves. The top
bar's middle names the book.

- **Focus** widens the panel by collapsing the rail; the scan shrinks but
  stays visible. The toggle sits right of the panel's tabs.
- The panel is always open, and remembers **per book** which tab it showed.

## Page scan

- **Continuous vertical scroll** — pages stack like a PDF reader.
- Pages are **backend-rendered images**, lazy-loaded `<img>`s. No pdf.js.
- Chrome is one **floating pill**, bottom-center: page indicator · zoom.
  Appears on hover/scroll, fades when idle. The scan is otherwise
  edge-to-edge paper.

## Contents rail

- **TOC only** — the chapter/section tree as an ActionList, current
  section highlighted, page numbers in mono on the right.
- A book with **no usable TOC has no rail** — the scan takes the width,
  and Focus simply has less to collapse.

## Ask (panel tab)

The backend is an **agentic loop**: the model holds tools — searching
pages, extracting text, solving math, rendering chat cards — and how a
question gets page context is deliberately left open until that loop is
built.

- **Visible step feed**: each tool call renders as its own quiet row in
  the transcript, as it happens, and stays. One line per call — verb,
  object, count ("Searched 'eigenvalue' · 6 pages") — no expansion.
- **Turns are asymmetric**: the question is a compact `primary-soft`
  block on the right; the answer is full-width quiet text on the panel
  ground. The answer **streams** in after the steps.
- **Citations are inline page chips** — a distinct small mono element
  ("p. 142") in the prose, not underlined text and not a card. Click
  scrolls the scan there and flashes the page's edge.
- **Math renders inline and display**, KaTeX. Answers about a math book
  are math; half-rendering looks broken.
- **Send becomes Stop** while the loop runs; stopping freezes the feed
  and keeps the partial answer with a "stopped" note.
- **A failed loop** freezes the feed, says what happened in one
  destructive-ink line, and offers Try again. Partial text stays.
- **Past turns**: Copy on the answer, nothing else — history is
  append-only, no edit, no retry of old turns.
- **Endless history with day dividers** (quiet centered hairline:
  "Yesterday", "Sep 12"); the very top of the transcript carries
  "Start of conversation · Clear" with a confirm.
- Empty conversation: a prompt line plus one short sentence of what the
  agent can do. No generated suggestions.
- One running conversation per book (locked earlier).

## Homework (panel tab)

- **List → walkthrough**, both in the panel: the book's assignments as
  rows (Box + Door), opening one fills the panel with its walkthrough,
  back link at top.
- **Creation is two acts, not one** (2026-09-20 grill). Making a set and
  filling it are different decisions, so they are different dialogs:
  - **New homework** — title (required, because an unnamed set still
    shows up in the list and on Home) and an optional due date, a
    native `<input type="date">`. Nothing about questions. Creating
    lands you in the set's empty walkthrough.
  - **Add questions** — a stack of rows, one question each: a field
    that grows as you type, a **"In this book" checkbox per row**, and
    a remove button that is always visible and disabled on the only
    row. Enter adds a row below and moves into it; Cmd/Ctrl+Enter
    submits. Submit adds every non-empty row at once, drops the blanks
    silently, and closes.
  - Both leave the same way: **Cancel in the footer, or Esc**. No X in
    the corner — one job, one control.
- **Not every question is in the book.** A professor's own problem still
  needs a walkthrough. An unchecked row skips the engine's locate stage:
  it gets **no page chip and no scan jump**, and is otherwise identical
  — same statement, same two veiled stages, same Complete.
- **Progressive rows**: questions appear as they are located, each with a
  quiet working state until its guide is ready ("Finding it in the
  book…", or "Writing the guide…" when there is nothing to find).
- Walkthrough per question: two veiled stages and a Complete checkbox,
  detailed below. Reveals and marks persist; progress is questions
  marked done.
- **Print** (questionScale/figureScale template) is an action in the
  walkthrough's header, beside the `+`.
- A Home due-row click lands **straight in that walkthrough**, scan on
  the question's page.

### Walkthrough (2026-09-18 grill)

- **One question at a time**: prev/next plus a "3 of 8" position row.
  440px is one problem's screenful; focus is the point.
- **Statement = extracted text + figure crops** (math rendered), never a
  flat page image.
- **Scan jumps on demand**: a page chip in the question header; opening a
  question never moves the scan by itself.
- **Two stages, both veiled**: *hint* and *walkthrough* — the walkthrough
  carries the solution, so there is no separate approach step. Each sits
  behind frosted glass (the `Veil`) from the start: the content is laid
  out at its true size, blurred, with "Show hint" / "Show walkthrough"
  over it. One click lifts it. No sequence, no skip link — both are
  always available, and the student is an adult. Stages reuse the
  transcript's pieces (math, page chips).
- **Complete is a checkbox**, not a button, and it does exactly one
  thing: marks the question done. It never advances — you move on when
  you decide to, not when the app decides for you — and unchecking is
  the undo. Progress is the count of checked questions, shown in the
  list row; a finished set carries a Turn in affordance there. Done is
  a fact, not a party.
- **"Ask about this"** on every question flips to the Ask tab with the
  problem as context — the canned guide's escape hatch.
- **Failed question**: one line saying why, Try again, and "It's on
  page …" — a typed page relocates from human knowledge.
- **Sets are editable: add, remove and reorder.** The controls sit inline
  on the question you are looking at — move up, move down, remove, as
  quiet icon buttons beside its page chip — because the walkthrough is
  the only view of the set there is. The system has no menu component,
  and this did not justify inventing one.
- **Turn in is manual** (header overflow), undoable; turned-in sets drop
  to a collapsed group at the list's bottom and leave Home's due list.
- **Every "make one" is a `+`**, and nothing lives at the bottom of a
  list but the Door: `+` on the Assignments box header opens New
  homework, `+` in the walkthrough header opens Add questions. The same
  gesture as importing a book on Home.

## Panel header

One row: **Ask | Homework as UnderlineNav tabs** left, Focus toggle
right. Nothing else — the walkthrough owns its own back link, `+` and
Print.
