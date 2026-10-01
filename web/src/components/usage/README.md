# UsageLine

What a finished job spent, as one muted line where the thing it produced
lives: a question's guide (its find, its figure read and its guide
together), an assignment read's row, one Ask answer. It is text, not a
control: nothing to press, nothing that moves.

`deepseek-v4 +1 · 25s · 11,016 tokens · $0.0047`

- **The order** is the model, the time, the tokens, the cost. The model is
  the one that did the most of the work (the most tokens, usually the
  writer), with `+N` for how many more served the job; the `title` names
  them all. Cost is last because it is the number to skim past.
- **`text-xs text-muted-foreground`, `tabular-nums`**, inline: it sits in a
  sentence (`wrapDescription` rows) or, given `className="block"`, on its own
  line under a guide or an answer. It wraps between its parts, never inside one.
- **The formatting** is `web/src/lib/usage-format.ts`, with tests: `clock`,
  `cost`, `tokens`, `shortModel`, `atLeast`. Tokens are exact with
  separators. **Time is the calls' durations added up**, so calls made at
  once count in full (the `title` says so).
- **Marks:** a call that failed, was stopped or came from a provider that
  reports nothing has no tokens or cost, though a failed one still bills: when
  any call is uncounted, tokens and cost read `≥ n`, and a figure with nothing
  counted is "–" (never a zero, which would say free). A paid call under
  $0.0001 reads "<$0.0001"; "$0.0000" is exactly nothing, a local model.
- It is `data-copy-skip`: an answer's copy button leaves it out.

**It appears only after the job has finished** (ready or failed, done,
stopped, failed) and only when at least one call was made; nothing shows
while it runs, where the working lines already say how it's going. Every
call is counted, a rerun or retry included: the money was really spent.

**Changed 2026-09-30** (Jack, in the homework redesign): it was a button
(`deepseek-v4 · 25s ▾`) that opened a popover with one row per model and a
Total. The numbers now sit on the page; the per-model split is the `title`.

**Don't:** show it for a job still running; abbreviate the tokens ("21k"
belongs nowhere here); put actions on it. Book imports record their calls
but don't surface them yet.
