# ask

The book's tutor: one running conversation per book, each turn an agent
loop over the book (`internal/agent`: search, read, look, compute,
remember) that streams its steps and its answer as a document
(`internal/doc`). Spec: `design/workspace.md`, "Ask".

## Tables

`turns` (`book_id`, `question`, `about` and `about_text` from the "About"
chip, `steps`, `answer` as blocks, `state`, `reason`, `failure`),
cascading from the book. Migration `ask/2` deleted every conversation when
answers became documents.

## A turn

`POST /api/books/{id}/turns` inserts the turn and enqueues its job (lane
`turn`, eight at once, keyed by the book so a book answers one question at a
time) in one transaction, and publishes `turn.changed` before the job can
start. It is refused `not_configured` with no key. The job runs the loop
with the book's last six finished turns as history (citations moved back
to printed pages) and up to eight tool rounds, then a final answer with
what it has. As it goes it publishes `turn.block.start`, `.text`,
`.repairing`, `turn.block` and `.failed` (see the events table in
`design/backend.md`) and saves the turn at most every 400 ms, so a reload finds it close
behind the stream.

States: `running`, `done`, `stopped` (`POST /api/turns/{id}/stop` keeps the
blocks written so far), `failed`. A failed turn has a `reason` in words and
a `failure` kind the page acts on: `setup` (no key, a refused or expired
key, an account out of credit: Settings), `unavailable` (OpenRouter busy),
`generation` (cut off, or the model stopped without answering). A shutdown
puts the job back to queued, and its turn starts over from the question.

`GET /api/books/{id}/turns` lists the conversation; `DELETE` clears it
(`turns.cleared`). The tutor's memory of the book is `internal/memory`,
reached through the agent loop.
