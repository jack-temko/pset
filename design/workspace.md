# The book workspace

`/books/{sha}`: the app's heart, and its one filled screen
(`AppShell scroll="fill"`). Decisions from the 2026-09-18 grill; each is
settled, not open.

## Frame

Three panes under the top bar: contents rail (256) · page scan (flex) ·
panel (440). Each scrolls independently; the frame never moves. The top
bar's middle names the book.

- **Focus** widens the panel by collapsing the rail; the scan shrinks but
  stays visible. The toggle sits right of the panel's tabs.
- The panel is always open, and remembers **per book** which tab it showed.

## Page numbers

**The app speaks the printed page number everywhere** (2026-09-21): page
chips, the rail, the scan pill, and anything you type. It's the number a
syllabus, the index and the professor use. **Hovering any of them shows
the PDF page** in a Tooltip; the PDF index never appears otherwise.
Front matter before printed page 1 shows its roman numerals, as the book
does.

One number per book connects the two, the **offset** (PDF page = printed
page + offset). The engine **works it out at import**, from the PDF's page
labels or the numbers printed in headers and footers, and the book dialog
can correct it.

## Page scan

- **Continuous vertical scroll**: pages stack like a PDF reader.
- Pages are **backend-rendered images**, lazy-loaded `<img>`s. No pdf.js.
- Chrome is one **floating pill**, bottom-center: page indicator · zoom.
  Appears on hover/scroll, fades when idle. The scan is otherwise
  edge-to-edge paper.
- **Pinch on a trackpad zooms into the spot under the pointer**, which stays put,
  from 50% to 300% of fit-width. **Past the pane's width, click-drag
  pans**, and only then is the cursor a hand. **Clicking the percentage
  snaps back to fit.** A zoomed page scrolls sideways in its pane: content
  that can't reflow, the one sideways scroll the system allows.

## The book

A **pencil beside the book's title in the top bar** opens the Book
dialog: title and author, editable (they start as the PDF's metadata);
"Printed page 1 is PDF page ___", the offset, correctable; the page count
and import date. **Remove book** sits at the footer's left. Confirming
turns the dialog itself into the question (dialogs never nest), naming
what goes with the book: its homework and its conversation. This is the
top bar's one action, and it edits the thing the bar names.

## Contents rail

- **TOC only**: the chapter/section tree as an ActionList, current
  section highlighted, page numbers in mono on the right.
- A book with **no usable TOC has no rail**: the scan takes the width,
  and Focus simply has less to collapse.

## Ask (panel tab)

The backend is an **agentic loop**: the model holds tools (searching
pages, extracting text, solving math, rendering chat cards) and how a
question gets page context is deliberately left open until that loop is
built.

- **Visible step feed**: each tool call renders as its own quiet row in
  the transcript, as it happens, and stays. One line per call: verb,
  object, count ("Searched 'eigenvalue' · 6 pages"), no expansion.
- **Turns are asymmetric**: the question is a compact `primary-soft`
  block on the right; the answer is full-width quiet text on the panel
  ground. The answer **streams** in after the steps.
- **Citations are inline page chips**: a distinct small mono element
  ("p. 142") in the prose, not underlined text and not a card. Click
  scrolls the scan there and flashes the page's edge.
- **Math renders inline and display**, KaTeX. Answers about a math book
  are math; half-rendering looks broken.
- **Send becomes Stop** while the loop runs; stopping freezes the feed
  and keeps the partial answer with a "stopped" note.
- **A failed loop** freezes the feed, says what happened in one
  destructive-ink line, and offers Try again. Partial text stays.
- **Past turns**: Copy on the answer, nothing else. History is
  append-only, no edit, no retry of old turns.
- **Endless history with day dividers** (quiet centered hairline:
  "Yesterday", "Sep 12"); the very top of the transcript carries
  "Start of conversation · Clear" with a confirm.
- **While it works** (2026-09-21): the step in flight is the feed's last
  line, in the present tense with a Spinner at its start ("Searching
  'eigenvalue'…"); finished, it turns past tense with its count and the
  spinner goes. The answer streams in with **no caret**: Stop in the
  composer already says it's running. **Stopped** leaves the partial
  answer and a quiet "Stopped" line, with nothing to click; asking again
  is the retry.
- **Answer cards, a short list on purpose** (2026-09-21), for the three
  things prose does badly:
  - **Statement**: a definition or theorem as the book numbers it
    ("Theorem 5.22"), its name, and a page chip, in a Box-like frame.
  - **Worked steps**: a numbered derivation, all shown (the walkthrough
    is where things hide), one line of math per step with a short why.
  - **Plot**: one or two functions on one y-axis, chart-1 then chart-2,
    a legend and no labels on the lines, a hover crosshair with every
    value, and a table behind it for screen readers.

  Plus two plain blocks, a **table** and a **code block**, both
  sideways-scrolling inside their own frame when wide. No page-excerpt
  card: page chips already jump the scan to the real page. Everything
  else is prose with math and chips.
- Empty conversation: a prompt line plus one short sentence of what the
  agent can do. No generated suggestions.
- One running conversation per book (locked earlier).

## Homework (panel tab)

- **List → walkthrough**, both in the panel: the book's assignments as
  rows (Box + Door), opening one fills the panel with its walkthrough,
  back link at top.
- **Creation is two acts, not one** (2026-09-20 grill). Making a set and
  filling it are different decisions, so they are different dialogs:
  - **New homework**: title (required, because an unnamed set still
    shows up in the list and on Home) and an optional due date, a
    native `<input type="date">`. Nothing about questions. Creating
    lands you in the set's empty walkthrough.
  - **Add questions**: a stack of rows, one question each, with a field
    that grows as you type, a **"In this book" checkbox per row**, and
    a remove button that is always visible and disabled on the only
    row. Enter adds a row below and moves into it; Cmd/Ctrl+Enter
    submits. Submit adds every non-empty row at once, drops the blanks
    silently, and closes.
  - Both leave the same way: **Cancel in the footer, or Esc**. No X in
    the corner: one job, one control.
- **Not every question is in the book.** A professor's own problem still
  needs a walkthrough. An unchecked row skips the engine's locate stage:
  it gets **no page chip and no scan jump**, and is otherwise identical:
  same statement, same two veiled stages, same Complete.
- **Progressive rows**: questions appear as they are located, each with a
  quiet working state until its guide is ready ("Finding it in the
  book…", or "Writing the guide…" when there is nothing to find).
- Walkthrough per question: two veiled stages and a Complete checkbox,
  detailed below. Reveals and marks persist; progress is questions
  marked done.
- **Print produces a worksheet** (2026-09-21): each question's statement
  and figure, then blank space to work in: no hints, no walkthroughs,
  nothing spoiled on paper. The engine renders it as a PDF (`hwpdf.go`,
  questionScale/figureScale) and it **opens in a new tab**; printing and
  saving happen there.
- **The walkthrough header** (2026-09-21) keeps what you read: back, the
  set's title, "3 of 8", and a **"⋯" menu** for what you do to the set:
  Add questions, Edit homework, Print worksheet, then **Turn in** below a
  divider, which reads **Turned in** with a check once done. While a set is turned in, a success
  Label says so in the bar.
- **A Home due-row lands straight in that walkthrough** at
  `/books/{sha}/homework/{id}`, on the **first question not yet
  complete**, where you'd pick up. The scan doesn't move; it only ever
  jumps on demand.

### Walkthrough (2026-09-18 grill)

- **One question at a time**: prev/next plus a "3 of 8" position row.
  440px is one problem's screenful; focus is the point.
- **Statement = extracted text + figure crops** (math rendered), never a
  flat page image.
- **Scan jumps on demand**: a page chip in the question header; opening a
  question never moves the scan by itself.
- **Two stages, both veiled**: *hint* and *walkthrough*: the walkthrough
  carries the solution, so there is no separate approach step. Each sits
  behind frosted glass (the `Veil`) from the start: the content is laid
  out at its true size, blurred, with "Show hint" / "Show walkthrough"
  over it. One click lifts it. No sequence, no skip link: both are
  always available, and the student is an adult. Stages reuse the
  transcript's pieces (math, page chips).
- **Complete is a checkbox**, not a button, and it does exactly one
  thing: marks the question done. It never advances: you move on when
  you decide to, not when the app decides for you, and unchecking is
  the undo. Progress is the count of checked questions, shown in the
  list row. Done is a fact, not a party.
- **"Ask about this"** on every question flips to the Ask tab with the
  problem as context: the canned guide's escape hatch. The question
  rides above the composer as a removable chip, **"About 3.A.4 ×"**, so
  the box stays empty for your own words; the sent turn keeps the chip,
  so the transcript records what you asked about.
- **Editing a set** (2026-09-21): Edit homework in the header's menu
  opens New homework again as **Edit homework**, with **Delete** at the
  footer's left, confirmed in place.
- **Failed question** (2026-09-21): one destructive line saying why, and
  **both ways out at once**, in place of the stages:
  - **"It's on page ___" + Try again**: you know where it is; the
    search didn't. Only for in-book questions.
  - **"Not in this book?"**: paste the question, and it becomes an
    off-book question whose guide is written from your text alone.
  A bare reference that failed ("3.C.14") shows once, as the label.
- **Sets are editable: add, remove and reorder.** The controls sit inline
  on the question you are looking at (move up, move down, remove, as
  quiet icon buttons beside its page chip) because the walkthrough is
  the only view of the set there is. The system has no menu component,
  and this did not justify inventing one.
- **Turned in is a checkable item in the header's menu** (2026-09-21):
  the set-level twin of Complete, and like it a fact you can take back.
  It lives with the set's actions, away from Complete in the footer, so
  the two are never confused. Turned-in sets drop to their own group at the
  list's bottom and leave Home's due list; unchecking brings them back.
- **A list's last row adds to it** (2026-09-21, replacing a `+` on an
  "Assignments" header). The homework list has no header of its own: the
  panel tab already says Homework, and the box saying it again was noise.
  Its last row is **"+ New homework"**, a `DoorAction` shaped exactly like
  the Door, so a list ends the same way whether its last word is "show
  more" or "add one". Where the thing isn't a list in a Box, the `+`
  stays: import on Home's shelf. (Add questions lives in the walkthrough
  header's menu.)

## Panel header

One row: **Ask | Homework as UnderlineNav tabs** left, Focus toggle
right. Nothing else: the walkthrough owns its own back link and its
menu.

## No global activity

**There is no activity indicator and no activity sheet** (2026-09-21).
Work shows where it lives: an import on the shelf, a question in its
walkthrough. You started it there, so that's where you look. A book that
finishes preparing while you're inside another one is simply on the
shelf when you go back.
