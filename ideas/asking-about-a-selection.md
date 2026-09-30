# Asking about a selection

## Status

**Planned** · grilled 2026-09-30; waiting its turn. No dependencies.

## Information

### Why

The walkthrough is where confusion happens, and it happens at the scale
of one line, not one problem. Today a stuck student can ask about the
whole question ("Ask about this") or type their confusion in their own
words, pointing at a derivation with phrases like "the fourth line".
The document already knows what every element is; the tutor should get
told exactly which one, with the problem for context.

### Decided (2026-09-30)

- **Where.** Everywhere the document renders for real: walkthroughs and
  Ask answers. The samples on `/components` stay inert (selection is
  wired, not built in).
- **What.** Every block whole (paragraph, note, equation, derivation,
  callout, statement, table, plot, code, answer, hint), one numbered
  line inside a derivation, and part and step headings select their
  whole group. One element at a time: a new click moves the selection.
- **Entry is always on.** Hovering shows a quiet affordance (a soft
  tint and hairline), clicking selects. No mode. Page chips still jump,
  drag still copies, veiled content is selectable only once lifted, and
  a block still streaming is selectable only once finished.
- **The button.** A small floating toolbar pinned to the outlined
  element's corner, the boxing toolbar's pattern: "Ask about this
  {noun}" (the noun names itself: this step, this table, line 4) and ✕.
  Esc deselects too.
- **What clicking does.** From the walkthrough, flip to the Ask tab;
  from the Ask tab, stay put. Either way a chip rides the composer, the
  box stays empty and focused for your own words. Exactly the
  question-level "Ask about this" flow, one level down.
- **Lifetime.** The selection and the chip are one state: the outline
  stays while the chip sits in the composer (across tab flips), ✕ on
  the chip or Esc drops both, sending consumes it. One context chip at
  a time; a new selection, or the question's "Ask about this",
  replaces what's there.
- **The chip absorbs the problem.** One chip, not two: its label names
  the question and the place ("About 3.A.4 · B.2 ×"), and its text for
  the model is the whole problem statement plus the selection.
- **What the tutor gets.** The whole problem, exactly what was
  selected, and where it sits in words ("Part B, step 2, line 4"). The
  selection travels as an exact-text snapshot taken at send, not an
  index into the guide: the tutor's tools search the book, not the
  guide's block list, and a snapshot survives a rewritten guide. For a
  selection from an answer, the "problem" is that turn's question
  (history may have scrolled it out). Anything more, the loop fetches
  with its tools.
- **The record.** The sent turn keeps its chip in the transcript, an
  inert label like the About chip today: no jump, no re-select, since
  guides get rewritten and references go stale.

### How it works

- `Document` takes an optional selection context (the selected key, a
  select callback, and whether asking is wired). Where it's absent,
  nothing hovers or outlines. A key is a block's flat index, a
  (block, line) pair for a derivation step, or a heading's index, whose
  group membership the tree already defines.
- The composer's About machinery carries it end to end: the toolbar's
  button is the question-level "Ask about this" with a richer About.
  The chip for a walkthrough selection is labelled with the question
  number and the path ("3.A.4 · B.2", plus "line 4" for a derivation
  line); an answer selection, which has no numbers, is labelled with a
  short excerpt of the content.
- Serialization (runs to text) is one shared function: words as-is,
  math as its TeX, a derivation line as its math and why, a table as
  rows, code verbatim, a plot as its expressions and marked points.
  The server composes the model's context from the question's stored
  statement plus that text.

### Data model

No migration. The `About` on `Question` and `turns` is already a label
plus a text for the model; a selection is a composition of both, not a
new column. Frontend state is the panel's pending-About, widened to
remember the selection's key so the outline can persist beside the
chip.

### Testing

Per the one-layer rule: the serialization function and the
key-to-group mapping (derivation lines, heading ranges) are the
deterministic frontend tier; the server's context composition has a
pipeline test; the wire contract is unchanged, so the API tier adds
nothing. The look is checked in the real app, both themes, with a
section on `/components` for the outline, the toolbar and the chip.

### Weight

Mostly frontend: selection plumbing in `Document` and the transcript
(pass 1), the outline and toolbar (pass 2), the composer binding and
tab flip (already half there), serialization (~60 lines). The server
grows the context composition only. A few hundred lines, no migration.

### Deferred

- Selecting several elements ("compare line 3 with line 7").
- A transcript chip that jumps to and highlights the block.
- Selection provenance kept distinctly in the schema.
- Sub-selection inside tables (rows, cells).
