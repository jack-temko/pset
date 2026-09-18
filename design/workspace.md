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
- Creation keeps the backend's shape: **paste the assignment text** in a
  dialog (title, due date optional); the engine extracts, locates and
  guides each question. The flow gets rewritten to match the UI but the
  paste-text idea stays.
- **Progressive rows**: questions appear as they are located, each with a
  quiet working state until its guide is ready.
- Walkthrough per question: **hint → approach → full solution**, revealed
  in order, plus a **"got it" mark**. Reveals and marks persist; progress
  is questions marked done.
- **Print** (questionScale/figureScale template) is an action in the
  walkthrough's header.
- A Home due-row click lands **straight in that walkthrough**, scan on
  the question's page.

### Walkthrough (2026-09-18 grill)

- **One question at a time**: prev/next plus a "3 of 8" position row.
  440px is one problem's screenful; focus is the point.
- **Statement = extracted text + figure crops** (math rendered), never a
  flat page image.
- **Scan jumps on demand**: a page chip in the question header; opening a
  question never moves the scan by itself.
- **Reveals are sequential but skippable** — hint, then approach, then
  solution, with a quiet skip-to-solution always present. The student is
  an adult. Guide stages reuse the transcript's pieces (math, page chips).
- **"Got it" marks done and advances** to the next unfinished question.
  When the last one is marked: quiet close back to the list, the row
  showing 8 of 8 with a Turn in affordance. Done is a fact, not a party.
- **"Ask about this"** on every question flips to the Ask tab with the
  problem as context — the canned guide's escape hatch.
- **Failed question**: one line saying why, Try again, and "It's on
  page …" — a typed page relocates from human knowledge.
- **Sets are editable: add and remove** questions (paste more text to
  add; remove from the question's overflow). No reorder yet.
- **Turn in is manual** (header overflow), undoable; turned-in sets drop
  to a collapsed group at the list's bottom and leave Home's due list.
- **New homework is a dialog**: paste box, optional title (auto-named
  when blank), optional due date; the list then fills progressively.

## Panel header

One row: **Ask | Homework as UnderlineNav tabs** left, Focus toggle
right. Nothing else — the walkthrough owns its own back link and Print.
