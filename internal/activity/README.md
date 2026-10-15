# activity

Time spent: stretches of study from the workspace, folded into the week
Home reports. It reports and never nags: no targets. Spec:
`design/backend.md`, "Settings and data" ("Time spent is stretches of
study").

## Tables

`study` (`id`, `book_id`, `kind`, `started`, `ended`), cascading from the
book. The times are `db.Stamp`s, fixed width, so they compare as strings.
`activity/2` turned the heartbeats before it into stretches and dropped
their table.

## Endpoints

- `POST /api/study {id, bookId, kind, started, ended}` (`reading`,
  `asking` or `homework`): the client names a stretch and saves it every
  half-minute and as it ends. Saving an id again only moves its end on,
  never back. An end past the server's clock is clamped to it, and a
  stretch to six hours. A book that no longer exists is `not_found`.
- `GET /api/week?since=<RFC 3339>`: minutes by kind and by book since the
  start of the student's week, which the client sends because it knows
  the local calendar, and the questions and sets worked, which come from
  homework (`QuestionsDoneSince`). Overlapping stretches count once: each
  total is the length of their union, rounded to the minute, so the parts
  of a week can differ by a minute from its whole.
- `DELETE /api/study`: forgets all time, in every book. Questions worked
  stay.
