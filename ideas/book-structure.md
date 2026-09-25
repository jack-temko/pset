# Book structure

## Status

**Planned** · phase 1. Nothing blocks it. [Finding
problems](finding-problems.md) builds on it: a reference can't be read
until the book's numbering is known.

## Information

Two things the app assumes about every book, both detected at import:
how printed page numbers map to PDF pages, and how the book numbers its
problems. Both are wrong or missing today for some books.

### 1. Printed page numbers, in ranges

**Why.** A book has one offset (`books.page_offset`, PDF page = printed
page + offset). A scan can drop or duplicate a page, and then the offset
changes partway. In Boyce's *Elementary Differential Equations* printed
page 85 is missing from the scan: PDF 96 prints "84", PDF 97 "86". The
offset is 12 for PDF 13 to 96 and 11 from PDF 97 on. The book stores 11,
so in chapters 1 and 2 every page chip, jump and citation is one page
early, and "Page 33 Problem 7" was searched on printed page 32, where
it isn't.

**Decided.** Offsets per page range (no preference in the grill, so the
recommendation stands): runs like "PDF 13–96: offset 12, PDF 97 on:
offset 11".

**How.** The import already has each page's vote (the number in its head
or foot). Segment the votes into runs instead of taking one winner; the
contents entries, which get matched to the scan anyway, confirm the
seams. Store the runs; every conversion goes through one helper each in
Go and TS that takes the runs instead of a number. The Book dialog shows
the ranges and names a gap: "Printed page 85 is missing from the scan."
Front matter keeps its roman numerals.

**Weight.** The widest change here: about 70 call sites in 20 files use
the offset today (35 in Go, 35 in the web app), plus a migration and the
wire. Mechanical, but it touches everything that shows a page number.

**Risks.** The Book dialog's one "Printed page 1 is PDF page ___" field
has to become editable ranges, or a single "this page is printed as ___"
correction that splits a range. A wrong seam is worse than no seam, so a
run needs several agreeing pages before it counts.

### 2. How a book numbers its problems

**Why.** Three of Jack's books, three styles, and the same digits mean
different things in each:

| Book | Printed as | Restarts | Where | Assignments say |
|---|---|---|---|---|
| Alexander/Sadiku, *Electric Circuits* | `4.27` | never in a chapter | end of chapter | `4.27` |
| Boyce, *Differential Equations* | `7.` under a bare "Problems" | every section | end of each section | `1.1: 1, 7` |
| Yates/Goodman, *Probability* | `2.1.4` (to confirm) | every section | end of chapter, grouped by section | `Problem 2.1.4, p. 57` |

"3.1.7" is section 3.1, problem 7 in two of them and nonsense in the
third. The finder can't read a reference until it knows.

**Decided.** Detected at import, and it must be hardened: cover most
books, and be reliable. The Book dialog always shows the detected style
with an example from the book. When detection isn't confident, the
first import asks once, in the Book dialog; editable later.

**How it's detected** (hardened by agreement and by a check the model
can't talk its way past):

1. **Find problem pages** without a model: from the contents, the last
   pages of sections and chapters, and pages whose text has a
   "Problems" or "Exercises" heading. Pick three or four from different
   chapters.
2. **Two independent reads.** The model looks at them (at 2400px) and
   fills in the style: printed form (whole `4.27`, local `7.`, or
   `2.1.4`), where numbering restarts (chapter or section), where the
   problems sit (end of section, end of chapter, separate section), the
   heading word, and an example ("Section 3.1's problems start on p.
   112"). Two reads must agree, as the figure readings taught.
3. **Check it against the text.** For the claimed style, count how many
   sections or chapters actually fit (a heading, then numbers counting
   up from 1 within the claimed pages). A style that fits most of the
   book is confident; one that fits few is not, whatever the model said.
4. Answer keys ("Answers to odd-numbered problems") are found the same
   way and kept out of every find.

Stored per book: the style, the example, and the confidence.

**Weight.** ~250 lines, and two or three model calls at import.

**Risks and later.**
- OCR garbles numbers (`1. Oy" +8y'` is problem 11), so the text check
  must tolerate gaps and still count a section as fitting.
- Books mix styles: an appendix with its own problems, "Supplementary
  problems" at chapter end, worked "Practice problems" inside sections
  that share numbers with the end-of-chapter ones. The style may need
  exceptions, not one value.
- Books already in the library need it detected once: a "Read the
  book's structure again" action, or run on first open.

### Open

- Whether the assignment itself should vote: the 220 sheet's
  `1.1: 1, 7` says "per section" as plainly as the book does.
