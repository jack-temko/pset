# Error catalog: grill

- status: built
- date: 2026-10-09
- brief: one table of every error PSet can show (stable id to what happened, why, how to fix), shown the same way everywhere; judged from the tired student's point of view
- sources: internal/httpx/{httpx,wire,handle}.go, internal/llm/llm.go, internal/settings/service.go, internal/homework/wire.go, internal/library/{import,wire}.go, internal/jobs/jobs.go, web/src/api/client.ts, design/backend.md "Errors", design/import.md, design/model-usage.md, web/src/components/flash

## Summary

### In one line

Every error PSet can show has a dotted id with what happened, why and how to fix it, raised through Go's error chain, logged and kept, and shown the same way everywhere, so a tired student knows what went wrong and what to click.

### Decisions

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Why                                                                                              | Beat                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| D1  | Ids are dotted names per area (`key.out_of_credit`, `book.duplicate`)                                                                                                                                                                                                                                                                                                                                                                                              | readable in code, logs and bug reports                                                           | numeric codes, both                                   |
| D2  | Errors are declared where they are used: a tiny `errs` package defines the entry type, each package lists its own entries in its `errors.go`, and a generator collects them into one table, the TS types and a docs page. An error raised in more than one package is owned by the lowest package that detects the cause (`llm` owns `key.*` and `model.*`; `errs` owns `internal.*`); others wrap it, never redeclare it. A test fails on duplicate or unused ids | low upkeep, no hub every package imports, no shared-error edge cases                             | one central file (first chosen, then amended by Jack) |
| D3  | Every error is in scope, tied into Go error wrapping and logging, so chains can be read for smart descriptions                                                                                                                                                                                                                                                                                                                                                     | Jack: "tie deeply into the logging/go error handling"                                            | request errors only                                   |
| D4  | One id per distinct cause (roughly 60 to 80); a new id only when its fix differs                                                                                                                                                                                                                                                                                                                                                                                   | each cause has its own fix; keeps the table small                                                | per call site, broad codes                            |
| D5  | What comes from the outermost catalog error, why and fix from the deepest catalog cause                                                                                                                                                                                                                                                                                                                                                                            | the fix lives where the cause is known                                                           | deepest only, outermost only                          |
| D6  | Every shown error gets an incident id, a structured slog line with its full chain, and a row in an errors table                                                                                                                                                                                                                                                                                                                                                    | understand error paths later                                                                     | slog only, table only                                 |
| D7  | A collapsed Details link shows the chain's ids and the incident id, with Copy                                                                                                                                                                                                                                                                                                                                                                                      | quiet when tired, there for bug reports                                                          | incident id only, nothing                             |
| D8  | The linter landed first (#31, #32); this change turns on wrapcheck and errorlint and adds a golangci-lint rule that handlers return only catalog errors, plus an `internal.unexpected` fallback                                                                                                                                                                                                                                                                    | Jack's sequencing                                                                                | this first with a test guard                          |
| D9  | Each entry names at most one typed action from a fixed set (retry, open_settings, open_book, ...), rendered as a button                                                                                                                                                                                                                                                                                                                                            | the student clicks instead of hunting                                                            | text only                                             |
| D10 | Field validation errors get ids but render as one line under the field, no why or Details                                                                                                                                                                                                                                                                                                                                                                          | in the table, not heavy                                                                          | full entries, outside the catalog                     |
| D11 | Background failures (import reason, homework Failure, jobs error, model usage rows) move to catalog ids in this change, with a migration                                                                                                                                                                                                                                                                                                                           | one vocabulary, no half-state                                                                    | two phases                                            |
| D12 | The errors table keeps everything until cleared; a Settings section lists errors grouped by id (count, last time), expandable to each incident, with one confirmed Clear all                                                                                                                                                                                                                                                                                       | Jack: "forever, but you can clear them"                                                          | 90 days, 1000 rows, newest first, per-row clear       |
| D13 | Placement: the notice sits inline where the failure belongs (row, question, dialog); the flash banner only for screen-wide blocks (no key, server unreachable); no toasts                                                                                                                                                                                                                                                                                          | nothing vanishes while the student looks away                                                    | banner for all, toast plus dialog                     |
| D14 | The builder drafts all entry copy; no review gate; the PR lists the entries it is least sure of for Jack to revisit                                                                                                                                                                                                                                                                                                                                                | Jack: "highlight the possible trouble ones"                                                      | review gate before merge                              |
| D15 | Ship it whole, in reviewable commits                                                                                                                                                                                                                                                                                                                                                                                                                               | the parts lean on each other                                                                     | cut Settings section or lint rule                     |
| D16 | Upkeep is a requirement: adding an error is one entry plus its use; nothing hand-copied into TS; no new runtime dependency; the table stays small (D4)                                                                                                                                                                                                                                                                                                             | Jack: "doesn't become a hassle to upkeep ... without hidden dependencies, and getting too large" | none                                                  |

### The artifacts

- Mockups: `/views/error-notice` (scenarios inline, banner, toast, field, settings). Inline (A) and the Settings table are the chosen shapes; banner (B) stays only for screen-wide errors; toast (C) is dropped. Known mockup flaws to fix in the build: the side notes squeeze on wide states; the Settings time column overlaps.
- The student sees, inline: **what** (one line, body weight), **why** and **fix** (quiet lines), one action button, a small Details link (ids + incident id, Copy).
- Wire: `{code, message, field?, id?}` grows into `{id, what, why, fix, action?, field?, ref?, incident, chain[]}`; `code` is replaced by `id`. Generated TS as today.
- Lint draft (measured 2026-10-09): wrapcheck with `ignore-package-globs: [github.com/jackt/pset/*]`, tools/ and tests excluded, plus errorlint: 234 findings (224 + 10), mostly bare database/sql, os and encoding/json errors in homework (75) and library (49).

### Assumed

- A1: Go `error.Error()` strings stay lowercase without periods (revive); student-facing sentences live only in catalog entries.
- A2: The errors table stores incident id, chain of ids, Go error text, route or job, book/set/question ids and time; never keys, prompts or answers.
- A3: The generated docs page sits on `/components`-style dev pages as `/errors`, read-only.
- A4: The lint rule is a go/analysis analyzer loaded as a golangci-lint module plugin; if that proves heavy, a Go test that walks handler returns does the same job.
- A5: Use the post-lint names: `llm.CallError`, `usage.Row`/`Total`, `homework.SetChanged`/`SetRemoved`.

### Open

Nothing blocking.

## Reversals

## Disagreements

- D2: recommended per-package declarations for upkeep; Jack first kept one central file, then said: "If you truly can keep them separated without weird error edge cases where more than one part needs it than you can keep the errors where they are used." Settled per package with an ownership rule for shared errors.

- D8 sequencing: recommended this change first and the linter after (avoid touching ~130 sites twice). Jack chose the linter first. Recorded, not re-argued.

## Frontier

Empty: finished.

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

### Batch 4 (F1 mockups)

- Q14 Placement: Inline, banner for screen-wide (Recommended) / Banner for everything / Toast plus dialog. Answer: "Inline, banner for screen-wide (Recommended)"
- Q15 Settings: Grouped by id, expandable (Recommended) / Newest first. Answer: "Grouped by id, expandable (Recommended)"
- Q16 Clear: Clear all, confirmed (Recommended) / Clear all and per row. Answer: "Clear all, confirmed (Recommended)"

### Batch 5 (tail)

- Q17 Copy: I draft, you review the table (Recommended) / I draft, no review gate. Answer: "you draft, no review gate. highlight the possible trouble ones and we can go back and fix if needed"
- Q18 Cut: Nothing, ship it whole (Recommended) / Settings errors section / Lint rule. Answer: "Nothing, ship it whole (Recommended)"
- Q19 Regret: No, write the spec (Recommended) / Yes. Answer: "I want to make sure that this doesn't become a hassle to upkeep. It should be as useful as possible to the student, without introducing hidden dependencies, and getting too large."
- Q20 Upkeep (reopens D2): Per package, one generated table (Recommended) / One central file (as decided). Answer: "One central file (as decided)", then in a follow-up message: "If you truly can keep them separated without weird error edge cases where more than one part needs it than you can keep the errors where they are used."
