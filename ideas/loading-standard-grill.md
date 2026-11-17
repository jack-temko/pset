# One loading standard: grill

- status: approved
- date: 2026-10-09
- brief: one way of loading for all of PSet, so nothing jumps, judged from the tired student who opens a dialog and watches it lurch
- sources: `make jumps` reports 20261008-222228 and 20261009-010711, `design/design-system.md` (Nothing jumps, motion), `design/backend.md`, `web/src/components/{dialog,skeleton,spinner,usage,usage-modal,confirm}`, `web/src/api/usage.ts`, `web/src/lib/settled.ts`

## Summary

### In one line

Everything that waits on data opens at its final size, fills in with a 150ms fade,
and is written through one `Loaded` wrapper, and a CI check fails any PR that brings
back a jump.

### Decisions

| #      | Decision                                                                                                                                                                                                                                         | Why                                                                             | Beat                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| D1     | Overlays prefetch their data (with the page, or as the pointer reaches the trigger) and open complete; if still waiting, they open at the final size with a skeleton                                                                             | Nothing grows and nothing delays the click                                      | hold the open until ready; always a skeleton; fixed height and fade |
| D2     | Content that replaces a skeleton fades in over 150ms in the skeleton's exact space; cached content appears at once                                                                                                                               | Soft without feeling slow                                                       | instant swap; 200ms crossfade                                       |
| D3     | One shared `Loaded` wrapper owns the skeleton, the 300ms grace, the fade, `aria-busy` and the error line; every screen uses it                                                                                                                   | Screens cannot drift apart                                                      | conventions plus the audit; React Suspense                          |
| D4     | The jump audit runs in CI on every PR that touches `web/` and blocks the merge                                                                                                                                                                   | Enforced, not remembered                                                        | local via /change; on demand                                        |
| D5     | A list's skeleton draws the count it showed last time (saved per list in the browser, 3 the first time), in the real layout                                                                                                                      | Right almost always, so lists do not resize                                     | keep and show the last data; fixed counts                           |
| D6     | CI fails on any overlay that changes size by more than 2px after opening, or any layout shift above 0.001; deliberate exceptions go in a short named allow-list                                                                                  | "No inconsistencies anywhere"                                                   | only worse than dev; Chrome's 0.1                                   |
| D7     | Numbers inside a sentence are prefetched with the page; if missing, each holds a fixed-width slot so the sentence never reflows                                                                                                                  | Keeps the concrete copy                                                         | numbers on their own line; drop them                                |
| D8     | Two changes: (a) `Loaded`, the usage dialogs, Reset everything, font preloading; (b) every other screen onto `Loaded`, the rest of the spots, then the CI guard on                                                                               | The worst jump goes first; the guard turns on green                             | one change; guard first with an allow-list                          |
| ~~D9~~ | ~~When content and its skeleton differ in size, the box morphs from the skeleton's height to the content's over 200ms ease-out while the skeleton fades out and the content fades in; the CI check still fails a skeleton off by more than 2px~~ | ~~Residual mismatch glides instead of snapping, and skeletons still get fixed~~ | ~~morph and allow it; no morph~~                                    |

D9 dropped (2026-10-09): the height animation jittered, flashed and snapped at the end in Jack's look at /components; skeletons are made exact instead, which the jump check enforces. Content crossfades over the skeleton in one place.

**Variant first (2026-10-09).** A view whose layout depends on its data (a set done or in progress, empty or not, first run, a book with or without contents, Ask empty or with turns, key saved or not) is a view with variants. Opening a finished set drew the question skeleton, rendered question 1 for a frame, then switched to the summary in an effect: a skeleton that guessed, and a variant chosen after paint. Nothing in the jump check could see it, because a same-size swap moves nothing.

| #   | Decision                                                                                                                                                                                                                                                                                                  | Why                                     | Beat                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------- |
| D10 | A view declares its variants; `Loaded` takes one skeleton per variant and a `variant` resolved before the data, from what is already known (the clicked row's summary, the route, cached data); with nothing known it draws the neutral skeleton: the chrome every variant shares, real, and a quiet body | Never a wrong guess; fuller when known  | last-seen variant per item; hold the old screen with a progress bar |
| D11 | Navigation carries the summary: every list-to-detail move seeds the detail query from the list's cached row, so the variant is known at click time                                                                                                                                                        | In-app moves never guess                | fetching first and guessing                                         |
| D12 | The variant is chosen during render, never in an effect; `Loaded` stamps skeleton and content with `data-variant`; types require a skeleton per variant, a mismatch warns on screen in development and fails the jump check, as does a box that changes variant after its reveal                          | Caught while building and in CI         | check only                                                          |
| D13 | One manifest lists every view's variants; the public fixture library holds one of each; the core CI check opens every variant; a test fails when a manifest variant has no fixture or scenario                                                                                                            | Every state is exercised on every UI PR | nightly only                                                        |

### The artifact: what each surface does

| Surface              | Before data                                          | When it arrives                 | Today's offenders                                                  |
| -------------------- | ---------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------ |
| Dialog, popover      | Prefetched; else opens at final size with a skeleton | 150ms fade in place             | Usage (book, +284px, 472ms), usage lines, Reset everything (+24px) |
| Page section, list   | Skeleton in the real layout, last known count        | 150ms fade in place             | Home rows and covers, key banner, greeting name, Settings section  |
| Value in a sentence  | Prefetched; else fixed-width slot                    | Number appears, nothing reflows | Reset everything counts                                            |
| Any wait under 300ms | Nothing drawn (existing rule)                        | Content at once                 |                                                                    |
| Cached data          | Content at once, no fade                             |                                 |                                                                    |

### Assumed

- A1: Every font is preloaded at app start, so no first use reflows (JetBrains Mono today).
- A2: Cheap queries prefetch with the page; the book usage aggregate prefetches when the pointer reaches the Book actions menu or its Usage item, so the page load does not pay for it.
- A3: Usage data stays cached (no `gcTime: 0`) and refreshes from the event stream like other data, so a second open is instant.
- A4: The fade is opacity only, ease-out, and off under reduced motion.
- A5: The CI job uses the test library, 3 runs, real and slow, the hand-written scenarios plus discovery, and needs Chromium in CI.
- A6: Change 1 (the audit itself) lands first, as built.

### Open

- None.

## Gate 0: what is true today

- Data is TanStack Query behind hooks; `staleTime: Infinity` and the event stream keep
  most data fresh, so most dialogs have their data before they open and do not grow.
- The usage dialogs are the exception: the book one queries only when opened
  (`enabled: usageOpen`), the per-job ones mount their query on open, and both use
  `staleTime: 0, gcTime: 0`. The body shows one spinner line with no size, so the
  centred dialog opens 152px tall and grows to 436px (+284px) after 472ms (slow disk:
  1.1s). Jump score 0.067, six times anything else measured.
- Reset everything fetches its counts on open and puts skeleton words inside a
  sentence: +24px, 56ms.
- Home's skeleton draws 3 homework rows and 5 covers when 2 and 3 arrive; the key
  banner and the name in the greeting arrive late.
- JetBrains Mono is fetched the first time something uses it, so the first table or
  figure in mono reflows once more.
- Rules today: a Skeleton at the size and count of what's coming; no spinner for
  waits under 300ms; 200ms ease-out for state changes. Nothing for dialogs, popovers,
  inline values or fades.

## Reversals

## Disagreements

## Frontier

Empty.

## Log

Note: Q8 (fonts) was assumed, not asked (A1).

### Batch 1 (2026-10-09)

- Q1 Overlays: "When a dialog or popover needs data, how should it open?" Options: Prefetch, then sized skeleton (Recommended) / Hold until ready / Open now, sized skeleton / Fixed height, then fade. Answer: "Prefetch, then sized skeleton (Recommended)".
- Q2 Fade: "When real content replaces a skeleton, how does it appear?" Options: Quick fade-in, 150ms (Recommended) / Instant swap / Crossfade, 200ms. Answer: "Quick fade-in, 150ms (Recommended)".
- Q3 Primitive: "How should loading be written in code, so every screen behaves the same?" Options: One shared Loaded wrapper (Recommended) / Conventions + the audit / React Suspense. Answer: "One shared Loaded wrapper (Recommended)".
- Q4 Guard: "How should the jump audit guard against new jumps?" Options: CI on every web/ PR (Recommended) / Local, run by /change / On demand only. Answer: "CI on every web/ PR (Recommended)".

### Batch 2 (2026-10-09)

- Q5 Skeletons: "How many rows or cards should a skeleton draw? Home draws 3 homework rows and 5 covers, then 2 and 3 arrive." Options: Last known count (Recommended) / Keep the last data / Fixed count per list. Answer: "Last known count (Recommended)".
- Q6 Threshold: "What should fail the CI jump check?" Options: Any jump at all (Recommended) / Only get worse than dev / Chrome's 'good' bar. Answer: "Any jump at all (Recommended)".
- Q7 Inline: "Numbers inside a sentence, like \"Deletes 3 books and their 2,147 pages\" in Reset everything: how should they load?" Options: Prefetch, fixed-width slot (Recommended) / Numbers on their own line / Drop the numbers. Answer: "Prefetch, fixed-width slot (Recommended)".
- Q9 Order: "How should the work be split?" Options: Two changes (Recommended) / One change / Guard first. Answer: "Two changes (Recommended)".

### Batch 3 (2026-10-09, Jack's own ask)

- Jack: "can we make the skeletons shrink as they fade out to match the size of the loading text or card?"
- Q10 Morph: "With the skeleton morphing to the content's size, should the jump check still flag a skeleton that's the wrong size?" Options: Morph, and still flag (Recommended) / Morph, allow it / No morph. Answer: "Morph, and still flag (Recommended)".
- Jack, on the built morph: "The morph is fucked up, either fix it or drop it if its too much work. It jitters, flashes, and still jumps as it settles slighlty." Answer: "Dropped (Jack delegated the call)."

### Batch 4 (2026-10-09, Jack's report)

- Jack: "When a homework is done and I select it, the skeleton loads for a question page, but then flashes to the summary, and the skeltons dont match. Why do the checks not catch this? What class of issues is this? We need to cover stuff like this where we might not know what the underlying view will look like. I want a strong architectural decision on this so it works everywhere" and "The new component should account for yhis".
- Q11 Unknown: "When a view's variant really can't be known before its data (a cold link, nothing cached), what should it draw?" Options: Neutral skeleton (Recommended) / Last-seen variant / Hold the old screen. Answer: "Neutral skeleton (Recommended)".
- Q12 Enforce: "How strictly should variants be enforced?" Options: Types + dev warning + check (Recommended) / Check only. Answer: "Types + dev warning + check (Recommended)".
- Q13 Coverage: "How should every variant be exercised?" Options: Manifest + fixture + CI (Recommended) / Nightly only. Answer: "Manifest + fixture + CI (Recommended)".
