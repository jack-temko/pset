# Loading skeletons: grill

- status: approved 2026-11-09; largely superseded 2026-11-16 (see "After the audit" below)
- date: 2026-11-09
- brief: how every /design unit loads, so that combined screens never jump and the same thing always loads the same way; judged from the tired student's point of view
- sources: [skeleton-plan.md](skeleton-plan.md) (Fable 5.2's plan, measured on design at ab0c3a0); [fable-review-grill.md](fable-review-grill.md) D11; [loading-standard-grill.md](loading-standard-grill.md); web/src/components/loaded and skeleton; web/src/units/*/spec.ts

## Summary

### In one line

No unit has a separate skeleton: each draws its own loading form from its own layout and a small "shape" of its data, known things are drawn real, and a browser proof on every PR fails on any box that moves.

### Decisions

| #   | Decision                                                                                                                                                                                                                           | Why                                                                              | Beat                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| S1  | On a repeat visit, before fresh data, a screen draws bars at the remembered shape.                                                                                                                                                 | Honest: nothing stale reads as true; within a session data shows at once anyway. | The last data at once; the last data dimmed                                  |
| S2  | With nothing known (a first visit, a cold link), a screen draws its chrome, title and headings, and leaves the body quiet.                                                                                                         | The only choice where nothing drawn ever moves.                                  | A usual shape of three rows a list; the empty state's shape                  |
| S3  | Bars pulse slowly, all together. The shimmer sweep means only "PSet is working" (Ask's Thinking, Finding).                                                                                                                         | One meaning per motion; what the new units already draw.                         | The old shimmer sweep; still bars                                            |
| S4  | A part that fails while loading shows the Error notice block in its own box, which keeps its size, with Try again.                                                                                                                 | Nothing else on the page moves while the student reads what went wrong.          | One line, the box closing up (the old Loaded)                                |
| S5  | Buttons and links are drawn real while loading; a link that needs only what is known works, the rest are not ready, saying "Still loading".                                                                                        | The page keeps its shape and the student can leave at once (button-d4).          | Everything inert; buttons hidden until loaded                                |
| S6  | Enforced by checks in make check, a browser box proof on every PR that touches web/ (about 2 min, blocking), and the real-app jump guard back screen by screen as screens are wired.                                               | Exact where the old guard allowed 2px, at about half its cost.                   | Turning the old guard on now; the proof nightly only                         |
| S7  | The spec format gains two optional fields (a state reached only by acting is not proven; each data read lists what is known before it and from where), and hand-written skeleton examples go: loading is the same example, forced. | A derived skeleton cannot drift from its unit.                                   | Derived skeletons with no new fields; hand-written skeletons                 |
| S8  | **Reversed 2026-11-14.** Wrapping text loads as one bar line; when it comes, its block grows smoothly to its height and the text fades in (FillBlock, bone-d4).                                                                    | Effortless: nothing to count or remember, and nothing jumps, it slides.          | Remembering each text's line count (the old S8); clamping such text for good |

Everything else in [skeleton-plan.md](skeleton-plan.md) stands as written: the five rules (one layout; a bar has no size of its own; size depends on the shape only; known is real, unknown is a bar, remembered is only shape; only `Bone` draws a bar), the real-versus-bar table, the reveal order (chrome at once, 300ms grace, one reveal per data read), lists as the real frame at the shape's count, the proof layers, and the 15-step migration.

### Assumed

- A1: The migration follows the plan's order (bone unit, contract, proof, leaves, lists, stats, then each screen); changes 4 to 12 change what a screen looks like while loading and wait for Jack's try, as every UI change does.
- A2: The old `components/loaded` and `components/skeleton` stay until the old app retires; `reveal.ts` is reused.

### Open

- Real timings: the units run on sample data, so how often bars show at all is unknown until screens are wired (plan, section 7).

## After the audit (2026-11-16)

An audit of the open PRs #81 to #86 and a grill with Jack replaced most of this file. The PRs are closed, not merged.

### What the audit found

- Measured on the seeded test library: every read answers in 1 to 40 ms warm. On a fresh launch (three runs) the server answers 65 to 165 ms after starting and each first read takes 2 to 20 ms. Only `/api/health` (0.9 to 1.6 s, Settings' checks) and uncached page images (0.3 to 0.5 s) outlast the 300 ms grace. Not measured: a much larger library, a slow disk, the course-centred backend.
- In the PRs, Course, Settings, Work and Memory remount when data arrives, so text jumps (28px on an ordinary Work problem). Boxes move inside equal outer sizes (list switch 8px, Course stats 5px, Memory empty 22px, Work summary 6.5px, chart tracks 20px). The proof compared only outer size, so it passed all of them.
- 917 lines in 14 hand-written Waiting functions, for bars a student would almost never see.

### Decisions

| #   | Decision                                                                                                                                                                           | Jack's pick              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| D1  | The previous screen stays until the next one's data is in; past 300 ms the new screen shows its quiet form. No per-screen Waiting components, no shape functions. **Reverses S1.** | "Hold the old screen"    |
| D2  | The quiet form draws chrome, the title if known, and stops at the first thing whose size is unknown. Nothing drawn ever moves (S2 as promised).                                    | "Stop at first unknown"  |
| D3  | Figures roll, bars grow, sparklines rise and heat squares fade the first time each screen shows after PSet starts; after that values just appear.                                  | "First open per session" |
| D4  | Pulse low point 0.7 in place of 0.5 (`ds-bone-pulse`). Display-size bars 0.45em tall in place of 0.7em, if any survive D7.                                                         | "Take my numbers"        |
| D5  | Close #81 to #86. Carry over only a loading form for Settings' checks and tidying not about loading.                                                                               | "Close, rebuild small"   |
| D6  | A read past 300 ms shows the quiet form: no progress line, nothing new.                                                                                                            | "The quiet form"         |
| D7  | Delete every loading form nothing uses after D1, including the merged ones on design.                                                                                              | "Only what has a caller" |
| D8  | The proof checks, on every web PR: known text stays in place; nothing jumps at the flip; the quiet form is drawn too.                                                              | "Both on every web PR"   |

Superseded by these: S1 (reversed by D1), S7's derived skeletons and S8's FillBlock (by D7), the plan's steps 8 to 13. Still standing: S2 (now D2), S3 (bars pulse, at D4's depth), S4 and S5 where a loading form survives, S6 and S9 (the proof, extended by D8).

### Assumed (Jack can overrule)

- A1: The callers that remain are Settings' checks, the material pane's page boxes (`BoneBlock`) and Problem's Finding and Queued (`Bone`). Verified by search before anything is deleted. Searched 2026-11-16: on design none of them uses `Bone` yet (those uses were in the closed PRs; each draws its own box), so after the deletion nothing calls `Bone` or `BoneBlock`. Both stay as the one bar primitive for step 7 and D4's pulse; `Fill`, `FillBlock` and the rhythms go.
- A2: Home's quiet form is the top bar alone, since the greeting is data.
- A3: A whole screen whose read fails shows its quiet form with the Error notice and Try again under the title.
- A4: "Session" in D3 means since the page loaded, kept in memory per screen.
- A5: One source for the 300 ms and 700 ms timings (`bone/rhythm.ts` and `tokens.css` both hold them); `Ticker` moves out of the bone unit; `RowSkeleton` and `Bar` in `home/parts.tsx` go.

### Added in step 6 (2026-11-17)

- D9: When a screen's quiet form was on screen past the grace, what it draws below its title fades in over 150 ms, opacity only, and D3's motion plays inside that fade. An ordinary screen change, held under D1, does not fade. Jack, asked whether first load should get "some sort of graceful load animation": **"merge it and fold the fade into step 6"**. Beat: a fade on every screen change (a delay on every click); a staggered cascade.
- D4's display-size bars: none survive D7 (nothing draws a `Bone` at display size), so only the pulse changed.
- A5 done: the 300, 150 and 700 ms live in `MOTION` (`design/tokens.ts`) and as `--ds-grace`, `--ds-reveal` and `--ds-arrive` in `tokens.css`, kept equal by `tokens.test.ts`. `Ticker` is `design/ticker.tsx`, beside the arrival code (`design/arrival.ts`, `design/arrives.tsx`).

### Disagreement, settled

D7 and the deletion. I recommended keeping the leaf forms, then deferring the deletion until the first screen is wired to real data, since the timings come from a backend about to be replaced. Jack: **"don't defer step 4"**. The deletion happens now. Not to be reopened.

### Open

- ~~Settings' checks loading form~~ (step 7, 2026-11-17, waiting on Jack's try): the checks are their own read. While they run, Health's line says "Checking", shimmering, and the folded rows show each check by name with a bar for its result. A late failure takes Health's line (the error line, in place) and the fold does not open by itself, so nothing under it moves; it opens for a failure only when the results were in as the page drew.
- The hold itself (D1) is built when routes are wired. Until then it is a written rule.

### Work, in order

1. These decisions, in this file, the plan and `design/design-system.md`. Docs only.
2. Close #81 to #86, lifting out of their worktrees anything not about loading.
3. The proof: known text at the same place once loaded (text nodes matched by content, 0.5px); one flip to loaded in one tree, where elements survive and no known text moves in a single frame.
4. Delete on design what D1 and D7 leave without a caller, and update each unit's spec decisions.
5. A quiet form per screen under D2 and A2, as the screen's own frame with no body. Jack tries it.
6. D3 and D4. Jack tries it.
7. Settings' checks form. Jack tries it.

## Reversals

- **loading-standard D5's "3 the first time"** (ideas/loading-standard-grill.md): a first visit draws no guessed rows (S2).
- **The old Skeleton's shimmer** (web/src/components/skeleton/README.md, Jack: "a still one read as a broken layout"): bars pulse; the sweep keeps one meaning (S3).
- **The old Loaded's one-line error** ("It is not the skeleton's size"): the error keeps the box (S4).
- **The 2026-11-04 pause of the jump guard**: ends in a new form, the box proof on every PR (S6).
- **course-d13 and settings-d12** (assumed there): kept in meaning, changed in mechanism, as each screen's skeleton component is deleted.

- **S1, bars at the remembered shape** (this file, 2026-11-09): reversed 2026-11-16 by D1, Jack choosing "Hold the old screen" with the reversal named. The previous screen holds until data is in; a slow read shows the quiet form, never bars at a remembered shape.
- **S8, the remembered line count** (this file, 2026-11-09): reversed 2026-11-14. Asked how to find a wrapping text's line count, and what big companies do (most use a fixed count and accept the jump, or clamp the text), Jack: **"lets go with 2, but it smoothly grows if needed. and smoothly replaces the text. Make it effortless"**. Wrapping text loads as one bar line and grows smoothly to its height in 200ms when it comes; the box proof allows exactly that growth and nothing else.

## Disagreements

- 2026-11-16, D7: settled for Jack's choice, see "After the audit".

## Frontier

Empty.

## Log

### Batch 1

- On a repeat visit, before fresh data arrives, what fills a screen? Options: Bars at the remembered shape (Recommended) / Last data at once / Last data, dimmed. **"Bars at the remembered shape (Recommended)"**
- With nothing known (first visit, a cold link), what does a screen draw while loading? Options: Chrome, title, quiet body (Recommended) / A usual shape, 3 rows a list / The empty state's shape. **"Chrome, title, quiet body (Recommended)"**
- How do the placeholder bars move? Options: Slow pulse, all together (Recommended) / Shimmer sweep / Still. **"Slow pulse, all together (Recommended)"**
- A part of a page fails while loading. What happens to its space? Options: Error box keeps its size (Recommended) / One line, the space closes. **"Error box keeps its size (Recommended)"**

### Batch 2

- Buttons and links on a page that is still loading? Options: Real; not ready until loaded (Recommended) / Everything inert / Hidden until loaded. **"Real; not ready until loaded (Recommended)"**
- How is it enforced? Options: Checks + box proof on every PR (Recommended) / Also the old jump guard now / Box proof nightly only. **"Checks + box proof on every PR (Recommended)"**
- Should the unit spec format change for this? Options: Two optional fields; derived skeletons (Recommended) / Derived skeletons, no new fields / Keep hand-written skeletons. **"Two optional fields; derived skeletons (Recommended)"**
- Text of unknown length that wraps: how many placeholder lines? Options: Remember its line count (Recommended) / Fixed lines, then grow / Clamp it for good. **"Remember its line count (Recommended)"**

### After step 2

- Jack, during step 3: **"I want this to be as lightweight as possible. It should not require us to constantly update logic with it when adding new components or changing components. The check should also be lightweight, especially if it runs on every PR"**. S9 below.

S9 (decided 2026-11-11): the checks find the units on the contract by themselves (they read data and write no skeleton) and judge only those. No offender lists or allow-lists to keep, and no `data-unit` marker on unit roots: the proof compares each state's whole box. A unit declares only its data props and its shape, once, in its own file; a unit that waits on nothing declares nothing. The CI proof runs on Vite with no build, only for units on the contract, only when `web/` changed: about 10 seconds plus the cached browser.

### During step 6

- Jack, on how a wrapping text's line count is found: **"lets go with 2, but it smoothly grows if needed. and smoothly replaces the text. Make it effortless"**. S8 reversed (above).

### After the audit (2026-11-16)

Jack's picks, verbatim: "Hold the old screen" (D1, with S1's reversal named), "Stop at first unknown" (D2), "First open per session" (D3), "Take my numbers" (D4), "Close, rebuild small" (D5), "The quiet form" (D6), "Only what has a caller" (D7), "Both on every web PR" (D8). On deferring the deletion: "don't defer step 4".
