# e2e (visual state suite)

Drives the real SPA through every UI state in the manifest and writes a
static HTML gallery for human review. The suite asserts almost nothing:
readiness markers found, no console errors, screenshots written. The
acceptance gate is a person flipping through `gallery.html`.

## Usage

```sh
cd web/e2e
npm install                     # once, plus: npx playwright install chromium
npm run visual                  # everything: mock mode, light + dark
npm run visual -- dialog        # filter by id/title/tag substring (OR)
npm run visual -- --mode=live   # real Go binary instead of the mock API
npm run visual -- --theme=light
npm run visual -- --watch       # headed browser at human pace
npm run visual -- --no-build    # reuse the current web/dist as-is
npm run console                 # interactive console on http://127.0.0.1:8431/__control
```

Artifacts land in `artifacts/<run-id>/` (gitignored): `gallery.html` plus
`png/` screenshots. Exit code is nonzero if any selected state failed.

## Console

`npm run console` serves the built SPA and its mock API on one origin with
the console page at `/__control`. The iframe runs the real app; Load
stages a manifest entry's seed and mock script (same configuration the
runner uses — `states.ts` is the only source of truth). Network
conditioning (slow, offline, 500, hang, kill SSE) is applied by a service
worker (`console/sw.js`) intercepting `/api/*`, so it works on manual
clicks in the iframe. Flow rows spawn `--watch` replays in a headed
window (viewport selectable); state rows spawn headless captures and show
the PNGs in a viewer. One run at a time. Mock mode only — the console
never spawns the live backend.

## Layout

- `states.ts` — the checked-in inventory. One entry per UI state: seed,
  mock script, network condition, live seed, and the actuation steps.
  This list is the acceptance checklist; a state absent from it is not
  reviewed. Steps are plain Playwright code with `{shot}` markers
  interleaved where screenshots happen.
- `seeds/` — mock data scenarios (structural mirrors of the JSON API
  shapes from `internal/api/README.md`).
- `mock/server.ts` — mock mode: one Node process serving `web/dist` and
  answering `/api/*` from the seed + script of the current state. SSE
  (`GET /api/events`) sends a snapshot then pings. Unknown API routes
  answer 501 loudly. No Go binary, no network, any mid-flight state
  frozen exactly.
- `live.ts` — live mode: builds and spawns the real `pset` binary with a
  temp `HOME` (isolated SQLite, library, config), seeds it through the
  real import API, waits for jobs to drain. Catches mock drift.
- `run.ts` — CLI, per-state browser contexts, theme forcing, network
  conditioning, screenshots, gallery generation. In `--watch` mode it
  also narrates: a HUD overlay (bottom left) shows the running state,
  its note, and a live log of every navigation, action, and screenshot;
  pacing is slowed to human speed. The HUD hides itself before each
  screenshot so gallery PNGs stay clean.
- `hud.ts` — the watch-mode HUD: injected render script, plus the page
  wrapper that turns Playwright calls into log lines.
- `gallery.ts` — the static gallery: a Light / Dark / Both switch
  (default Light, one theme on screen at a time), per-theme status dots,
  failure slots in red, console errors listed.

## Contracts

- Two modes. `mock` (default) stages the API in-process; `live` runs the
  real backend. The same manifest drives both; states declare which
  modes they support via `modes`. Live currently covers the
  backend-visible states (empty, populated shelf); dialog states are
  mock-only until they have live counterparts.
- Fresh browser context per state x theme. Theme is forced through
  `localStorage['pset-theme']` plus `colorScheme`; light and dark are
  both captured by default.
- Never touches the real LLM. Ask-streaming states will run on the mock
  server's scripted SSE; live-mode LLM states wait for a `-fake-llm`
  server flag.
- Do not use `waitForLoadState('networkidle')` in steps: the SSE
  connection never goes idle. Wait for concrete selectors instead.
- Adding a page's states: extend the seed registry, add manifest
  entries, run `npm run visual -- <page>`.

## Deliberately not here

- Pixel-diff baselines; the human eye is the assertion.
- Mobile viewports (desktop-only per the UI standards).
- CI; the gallery is a local review artifact.
