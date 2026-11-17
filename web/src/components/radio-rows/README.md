# RadioRows

One choice out of a few where each option needs explaining: a Box of
rows, each a radio with a label and a hint under it saying what choosing
it means. The SegmentedControl's sibling. Where a word or two carries
the choice (Paper / Night / System), use that; where the label means
nothing until it's spelled out ("2.1.4" is section 2.1's problem 4),
use this.

- A `radiogroup` of `radio` rows with `aria-checked` and a required
  `label` for the group's accessible name. The chosen row is the one tab
  stop and the arrow keys move the choice, as the platform's radios do;
  with nothing chosen, the first row takes the tab stop.
- The whole row is the target. Rows are divided by `border-muted`
  hairlines inside the Box frame, like BoxRows.
- The radio is the Checkbox's circle: 16px, `border-input` on `card`
  unchosen, `primary` ring and dot chosen. The chosen row's ground is
  `primary-soft`, the selected row's ground elsewhere (the contents
  rail), so the choice reads at a glance down the column; unchosen rows
  wash `muted/50` on hover.
- Label `text-sm font-medium`, hint `text-xs` in `muted-foreground`. The
  dot sits on the label's first line however long the hint runs.
- Nothing chosen is allowed (`value=""`): a question not answered yet,
  like a book whose numbering PSet couldn't make out.

**Don't:** use it for two options with self-evident labels (a Checkbox
or SegmentedControl says it in less room); put controls inside a row
(nested targets); use it to trigger actions.

## Changes from baseline

- **New in the app, not in the baseline.** It arrived for the Book
  dialog's "Problems are numbered like", which used a SegmentedControl
  whose labels ("4.27", "2.1.4", "3.1 #7") needed a sentence each to
  mean anything (2026-09-25, Jack: "use radio rows, design the
  component").

## Open

- Whether a hint should ever carry a second line of its own (the Book
  dialog puts "In this book: 4.27, on p. 163" there for the numbering
  import found).
