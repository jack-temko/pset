# Time remaining estimate

## Status

**Idea** (2026-09-30, Jack, from the homework redesign grill). The redesigned
homework view shows a time left on the set; for now it is **mocked and fake**
(sample numbers in the `/views` world). This file is the backend the mock stands
in for.

## Information

**What Jack wants.** "Often I want to know how much longer this homework will take."
The set's progress line shows "3 of 8 done" and a time left, computed from the
student's own pace.

**How to compute it (Jack's design).**
- While the LLM writes a question's walkthrough, it also writes a **difficulty
  index** for that question, relative to the other questions in the same set (the
  hardest question of the set scores highest).
- The client or server records **how long each question took** the student (time
  with that question open and active; see `design/backend.md` on sessions and the
  focus-aware timer).
- **Estimate = the remaining questions' indices, scaled by how long earlier
  questions took per unit of index.** A question that took 20 minutes at index 2
  says 10 minutes per point; a remaining index-4 question then reads about 40
  minutes.

**Guard rails (assumed by the grill, overrule them).** Shown only after at least two
questions have been timed; worded "about 1 h 40 m left", never a live countdown; a
range when the spread is wide; never nagging. A wrong number at 1am is worse than
none, so it stays quiet until it has earned trust.

**What it needs from the backend.**
- `difficulty` on `Question` (wire type in `internal/homework/wire.go`), written by
  the guide's writer; a way to regenerate it when the set changes.
- Time per question: the activity heartbeats already carry a book and an activity
  kind; they need the question as well.
- The estimate itself, computed server-side and sent with the set (so Home and the
  finish page can use it), or computed in the client from the two fields above.

**Also used by.** The finish page after the last question (time per question, total
time, the hardest questions by index).

**Open.** Whether difficulty is one number or per part; how to treat a question
skipped and returned to; how to handle time away (the timer already pauses after
five minutes idle).
