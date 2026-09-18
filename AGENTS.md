# Agent notes

## Visual e2e workflow (after every UI change)

The visual suite lives in `web/e2e` (see `web/e2e/README.md`). It is the
acceptance gate for UI work, not an optional extra:

1. **Update the manifest first.** `web/e2e/states.ts` must cover what you
   changed: new states get entries, changed states get updated notes,
   selectors, and seeds, and `seeds/` gains any data the new states need.
   A state missing from the manifest does not exist for review.
2. **Shoot the changes.** From `web/e2e`, run `npm run visual -- <page>`
   (mock mode, light + dark) and fix failures — step selectors, readiness
   waits, seed data — until green.
3. **Judge major changes.** For significant visual work, run the judge
   subagent over the fresh screenshots and act on its verdicts before
   calling the work done. Minor tweaks can rely on Jack's review.
4. **Final run for Jack.** Finish with a full clean `npm run visual` and
   hand over the gallery path — Jack reviews the gallery. Loose
   screenshots are never the deliverable.

`npm run visual -- --watch <page>` plays the suite in a visible browser at
human pace with a HUD overlay narrating every step; use it when Jack wants
to watch motion rather than flip stills. For hands-on inspection,
`npm run console` serves an interactive console (app in an iframe, network
conditioning, one-click capture/replay) at `/__control` on port 8431.

## Repo hygiene: no artifacts in the repo root

Never leave screenshots, console logs, traces, browser-tool output, or
any other inspection artifacts in the repository root — not even
temporarily. This repo once filled with 83 stray PNGs from ad-hoc
browser sessions; don't do that again.

- Browser automation tools save to the workspace root by default. When
  driving a browser, always pass an explicit output path under
  `web/e2e/artifacts/` (gitignored) or `/tmp`.
- The durable visual record is the visual suite's gallery, not loose
  image files: `cd web/e2e && npm run visual` (see `web/e2e/README.md`).
- Run frontend tooling from `web/` (or `web/e2e/`), never from the
  repo root — stray `node_modules` and tool caches at the root are the
  same pollution.
- `.gitignore` backs this up with `/*.png` and friends, but the ignore
  rules are the safety net, not the rule. Clean up after yourself.
