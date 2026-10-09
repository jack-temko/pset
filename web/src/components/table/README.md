# Table

A quiet table for data you read across a row: stages, calls, anything
with several short values per item. Lists of things you act on stay a
Box of rows; a Table is for figures.

- **Frame**: `card` fill, 1px `border`, `radius-lg`. A table
  wider than its frame scrolls sideways inside it.
- **Header row**: a `card-header` band, `text-xs` 500 in muted ink, with a
  border under it. Column names are short nouns, sentence case.
- **Body rows**: `text-sm`, `spacing-2` above and below and `spacing-4`
  beside each cell, so a one-line row is 40px, the height of a Box row.
  Rows are divided by `border-muted`. Cells don't wrap: a table too wide
  for its frame scrolls sideways instead. No zebra stripes, no vertical rules.
- **Numeric columns** (`numeric`) align right, header included, in tabular
  figures so digits stack. A missing figure is a dash, never a zero.
- **Secondary line**: a column may give `secondary`, a `text-xs` muted line
  under the main content (the model under a stage, say).
- **Error row**: `error` marks a row failed. It takes a light `destructive-soft`
  tint; only the secondary line and columns marked `errorInk` turn
  `destructive`; the reason belongs in a cell, since colour
  alone never says anything.

Pass `caption`: it is the table's accessible name and is not drawn.

**Don't:** put controls in a Table; nest one in a Table; sort or paginate
here (neither exists yet); use it for layout.
