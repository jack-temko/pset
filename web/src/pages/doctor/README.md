# Doctor

Route `/doctor`. This doc is the spec: the page renders exactly what's
described here, and nothing else.

**Purpose:** the one "is PSet ready" answer. Every hard requirement of the
platform checked in a single pass — storage, database, PDF tools, OCR,
chat, semantic search — with safe repairs applied on request and each
failed finding pointing at where its fix lives.

**Decisions from the grill (2026-09-16):**

- The check list covers the whole platform, including the two endpoint
  probes (chat key, embeddings) whose absence hard-fails imports and
  asks.
- Actions collapse to two honest controls: **Repair** (primary; checks +
  safe fixes in one pass) and an icon-only refresh button ("Run the
  checks again", check-only). No more Repair-vs-Run-again guessing.
- Failed findings link to where the fix lives: Settings for the key and
  endpoints, install-command copy for system tools.
- Checks render as rows, not cards.

## Layout

`PageShell`: title `Doctor`, lead `Makes sure PSet's storage, database and
AI connections are ready to go, and repairs what it safely can.` Actions
(right): refresh icon button (`RefreshCw`, aria-label `Run the checks
again`, runs the check-only GET, spins in flight) and `Repair` (primary,
`Wrench`, runs the fixing POST; label `Repairing…` with spinner while in
flight, both actions disabled then).

1. **Status banner** — one slim card, tone by overall state: all checks
   passed (success), usable-with-warnings (warning, some check `warn`),
   needs attention (destructive, some check `failed`). Line: status word
   + counts (`6 checks · 1 fixed · 2 warnings · 1 failed`, pieces appear
   only when non-zero).
2. **Repairing line** — while the fixing POST runs, a `role="status"`
   line under the header: `Running every check and applying safe
   repairs…`.
3. **Check rows** — `ul divide-y rounded-xl border bg-card`; each row:
   uppercase micro-label check name + status chip (`ok` success-outline,
   `fixed` success-tinted, `warn` warning, `failed` destructive),
   findings beneath as plain lines — info findings muted, warnings in
   warning tone, errors destructive. A finding with a `link` renders its
   label as an inline link under the message (to `/settings`).
4. **Load error** — destructive badge card: `Couldn't run the doctor.`,
   the server message, `Retry` (re-runs the check-only GET).

## Checks (server-rendered list, order fixed)

`data dir`, `database`, `poppler`, `tesseract`, `chat api`,
`semantic search`. The page renders whatever the report carries — no
client-side filtering or reordering.

## Behavior

- On mount: check-only `GET /api/doctor`.
- `Repair` → `POST /api/doctor` (checks + safe repairs); the response
  replaces the shown report; a failed POST shows a destructive line
  under the list (`Repair failed: {message}`) and keeps the old report.
- Refresh → `GET /api/doctor`; never fixes.
- The two endpoint checks probe the saved settings with a 5s timeout
  each (same probes as Settings' Save & test) and never auto-fix.

## Backend surface

- `GET /api/doctor` — report.
- `POST /api/doctor` — report with safe repairs applied.

Findings carry optional `link {label, href}`.

## Deliberately not here

- Config editing — Settings. Doctor only points at it.
- Scheduled/automatic runs — doctor is a page you visit.
- Deep diagnostics (log excerpts, per-check retries) — not scoped.

## E2e manifest (web/e2e/states.ts)

`doctor/healthy`, `doctor/warnings`, `doctor/failed`, `doctor/fixed`,
`doctor/repairing`, `doctor/load-error` — over the scriptable mock
`/api/doctor` routes, library-independent (seed `library:empty`).
