# Problem strip: log

From the work pane grill of 2026-10-21 (`ideas/work-pane-grill.md`), word for word.

Batch 1: layout **One at a time + strip (Recommended)**.

Assumed there: strip chips are done filled, current outlined, failed marked with the danger colour, skipped parts not counted; hovering a chip shows its label.

Jack, approving: **"work pane spec is gtg"**.

Jack, 2026-10-21, on the boxes: **"Not a fan of the boxes with the numbers for questions. Can you give me some other options? Include an option where the problem has a short generated title to show with the problem number"**

He tried five (A segments, B plain numbers, C titled picker, D titled list, E titled numbers) and said: **"Lets go with the segments"**

His four notes on the segments, word for word:

1. **"We don't need the title twice"**
2. **"Don't these show the same thing?"** (the segments, the line and the set line's "3 of 8")
3. **"Not a fan of the white out line for the active problem."**
4. **"Can we make this more github-y? Not a fan of the current option"**

On the outline, Jack clarified: **"just the white outline for the active problem, find a different way to show it"**, then: **"leave the rest of the segments alonge, I just wanted either a different outline color, or it to change color."** Finally: **"Keep the GitHub restyle tho"**. So the Primer-style track stays, and the current segment keeps its colour with an accent outline.

Jack, 2026-10-21: **"Try some other options to show the active question including underlining the segment. The outline overlaps the next bar slighlty. Also have the colors of the bar represent the state of the question, error in progress, queue, searching etc. Just pick a small representative set"**

Built: six state colours (done, started, not started, working, queued, failed) with the state word in the tooltip, and three markers for the current segment (underline, taller, inset) to compare. The underline is the default.

Jack, 2026-10-21, after the three markers: **"go with the underline, drop the others"**. The state colours stay.

Jack, 2026-10-21: **"Can we make the line the same color as the segment"**. The underline takes its segment's colour; a not-started segment, the neutral track, uses the muted text colour so it still shows.

Jack, 2026-10-21: **"yes, make the queued line full yellow."** And on the summary: reach it **A last stop after the segments**, so a flag button ends the bar.

Jack, 2026-10-21, on the flag: **"The underline overlaps the icon and looks weird."** The flag now has a segment's slot: a 12px icon centred on the track, its line at the same y as a segment's underline, 3px below the track.

Jack, 2026-10-21: **"also the underline of the summary is much thicker and a different color than the icon."** The flag and its line now share one colour (green when all are done, the text colour otherwise), the line 2px like a segment's.
