# Loading skeletons: grill

- status: approved
- date: 2026-11-09
- brief: how every /design unit loads, so that combined screens never jump and the same thing always loads the same way; judged from the tired student's point of view
- sources: [skeleton-plan.md](skeleton-plan.md) (Fable 5.2's plan, measured on design at ab0c3a0); [fable-review-grill.md](fable-review-grill.md) D11; [loading-standard-grill.md](loading-standard-grill.md); web/src/components/loaded and skeleton; web/src/units/*/spec.ts

## Summary

### In one line

No unit has a separate skeleton: each draws its own loading form from its own layout and a small "shape" of its data, known things are drawn real, and a browser proof on every PR fails on any box that moves.

### Decisions

| #   | Decision | Why | Beat |
| --- | -------- | --- | ---- |
| S1  | On a repeat visit, before fresh data, a screen draws bars at the remembered shape. | Honest: nothing stale reads as true; within a session data shows at once anyway. | The last data at once; the last data dimmed |
| S2  | With nothing known (a first visit, a cold link), a screen draws its chrome, title and headings, and leaves the body quiet. | The only choice where nothing drawn ever moves. | A usual shape of three rows a list; the empty state's shape |
| S3  | Bars pulse slowly, all together. The shimmer sweep means only "PSet is working" (Ask's Thinking, Finding). | One meaning per motion; what the new units already draw. | The old shimmer sweep; still bars |
| S4  | A part that fails while loading shows the Error notice block in its own box, which keeps its size, with Try again. | Nothing else on the page moves while the student reads what went wrong. | One line, the box closing up (the old Loaded) |
| S5  | Buttons and links are drawn real while loading; a link that needs only what is known works, the rest are not ready, saying "Still loading". | The page keeps its shape and the student can leave at once (button-d4). | Everything inert; buttons hidden until loaded |
| S6  | Enforced by checks in make check, a browser box proof on every PR that touches web/ (about 2 min, blocking), and the real-app jump guard back screen by screen as screens are wired. | Exact where the old guard allowed 2px, at about half its cost. | Turning the old guard on now; the proof nightly only |
| S7  | The spec format gains two optional fields (a state reached only by acting is not proven; each data read lists what is known before it and from where), and hand-written skeleton examples go: loading is the same example, forced. | A derived skeleton cannot drift from its unit. | Derived skeletons with no new fields; hand-written skeletons |
| S8  | Wrapping text of unknown length (a memory, a long name, a statement) draws as many bar lines as it had last time. | A revisit is exact; only the first sight of a thing can settle. | Fixed lines, then grow; clamping such text for good |

Everything else in [skeleton-plan.md](skeleton-plan.md) stands as written: the five rules (one layout; a bar has no size of its own; size depends on the shape only; known is real, unknown is a bar, remembered is only shape; only `Bone` draws a bar), the real-versus-bar table, the reveal order (chrome at once, 300ms grace, one reveal per data read), lists as the real frame at the shape's count, the proof layers, and the 15-step migration.

### Assumed

- A1: The migration follows the plan's order (bone unit, contract, proof, leaves, lists, stats, then each screen); changes 4 to 12 change what a screen looks like while loading and wait for Jack's try, as every UI change does.
- A2: The old `components/loaded` and `components/skeleton` stay until the old app retires; `reveal.ts` is reused.

### Open

- Real timings: the units run on sample data, so how often bars show at all is unknown until screens are wired (plan, section 7).

## Reversals

- **loading-standard D5's "3 the first time"** (ideas/loading-standard-grill.md): a first visit draws no guessed rows (S2).
- **The old Skeleton's shimmer** (web/src/components/skeleton/README.md, Jack: "a still one read as a broken layout"): bars pulse; the sweep keeps one meaning (S3).
- **The old Loaded's one-line error** ("It is not the skeleton's size"): the error keeps the box (S4).
- **The 2026-11-04 pause of the jump guard**: ends in a new form, the box proof on every PR (S6).
- **course-d13 and settings-d12** (assumed there): kept in meaning, changed in mechanism, as each screen's skeleton component is deleted.

## Disagreements

None.

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
