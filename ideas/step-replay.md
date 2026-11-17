# Step replay: evals from real work

## Status

Idea. Not decided. It can be built once the pipeline runs on steps (after track 5 of
[backend-courses.md](backend-courses.md)).

## Information

**Why.** Every step has its inputs hashed and its model calls attached, so any step
can be run again on demand. Today a change to a prompt or a model is judged by a
hand-run comparison, and the evidence lives in prose in `design/backend.md`.

**What it would be.**

- Run a changed prompt or model again on last week's real problems, and compare the
  answers, cost and time side by side.
- A catalog of prompts, as errors and actions have one: an id, a version, the step
  that owns it and the eval that justified it. A call records the prompt and version
  it used.
- Tests replay recorded calls in place of a hand-written fake model.

**What it costs.** Replays spend on a model key, so each run needs a capped key. The
recorded calls hold the student's problems, so they stay in the data folder and never
enter the repo.

**Open.** Which steps are worth replaying first; how answers are compared (by the
checker, or by hand); where the results are shown.
