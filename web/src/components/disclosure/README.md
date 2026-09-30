# Disclosure

A row that opens its content in place. It replaced the Veil for a question's
hint, walkthrough and answers (homework redesign, 2026-09-30).

- **The row** is 40px (`row`), the title in `text-sm`, then, at the end in muted
  `text-xs`, a short fact about what is inside ("2 lines", "5 steps", "2 answers") and a
  chevron that turns as it opens. The fact says how long the content is, which is what the
  Veil's blurred true-size shape used to say, in words and without the scroll.
- **Open and closed** are the caller's (`open`, `onOpenChange`): a tap opens it and it
  stays open; a tap again closes it. Rows are stacked inside one `Box`, divided by
  `border-muted`; an open row's content sits under a hairline in `text-base`.
- **`busy`** is for content still being made. The row says what ("Writing") with a
  `Spinner` and can't be opened: it never opens onto nothing. With `still` (queued: nothing is
  happening yet) it is the word alone and no motion, as everywhere else.
- **Hover** is the row's `muted/50` wash (as a `BoxRow`'s), fading over 100ms with the rest.
- **Keys.** `keys` sets `aria-keyshortcuts` so assistive tech hears the shortcut; the
  handling is the caller's (the homework walkthrough uses 1, 2 and 3).

**What the caller provides:** a title, `meta`, `open` state, and the content.

**Don't:** put a form in one, nest one in another, or use it for navigation.

## Changes from baseline

- **New in the app.** The baseline had no disclosure; the frosted `Veil` did this job
  and was removed with the homework redesign (design/workspace.md, R9).
