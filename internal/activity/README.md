# activity

Time spent: heartbeats from the workspace, folded into the week Home
reports. It reports and never nags: no targets. Spec:
`design/backend.md`, "Settings and data" ("Time stats come from heartbeats").

## Tables

`heartbeats` (`book_id`, `kind`, `at`), cascading from the book. `at` is a
`db.Stamp`, fixed width, so it compares as a string.

## Endpoints

- `POST /api/heartbeat {bookId, kind}` (`reading`, `asking` or `homework`):
  one beat stands for 30 seconds. A beat less than two thirds of that after
  the last one for the same book is the same half-minute (a second tab) and
  is dropped. A book that no longer exists is `not_found`.
- `GET /api/week?since=<RFC 3339>`: minutes by kind and by book since the
  start of the student's week, which the client sends because it knows the
  local calendar, and the questions and sets worked, which come from
  homework (`QuestionsDoneSince`), not from beats. Minutes are beats times
  30 seconds, rounded to whole minutes for each kind and each book on its
  own, so the parts of a week can differ by a minute from its whole.
- `DELETE /api/heartbeats`: forgets all time, in every book. Questions
  worked stay.
