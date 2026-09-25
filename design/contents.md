# A book's contents

How PSet works out a book's contents (the chapters and sections the rail
shows, and homework's chapter sweep reads) when the PDF has no outline,
and its title and author. Decisions from the 2026-09-22 grill.

The old way, scanning every page for heading-shaped lines, gave one scan
2,498 flat "sections": exercises, OCR noise from plots, running heads,
the contents pages themselves. A model now reads the contents instead.

## Which books

- **Every book without a PDF outline**, scanned or digital. A PDF
  outline is still trusted as it is, with no model call.
- **A chat model is required.** Import refuses up front when none is
  configured, as it already does for embeddings, and Home's `+` says so.
  There is no non-LLM path.
- **No migration**: books already on the shelf keep their contents. A
  book gets the new contents by being imported again.

## The printed contents, first

1. **Find the contents pages without the model**: in the front of the
   book, pages where most lines end in a page number. A brief and a
   detailed contents are both kept.
2. **Show them to the model as page images** (OCR mangles contents
   pages: "TheLaplaceTransform", titles that wrap and lose their
   number). It returns each entry's number ("2.3"), title and printed
   page.
3. **Which entries**: chapters (and parts) with their sections, and what
   a student uses from the back of the book: appendices, answers,
   glossary, reference tables, index. No front matter (preface, to the
   student, acknowledgments, the contents itself), no bibliography, no
   credits. **Every level** the contents gives is stored (2.3.1 and
   deeper); the rail still shows two.
4. **Levels come from the numbering**: "2.3" sits under chapter 2. An
   unnumbered entry takes the level the model gives it.
5. **Titles are the model's reading**, with the number in front ("2.3
   Linear Equations"), so the rail reads like the book.

## Checked against the scan

- Each entry's printed page maps to a PDF page, and its title must
  appear on that page's text (letters and digits only, a few OCR slips
  allowed). A few pages either side are searched, and the entry snaps to
  the match. The expected page follows the last match, so a scan that
  dropped a page midway still lines up.
- **An entry whose title isn't found is placed by its neighbours**: it
  takes the offset of the entry before it or after it, whichever
  matched, and is dropped only when neither did.
- **Fewer than half the entries found** means the printed contents
  isn't this book's, and the fallback runs.

## The fallback: the model picks headings

For a book with no contents pages, or whose contents didn't check out.

- Candidate lines come from the page text: numbered lines ("3.2 …"),
  "Chapter 3" lines, short capitals, and in a digital book lines set in
  a clearly larger font. Numbering is kept; a running head's page number
  is stripped, so its repeats merge into one line at its first page;
  lines with no real word or with an `=` are dropped, and so are the
  contents pages.
- The model gets them as a numbered list (`[412] p.117 | 3.1 …`) and
  answers with line numbers and levels only, so it cannot invent an
  entry. Titles stay as the scan has them.
- **Fewer than three picks means no rail.**

## The book's name

The same treatment for the title and author (2026-09-22), for **every
book**, outline or not, because junk metadata looks plausible ("ISE
EBook Online Access for Fundamentals of Electric Circuits").

- The model sees the pages before the contents (at most six) as images,
  with the name the file came with as a hint. It returns the title and
  the authors' surnames.
- **The title page wins over the cover**: a scan's cover can name a
  bigger edition than its title page ("… & Boundary Value Problems").
- **Full title, surnames only**: "Elementary Differential Equations" ·
  "Boyce, DiPrima & Meade"; two authors "Alexander & Sadiku"; more than
  three "Halliday et al.". No subtitle, edition, series, publisher or
  store labels.
- **Checked like the contents**: the title, and every surname, must be
  in those pages' text (a few OCR slips allowed). What doesn't check out
  keeps the metadata or the filename.
- **Failure is quiet**: a failed call leaves the name as it was and the
  import carries on. The title can always be fixed in Edit book, in the
  book's menu.
- A title or author the student edited is **never replaced**.
- The workspace's one-time "named after its file" prompt is gone.

## When the model fails

Contents only; naming never fails an import (above). A failed call (network, rate limit, refused key), or a reply that still
isn't the JSON asked for or a call still stalled (five minutes) after
one more try, **fails the import**, with a reason. Try again re-runs
it; the pages already read are kept, so OCR isn't repeated.

## Import

A fifth phase, **Read the contents**, between *Read the pages* and
*Index the sections* (design/import.md). It covers naming, the outline,
the model calls and the check; *Index the sections* saves them and finds
how the printed page numbers run (design/workspace.md, "Page
numbers").

## The rail (design/workspace.md)

- Chapter rows show their printed page, like section rows.
- The highlighted row scrolls into view as you read.
- Hover and highlight run edge to edge with no gaps between rows.

## Cost

GLM-5.3-Flash at list price ($0.15/M in, $0.50/M out): reading the
contents pages is a fraction of a cent; the fallback's calls are about
$0.005 a book.
