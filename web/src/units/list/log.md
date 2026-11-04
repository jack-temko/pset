# List: log

Jack, 2026-10-14: **"Unfortunately the course row looks absolutely horrible. More
GitHub-ey And it has components that don't exist."** (the list's frame was styled inside
the course row) and, about the heading: **"I want to be more similar to my old design."**

The list is the old `Box` (`web/src/components/box`) in `ds` tokens: a 1px border at the
control radius, a header band at least 40 high, rows divided by the muted rule. Departures:
the title is weight 500 (the `ds` scale has no 600) and the radius is the control's 6.

Jack, 2026-11-04, in `ideas/list-pattern-grill.md` (L1 to L3, L8, L9), after asking how GitHub's Issues page folds Closed: "start the grill on the details", then: **"Switch in header (Recommended)"** (the Done fold becomes a state switch in the list's header), **"Cap 5, Show all page (Recommended)"**, **"Foot, with a count (Recommended)"** (the link is the last row of the box, not at the header's right), **"Stay on To do, say so (Recommended)"** and **"Yes, one rule (Recommended)"** (the cap also applies to to-do rows). The switch is text and a Counter each, as GitHub's Open and Closed, not a segmented control: it names two views of one list, not a setting. With a switch the header carries no title: the heading above the list names it.
