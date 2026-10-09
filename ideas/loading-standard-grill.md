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

| # | Decision | Why | Beat |
|---|---|---|---|
| D1 | Overlays prefetch their data (with the page, or as the pointer reaches the trigger) and open complete; if still waiting, they open at the final size with a skeleton | Nothing grows and nothing delays the click | hold the open until ready; always a skeleton; fixed height and fade |
| D2 | Content that replaces a skeleton fades in over 150ms in the skeleton's exact space; cached content appears at once | Soft without feeling slow | instant swap; 200ms crossfade |
| D3 | One shared `Loaded` wrapper owns the skeleton, the 300ms grace, the fade, `aria-busy` and the error line; every screen uses it | Screens cannot drift apart | conventions plus the audit; React Suspense |
| D4 | The jump audit runs in CI on every PR that touches `web/` and blocks the merge | Enforced, not remembered | local via /change; on demand |
| D5 | A list's skeleton draws the count it showed last time (saved per list in the browser, 3 the first time), in the real layout | Right almost always, so lists do not resize | keep and show the last data; fixed counts |
| D6 | CI fails on any overlay that changes size by more than 2px after opening, or any layout shift above 0.001; deliberate exceptions go in a short named allow-list | "No inconsistencies anywhere" | only worse than dev; Chrome's 0.1 |
| D7 | Numbers inside a sentence are prefetched with the page; if missing, each holds a fixed-width slot so the sentence never reflows | Keeps the concrete copy | numbers on their own line; drop them |
| D8 | Two changes: (a) `Loaded`, the usage dialogs, Reset everything, font preloading; (b) every other screen onto `Loaded`, the rest of the spots, then the CI guard on | The worst jump goes first; the guard turns on green | one change; guard first with an allow-list |

### The artifact: what each surface does

| Surface | Before data | When it arrives | Today's offenders |
|---|---|---|---|
| Dialog, popover | Prefetched; else opens at final size with a skeleton | 150ms fade in place | Usage (book, +284px, 472ms), usage lines, Reset everything (+24px) |
| Page section, list | Skeleton in the real layout, last known count | 150ms fade in place | Home rows and covers, key banner, greeting name, Settings section |
| Value in a sentence | Prefetched; else fixed-width slot | Number appears, nothing reflows | Reset everything counts |
| Any wait under 300ms | Nothing drawn (existing rule) | Content at once | |
| Cached data | Content at once, no fade | | |

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
