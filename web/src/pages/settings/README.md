# Settings

Route `/settings`. This doc is the spec: the page renders exactly what's
described here, and nothing else.

**Purpose:** the two things the platform cannot work without — the chat
connection and the search connection — plus the theme, the reset switch,
and the truthful facts about this installation (version, real paths).

**Data:** `useConfig()` (GET/PUT `/api/config`), `useHealth()`
(`/api/health` carries the version AND the real database/library paths),
`api.testConfig()` (`POST /api/config/test`, tests the SAVED settings),
`api.reset()` (`POST /api/reset`, preview with `{apply: false}`).

## Layout

`mx-auto w-full max-w-2xl space-y-section px-page py-10` — four cards.

## Connection

The platform card. Description: `PSet needs two things to work: a chat
service for answers and a search service that matches questions to pages.
Imports only finish once both are connected. The key stays on this
computer.`

Fields (top to bottom, mono `text-xs` inputs for addresses):

| Field | Hint | Notes |
|---|---|---|
| `API address` | `Where questions are sent.` | placeholder `https://…` |
| `API key` | `Stored only on this computer.` | `type="password"`, placeholder `Saved. Type to replace` when a key exists, never echoed |
| `Search service` | `The default looks for a service on this machine, so leave it as is unless you moved it.` | two-column row with Search model |
| `Search model` | `The model that matches questions to pages.` | |

One action, **`Save & test`** (primary, `size="sm"`): disabled until an
edit is dirty; saves the patch, then runs the test against the saved
settings, then renders the verdicts — `Chat is working` / `Semantic search
is working` with a green check, or `isn't working` with the failure detail
in mono. There is no separate Test button, no unsaved-input testing, and
no transient "Saved" flash: the verdicts are the success state. Save
failures and test-run failures render inline (`text-xs text-destructive`).
The button shows its spinner for the whole save+test run.

Loading: two pulse skeleton bars. Load error: inline destructive line +
`Retry`.

## Appearance

One row: `Theme` (hint `System follows your device setting.`), a `w-32`
Select of `Light` / `Dark` / `System` that applies immediately through
`applyTheme()` (same setter the header toggle uses; persisted to
localStorage `pset-theme`).

## Danger zone

Destructive-bordered card. Warning icon + `Danger zone` title in
destructive; description `Removes every book, page, library file and
finished task from this computer. Preview the counts first.`

1. `Preview` (outline) loads the counts; `Delete everything…` (destructive)
   stays disabled until counts exist.
2. Count line, mono: `{books} books · {pages} indexed pages · {files}
   library files · {tasks} finished tasks would be deleted.` (all
   pluralized).
3. `Delete everything…` opens the confirm dialog: `Reset PSet?`, the same
   four counts restated inline, `This cannot be undone.`, Cancel +
   destructive `Delete everything`. One click — no type-to-confirm.

On success: dialog closes, success line `Reset complete. The library is
empty.`, books and health refetch. Reset refuses while tasks are
unfinished — the server's error renders inline.

## About

Purpose line (`PSet turns your textbooks into study sessions… Everything
stays on this computer.`), then three label/mono-value rows: `Version`,
`Database`, `Library` — the paths come from `/api/health` and are the
server's real configured locations, never hardcoded `~/.pset`. Closes with
`Something look off? The Doctor page can check and repair this setup.`

## Deliberately not here

- **Study defaults placeholder** — removed: disabled controls with hints
  describing features that don't exist are dishonest UI. The section
  returns with real controls when sessions and quizzes land.
- Separate `Test` button / testing unsaved edits — the engine can do it
  (`TestConnection` accepts an override) but the endpoint and the flow
  were deliberately not built; revisit only if typos become a real
  friction.
- Type-to-confirm on reset — preview + restated dialog is the agreed
  friction level.
- A standalone Data card — paths live in About, served by the server.

## Backend surface

`GET/PUT /api/config`, `POST /api/config/test` (saved settings only),
`GET /api/health` (`databasePath`, `libraryDirectory` added),
`POST /api/reset` (preview + apply; apply also clears the jobs table, so
finished task history does not outlive the books it refers to).
