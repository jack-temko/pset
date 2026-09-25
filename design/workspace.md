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
chips, the rail, the scan's floating bar, and anything you type. It's the number a
syllabus, the index and the professor use. **Hovering any of them shows
the PDF page** in a Tooltip; the PDF index never appears otherwise.
Front matter before printed page 1 shows its roman numerals, as the book
does.

**The numbering runs in stretches** (2026-09-25): from a PDF page on,
PDF page = printed page + offset, until the next stretch. Most books
have one; a scan that lost a page has two, one apart (Boyce's
*Differential Equations* is missing printed page 85). The engine **works
the runs out at import** from the numbers printed in heads and feet, and
the Book dialog can correct them. Every page travels as its PDF page;
only `lib/pages.ts` (and `internal/pagenum` on the server) turns one into
the other, so a chip, a jump, a citation and a typed page all agree.

## Page scan

- **Continuous vertical scroll**: pages stack like a PDF reader.
- Pages are **backend-rendered images**, lazy-loaded `<img>`s. No pdf.js.
- Chrome is one **floating bar**, bottom-center: page indicator | zoom,
  shaped like the system's other floating surfaces (radius-md, hairline,
  `floating` shadow). **Shows on arrival**, then on hover, scroll or
  focus, and fades when idle (2026-09-22: arriving, it says where you
  are before handing the frame back to the paper). The scan is otherwise
  edge-to-edge paper.
- **Pinch on a trackpad zooms into the spot under the pointer**, which stays put,
  from 50% to 300% of fit-width. **Past the pane's width, click-drag
  pans**, and only then is the cursor a hand. **Clicking the percentage
  snaps back to fit**: zoomed, it is a ghost button with a reset icon and
  a "Fit to width" tooltip; at fit it is plain text, with nothing to
  reset. A zoomed page scrolls sideways in its pane: content
  that can't reflow, the one sideways scroll the system allows.

## The book

**One menu beside the book's title in the top bar** (2026-09-24,
replacing a pencil and a memory icon) holds what you do to the book:

- **Edit book** opens the Book dialog: title and author, editable (they
  start as the title page reads, design/contents.md); the cover colour,
  one of six swatches (design/import.md); **Page numbers**, a row
  "Printed page 1 is PDF page ___" and one "PDF page ___ is printed page
  ___" wherever the numbering jumps, with the jump named under them
  ("Printed page 85 is missing from the scan.") and **Add a jump** to add
  one; **Problems are numbered like** (2026-09-25), a segmented control
  of the three ways books do it, `4.27` (through each chapter), `2.1.4`
  (by section, with where the book keeps them) and `3.1 #7` (starting
  again in each section), with a sentence saying what a reference means
  in the chosen one and an example from the book ("In this book: 1.1 #7,
  on p. 8."); the page count and import date. It only edits.
- **How problems are numbered is detected at import** from the book's
  text and contents. When the text didn't make it plain, the field says
  so in warning ink with **It's right** beside it, and **Add questions**
  opens with the same line and **Check it**, which closes it and opens
  the Book dialog: asked once, where it matters. The Add questions
  placeholder uses the book's own example ("A reference like 1.1 #7").
- **Memory** opens what the tutor remembers about the book
  (design/memory.md).
- **Remove book**, last, below a divider, in destructive ink. It asks
  first in a confirm under its row, with the menu kept open behind it,
  naming what goes: its homework sets, the conversation and what the
  tutor remembers. Removing lands you on Home.

Every thing that can be deleted has one menu for its actions, with the
destructive one last: the book here, the homework set in the
walkthrough's header. A book is removed only from inside it; the shelf
stays covers.

## Contents rail

- **TOC only**: the chapter/section tree as an ActionList, current
  section highlighted, page numbers in mono on the right, chapters' as
  well as sections'. Where the contents come from: design/contents.md.
- **The current row stays in view**: as the scan moves on, the rail
  scrolls to keep the highlighted row on screen, with a row of room.
- **Rows touch** (2026-09-22): no gap between chapter groups, so the
  hover runs unbroken from row to row. Chapter rows are taller (8px
  padding against sections' 4px) and set in medium weight instead.
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
  **Interleaved, not stacked** (2026-09-22): a call sits where it
  happened, between the paragraph before it and the paragraph after,
  because that is what it was. The engine records with each step how
  many answer segments were written when it ran, and a running tool
  ends the paragraph in progress. Copy takes the answer alone: the feed
  is the app talking, not the words.
- **The live line stands out** (2026-09-23): the call in flight is in
  full foreground ink with its Spinner; when the next call starts or the
  answer ends, it eases back (150ms) to the feed's muted ink.
- **Thinking…** (2026-09-23): while the loop waits on the model and
  nothing else says so (before the first step or word, and after a step
  until the next thing arrives), a live line reads "Thinking…". Streaming
  words say it themselves, so it never sits under a paragraph.
- **Turns are asymmetric**: the question is a compact `primary-soft`
  block on the right; the answer is full-width quiet text on the panel
  ground. The answer **streams** in around the steps.
- **No skeleton for the answer** (2026-09-22): until it arrives, its
  shape is unknown, and a shimmer at a made-up size promises one. The
  wait is said by the feed (a step, or Thinking…) and by Stop in the
  composer.
  Skeletons are for **cards**, where the envelope names the kind before
  the card arrives, so the shape is known.
- **Citations are inline page chips**: a distinct small mono element
  ("p. 142") in the prose, not underlined text and not a card. Click
  scrolls the scan there and flashes the page's edge.
- **Math renders inline and display**, KaTeX. Answers about a math book
  are math; half-rendering looks broken.
- **Send becomes Stop** while the loop runs; stopping freezes the feed
  and keeps the partial answer with a "stopped" note.
- **A failed loop** freezes the feed, says what happened in one
  destructive-ink line, and offers Try again. Partial text stays. When
  the cause is **setup** (no chat model), the line also offers **Open
  Settings** at Connections, ahead of Try again, as a failed homework
  question does (2026-09-22). A question that never sent says so in the
  same line above the composer.
- **Past turns**: Copy on the answer, nothing else. History is
  append-only, no edit, no retry of old turns.
- **Endless history with day dividers** (quiet centered hairline:
  "Yesterday", "Sep 12"); the very top of the transcript carries
  "Start of conversation · Clear". Clear asks first, in a confirm under
  it: every question and answer goes, what the tutor remembers stays.
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
  book…", or "Writing the guide…" when there is nothing to find),
  followed by the time left on that step once past questions give an
  estimate ("· less than a minute left"; rules in design/import.md).
  With an estimate the words drop their ellipsis, so it never runs into
  the dot: "Finding it in the book · about 2 minutes left".
- **Found first, written second** (2026-09-24): the engine finds every
  question in a set before it writes their guides, so the worksheet is
  whole and ready to print while the guides are still coming, and one
  added later is found ahead of the guides already waiting. A found question shows
  its statement and figures at once, over a line that is a word and no
  motion, like Queued: **"Found on p. 12. Its guide starts once every
  question is found."**, then "…once the questions ahead of it are
  written.", then "…in a moment.". One still to be found reads "Queued:
  it starts when the questions ahead of it are found."; one that isn't
  in the book waits for its guide like a found one, as "Queued: it
  starts…".
- **Print worksheet says what isn't found yet** (2026-09-24): while any
  question is still being found, the menu item carries a muted hint, "3
  still being found", since those print as a bare label. It never stops
  you printing.
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
  divider, which reads **Turned in** with a check once done, then
  **Delete homework** below another. While a set is turned in, a success
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
- **The figure, as read** (2026-09-24): a question with a figure shows,
  under it, the words its guide is written from, in a Box: every node,
  then every part between two of them, with its value and which way its
  arrow or its + sign points, one fact a line. A misread figure is the
  likeliest way for a guide to be wrong, so the reading is out in the
  open, where a glance against the figure catches it. It shows its
  first four lines, the rest behind a Door. It is not veiled: it says
  what the problem is, not how to solve it.
  - **Correct** turns it into a text box, a fact a line. **Save and
    rewrite the guide** writes the guide again from the student's lines,
    which the writer is told are the student's and win over its own
    look at the figure; the Box then carries a **Corrected** Label. A
    guide that hasn't started yet just waits for the new lines, and the
    button says **Save**. **Read it again**, at the row's other end,
    throws the lines away for a fresh reading, and the guide with them.
  - The engine reads every figure as the question is found, before any
    guide is written, so a set's readings are there to check while its
    guides wait: the working line says "Reading the figure…", then
    "Checking the reading…". How it reads: design/backend.md.
  - A guide written before figures were read shows the Box with a
    sentence saying so and **Read the figure**, which reads it and
    writes the guide again from the reading.
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
  opens New homework again as **Edit homework**. It only edits
  (2026-09-24): deleting is the menu's last item.
- **Deleting a set** (2026-09-24): **Delete homework** is the last item
  in the header's menu, below a divider, in destructive ink. It asks
  first in a confirm under its row, the menu kept open behind it:
  "Delete Set 3? Its 8 questions go with it, with their guides and what
  you checked off." Deleting lands you on the list.
- **Failed question** (2026-09-22): a recoverable state about that
  question, not an error dump. A **title naming what failed**, a
  sentence saying what happened (no internals, no "check Settings"
  without saying where), and the ways out that fit the kind, which the
  engine records as `failure`:
  - **generation**, "Couldn't write the guide" (cut off, missing a part):
    **Try again**, which writes it again without looking for it. Below,
    "Having trouble with this problem?" offers pasting it, for a
    statement read wrong.
  - **unavailable**, "The chat model isn't responding" (no answer, busy,
    5xx): **Try again**, and "nothing is wrong with problem 4.44".
  - **setup**, "The chat model needs setting up" (none set up, or the
    provider refused: a bad key, an unknown model, with its HTTP status):
    **Open Settings** at Connections, then Try again.
  - **not_found**, "Couldn't find 4.44 in this book": a **Printed page**
    field and **Look there**, then "Not from this book?" to paste it and
    have the guide written from your text alone.
  Every action is enabled; one with nothing to go on says what it needs
  ("Type the page number first.").
- **Sets are editable: add, remove and reorder.** The controls sit inline
  on the question you are looking at (move up, move down, remove, as
  quiet icon buttons beside its page chip) because the walkthrough is
  the only view of the set there is. **Remove asks first** (2026-09-24),
  in a confirm under the trash: "Remove 3.A.4? Its guide and your
  progress on it go with it." The confirm belongs to that question:
  moving to another one can't retarget it.
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
