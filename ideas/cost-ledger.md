# Cost: a ledger that speaks before it spends

## Status

Idea. Not decided. It needs calls keyed to steps (track 3 of
[backend-courses.md](backend-courses.md)) and conditions
([actions-conditions-place-grill.md](actions-conditions-place-grill.md)).

## Information

**Why.** The vision's `check-before-cost` rule is a habit today, kept by each feature.
With calls keyed to steps, cost rolls up to a question, a set and a course by one
query, and can be known before it is spent.

**What it would be.**

- An estimate before a large spend, from the student's own history: "Reading this
  700-page scan will cost about $0.40."
- A cap the student sets. Reaching it is a "waiting on you" condition, so it looks and
  heals as running out of credit does (`ideas/errors-grill.md`, E1 and E2).

**What it costs.** Little code once steps and conditions exist. The estimate is only
as good as the history: a first import has none, so it would say nothing rather than
guess.

**Open.** Whether a cap is per course, per month or both; where the estimate is shown
(on the action that spends, per C5 of the actions grill); whether small spends are
ever mentioned.
