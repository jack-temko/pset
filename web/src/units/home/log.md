# Home: log

From the Home info area grill of 2026-10-16 (`ideas/home-info-grill.md`), word for word. The other unit logs (greeting, heatmap, stat tile) hold the same answers for their own parts.

Jack, on the audit: **"looks right, go ahead. but this is from scratch. so we can disregard what the backend does and what the frontend shows right now. I want this informational at a glance, homey to a student, with enough information for an interested student, but not too much its a slog to read through."**

Jack, mid-batch: **"pick the two most reasonable options and A/B them once we start building"**, then **"Sorry please ask agai"**.

Batch 1, asked again: heatmap count **Time studied**; span **"pick the two most reasonable options and A/B them once we start building"**; stat tiles **A/B two vs one tile**; greeting **"Name + one line, we will reuse the greetings that we generated for randomization."**

Batch 3: layout **A/B two layouts (Recommended)**.

Jack, reshaping Home (2026-10-16, `web/src/units/assignment-row/log.md`): **"I want two lists on my home screen, plus some info on top (e.g. github style heatmap for work, stat tile, big greeting, this will be done later)."**

Jack, 2026-10-16, on the plan: **"Build it."**

Jack, 2026-10-21: **"Can we pick a resonable max width for this screen? I want the content to be centered, and not take up the whole screen. Then let me see them again."** Content capped at 1012 (GitHub's page width), centred (home-d4).

Jack, 2026-10-21, on the stats (`ideas/home.md`, round 2): **"I really want this home screen stats to look really cool. I like the heatmap for sure. Can you come up with some other options for this? I want some that look good and don't leave any large empty gaps. Lets go with the 6 months."** The year span is dropped (home-d5); the four options replace the tiles and layout picks (home-d6).

Jack, 2026-10-21: **"Make the backgrounds of the panels just outlines like the lists below them"**. Home's panel and tiles have no fill, the List's border and radius.

Jack, 2026-10-21, on the options: **"Week is my favorite. Drop the rest. Can we find a way to include sparklines in that one too? A/B it for me. Also make sure the stats that we are displaying are the most important ones to display and most useful."** (home-d6, home-d7)

Jack, 2026-10-21: **"Go back to having all the stat stuff in one box, how it was."** Then: **"heatmap in box too please"**: the whole info block is one outlined box (home-d9).

Jack, 2026-10-21: **"Lets go with spark lines, drop the other one, and anything else not used anymore."** State A and the meter and stat tile units are removed (home-d10).
