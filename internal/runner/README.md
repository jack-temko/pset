# runner

Every piece of PSet's background work, as steps (`ideas/backend-courses-grill.md`,
D3 and D4; `ideas/errors-grill.md`). A step's state is a row in the store's
`steps` table, logged like any change, so the page sees each step move. What a
step makes lives in its own table.

- **Pipelines.** A `Pipeline` is the steps of one kind of subject, in order. A
  `Handler` names the steps it waits for (default: every step before it), whether
  it is **lazy** (made `not_asked`, run only when asked), the **model** whose limit
  it counts against, and an **input** hash. `Start` makes a new subject's steps
  inside the caller's `store.Write`; `Wake` after the commit.
- **Scheduling.** Highest priority first, then oldest. A step runs when it is
  waiting with no incident (or retrying and due), the steps it waits for are done,
  its subject is not removed, and its model is under its limit (default 2). A
  running step whose subject is removed is **paused**: back to waiting, and it
  carries on if the removal is undone.
- **Tries.** A run that is shut down, paused or cut short by a crash is not a try.
  Asking a step again (`Ask`, Try again, out of date, a healed condition) starts
  its tries over.
- **Failure, by its catalog kind.** `passing`: tried again after 8 s, 30 s, 2 min,
  three tries in all; still failing, it waits on the condition its entry clears
  (the provider), or fails. `waiting_on_you`: the step waits on one incident per
  cause, shared by every step waiting on it, and the condition stops holding.
  Anything else fails the step with an incident on its subject. A cause the
  computer shows (a full disk, Poppler missing, the database unwritable) is named
  first by `condition.Cause`, whatever entry the step wrapped it in.
- **Healing.** `Holds(condition)` heals its incidents and runs what waited on it.
  It is called by saving a key (key, credit), a passing health check in Settings,
  Try again on a waiting incident (`TryAgain`), and any model call that works
  (key, credit, provider). There is no background probe.
- **Out of date.** `Changed(subject)` re-hashes its done steps: an eager step
  whose inputs changed runs again, a lazy one goes `out_of_date` until asked. A
  step that finishes checks again, in case its inputs moved while it ran.
- **Model calls.** One client for the whole run (`Run.Client`), reading the key
  saved now. `Run.Request` keys each call to its step in the `calls` table: a
  step's usage is the sum of its calls, and they go with it.
