# web

The frontend: a React SPA built into `dist/` and embedded in the Go
binary by `embed.go`. Vite, TypeScript, Tailwind CSS v4, TanStack Query.

## Commands

```sh
npm ci           # once
npm run dev      # Vite; /api/* proxies to 127.0.0.1:8420 (PSET_API_TARGET repoints it)
npm run build    # tsc -b && vite build → dist/, then a check that every theme utility compiled
npm run test     # vitest (jsdom)
npm run lint     # oxlint
```

For day-to-day work, `make dev` from the repo root runs the Go server
(rebuilt on save), regenerates the TS wire types when a `wire.go`
changes, and runs Vite, all in one terminal.

## Layout

```
src/api/         one file per backend feature: queries, mutations, and the
                 SSE handlers that patch the cache (events.ts owns the stream)
src/api/gen/     TS types generated from the Go wire.go files (make gen); never edit
src/components/  the design system: one folder per component, each with a README
src/pages/       the three screens (home, workspace, settings) and /components,
                 a page showing every component and variant
src/lib/         small pure helpers (page numbers, due dates, theme, covers)
```

## Contracts

- **The design system is `design/design-system.md`**, and `src/index.css`
  is its machine-readable form. Only the spacing steps and type sizes it
  defines exist: a fractional or arbitrary utility doesn't compile.
  Each component's README records how and why it departs from the
  baseline.
- **Server state lives in TanStack Query.** One EventSource
  (`/api/events`) feeds every feature's cache; a feature registers its
  event handlers in its own `src/api/*.ts` file. While the stream is
  down, the shell shows a lost-touch Flash.
- **Wire types come from Go.** Change a `wire.go`, run `make gen`, commit
  both; `make check-gen` fails when they drift.
- **Embedding.** A fresh clone has only `dist/.gitkeep`, so `go build`
  always works and serves a "not built" notice. Run `npm run build`
  before building the binary to ship the real UI. `/api/*` is JSON;
  anything else is the SPA, with hashed assets cached as immutable and
  every other path falling back to `index.html`.

## Visual suite

`e2e/` holds a Playwright state suite and gallery (see `e2e/README.md`).
Its manifest still describes the pre-rewrite app and is due to be
rewired.
