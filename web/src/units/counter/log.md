# Counter: log

Jack, 2026-10-14, about the section heading: **"The heading is bad too. I want to be
more similar to my old design."** The old design's `Counter` (`web/src/components/box`)
is a pill after the title, filled with translucent ink so it shows on a header band.
Here it is a soft ground with `fg` text.

On the dark ground `neutral-soft` made the pill almost invisible, so the pill is the `pressed` ground (#35383b) with `fg` text (a declared pair, 10.6:1). 2026-10-14.

## Round of 2026-10-14, annotations

Jack, on the pill beside a heading: **"Needs more padding."** and **"Not vertically
centered with the header and has not enough padding"**.

The padding he saw was none: the pill was set in `px-1.5`, a fractional step the
theme's lockdown does not compile, so the pill drew with 0 padding and read as a
bare digit floating beside the title. It now takes `px-2`, 8 each side, the same
inner padding as the tag, and keeps its 20 height, centred on the title's line.
