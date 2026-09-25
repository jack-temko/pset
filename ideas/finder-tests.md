# Finder test set

## Status

**Done** (2026-09-25). Two runners, both driving a running PSet with its
real chat model, on Jack's machine against his library:

- **`tools/findertest`** (finding): Jack's real misses, the professors'
  references and the typed forms, against his three books. 22 of 22
  found where they should be.
- **`tools/assignmenttest`** (reading assignments, branch
  `assignment-tests`): ten made-up documents, built as they'd arrive
  (PDFs made by the tool, web pages served by it so the server fetches
  them, pasted text), each scored on its due dates, the problems due on
  each in the book's labels, the professor's notes, and the problems
  written out. Lookalikes of the Math 220 table, the EECS 461 sheet and
  the EECS 202 page, then harder ones: a two-page syllabus whose
  schedule says "due the next Monday", a chatty email quoting last
  week's, two assignments in two columns, a Canvas page full of chrome,
  ranges ("1-8 all", "1-15 odd", "4.27–4.30"), a January due date with
  no year, and an announcement with no homework. First run: 7 of 10,
  every miss a range, which the reference parser then learned; then 10
  of 10.

Run them with the app up (`make dev`, or the app itself):

```
go run ./tools/findertest -addr http://127.0.0.1:8420
go run ./tools/assignmenttest -addr http://127.0.0.1:8420 [-doc email] [-keep] [-out dir]
```

`-keep` leaves the reads in the Homework list, to look over in the app;
`-out` writes each document out, to look at.

## Information

### Why

Finding a problem is the most delicate stage: it misses whole groups of
references (every "Chapter 3.1 Problem 7" in *Elementary Differential
Equations* failed or found the wrong problem), and nothing measures it,
so a fix for one book can quietly break another. The figure-reading
work showed what measuring buys: the 1800px render was only caught by
running the same question many times.

### Decided (2026-09-25)

- **Made-up lookalike documents**, safe to commit, but close enough to
  the real ones that passing them means the real ones pass. The real
  assignments are the professors' copyrighted material and stay out of
  the repo.
- The books themselves can't be committed either, so the set runs on
  Jack's machine against his library, not in CI.

### What it holds

Lookalikes of the four real sources, same shapes and same traps:

- **Math 220** (LaTeX table, Boyce): rows of due date, then
  `1.1: 1, 7, (4 pts each)`, `2.1: 1, 4, 6 (do c, 6 pts each)`,
  `2.1: 12 (also graph the solution, 9 pts)`: a section, then a list, with
  parts, points and notes mixed in.
- **EECS 461** (groff, numbered list, Yates/Goodman): `Problem 2.1.4, p.
  57.` beside problems written out in full with parts a to c, changes to
  book problems ("do it for 500 packets, each with 150 bits"), and
  reading and quiz lines that aren't homework.
- **EECS 202** (a semester table on a web page, Alexander/Sadiku): rows
  of lecture date, reading pages, due date, `4.27 , 4.32 , 4.25 (no
  PSpice or MulitSim)`, including "(all on page 24)" and a typo in the
  note.
- **Typed text**, as the Add questions box takes it today: "Chapter 3.1
  Problem 7", "3.1 #7", "Page 33 Problem 7", "4.25".
- A **photo** of one of the above, once importing takes photos.

For each: the rows it should read out (reference, parts, notes, due
date), and for each book reference the PDF page and label the finder
must land on. Known answers come from Jack's books, checked by hand;
the misses found on 2026-09-24 go in first (Boyce 1.1 #7, 2.1 #7, 2.2 #2,
2.5 #6, 2.6 #1, 3.1 #6, 3.2 #4, 3.2 #19, and "Page 8 Problem 7", "Page 33
Problem 7").

### How it runs

A `tools/` command (like `samplegen`) that runs each reference through
the real finder against the local library and prints hits, misses and
wrong pages, with the model calls logged. Parser and deterministic tiers
also get plain unit tests on OCR-shaped text (garbled numbers like
`1. Oy" +8y'` for problem 11), which do run in CI.

### Weight and risks

- ~150 lines of runner plus fixtures; unit tests grow with each parser
  rule.
- Every full run costs model calls (a find is 1 to 3 calls). Keep it
  small enough to run after each change: around 30 references.
- Expected pages go stale if a book is re-imported with a different
  scan; key them by the book's hash so a stale answer is noticed, not
  trusted.
