# List: log

Jack, 2026-10-14: **"Unfortunately the course row looks absolutely horrible. More
GitHub-ey And it has components that don't exist."** (the list's frame was styled inside
the course row) and, about the heading: **"I want to be more similar to my old design."**

The list is the old `Box` (`web/src/components/box`) in `ds` tokens: a 1px border at the
control radius, a header band at least 40 high, rows divided by the muted rule. Departures:
the title is weight 500 (the `ds` scale has no 600) and the radius is the control's 6.
