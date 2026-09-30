# UsageLine

What a finished job spent, on one quiet line where the thing it produced
lives: a question's walkthrough (its find, its figure read and its guide
together), an assignment read's row, one Ask turn. The pointer is already
there; the numbers are one press away and nothing else ever moves.

- **The line** is a button, `text-xs text-muted-foreground`, hovering to
  `text-foreground` underlined: the model that did the most of the work
  (the most tokens — usually the writer), a dot, the time, and a
  `ChevronDown` a quarter-turn when it's open. `aria-expanded` and
  `aria-haspopup="dialog"` say what it does before it's done.
- **The card** is the ConfirmPopover's geometry with none of its asking:
  `w-80`, `card`, hairline border, `shadow-floating`, radius-md, under
  the line (over it when there's no room, right-aligned, clamped, portal
  to the body), and it **follows its line on scroll and resize** — the
  transcript streams under it, and a popover that detached would point at
  nothing. No buttons, no `alertdialog`, no focus move: Esc closes it and
  a press anywhere else closes it, but a press inside only selects, so
  the numbers are copyable.
- **The numbers** are a `tabular-nums` table, mono for the machine
  strings: one row per model that answered, time then tokens then cost,
  and a Total row carrying the call count. Tokens are exact with
  separators (the card is where precision lives); time is the models'
  time summed; a provider that reported no usage shows "–", never a zero,
  which would say the call was free rather than uncounted. Failed calls
  are included — they cost too — and a muted footnote says how many.

**It appears only after the job has finished** (ready or failed, done,
stopped, failed) and only when at least one call was made; nothing shows
while it runs, where the working lines already say how it's going. Every
row is a rerun or retry included: the money was really spent.

**Don't:** reuse the ConfirmPopover for it (that one asks a question,
steals focus and vanishes); put actions in the card (it informs); show it
for a job still running; or abbreviate the tokens ("21k" belongs nowhere
here). Book imports record their calls but don't surface them yet — the
shelf row is busy and the cost is one-time per book.
