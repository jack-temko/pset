# Tooltip: log

The grill of 2026-10-13, word for word.

- Jack, on trying the button: **"For the non disabled buttons, I don't love how the line
  that comes down looks, it being in a box and all. Also how does github manage that line
  if the button is in a spot where there is no space for it?"**
- How should a not-ready button say why? On the page, placed by the screen
  (Recommended) / A tooltip, as GitHub's optional one / The line under the button,
  without the box / Pressing opens a small dialog. **A tooltip, as GitHub's optional
  one.**

Sources: https://primer.style/product/components/button/guidelines and
https://primer.style/product/components/tooltip/guidelines .

## Scrolling

- Jack: **"The tooltip seems to lag slightly behind when scrolling"** and **"Can we use the
  tooltip library github uses? Also one more issues, when the button scrolls out of frame
  the tooltip displays over the top bar"**
- How should the tooltip be positioned? Keep ours, add the close-when-covered fix
  (Recommended) / Use GitHub's positioning function / Use Floating UI. **Keep ours, add
  the close-when-covered fix (Recommended).**

## Several lines (2026-10-16)

- Jack, on the Home heatmap hover (`ideas/home-info-grill.md` D7): **"courses by time in them. no split"**. A day's tooltip is therefore its date, its total and one line per course, so the tooltip may now run a few short lines for one data point (tooltip-d5).
