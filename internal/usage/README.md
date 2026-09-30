# usage

What each model call cost, on the thing that spent it. One row per call in
`calls`, never summed into summaries: any later view (per book, per month)
is a query, not a migration. Spec: `design/model-usage.md`.

## Writing

`llm` hands every finished call to a sink (`llm.OnCall(usage.Sink(db))`,
wired in `cmd/pset`; `llm` never imports the db). A job names what its
calls are for with `llm.WithSubject` where it sets its session: a
`question` (its find, figure read and guide), a `read` (an assignment), a
`turn` (an Ask answer) or a `book` (its import). A call with no subject is
kept with empty strings. The write is one statement that records nothing
for a subject `Forget` has marked, so a call that ends after its subject
was removed leaves no row.

A call with no `Usage` (failed, stopped part-way, or a provider that
reports none) is recorded with null tokens and cost. It is *uncounted*:
the provider may well have billed it.

## Reading

`For` and `ForSubjects` are the one grouped query: one row per model that
*answered* (falling back to the model asked for when nothing answered),
ordered by tokens so the headline is who did the work, with the total, the
failed calls and how many calls were uncounted. Nil means no calls. The
alias in the query is not called `model`: `GROUP BY model` would group by
the column, the model asked for.

## Cleaning up

`Forget` and `ForgetAll` are called as a subject goes, in its transaction
where it has one: they mark the subject in `forgotten` and delete its rows.
Removing a book goes through the hooks library gives homework and ask.
`Sweep`, at startup, clears marks older than a day and unattributed calls
older than 30 days.
