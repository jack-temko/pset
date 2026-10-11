# memory

How the student wants answers in a book. Spec: `design/memory.md`.

- **A memory** is one preference about one book, a sentence, and who saved
  it: `you` or `tutor` (older preferences; only Ask saves now).
- **`Save`** validates, drops duplicates (the sentence compared without
  case, spacing or punctuation) and can `Replaces` a memory by its id or
  the start of it. Only the student's own saves replace the student's.
- **`ForPrompt`** is what fits in a system prompt: every one of yours, then
  the rest newest first, to 60 preferences or 4,000 characters.
- Knows nothing of the model or of homework: `cmd/pset` adapts it to
  `agent.Memory`.
- Routes: `GET`/`POST /api/books/{id}/memories`, `DELETE /api/memories/{id}`.
  Events: `memory.saved`, `memory.removed`.
