# Every error has an id, a reason and a fix

## Status

Built, branch `error-catalog`, waiting for Jack to try it. Spec: [error-catalog-grill.md](error-catalog-grill.md) (approved 2026-10-09). The grill's Summary is binding; this file is how to build it.

## Information

**Why.** Today an error says what happened in one sentence written at the call site, sometimes with a raw Go error in it, and background failures use their own words. A tired student should see what happened, why, and what to click, the same way everywhere.

**Decisions.** D1 to D16 and A1 to A5 in the grill. The ones that shape the code:

- Entries live in the package that detects the cause (D2), as **unexported** package vars in that package's `errors.go`, so the `unused` linter flags a dead entry for free. Shared causes belong to the lowest package (`llm` owns `key.*`, `model.*`; `errs` owns `internal.*`, `request.*`).
- Composition (D5): what from the outermost catalog error in the chain, why and fix from the deepest one. With no catalog error in the chain: `internal.unexpected`.
- Upkeep (D16): adding an error is one entry plus its use. No hand-written TS copy of entries. No new third-party dependency.

### Design

**`internal/errs`** (new, imports only the standard library):

- `Entry{ID, What, Why, Fix string; Action Action; Status int; Scope Scope}`. `Scope` is `Inline` (default), `Screen` (banner, D13) or `Field` (one line under a field, D10). Text may hold `{name}` placeholders filled from params.
- `define(Entry) *Entry` exported as `errs.Define`; panics on a duplicate id or a bad id (`^[a-z]+(\.[a-z_]+)+$`). `errs.All()` returns the registry, sorted.
- `(*Entry).New(params ...string)` and `(*Entry).Wrap(cause error, params ...string)` return `*errs.Error`, with `.OnField(name)` and `.About(ref)` (the resource id, as duplicate_book's id today). `Error()` is lowercase, no period (revive): `"<id>: <cause>"`. `Unwrap` works with `errors.Is/As`.
- `errs.Resolve(err) View`: walks the chain, applies D5, fills params, sets `Chain []string` (ids, outermost first). `View` is the wire type: `{id, what, why?, fix?, action?, scope, field?, ref?, incident?, chain}`.
- `errs.Recorder` interface plus `errs.SetRecorder`; `errs.Report(ctx, err, where Where) View` resolves, gets an incident id from the recorder (6 chars, Crockford base32), logs one structured slog line with the full chain and every Go error text, and returns the view. Field-scope errors are not recorded as incidents (they are the student's typing, not failures) but are still in the table.

**`internal/errlog`** (new): the errors table (migration `errlog/1`: incident, id, chain, detail text, route or job, book/set/question ids, created_at; never keys, prompts or answers, A2). Implements `errs.Recorder`. Routes: `GET /api/errors` (grouped by id: count, last time, incidents newest first), `DELETE /api/errors` (clear all). Wired in `cmd/pset/main.go`.

**`internal/httpx`**: `H`, `Reply`, `Send`, `Take`, `Act` and `Decode` answer every error through `errs.Report`, status from the entry. `Errorf`, `Invalid`, `NotFound`, `Code` and `httpx.Error` go away; generic entries (`request.invalid_json`, `request.too_large`, `request.not_found`) live in `errs`. `internal/events/events.go:127` answers in the same shape.

**Background rows** (D11), one migration per owning feature: questions (`failure`, `reason`), Ask turns (`failure`, `reason`), books (`reason`), assignment reads (`error`) gain one `error` column holding the ids, params and incident (`errs.Stored`); usage calls (`error`) gain `error_id`. ~~jobs (`error`)~~: no migration, `jobs.error` stays a string for the log, and it already starts with the catalog id because a catalog error's text does; a second report there would give one failure two incidents, backfilled from the old kinds through a fixed map (unknown text to `internal.unexpected`); the old columns are dropped. Wire types carry an `error: View` where they carried a failure kind or reason. The homework `Failure` and ask failure enums go.

**Generator** `tools/errcatalog`: blank-imports every package with entries, writes `web/src/api/gen/errors.ts` (the `ErrorId` union, `Action` and `Scope` types, and the entries for the `/errors` page) and `design/errors.md` (the table: id, what, why, fix, action, scope, owner package). `make gen` runs it; `check-gen` diffs both.

**Lint** (D8): add the measured draft from the grill (wrapcheck with `ignore-package-globs: [github.com/jackt/pset/*]` and `ignore-sigs` for the `errs` constructors, errorlint all three, tools/ and tests excluded for wrapcheck) to `.golangci.yml`, and fix every finding by wrapping in the owning catalog entry. Add a go/analysis analyzer `tools/lint/catalogerr` loaded as a golangci-lint module plugin: a function passed to `httpx.H/Reply/Send/Take/Act` may not return `fmt.Errorf` or `errors.New` values directly. If the plugin route costs more than a day, use a Go test that does the same check instead (A4) and say so.

**Web**:

- `web/src/api/client.ts`: `ApiError` carries the `View`; a network failure becomes `request.unreachable` (a Screen entry), a non-JSON answer `internal.unexpected`. Every consumer switches on `id`.
- `web/src/components/error-notice/` (new, with README and a `/components` section in `feedback.tsx`): the inline block from mockup A: what (body weight), why and fix (quiet lines), one action button, a Details link that expands the chain's ids and the incident id with Copy. Not a red fill: use the design system's danger tokens as the mockup's border and a quiet surface, judged against `design/design-system.md`.
- `web/src/api/error-actions.ts`: one map from `Action` to what the button does (retry the failed call, navigate to Settings `#connections`, open the book by `ref`, ...).
- Screen-scope errors go to the existing `flash` banner via the shell; Field-scope errors render as the field's existing error line.
- Background rows (book status, failed question, Ask turn, usage rows) render `ErrorNotice` (or its one-line form in a dense row that opens it).
- Settings gets an **Errors** section (after Health): grouped by id, expandable to incidents, one Clear all through `ConfirmPopover` as Reset everything does. Empty state: "No errors so far."
- `/errors`: a read-only dev page listing the generated entries (A3), linked from `/components`' sidebar like `/views`.
- `/views/error-notice`: the scenarios become the real component's states (inline, banner, field, background row, settings); drop the toast scenario; fix the mockup's squeezed side notes and the overlapping time column.

### Files

- `internal/errs/{errs.go,errs_test.go}`: new
- `internal/errlog/{errlog.go,routes.go,errlog_test.go}`: new
- `internal/httpx/{httpx.go,handle.go,wire.go,*_test.go}`: on errs
- `internal/events/events.go`: stream error shape
- `internal/<pkg>/errors.go` for each package that raises: homework, library, settings, update, activity, ask, memory, llm, pdf, ocr, doc, db, usage, jobs, mathx (only where its errors reach a student), and their call sites
- `internal/homework/{store.go,question.go,service.go,notes.go,boxes.go,wire.go}`, `internal/ask/{store.go,loop.go,wire.go}`, `internal/library/{store.go,import.go,service.go,wire.go}`, `internal/usage/{usage.go,wire.go}`: background rows and migrations
- `cmd/pset/main.go`: errlog migrations, recorder, routes
- `tools/errcatalog/main.go`, `tygo.yaml` (add errs, errlog), `Makefile` (gen, check-gen)
- `.golangci.yml`, `tools/lint/catalogerr/` (+ `.custom-gcl.yml` if the plugin route)
- `web/src/api/{client.ts,query.ts,library.ts,homework.ts,error-actions.ts}`, `web/src/api/gen/*` (generated)
- `web/src/components/error-notice/{index.tsx,README.md}`, `web/src/components/book-status/index.tsx`, `web/src/components/shell/index.tsx`
- `web/src/pages/settings/index.tsx`, `web/src/pages/workspace/{index.tsx,add-homework.tsx,memory.tsx}`, `web/src/pages/components/sections/feedback.tsx`, the `/errors` page and its route
- `web/src/views/homework/{failed-question.tsx,failed-line.ts,walkthrough.tsx,world.ts}`, `web/src/views/mock/server.ts`, `web/src/views/error-notice/*`
- `design/backend.md` (Errors), `design/errors.md` (generated), `design/import.md`, `design/model-usage.md`, `design/settings.md` if it exists, `ideas/README.md`, this file

### Steps

Each a commit; `make check` green at each.

1. `internal/errs` with tests: Define panics on duplicates and bad ids; Resolve composes D5 across a three-deep chain; params fill; no catalog error gives `internal.unexpected`; `errors.Is/As` work through `Wrap`.
2. `internal/errlog`: migration, Recorder, GET and DELETE routes, slog line; tests for record, grouping and clear.
3. httpx on errs, the generic `request.*` entries, events.go; regenerate TS; keep the web compiling with a temporary adapter only if needed, removed by step 7.
4. Package by package (one commit each): `errors.go` entries, call sites converted, no `%v` of a Go error in student text. `llm` owns `key.*` and `model.*`; settings' test maps onto them.
5. Background rows: migrations with backfill, writers, readers, wire types; migration tests that backfill old kinds.
6. Lint: config, fixes, the catalogerr analyzer (or the A4 test).
7. Generator, `design/errors.md`, check-gen.
8. Web: client, ErrorNotice + README + `/components` section, actions, consumers, background rows, banner, field lines, Settings Errors, `/errors`, `/views/error-notice`.
9. Docs: `design/backend.md` Errors rewritten for the catalog (how to add an error in five lines, the ownership rule, D5), `design/import.md` and `design/model-usage.md` for the new row rendering, this file's Status, the grill's status to built, `ideas/README.md`.

### Tests

- New: `internal/errs/errs_test.go`, `internal/errlog/errlog_test.go`, migration backfill tests in homework, ask, library, jobs, usage; `internal/httpx/handle_test.go` updated for the View shape; an HTTP test per converted package that one representative error answers with its id and status; a test that every entry's what, why and fix end with a period and contain no em dash; vitest for `client.ts` (network failure, non-JSON) and ErrorNotice (Details expands, Copy).
- `make check` green, including lint with wrapcheck, errorlint and catalogerr.
- States to photograph, Paper and Night: `/views/error-notice` every scenario; `/components#error-notice`; `/settings` Errors section (empty and with rows); `/errors`.

### Acceptance

1. Import a book with no key: the shelf shows the inline notice "what / why / fix" with an Open Settings button that lands on Connections.
2. A failed question and a failed Ask turn show the same notice shape with Retry; Details shows the chain and an incident id; Copy copies both.
3. Stop the server: the banner says PSet can't reach its server, with Retry; no other notice stacks up.
4. Submit an empty book title: one line under the field, nothing else.
5. Settings, Errors lists those incidents grouped by id with counts; Clear all asks to confirm, then the list is empty.
6. `design/errors.md` lists every entry; adding a new entry and running `make gen` updates it and the TS with no other edit.
7. `grep` finds no `httpx.Errorf`, no `httpx.Code`, and no student-facing text built from `%v` of an error.
8. The PR body lists the entries whose copy the builder is least sure of (D14).

### Out of scope

Toasts; translations; sending errors anywhere off the machine; reworking screens beyond swapping their error display; retention limits (D12 keeps everything until cleared).

## Built differently

- **catalogerr** is the A4 Go test (`tools/errcatalog/handlers_test.go`), not a golangci-lint plugin. It reads handler bodies as syntax, so it only sees a literal `fmt.Errorf` or `errors.New` returned inside the handler; an error built elsewhere and returned by a variable is not seen. wrapcheck and errorlint cover the rest.
- **Recording** (reviewed 2026-10-10): only server failures (status 500 or more) and background failures become incidents and rows; a 4xx request error is answered with its view and chain and nothing is kept. A cancelled request, and a host or origin refused by `LocalOnly`, keep nothing.
- **Merged entries**: not-found is `request.gone` and out-of-date is `request.stale`, each with a `{thing}`; the import contents steps are plain `import.failed`; a failed question is `homework.question_failed` with a `{step}`; a missing part of a guide is `agent.no_answer`.
