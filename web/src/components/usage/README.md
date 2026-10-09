# UsageTrigger

What a finished job spent, as one quiet line that opens the details: where
the thing it produced lives (a question's guide, an assignment read's row,
an Ask answer), the line reads

`deepseek-v4 +1 · 25s · 11,016 tokens · $0.0047 ›`

and is a **button**. Clicking it opens the [usage modal](../usage-modal/README.md).

- **The line** is the model that did the most of the work (the most tokens,
  usually the writer) with `+N` for how many more served the job, the time,
  the tokens, the cost: the order a student cares about, the number to skim
  past last. `text-xs`, `tabular-nums`, `text-muted-foreground`; the `title`
  names every model and says time adds up every call.
- **Inter, never mono.** The line opens a dialog and is not for copying, so
  it is all Inter with tabular figures, its model name included; the
  copyable ids are in the modal.
- **The chevron** is a `size-3` `ChevronRight` after the line. It says "opens
  something" without a loud link; the line and the chevron turn to `primary`
  together on hover and on `:focus-visible`. No underline, no border.
- **It is a button**: tab reaches it, Enter and Space open the modal. Its
  `aria-label` is "Usage details for <what>", `aria-haspopup="dialog"`.
- **Inline or its own line.** It sits inline in a sentence (an assignment
  read's description) or, with `block`, on a line of its own under a guide or
  an answer. The line wraps between its parts, never inside one.
- **Marks:** when a call failed, was stopped or came from a provider that
  reports nothing, tokens and cost read `≥ n` (they are a minimum); a figure
  with nothing counted is a dash, never a zero, which would say free. A paid
  call under $0.0001 reads "<$0.0001".
- **`data-copy-skip`**: an answer's copy button leaves it out.
- The formatting is `web/src/lib/usage-format.ts`, with tests.

**It appears only after the job is done or failed**, and only when at least
one call was made; while it runs, the working lines already say how it is
going. It sends `source` (a question, a read or a turn, and its id) to the
modal, which fetches the detail when it opens. `detail` is for
`/components` and tests, where there is no server.

**Changed 2026-10-08** (Jack, the job usage modal): the plain-text
`UsageLine` became this button, after four ways of showing it was
clickable were tried (hover only, dotted underline, a Details link, a
chevron); the chevron won. The popover of the first version was removed on
2026-09-30.

**Don't:** show it for a job still running; abbreviate the tokens ("21k"
belongs nowhere here); put other actions on it; use a popover for what the
modal now shows.
