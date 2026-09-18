# UnderlineNav

Primer's tab row: quiet `text-sm` labels, the current one at 500 in
`foreground` with a 2px `primary` underline. The nav draws no border of
its own — it sits on its container's hairline (a panel header, a page
section) so the underline lands exactly on it; give the nav the
container's height and `-mb-px` if the border needs overlapping.

`UnderlineTab` takes `active`, `onClick`, children. Announces the current
tab with `aria-current`.

**Don't:** use it for actions (tabs show, buttons do); mix it with a
SegmentedControl in the same surface; underline more than one tab.

## Changes from baseline

- None yet — this is the baseline's UnderlineNav at its minimum: two
  tabs. Counters-in-tabs and overflow come only when a surface needs
  them.

## Open

- First used in the workspace panel (Ask | Homework). Settings will want
  it too if Health becomes a tab.
