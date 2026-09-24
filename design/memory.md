# Book memory

What the tutor knows about a book from working in it: where things are,
how the book is laid out, and how you want answers. Decisions from the
2026-09-21 grill; each is settled, not open.

## What a memory is

One sentence about one book, of one of two kinds:

- **Book**: anything about the book. Where a named result lives
  ("Theorem 1.5, Cauchy-Schwarz", p. 22) and how it's laid out ("Each
  section's problems come right before the next section starts"). An
  optional page.
- **Preference**: how you want answers ("Use SI units", "I use Octave,
  not MATLAB").

Each carries **who saved it**: **You** (the memory menu, or asked for in
Ask), **Tutor** (the model, on its own judgement), or **PSet** (code: the
problem ranges locate records). The page is stored as a PDF page, like
every page on the wire, and shown printed.

## Who saves, and when

**Ask and the walkthrough writer both have a `remember` tool.** The
walkthrough is where most is learned: if five of eight problems rest on
Theorem 1.5, the first one to find it saves it and the others go straight
to its page.

The rules are **strict, with no count cap**. Save only what spares future
work or changes future output: where a named result lives when the work
needed it and had to look for it, a rule about how the book is laid out
or writes things, or something the student asked for. Never a problem's
solution, general math, a guess not checked on the page, or anything
already remembered. One fact per memory; the page goes in its field, not
the sentence.

**Upkeep.** Memories reach the model with short ids. `remember` can take
`replaces` to overwrite a Tutor or PSet memory; **yours are never
replaced or dropped by the tutor**. The server treats a sentence that
matches an existing one (case, spacing and punctuation aside) as already
remembered.

A `remember` with no kind (small models drop it) is about the book, or a
preference when the student asked for it and there's no page.

**Yours, through Ask.** "Remember I use Octave" saves as yours
(`from_student`). "Forget that" removes one: Ask alone has a `forget`
tool, used only when the student asks in that turn. The walkthrough
writer has neither.

## How it's used

**Every memory goes into the system prompt, refreshed every model
round**, so a save by one walkthrough reaches another running at the same
time within a round. The block is capped at 60 memories or 4,000
characters: yours always go in, then the rest newest first.

**Locate records problem ranges, by code.** When it finds problem 3.36
on a page, PSet keeps one memory per chapter ("Chapter 3 has problems on
p. 148-156") with the problems it has seen behind it. The next locate
in that chapter shows the pages between the nearest problems seen before
and after the new one, nearest the estimate first, ahead of search, and
sweeps them before the chapter's end. Delete the memory and the points go
with it.

## What you see

- **A save is a step.** In Ask it is a line in the step feed:
  "Remembered · Theorem 1.5 (Cauchy-Schwarz) · p. 22" with **Undo**,
  which deletes it. Once gone the line says "Undone".
- **A walkthrough lists its memory work under its stages**, the same
  lines: what it remembered, with Undo, and "Found from memory" when a
  remembered range spared locate its search. Use is otherwise shown only
  through citations; there is no "recalled 9 memories" line.
- **The memory menu**: **Memory** in the book's menu in the top bar
  (design/workspace.md) opens the Memory dialog (wide). Add a memory at the top (kind,
  sentence, optional printed page; one already there says so), filter by
  kind with tabs (not a second segmented control, which would read as
  the kind picker), and every row shows its sentence, its page (jumps
  there), who saved it and when, and Delete. Deletes are immediate; the
  dialog's one button is Done.

## Backend

`internal/memory`, a feature package. It knows nothing of agent or
homework; `cmd/pset` adapts it to what each consumer asks for.

```
GET    /api/books/{id}/memories   POST /api/books/{id}/memories  {kind, text, page?}
DELETE /api/memories/{id}
events: memory.saved {memory}   memory.removed {id, bookId}
```

- `agent.Loop` takes a `Memory` (notes, remember, forget) and `Student`
  (Ask: `from_student` and `forget` exist). It appends the rules and the
  fresh block to its `System` prompt each round, and reports saves
  through `Remembered`.
- Homework asks for `ProblemsSeen(book, chapter)` and
  `SawProblem(book, chapter, label, page)`, and keeps each question's
  memory lines (`memory`) beside its guide; a retry clears them.
- A book's removal takes its memories (foreign key).
