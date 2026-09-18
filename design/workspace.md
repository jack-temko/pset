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
  the transcript, as it happens, and stays.
- Cards, first two: **page citation** (names pages + snippet; click
  scrolls the scan there) and **rendered math** (display blocks).
- **Send becomes Stop** while the loop runs; stopping freezes the feed
  and keeps the partial answer with a "stopped" note.
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

## Panel header

One row: **Ask | Homework as UnderlineNav tabs** left, Focus toggle
right. Nothing else — the walkthrough owns its own back link and Print.
