# Error catalog: grill

- status: grilling
- date: 2026-10-09
- brief: one table of every error PSet can show (stable id to what happened, why, how to fix), shown the same way everywhere; judged from the tired student's point of view
- sources: internal/httpx/{httpx,wire,handle}.go, internal/llm/llm.go, internal/settings/service.go, internal/homework/wire.go, internal/library/{import,wire}.go, internal/jobs/jobs.go, web/src/api/client.ts, design/backend.md "Errors", design/import.md, design/model-usage.md, web/src/components/flash

## Summary

(written at the end; decisions so far)

| #   | Decision                                                                                                                                                                                 | Why                                                   | Beat                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| D1  | Ids are dotted names per area (`key.out_of_credit`, `book.duplicate`)                                                                                                                    | readable in code, logs and bug reports                | numeric codes, both                              |
| D2  | The catalog is one Go file; the server sends id plus params; TS types and a docs page are generated from it                                                                              | one place to edit                                     | YAML data file, frontend-owned copy              |
| D3  | Every error is in scope, tied into Go error wrapping and logging, so chains can be analysed for smart descriptions                                                                       | Jack: "tie deeply into the logging/go error handling" | request errors only                              |
| D4  | One id per distinct cause (roughly 60 to 80)                                                                                                                                             | each cause has its own fix                            | per call site, broad codes                       |
| D5  | Message composition: what from the outermost catalog error, why and fix from the deepest catalog cause                                                                                   | the fix lives where the cause is known                | deepest only, outermost only                     |
| D6  | Every shown error gets an incident id, a structured slog line with its full chain, and a row in an errors table; Settings lists them with counts (see D12)                                       | understand error paths later                          | slog only, table only                            |
| D7  | The student sees a collapsed Details link with the chain's ids and the incident id, copyable                                                                                             | quiet when tired, there for bug reports               | incident id only, nothing                        |
| D8  | A general linter (frontend and backend) lands first as its own change; this change then adds a lint rule that handlers return only catalog errors, plus the internal.unexpected fallback | Jack's sequencing                                     | this first with a test guard, both in one change |
| D9 | Each entry names at most one typed action from a fixed set (retry, open_settings, open_book, ...); the UI renders it as a button | the student clicks instead of hunting | text only |
| D10 | Field validation errors get catalog ids but render short: one line under the field, no why or Details | still in the table and counted, not heavy | full entries, outside the catalog |
| D11 | Background failures (import reason, homework Failure, jobs error, model usage rows) move to catalog ids in this change, with a migration | one vocabulary, no half-state | two phases |
| D12 | The errors table keeps everything until cleared; Settings gets a section to see the errors and clear them | Jack: "forever, but you can clear them. make a space on the settings page to see them" | 90 days, last 1000 rows |

## Reversals

## Disagreements

- D8 sequencing: recommended this change first and the linter after (avoid touching ~130 sites twice). Jack chose the linter first. Recorded, not re-argued.

## Frontier

Parked after batch 2. Resume here once `lint-everything` has merged into dev (rebase this branch first).

- F5b (delivery, medium) Settings errors section: what it lists (grouped by id with counts, or newest first), clear all vs per id.
- F1 (gate: shape, high) How an error looks: one ErrorNotice with what / why / fix plus an action button, inline vs flash vs toast per surface. Show live mockups on /views from real components (no ASCII).
- F6 (delivery, medium) The lint rule's shape. Linter: golangci-lint v2.14.0 (go.mod `tool`), `.golangci.yml` on `lint-everything`, every rule an error, nolint needs linter + reason. The "handlers return only catalog errors" rule: a golangci-lint module plugin (`golangci-lint custom`) or a go/analysis analyzer it loads. Draft for wrapcheck and errorlint (left off by the linter for this change), measured 2026-10-09 on `lint-everything`:

  ```yaml
  run:
    relative-path-mode: gomod
  linters:
    enable: [wrapcheck, errorlint] # added to the existing list
    settings:
      wrapcheck:
        ignore-package-globs: [github.com/jackt/pset/*] # our own errors already carry their id
        # ignore-sigs: add the catalog constructors (errs.Wrap, errs.New) once named
      errorlint: { errorf: true, asserts: true, comparison: true }
    exclusions:
      rules:
        - { path: ^tools/, linters: [wrapcheck] } # dev tools, never seen by a student
        - { path: _test\.go$, linters: [wrapcheck] }
  ```

  Size: plain wrapcheck + errorlint give 472 findings (462 + 10). With the draft: 234 (wrapcheck 224, errorlint 10: 8 `%v` for errors, 1 `==`, 1 type assertion). Wrapcheck by package: homework 75, library 49, db 17, activity 12, update 11, settings 11, jobs 10, llm 9, memory 6, ask 6, usage 5, doc 4, rest small. Most are database/sql, os and encoding/json errors returned bare; those become the catalog's lowest layer (e.g. `db.*`, `file.*`).

- F8 (note) Names on `lint-everything` to use in the catalog: `llm.LLMError` is now `llm.CallError`; `usage.UsageRow`/`UsageTotal` are `Row`/`Total`; `homework.HomeworkChanged`/`HomeworkRemoved` are `SetChanged`/`SetRemoved`. revive error-strings is on: Go error strings start lowercase with no trailing period, so the catalog's display copy (sentences) must live in catalog entries, never in `error.Error()` text. errcheck is on, with new `internal/cleanup` (logs Close failures) and `internal/testx`. A `StopSubject` error now aborts the delete or rewrite that called it.
- F7 (tail) What would make Jack regret this in a month; what he'd cut if halved.

## Log

### Gate 0, audit

Today: one wire shape {code, message, field?, id?}; 10 broad codes; ~130 sites write their own message, some leak %v; background failures (homework Failure, import Reason, jobs Error, llm classify) bypass it; inline text plus one flash banner. No per-cause id, rarely why or fix.
Jack: "ok" (no corrections).

### Batch 1

- Q1 ID scheme: Dotted names (Recommended) / Numeric codes / Both. Answer: "Dotted names (Recommended)"
- Q2 Source: Go catalog, generated (Recommended) / Data file (YAML) / Frontend owns copy. Answer: "Go catalog, generated (Recommended)"
- Q3 Scope: Everything a student sees (Recommended) / Request errors only. Answer: "every error. it should tie deeply into the logging/go error handling systems and architecture, and enable deep understanding of error paths with chain analysis for smart descriptions"
- Q4 Granularity: One per cause (Recommended) / One per call site / Keep broad codes. Answer: "One per cause (Recommended)"

### Batch 2

- Q5 Chain: Outer what, deepest why/fix (Recommended) / Deepest wins entirely / Outermost wins. Answer: "Outer what, deepest why/fix (Recommended)"
- Q6 Logging: slog + errors table (Recommended) / slog only / Errors table only. Answer: "slog + errors table (Recommended)"
- Q7 Unknown: Fallback + test guard (Recommended) / Fallback only / Lint forbids it. Answer: "I want to add a linter anyways for both the frontend and the backend so our code is pretty and standard. Should we do this now or should I do that first in a different change session?"
- Q8 Details: Collapsed details (Recommended) / Only the incident id / Nothing. Answer: "Collapsed details (Recommended)"
- Q9 Linter: This first, linter after (Recommended) / Linter first, then this / Both in this change. Answer: "Linter first, then this"

### Batch 3 (resumed 2026-10-09 after lint-everything merged as #32)

- Q10 Actions: Yes, typed actions (Recommended) / Text only. Answer: "Yes, typed actions (Recommended)"
- Q11 Fields: Catalog ids, short form (Recommended) / Full entries / Outside the catalog. Answer: "Catalog ids, short form (Recommended)"
- Q12 Phasing: All in this change (Recommended) / Two phases. Answer: "All in this change (Recommended)"
- Q13 Retention: 90 days, no secrets (Recommended) / Forever / Last 1000 rows. Answer: "forever, but you can clear them. make a space on the settings page to see them"

## Mockups for F1 (builder brief)

Live mockups on `/views`, built from existing components only (design/design-system.md), sample data, no backend. One new view entry `error-notice` in web/src/views/registry.ts with these states, each a selectable variant:

Sample error everywhere: importing "Calculus" failed. Chain `import.failed` -> `key.out_of_credit` -> HTTP 402. What: "Couldn't prepare Calculus." Why: "Your OpenRouter account is out of credit, so PSet can't read the pages." Fix: "Add credit on OpenRouter, then try again." Action button: "Try again". Details (collapsed): ids `import.failed`, `key.out_of_credit`, incident `E7K2QF`, a Copy button.

- A. Inline block: the notice sits where the failure happened (in place of the book's card or row): what in the body weight, why and fix as quiet lines, the action button, a small Details link.
- B. Banner: the same content in the flash banner at the top of the screen, for request errors; background rows show a one-line summary that opens it.
- C. Toast plus dialog: a short toast (what + action), and "More" opens a dialog with why, fix and Details.
- Field short form: the "A book needs a title." line under the title field (one line, no Details).
- Settings errors section: a table of past errors (time, what, id, incident, count), a Clear all button. Two sample groupings side by side: newest first, and grouped by id with counts.

Every state in Paper and Night. Mockup code only (no Go, no wire changes). Do not add the mock to /components.
