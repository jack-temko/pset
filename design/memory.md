# Book memory

How you want answers in a book: units, notation, how much working to
show. Decisions from the 2026-09-21 grill, cut down on 2026-10-08 to
preferences only; each is settled, not open.

## What a memory is

One sentence about one book: a **preference** ("Use SI units", "I use
V_0, V_1 for nodal voltages"). Each carries **who saved it**: **You** (the
memory menu, or asked for in Ask) or **Tutor** (preferences the model
saved before 2026-10-08, which stay).

**Why only preferences.** The tutor used to save facts about the book too:
where a theorem lives, and, from code, the range of pages a chapter's
problems had been found on. Nothing checked them before they were
remembered, and a wrong find saved as a range steered later finds in its
chapter to the wrong page. Since finds start from the contents' Problems
pages and the Reader decides whether a page holds the problem, the ranges
helped nothing. Book notes the tutor saved on its own were the same kind
of unchecked steering. A migration (`memory/2`) deleted them.

## Who saves, and when

**Only Ask saves.** Ask has `remember` and `forget`. It saves only what
you state or ask it to remember about how you want answers ("Remember I
use Octave"), as yours, and removes one only when you ask it to forget.
The walkthrough writer **reads** every preference but has no tool to save
or remove one, and nothing in the find saves anything.

**Upkeep.** Memories reach the model with short ids. `remember` can take
`replaces` to correct one. The server treats a sentence that matches an
existing one (case, spacing and punctuation aside) as already remembered.

## How it's used

**Every preference goes into the system prompt, refreshed every model
round**, for Ask and for the walkthrough writer, so a save in Ask reaches
a walkthrough running at the same time within a round. The block is
capped at 60 preferences or 4,000 characters: yours always go in, then
the rest newest first. Finding a problem does not read memory.

## What you see

- **A save is a step.** In Ask it is a line in the step feed:
  "Remembered · Use SI units" with **Undo**, which deletes it. Once gone
  the line says "Undone".
- **A walkthrough shows nothing about memory.** It reads preferences and
  saves none, so there is nothing to list.
- **The memory menu**: **Memory** in the book's menu in the top bar
  (design/workspace.md) opens the Memory dialog (wide). Add a preference at
  the top (one already there says so); below, every preference with who
  saved it and when, and Delete. Empty, it speaks of preferences ("How
  you want answers, like units or notation"). Deletes are immediate; the
  dialog's one button is Done.

## Backend

`internal/memory`, a feature package. It knows nothing of agent or
homework; `cmd/pset` adapts it to what the loop asks for.

```
GET    /api/books/{id}/memories   POST /api/books/{id}/memories  {text}
DELETE /api/memories/{id}
events: memory.saved {memory}   memory.removed {id, bookId}
```

- `agent.Loop` takes a `Memory` (notes, remember, forget) and `Student`
  (Ask). The notes go in its `System` prompt each round; `remember` and
  `forget` are offered only with `Student`. It reports saves through
  `Remembered`.
- Homework passes the same `Memory` to the writer's loop, without
  `Student`, so it only reads.
- A book's removal takes its memories (foreign key).
