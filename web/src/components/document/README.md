# Document

A document of blocks, drawn: the renderer that maps the engine's typed
blocks (a question's hint and walkthrough, an Ask answer) onto the
transcript's pieces. The server has already split every text field into
runs and checked the math, so nothing here parses anything; the tree
comes from the part and step markers (`tree.ts`). Spec:
`design/workspace.md`, "Walkthrough" and "Ask".

- **`Document`** takes `blocks`, and `before(i)` for what sits between
  the blocks (Ask's step feed). `reading` draws paragraphs at the
  guide's reading size. A document is inert by default; everything
  below only exists when the caller passes `ask`.
- **`BlockView`** is one block as a component; **`Runs`** is inline
  text with its marks, math and citation chips.
- **`BlockSkeleton`** is a block being written, in roughly its own
  shape ("Writing a plot", "Tidying" while repaired).

## Selecting, to ask about exactly that

Every element of a live document is selectable (`selection.ts` for the
pure half, `selectable.tsx` for the worn half): a block, one line of a
derivation (through `WorkedSteps`), and a part or step heading, which
selects its whole group. Hover washes an element quietly; a click picks
it; a small toolbar on the outline (the boxing toolbar's shape) asks
about it, naming what it asks about ("Ask about this table", "Ask
about line 4"). Spec: `ideas/asking-about-a-selection.md`; the flow on
`design/workspace.md`, "Ask".

- The selection lives **above** the document: `ask.selected` is the
  pending selection when it belongs to this one, and the outline and
  the composer's chip are one state (✕ on the chip drops the outline;
  the chip's About outlives it as the sent turn's record).
- The pointer is owned by the **document's root**: the innermost
  `[data-sel]` under the pointer is what hovers and what a click picks,
  so a block inside a step washes alone. A part or step is picked by
  its **heading** (`data-sel-head`), never by the whitespace between its
  blocks, so a stray click or a press that ends on another block picks
  nothing. Buttons, links and the toolbar (`data-sel-toolbar`, padding
  included) keep their clicks (page chips still jump), a drag that took
  words isn't a pick, and Esc lets go unless a menu or dialog takes it
  first. A text box takes its own Esc, except the Ask composer
  (`data-esc-lets-go`): asking leaves focus there, and the chip goes
  with Esc.
- The held selection remembers its **text** (`PendingSel.text`), and
  `heldSel` outlines it only while the element still reads that way: a
  key is an index, and a guide redone under it would otherwise move the
  outline onto something never picked. The chip keeps its snapshot
  either way.
- **`guideAbout` / `answerAbout`** compose the About a selection
  becomes: the chip names the question and the place ("4.72 · (a).1
  line 3", or an excerpt for an answer), and the text gives the model
  the whole problem and the selection's exact text, snapshotted when
  picked so a rewritten guide can't change what was asked.
