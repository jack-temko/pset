# Error notice

What went wrong, said where it went wrong. Every error PSet can show has an
id and its words in the Go catalog (`internal/errs`, the table in
`design/errors.md`); this draws one.

- **Inline.** A `card` surface with a 1px `destructive` border and the
  `p-card` padding; not a red fill. The **what** is body weight (`text-base`,
  500), the **why** and **fix** are `text-sm` muted lines under it, and the
  words are the server's, as written. Nothing here is reworded.
- **One action.** At most one `Button`, the error's typed action (`retry`,
  `open_settings`, `open_book`, `check_update`, `reload`). `retry` is the
  caller's own `onRetry`; the rest do the same wherever they are shown
  (`api/error-actions.ts`). No `onRetry`, no Try again button.
- **Details.** A small underlined link, collapsed. It opens the chain of ids
  (outermost first), the incident id, and a Copy that puts the what, the
  ids and the incident on the clipboard for a bug report.
- **Field errors** (`scope: 'field'`) are the one line, `text-xs` in
  `destructive`, with no why, fix or Details. The Field component draws its
  own error line; this is for a field that has no Field around it.
- **Where it sits.** Inline, in the row, question or dialog the failure
  belongs to. A failure of the whole screen (no key, the server unreachable)
  goes in the `Flash` banner instead, by the shell. No toasts.

**Don't:** build a message from an error's text in a screen; add a second
button; show the ids outside Details.
