# Homework backend — spec (v1)

Grilled and decided 2026-09-14, following the UI spec (`homework-spec.md`).
The UI ships stubbed; this spec is the real build behind the same shapes.

## Core model

An assignment is a book + pasted source text → an ordered outline of
questions. Every question is **a region screenshot of its book page**: the
vision pass pins the page and the question's bounding rect, and that crop is
what renders in the UI, prints on the sheet, and downloads. The model's text
transcription is stored as context for LLM edits and guides but never
printed. Both artifacts (walkthrough UI, PDF) render deterministically from
the stored outline — the LLM only ever changes the outline.

## Data model (store)

Two tables, following the conversations pattern (structured content as JSON
columns, cascade deletes):

- `homeworks(id, book_id → books, title, due_date NULL, status
  'generating'|'ready', turned_in, source_text, created_at, updated_at)`
- `homework_questions(id, homework_id → homeworks CASCADE, position, page,
  status 'pending'|'locating'|'writing'|'ready'|'failed', error NULL,
  standalone BOOL (v6), question_rect JSON, transcription, diagrams JSON,
  guide JSON NULL, created_at, updated_at)`

- `question_rect` — normalized `{x, y, w, h}` in page-image space.
- `diagrams` — `[{label, rect}]`, same coordinate space, rendered on demand.
- `guide` — `{setup, hints[], steps[], equations[{title, tex, note?}],
  answer}`, validated engine-side like ask's envelope payloads (with the
  same repair-round escalation when JSON comes back malformed).
- Reveal state (steps/answer shown) is client-only localStorage — study
  preference, not content.
- Migration adds both tables; `position` renumbers on reorder/delete.

## API contract

Follows existing conventions (JSON errors, 202 + job for queued work, SSE
with `data:` events, DisallowUnknownFields on bodies):

- `POST /api/homework` `{bookSha256, title?, dueDate?, sourceText}` →
  `202 {homework, job}`. Caps enforced here: ≤ 30 questions extracted,
  source ≤ 20 KB, ≤ 3 candidate pages per question.
- `GET /api/homework` — list with question counts and book identity
  (dashboard).
- `GET /api/homework/{id}` — homework + ordered questions (workspace load;
  partials visible mid-generation).
- `PATCH /api/homework/{id}` `{title?, dueDate?, turnedIn?}`.
- `DELETE /api/homework/{id}` — questions cascade.
- `GET /api/homework/{id}/events` — SSE: `stage` (extracting/locating/
  writing), `question` (added or updated, full row), `question-removed`
  (questionId), `guide` (questionId + guide), `done`, `error`. Reattachable:
  every step persists before it emits, so a reload re-streams current state
  via plain GET and continues live.
- `POST /api/homework/{id}/commands` `{text}` — SSE of the same event
  shapes while the tutor runs; the resulting outline is validated (every
  question keeps page + rects) and applied transactionally.
- Direct question endpoints, no LLM: `DELETE …/questions/{qid}` (response
  carries the removed row — the client's undo re-POSTs it), `POST
  …/questions` (create with full content; the undo target), `PATCH
  …/questions/{qid}` `{position}` (reorder). Manual guide editing is
  deferred.
- `POST …/questions/{qid}/retry` — re-runs locate and/or guide for one
  failed question.
- `GET …/questions/{qid}/image?variant=question|diagram&n=` — renders the
  stored rect from the book's page as JPEG (same poppler path the page-image
  endpoint wraps). The PDF renderer uses the same source.
- `GET /api/homework/{id}/pdf` — `application/pdf`.

## Generation pipeline (engine)

A new `homework` job type in the existing serial queue — task-center
visible, survives restarts, cancel at stage boundary (partials keep their
statuses). Staged calls:

1. **Extract** — one cheap text-only call over the pasted source: an array
   of questions, each with its text plus a header hint ("Chapter 4") when
   the assignment carries one, and a source classification: `book` when the
   question is tied to the book's content, `standalone` when it is fully
   self-contained (professor-written, conceptual, all numbers given). Cap 30.
   Standalone questions skip locating: their guide is written from the
   statement itself plus a text-only retrieval pass (top 6 pages), so the
   walkthrough can cite the pages that teach the material — citations are
   grounded in the pages the writer was given, never invented. The printed
   sheet shows the statement instead of a screenshot. The tutor command
   channel's `add` op carries the same flag.
2. **Locate** (per question) — reuse ask's retrieval: FTS + vector fusion
   over the question text, seeded by matching the header hint against the
   TOC; top ≤ 3 candidate pages go to one vision call with page images and
   page text attached, which returns page, question rect, diagram rects.
   The contract is "where the book covers this problem" (matched on topic,
   not wording); out-of-range pages are rejected. Rects are
   bounds-validated; failure marks the question `failed` with its error.
3. **Guide** (per question) — context is the pinned page's text + image and
   the transcription; structured guide JSON out with the repair round.

Each step persists before emitting its event, so streaming and reload agree.
Job settle (completed/cancelled/failed) flips the homework to `ready` with
whatever exists. A homework shows `generating` iff an active job targets it.

## Tutor edits

Command context = the full outline (rows, not rendered) + page images for
questions the command touches. The engine streams the same event shapes as
generation. Validation before commit: page numbers in range, rects present
and in bounds, positions a clean permutation. A command that fails parses or
validation emits `error` and changes nothing.

## PDF (engine)

Pure-Go writer, deterministic from the outline, **Letter** paper: sheet 1
carries the header band (title, due date, question list with page refs) with
Q1 below it; one question per sheet after; region screenshots and diagram
crops embedded as JPEGs; the rest of each sheet is working space; footer
`n / total`. The web preview mirrors this geometry (the shipped mock's
caption and aspect ratio update from A4 to Letter). No name/course stamp
(decided in the UI grill).

## Testing (one-layer rule)

- **store**: CRUD, cascade, JSON round-trips (rects, diagrams, guide),
  position renumbering, list-with-counts.
- **engine** (deterministic, llm fakes): pipeline order and event sequence,
  staged fake responses per call kind, rect validation, per-question failure
  and retry, cancel-keeps-partials, caps enforcement, command validation and
  transactional apply, PDF bytes from the sample books' pages.
- **api**: wire contract only — routes, status codes, SSE event shapes,
  crop/PDF content types.
- **costly tier** (`-tags llm`): one live generation over a sample book;
  prompt conformance for extract/locate/guide.

## Explicitly deferred

- Reader deep link "make homework from this page"; A4 toggle; per-question
  sheet density; manual guide text editing; name/course stamping; grading.
- Book deletion interplay (books are not deletable in the app today).
- Parallelizing locate/guide calls (the serial queue runs them sequentially;
  revisit only if latency hurts).
