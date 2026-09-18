# web

The frontend adapter: a React SPA served from the binary. Vite + TypeScript +
Tailwind CSS v4 + shadcn/ui. The built app lands in `dist/` and is embedded
by `embed.go`; the HTTP adapter (`internal/api`) serves it.

## Dependencies

- React 19, Vite 8, TypeScript 6
- Tailwind CSS v4 via `@tailwindcss/vite` (no config file; theme lives in `src/index.css`)
- shadcn/ui on the **radix** base, **nova** preset (`components.json`); primitives come from the `radix-ui` package, class merging from the `cn` package
- `lucide-react` for icons
- `sonner` for toasts (job failures/completions — import completions carry
  an `Open book` action); theming follows the app's own `.dark` class, not
  `next-themes`
- Self-hosted fonts via Fontsource (bundled into `dist/` — no CDN, works offline)

## Commands

```sh
npm install
npm run dev      # Vite dev server; /api/* proxies to 127.0.0.1:8420 (`pset serve`)
npm run build    # tsc -b && vite build → dist/
npm run lint     # oxlint
npm run test     # vitest run (jsdom)
```

Dev workflow: run `pset serve` in one terminal and `npm run dev` in another;
open Vite's URL. Hot reload on the frontend, real API on the backend.

## Embedding contract

- `embed.go` embeds `all:dist` into `var Dist`. A fresh clone has only
  `dist/.gitkeep`, so `go build ./...` always works; the binary then serves a
  "not built" notice instead of the app. Run `npm run build` before building
  the binary to ship the real UI.
- Everything under `/api/*` is JSON. Anything else is the SPA: exact files
  are served (hashed `assets/*` get `immutable` caching), every other path
  falls back to `index.html` with `no-cache` (client-side routing), and a
  missing asset is a 404 rather than HTML.
- `GET /api/health` → `{"status":"ok","version":"…"}`; unknown API routes
  return `{"error":"…"}` with 404.
- **Two kinds of task, and only two**: preparing a book and writing an
  assignment's walkthroughs. Each is a flat ordered list of phases — no
  child rows, so what runs is exactly what a student sees. `POST /api/import`
  accepts multipart (`file` part) or JSON (`{path}`) and returns
  `202 {book, task, duplicated}` (200 + the existing book when the SHA is a
  duplicate, 400 when no model connection is configured — preparation ends
  in search, so it is refused at the door). Tasks live at `GET /api/tasks` /
  `GET /api/tasks/{id}` with `stop` and `retry`; the wire shapes (`Task`,
  `Phase`) sit in `src/lib/types.ts`, mirror calls in `src/lib/api.ts`, and
  the pure display helpers in `src/lib/tasks.ts`.
- **Everything else is a direct request** that renders on the thing it
  affects. With a serial runner, a five-second walkthrough rewrite queued
  behind a forty-minute book would wait an hour, so question repair
  (`adjust` / `relocate` / `rewrite`) runs now, on the question's own card.
- **A book is Ready, or Not ready with a reason.** Readiness is derived on
  the server and travels as counts (`book.ready`, `book.readiness`,
  `book.failedPages`), never as stored flags. A not-ready book is visible
  everywhere and usable nowhere: shown dimmed in the library, redirecting
  out of the reader, and absent from Ask's and homework's pickers.
- Live task state streams over `GET /api/events` (SSE: `snapshot` / `task` /
  `phase` / `task_removed`, plus a `ping` event every 15s) into the module-level
  store in `src/lib/events.ts` — one connection feeds every subscriber via
  `useTasks` / `useTaskSettled`. The pure fold (`applyTaskEvent`) is covered
  by `src/lib/events.test.ts`. **A dropped stream is never silent**: two
  missed heartbeats and the sidebar card dims, says it lost touch, and
  stamps the frozen numbers with how old they are.

## UI standards

The design language is **ink & paper**: a quiet study room. Warm paper
neutrals, ink text, one confident fountain-pen blue for actions, serif
display type. Calm and content-first — decoration never competes with
textbooks.

Everything below is **compiler-enforced where possible**: the `@theme`
block in `src/index.css` defines the only spacing steps and type sizes
that exist. A fractional utility (`gap-1.5`, `px-2.5`) or an off-scale
size (`text-5xl`) simply doesn't compile — there is no CSS for it. If
you need a value the theme doesn't have, that's a design question, not
a CSS question: change the tokens or the design, never reach for an
arbitrary value.

### Typography

Eight steps, fixed roles. Newsreader is the heading face everywhere;
Inter is everything else; JetBrains Mono is for content-addressed data
(hashes, paths, versions, code, counts).

| Step | Size / line | Face | Role |
|---|---|---|---|
| `text-xs` | 0.75 / 1rem | Inter 500 | meta, labels, micro-captions |
| `text-sm` | 0.875 / 1.25rem | Inter 400 | dense UI, secondary text |
| `text-base` | 1 / 1.5rem | Inter 400 | body |
| `text-lg` | 1.125 / 1.75rem | Inter 600 | card titles; italic serif leads |
| `text-xl` | 1.25 / 1.75rem | Newsreader 500 | section heads |
| `text-2xl` | 1.5 / 2rem | Newsreader 500 | reserved |
| `text-3xl` | 1.875 / 2.25rem | Newsreader 500 | page titles |
| `text-4xl` | 2.25 / 2.5rem | Newsreader 500 | empty-state / hero display |

- Leads (the description under a page title): `font-heading text-lg
  text-muted-foreground italic` — the study-room voice; never sans.
- Uppercase micro-labels use `text-xs` with `tracking-*` — no
  arbitrary micro sizes (`text-[0.65rem]` and friends are legacy and
  die at page rewrites).
- Reading measure: `max-w-prose` for prose, `max-w-3xl` for page columns.
- No `text-[…]` arbitrary sizes in new code. No sizes outside the eight.

### Color

Tokens are OKLCH CSS variables in `src/index.css` (`:root` light, `.dark`
dark). Use semantic utilities (`bg-background`, `text-muted-foreground`),
never raw values.

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` / `foreground` | warm paper / ink | deep warm charcoal / off-white | page |
| `card` | brighter paper | slightly raised | cards, popovers |
| `primary` | ink blue | softened ink blue | primary actions, active states |
| `secondary` / `muted` | warm gray | raised gray | secondary actions, quiet fills |
| `accent` | ochre highlight | warm dark | hover fills, subtle emphasis |
| `success` / `warning` / `destructive` | green / amber / red | same, lifted | status: doctor severities, import results |
| `chart-1..5` | ink blue, teal, amber, rose, violet | lifted variants | data viz, in this order |

- Status mapping is fixed: check `ok`/`fixed` → `success`, `warning` →
  `warning`, `error` → `destructive`, `info` → `muted`.
- Meaning is carried by tokens, never by raw hex; both themes come free.

### Shape, space, elevation

- Radius: `--radius: 0.625rem`; components use the `rounded-*` scale derived
  from it. Pills (badges) are `rounded-4xl`.
- Spacing derives from **one shared step** (`--spacing-1`, 4px): utilities
  are integer multiples of it, and half-steps and arbitrary values are not
  available. Density comes from smaller multiples, never off-grid values.
  Extra breathing room comes from the semantic tokens below, not from a
  bigger base — controls stay the same size across density changes.
- Semantic layout tokens own page rhythm: `page` (2.5rem gutters and page
  padding), `section` (2.5rem between major sections), `card` (1.25rem card
  interior). Pages compose with `px-page`, `gap-section`, `p-card`;
  raw integers (`gap-2`, `p-4`) are for component internals and one-off
  layout glue, never for page rhythm.
- Elevation: hairline `border` first; shadows only for floating layers
  (popovers, dialogs). No drop shadows on static cards.

### Components

- Pull from `@/components/ui` (shadcn). Never hand-roll a primitive; add new
  ones with `npx shadcn@latest add <name>` (or the shadcn MCP server's
  `add_items`), then style via `className` + tokens.
- Variants over ad-hoc styling: pick `variant`/`size` before writing classes;
  one-off classes only for layout around a component.
- **The library owns every repeated visual.** Badges, pills, chips, forms,
  previews, equations, progress, list rows, empty states: these are
  components, not patterns to re-style per page. Pages are thin
  compositions of library parts plus raw integer utilities for layout glue.
- **Components are extracted on demand.** Build a visual page-local first;
  the moment a second page needs it, promote it into `components/` with the
  shared look. Nothing is pre-invented "for later".
- Math renders through one family (extracted from `answer-blocks` as pages
  are rewritten): `MathInline` for prose math, `EquationBlock` for display
  equations, `StepList` for numbered solutions.
- Lists and cards need all three states: loading (skeleton or muted line),
  empty (icon + one-liner + action), error (destructive badge + retry).

### Layout

- **Desktop-only.** Below 1024px the app doesn't render; the static gate in
  `index.html` shows instead ("This desk needs a bit more room"). No mobile
  layouts, no drawers, no mobile-first padding. `lg:`/`xl:` variants are
  fine for desktop window sizes (library grid 4→5 columns, the Ask history
  rail at `lg:`); `sm:`/`md:` variants are legacy from the mobile era —
  don't add new ones, and flatten them when a page is rewritten (base
  value = the current `md:` value).
- The shell uses the shadcn `Sidebar` primitive (`@/components/ui/sidebar`,
  `collapsible="offcanvas"`): a fixed `15rem` ink column (brand, grouped
  nav: Library / Study / System, version footer) that collapses via
  `SidebarTrigger` in the header (Cmd/Ctrl+B also works).
  `TooltipProvider` wraps the shell because the sidebar's tooltips
  require it. The rail's **bottom** holds the Tasks card
  (`components/task-card.tsx`) with Settings beneath it: what is happening
  in plain words, a bar for the running phase with its count, four pips for
  its place in the plan, time left, and Stop. It collapses to a quiet
  `Tasks` row when nothing is running, turns destructive when something
  needs a decision, and goes honest when the stream drops. Everything else —
  the full plans, the failures, the history — is on `/tasks`, which is where
  you go to fix things rather than to watch them. Task state comes from the
  shared SSE store (`useTasks` in `src/lib/events.ts`).
- The sidebar is themed **dark ink in both modes** (`--sidebar` tokens in
  `src/index.css`) — treat it as an ink column on paper, not a gray panel.
  Screens sitting on the main background (e.g. the Reader's contents list)
  must use main tokens (`bg-muted`), never sidebar tokens.
- Pages live in `src/pages/<name>/` (one route each, react-router,
  `BrowserRouter` — the Go server falls back to `index.html`, so deep
  links work). Each page folder carries its design doc as `README.md`:
  what the page shows, why each element exists, its states. If a rewrite
  is planned, the doc is grilled and approved first — the doc is the spec
  the HTML is generated from.
- Every page opens with `PageShell` (`components/page-shell.tsx`): the one
  shared wrapper — centered `max-w-6xl` column, `px-page py-10`,
  `space-y-section` rhythm — with the header baked in: one `h1` in
  `font-heading` via `PageHeader` (title, italic serif lead, actions
  right-aligned — no eyebrow badge; the sidebar and shell header already
  locate the page); the shell header shows the section label, not a
  repeated title. Empty collections render the shared `EmptyState`
  (`components/states.tsx`): icon roundel, serif heading, one supporting
  line, optional action — the same card, padding and placement on every
  page.
- Chat-style pages (Ask) use a fixed-height column with an internally
  scrolling transcript, an always-visible composer, and a persistent
  collapsible history rail beside the transcript (a flat
  recency-sorted list with a pinned section on top).
- Content-addressed data (hashes, paths, scores) renders `font-mono`.

### Book covers

No real cover images: `BookCover` renders a CSS cover — per-book hue as a
cloth-bound board: deep OKLCH gradient with a soft top-left sheen, darker
spine with a highlight groove, a paper page-edge strip on the right, and the
title set inside a hairline plate (uppercase micro author, serif title
`line-clamp-3`, small `PSET` stamp at the foot). Hues map to the chart
palette; keep new books on that map.

Table-of-contents lists (book detail and reader) use dotted leaders between
entry and page number — `border-b-2 border-dotted` on an `aria-hidden` filler
span — with no divide rules between rows.

### Icons & motion

- `lucide-react` only: `size-4` inline and in nav, `size-3` inside
  badges/buttons.
- Motion is functional and fast: 150–200 ms ease-out (shadcn defaults +
  `tw-animate-css`). No bounce, no decorative loops. Sanctioned one-shot
  exceptions: the library cover lift (`group-hover:-translate-y-1` +
  deepening shadow while its card stays put — a book picked up off the
  shelf).

### Theming & accessibility

- Dark mode: `.dark` class on `<html>`. `index.html` applies it before first
  paint (localStorage `pset-theme`: `light`/`dark`/`system`, falling back
  to `prefers-color-scheme`); `applyTheme()` in `theme-toggle.tsx` is the
  single setter used by both the header toggle and Settings.
- `color-scheme` is set to `light`/`dark` alongside the class, so UA-rendered
  surfaces (native scrollbars, form controls) follow the theme. Scrollbars
  are additionally styled thin with a translucent `muted-foreground` thumb
  (`scrollbar-color` + `::-webkit-scrollbar` in `index.css`) — keep those
  rules token-based if the palette changes.
- Keyboard focus is always visible (`focus-visible` rings come from the
  components); navigation uses `aria-current="page"`, disabled items use
  `aria-disabled`; never encode meaning in color alone.

## Adding a page

1. Create `src/pages/<name>/index.tsx` plus its `README.md` design doc
   (purpose, layout anatomy, components used, states, what's deliberately
   not there), and add the route in `App.tsx` inside the `AppShell`
   layout route.
2. Add the nav entry to `navGroups` in `app-shell.tsx` under the right group.
3. Real data access goes through `src/lib/api.ts` with a typed response,
   hooks in `src/hooks/`. When server state gets non-trivial, add
   TanStack Query.
4. Compose from the shared components first; promote a page-local visual
   into `components/` when a second page needs it. If a page rewrite cuts
   a feature, record it in `design/removals.md`.

## Ask envelopes

The engine streams answers as typed SSE events and stores them as ordered
segments — the web never parses a fence. `src/lib/types.ts` hand-syncs the
shapes (`EnvelopeKind`, per-kind payload types, `Segment`); there is no
runtime validator — the web trusts the engine's schema validation.

- **Events:** `delta` folds into the trailing prose segment
  (`src/lib/ask-stream.ts`); `envelope-start` shows the shaped shimmer
  skeleton ("Writing an equation…"); `envelope-repairing` swaps the label
  ("Tidying an equation…"); `envelope` replaces the skeleton with the card;
  `envelope-failed` renders the raw payload as a muted code block — never
  an error chip, never dropped.
- **Cards:** equation renders `equations[]` straight through KaTeX
  `displayMode: true` (bare TeX — no `$$` delimiters anywhere, so nothing
  mis-pairs); steps/theorem/definition/note render their text fields
  through the same prose pipeline, so inline `$…$` math and `[p. N]`
  citation chips work exactly like prose, with the message-wide
  changed-page-only chip rule.
- **Persistence replay:** the messages API returns the same segment list,
  so opening an old thread is render-only.
- **Testing:** `npm run test` — `ask-stream.test.ts` covers the event
  folding, `ask.test.tsx` renders each kind from events plus the skeleton
  label swap and the degraded code block.
