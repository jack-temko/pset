# Memory dialog

The book's preferences, opened from **Memory** in the book's menu. The
component itself is `MemoryDialog` in `pages/workspace/memory.tsx`; it
reads and writes through `api/memory.ts`. Spec: `design/memory.md`.

A wide `Dialog` with one button, **Done**: deletes are immediate, so there
is nothing to confirm or cancel.

- **Add a preference** at the top: one `Field` and `Input` ("Use SI units")
  with a secondary **Add** beside it, level with the input. A sentence
  already there says so under the field instead of adding it twice.
- **The list** below, newest first. Each row is the sentence, then who
  saved it (**You**, or **Tutor** for preferences saved before only Ask
  could) and when, with a ghost trash **Delete** at the end.
- **Empty** it speaks of preferences, not of the tutor: "How you want
  answers, like units or notation".
- **Loading** shows two skeleton lines in the list's place.

There is no kind picker, no filter and no page: a memory is a preference
and nothing else.
