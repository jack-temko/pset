# Importing assignments

## Status

**Planned** · phase 3. Waits on phase 1: the importer hands every book
reference to the finder, so the finder must be reliable first.

## Information

### Why

Homework arrives four ways, and the app takes one (typing references
into Add questions):

| Source | Shape | Book |
|---|---|---|
| Math 220 PDF (LaTeX) | A table: due date, `1.1: 1, 7, (4 pts each)`, notes, points | Boyce, *Differential Equations* |
| EECS 461 PDF (groff) | A numbered list: `Problem 2.1.4, p. 57.` beside problems written out in full, changes to book problems, reading and quiz lines | Yates/Goodman, *Probability* |
| EECS 202 web page | A semester table: lecture date, reading pages, due date, `4.27 , 4.32 , 4.25 (no PSpice or MulitSim)` | Alexander/Sadiku, *Electric Circuits* |
| Photo, or typed text | Whatever's on the board or slide; the text box as today, reworked into this flow | any |

### Decided (2026-09-25)

- **Starts from the book's Homework tab.** The book is known, so its
  numbering style applies. A document that names another book (461's
  names Yates/Goodman) is flagged in the review.
- **A review screen before anything is added.** An editable list of the
  rows read out: each a book reference as read (section, problem,
  parts), or "not from the book" with its text, plus its notes. Fix,
  drop or confirm, then add.
- **Several due dates in one document: pick the ones to import.** Each
  becomes its own set, titled and dated from the document. Importing
  again only offers dates not yet imported.
- **A course web page is fetched by URL and remembered on the book.**
  "Check for new homework" fetches it again and offers only new dates.
  Public pages only; a page behind a login (Canvas) comes in by
  screenshot or paste.
- **Reading and quiz lines show, unticked**, as "not homework" rows:
  tick one to add it (the quizzes as practice), or leave it.
- Problems written out in the document (461's #2 to #4) come in as
  questions that aren't in the book, with their parts.

### How

1. **Intake**: a PDF (text layer, or rendered for the model when it's a
   scan), a URL (fetched on the server, HTML turned to text with its
   table structure kept), a photo (the model reads it), or pasted text.
2. **Read out rows**: one model pass turns the document into rows (due
   date, set title, and per problem: a reference in the book's style, or
   full text, plus parts, points and notes), then the [reference
   parser](finding-problems.md) reads each reference. A row the parser
   can't read is flagged in the review, not guessed.
3. **Review**, grouped by due date, then add: each chosen date becomes a
   set, each row a question, and the finder takes over as today.

### Weight

~600 lines, the largest group: intake per source (~150), the read-out
pass and its prompt (~150), the review screen (~250 of UI), remembered
URLs and re-checks (~50). A new dialog spec in `design/workspace.md`.

### Risks and later

- Documents are free-form; the read-out pass is a model call and will
  sometimes merge or split rows. The review screen is the safety net,
  and the lookalike [test set](finder-tests.md) measures it.
- Fetching pages from the server: timeouts, hand-made HTML tables
  (the 202 page's cells are spread over several lines each), and a page that changes its
  layout mid-semester.
- Re-checking a remembered page must recognise rows already imported
  even if the professor edits them (a typo fixed, a problem swapped).
  Match on due date and reference, and show changes rather than
  duplicating.
- Photos are the least reliable source; worth a "retake" in the review.

### Open

- Whether points ("4 pts each") are shown on questions or dropped.
- Whether the set's title comes from the document ("Assignment #3") or
  the due date.
