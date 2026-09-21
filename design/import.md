# Importing a book

How a PDF becomes a book on the shelf. Decisions from the 2026-09-20
grill; each is settled, not open.

**What the engine already does** (`internal/engine/import.go`), because
the UI is shaped by it and not the other way round: it stages and hashes
the file in one pass, **refuses a duplicate by sha256** and hands back
the book that already exists, takes the title from the PDF's metadata
with the tidied filename as fallback, **refuses up front if the
embeddings endpoint isn't configured** rather than failing forty minutes
into OCR, and prepares the book in four named phases: *Examine the
pages · Read the pages · Index the sections · Build search*. A scanned
book pays for OCR; a digital one doesn't.

## Starting one

- **One control: the `+` beside "Your books" on Home.** It opens the OS
  file picker and nothing else: no drop zone, no upload dialog, no
  second entry point in the top bar. Books live on the shelf, so that is
  where you add one.
- The picker takes **several files**; the runner prepares one at a time.
- **No dialog.** There is nothing to ask: the title comes from the PDF
  and the sha comes from the bytes.

## While it runs

**The shelf only ever holds books you can open.** A book on its way
there (queued, preparing, or failed) is a row in **one Box above the
shelf** (2026-09-21, replacing a caption under a dimmed cover). The Box
exists only while there is work, so a shelf of ready books is nothing but
covers, with no space reserved beneath them.

Each row is an `ImportRow`: the book's cloth colour as a swatch, its
title (the tidied filename until the PDF's metadata replaces it), one
line of status, and the controls for that state.

| state | line | controls |
|---|---|---|
| queued | Queued: no spinner, nothing is happening yet | Cancel |
| preparing, can count | "Read the pages · 140 of 312" and a bar | Stop |
| preparing, can't count | the phase name and a `Spinner` | Stop |
| failed | the engine's own sentence, in destructive ink | **Try again** · Dismiss |

- Rows run preparing first, then queued in order, then failed.
- **Stopping leaves a failed row**, so Try again is the undo: one shape
  for "not going to finish", not two.
- A failure stays until you dismiss it: one you didn't watch happen must
  still be there when you come back. It never interrupts with a dialog.
- **You cannot open a book that isn't ready**: it isn't on the shelf.
- The Door counts ready books only, and the rows are never behind it.

**Rejected treatments**, compared side by side against real tokens: a
card over the bottom of the cover (covered the book, cramped the
controls), a badge with a popover (needed a new Popover primitive and
put everything a click away), and a one-line summary that opens down
(split status from the dimmed covers and put Stop two clicks deep).

## The two refusals

- **No embeddings endpoint.** The `+` is disabled and a warning-tone Box
  sits above the shelf with one line and a link to Settings. You never
  get to choose a file you can't import.
- **A book you already have.** Nothing is enqueued and nothing is said:
  you go **straight to that book's workspace**. You asked for this book;
  here it is.

## An empty shelf

A first run shows the greeting and one large **"Add your first book"**,
and nothing else. This week's numbers and the homework list aren't
rendered at all, because four empty sections read as broken and a row of
zeroes is noise. Home grows into itself as there is something to say.
