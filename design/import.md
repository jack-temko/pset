# Importing a book

How a PDF becomes a book on the shelf. Decisions from the 2026-09-20
grill; each is settled, not open.

**What the engine already does** (`internal/engine/import.go`), because
the UI is shaped by it and not the other way round: it stages and hashes
the file in one pass, **refuses a duplicate by sha256** and hands back
the book that already exists, takes the title from the PDF's metadata
with the tidied filename as fallback, **refuses up front if the
embeddings endpoint isn't configured** rather than failing forty minutes
into OCR, and prepares the book in four named phases — *Examine the
pages · Read the pages · Index the sections · Build search*. A scanned
book pays for OCR; a digital one doesn't.

## Starting one

- **One control: the `+` beside "Your books" on Home.** It opens the OS
  file picker and nothing else — no drop zone, no upload dialog, no
  second entry point in the top bar. Books live on the shelf, so that is
  where you add one.
- The picker takes **several files**; the runner prepares one at a time.
- **No dialog.** There is nothing to ask: the title comes from the PDF
  and the sha comes from the bytes.

## While it runs

A preparing book is **a tile on the shelf from the first frame**, in its
final place. The sha is known as soon as the file is staged, so it has
its cloth colour immediately; the title is the tidied filename until the
PDF's metadata replaces it. It never moves and never changes shape — it
only finishes.

- **In-flight tiles sit first and are never hidden by the Door.** Work
  you started must not disappear behind "Show all 12". The Door counts
  finished books only.
- **A tile that can count, counts**: the phase name and its numbers
  ("Read the pages · 140 of 312") over a determinate bar.
- **A tile that can't, spins**: examining and building search either
  finish or don't, so they get the phase name and a `Spinner`.
- **Queued says "Queued", with no spinner.** Nothing is happening to
  that book yet, and a turning shape would claim otherwise for the next
  forty minutes.
- **Stop** is on a running or queued tile. Stopping leaves the failed
  tile, which you can retry or dismiss — one shape, not two.
- **You cannot open a book that isn't ready.** It is visible everywhere
  and usable nowhere. No half-working workspace to design, and no
  feature that is present but doesn't answer.

## When it ends badly

The tile **turns to destructive ink**: the engine's own sentence, a
**Try again**, and a **Dismiss**. It stays where you left it — a failure
you didn't watch happen must still be there when you come back — and it
never interrupts with a dialog.

## The two refusals

- **No embeddings endpoint.** The `+` is disabled and a warning-tone Box
  sits above the shelf with one line and a link to Settings. You never
  get to choose a file you can't import.
- **A book you already have.** Nothing is enqueued and nothing is said:
  you go **straight to that book's workspace**. You asked for this book;
  here it is.

## An empty shelf

A first run shows the greeting and one large **"Add your first book"** —
and nothing else. This week's numbers and the homework list aren't
rendered at all, because four empty sections read as broken and a row of
zeroes is noise. Home grows into itself as there is something to say.
