# Table

A quiet table for data you read across a row: stages, calls, anything
with several short values per item. Lists of things you act on stay a
Box of rows; a Table is for figures.

- **Frame**: `card` fill, 1px `border`, `radius-lg`. A table
  wider than its frame scrolls sideways inside it.
- **Header row**: a `card-header` band, `text-xs` 500 in muted ink, with a
  border under it. Column names are short nouns, sentence case.
- **Body rows**: `text-sm`, `spacing-2` above and below and `spacing-4`
  beside each cell, so a one-line row is about 37px, a little tighter than a Box row.
  Rows are divided by `border-muted`. Cells don't wrap: a table too wide
  for its frame scrolls sideways instead. No zebra stripes, no vertical rules.
- **Fonts.** Mono is for data and anything copyable; Inter is for labels.
  Numeric columns (`numeric`) align right and are set in the `figure`
  utility (mono, tabular figures) so digits stack; `mono: false` opts one
  out. `mono: true` sets any other column in mono (a model id, a time of
  day), its secondary line included. Headers and label columns (a stage, a
  kind) stay Inter.
- **Numeric columns** (`numeric`) align right, header included. A missing figure is a dash, never a zero.
- **Secondary line**: a column may give `secondary`, a `text-xs` muted line
  under the main content (the model under a stage, say).
- **Error row**: `error` marks a row failed. It takes a light `destructive-soft`
  tint; only the secondary line and columns marked `errorInk` turn
  `destructive`; the reason belongs in a cell, since colour
  alone never says anything.

Pass `caption`: it is the table's accessible name and is not drawn.

- **`dense`** takes the cells' sides to `spacing-3`, for a table inside a
  dialog. **Column `width`** (give some, and the table lays out fixed) makes
  tables with the same columns line up under one another; a column with no
  width takes what is left (at least 10rem). A fixed table never gets narrower
  than its columns together: its frame scrolls sideways instead, so cells
  never overlap. A secondary line stays on one line unless its
  column says `wrapSecondary` (an error message), so a model name never
  breaks mid-name.

Body cells align on their first baseline, so a label and a figure share a
line whether or not a cell has a second line.

**Don't:** put controls in a Table; nest one in a Table; sort or paginate
here (neither exists yet); use it for layout.
