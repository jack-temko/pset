# memory

What the tutor knows about a book from working in it. Spec:
`design/memory.md`.

- **A memory** is one sentence about one book: kind `book` (where
  something is, how the book is laid out; optional PDF page) or
  `preference` (how the student wants answers), and who saved it: `you`,
  `tutor` or `pset`.
- **`Save`** validates, drops duplicates (the sentence compared without
  case, spacing or punctuation) and can `Replaces` a memory by its id or
  the start of it. Only the student's own saves replace the student's.
- **`ForPrompt`** is what fits in a system prompt: every one of yours, then
  the rest newest first, to 60 memories or 4,000 characters.
- **`SawProblem` / `ProblemsSeen`** keep one `pset` memory per chapter,
  "Chapter 3's problems are on p. 148–156", with the problems locate found
  behind it. Deleting it deletes them.
- Knows nothing of the model or of homework: `cmd/pset` adapts it to
  `agent.Memory` and `homework.Memory`.
- Routes: `GET`/`POST /api/books/{id}/memories`, `DELETE /api/memories/{id}`.
  Events: `memory.saved`, `memory.removed`.
