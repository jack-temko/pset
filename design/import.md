# Importing a book

How a PDF becomes a book on the shelf. Decisions from the 2026-09-20
grill; each is settled, not open.

**What the engine already does** (`internal/library/import.go`), because
the UI is shaped by it and not the other way round: it stages and hashes
the file in one pass, **refuses a duplicate by sha256** and hands back
the book that already exists, takes the title from the PDF's metadata
with the tidied filename as fallback until the model reads the real one
off the title page (design/contents.md), **refuses up front if the chat
model or the embeddings endpoint isn't configured** rather than failing
forty minutes into OCR, and prepares the book in five named phases:
*Examine the pages · Read the pages · Read the contents · Index the
sections · Build search*. A scanned book pays for OCR; a digital one
doesn't. How the contents are read is design/contents.md (2026-09-22).

## Starting one

- **One control: the `+` beside "Your books" on Home.** It opens the OS
  file picker and nothing else: no drop zone, no upload dialog, no
  second entry point in the top bar. Books live on the shelf, so that is
  where you add one.
- The picker takes **several files**; the runner prepares one at a time.
- **A scan steps aside** (2026-09-24). The runner examines every book
  first (title, pages, digital or scanned), then prepares digital books
  ahead of scans. A book added while a scan is being read interrupts the
  reading: the scan goes back to the queue with the pages it has read,
  and carries on from there once the book ahead of it is ready.
- **No dialog.** There is nothing to ask: the title comes from the
  book's title page and the sha comes from the bytes.

## Its colour

(2026-09-23) Three books once hashed to the same hue, so the hash no
longer decides alone. **A book's cloth colour is picked when it's added
and kept**: the one fewest books on the shelf wear, the search starting
at the hue its sha seeds, so an empty shelf still colours by hash and six
books wear six colours. Books from before were given theirs, oldest
first, the same way. **The Book dialog changes it** to any of the six;
there are no other colours. Changing it isn't an edit to the book's name:
a retried import can still name the book.

## While it runs

**The shelf only ever holds books you can open.** A book on its way
there (queued, preparing, or failed) is a row in **one Box above the
shelf** (2026-09-21, replacing a caption under a dimmed cover). The Box
exists only while there is work, so a shelf of ready books is nothing but
covers, with no space reserved beneath them.

Each row is an `ImportRow`: the book's cloth colour as a swatch, its
title (the tidied filename until the PDF's metadata, then the title
page, replaces it), one
line of status, and the controls for that state.

| state | line | controls |
|---|---|---|
| queued | Queued: no spinner, nothing is happening yet | Cancel |
| queued, a scan that stepped aside | "Queued · 140 of 312 pages read", still, no bar | Cancel |
| preparing, can count | "Read the pages · 140 of 312 · about 12 minutes left" and a bar | Stop |
| preparing, can't count | the phase name and a `Spinner`, then "· less than a minute left" once past imports give an estimate | Stop |
| failed | the engine's own sentence, in destructive ink | **Try again** · Dismiss |

- **Time left** (2026-09-22) is for the phase, never the whole import,
  in rounded words that coarsen with distance ("a few seconds", "less
  than a minute", "about 3 minutes", "about 25 minutes", "about an
  hour"), never a countdown. A counting phase goes by its own pace over
  its last few minutes; a phase that can't count goes by the median of
  its last five runs in this browser, and past that says "taking longer
  than usual". No honest estimate yet means no words at all. The
  arithmetic lives in `web/src/lib/eta.ts`, for any long step to reuse.
- Rows run preparing first, then queued in the order they will run
  (books not yet examined, then digital, then scans, oldest first within
  each), then failed.
- **Stopping leaves a failed row**, so Try again is the undo: one shape
  for "not going to finish", not two. It says "Cancelled before it
  started." only for a book nothing has happened to yet; one that has
  been examined says "Stopped.", and Try again resumes it.
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

- **No chat model or no embeddings endpoint.** The `+` is disabled and a
  warning-tone Box sits above the shelf with one line naming what's
  missing and a link to Settings. You never get to choose a file you
  can't import. (The chat model reads the contents, since 2026-09-22.)
- **A book you already have.** Nothing is enqueued and nothing is said:
  you go **straight to that book's workspace**. You asked for this book;
  here it is.

## An empty shelf

A first run shows the greeting and one large **"Add your first book"**,
and nothing else. This week's numbers and the homework list aren't
rendered at all, because four empty sections read as broken and a row of
zeroes is noise. Home grows into itself as there is something to say.
