# ProgressBar

How far along a set is, as a slim bar cut into its questions. Used in the homework
walkthrough's header (its bottom edge) and on each set's row in the list.

- **A segment per question**, `h-1`, rounded, with a gap of 4px. Each is **as wide as its
  question is hard** (`weight`), so what is left reads as how much work is left, not how many
  questions. With no weights every segment is equal (a plain bar of steps).
- **Marks:** done is `primary`; the current question is `primary` at 40%; what waits is the
  quiet `muted`; a failed one is `warning`, the status ink. Widths and colours ease over 200ms.
- **It is not a control.** It is `role="img"` with a label in words ("2 of 8 done"), since
  colour alone says which segment is which. The count beside it, a labelled `Menu`, is how
  you jump to a question.

**What the caller provides:** the `segments` (a mark and an optional weight each) and the
`label`. Where the weights come from (an LLM-ranked difficulty per question) is the view's
business: see ideas/homework-redesign.md.

**Don't:** make the segments clickable (they are 4px tall); put a percentage on it; animate
it except as it changes.

## Changes from baseline

- **New in the app.** The baseline had only the book's import bar (`BookStatus`, a single
  determinate bar); this is the first bar cut into parts.
