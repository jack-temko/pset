# Error catalog: grill

- status: grilling (parked 2026-10-09 until the linter change lands)
- date: 2026-10-09
- brief: one table of every error PSet can show (stable id to what happened, why, how to fix), shown the same way everywhere; judged from the tired student's point of view
- sources: internal/httpx/{httpx,wire,handle}.go, internal/llm/llm.go, internal/settings/service.go, internal/homework/wire.go, internal/library/{import,wire}.go, internal/jobs/jobs.go, web/src/api/client.ts, design/backend.md "Errors", design/import.md, design/model-usage.md, web/src/components/flash

## Summary

(written at the end; decisions so far)

| # | Decision | Why | Beat |
|---|---|---|---|
| D1 | Ids are dotted names per area (`key.out_of_credit`, `book.duplicate`) | readable in code, logs and bug reports | numeric codes, both |
| D2 | The catalog is one Go file; the server sends id plus params; TS types and a docs page are generated from it | one place to edit | YAML data file, frontend-owned copy |
| D3 | Every error is in scope, tied into Go error wrapping and logging, so chains can be analysed for smart descriptions | Jack: "tie deeply into the logging/go error handling" | request errors only |
| D4 | One id per distinct cause (roughly 60 to 80) | each cause has its own fix | per call site, broad codes |
| D5 | Message composition: what from the outermost catalog error, why and fix from the deepest catalog cause | the fix lives where the cause is known | deepest only, outermost only |
| D6 | Every shown error gets an incident id, a structured slog line with its full chain, and a row in an errors table; a dev page lists them with counts | understand error paths later | slog only, table only |
| D7 | The student sees a collapsed Details link with the chain's ids and the incident id, copyable | quiet when tired, there for bug reports | incident id only, nothing |
| D8 | A general linter (frontend and backend) lands first as its own change; this change then adds a lint rule that handlers return only catalog errors, plus the internal.unexpected fallback | Jack's sequencing | this first with a test guard, both in one change |

## Reversals

## Disagreements

- D8 sequencing: recommended this change first and the linter after (avoid touching ~130 sites twice). Jack chose the linter first. Recorded, not re-argued.

## Frontier

Parked after batch 2. Resume here once the linter change has merged into dev (rebase this branch first).

- F1 (gate: shape, high) How an error looks: one ErrorNotice with what / why / fix plus an action button, inline vs flash vs toast per surface. Show live mockups on /views from real components (no ASCII).
- F2 (shape, high) Catalog entries carry a machine action (open Settings, Retry, go to the book) that the UI renders as a button?
- F3 (behavior, high) Field validation errors: full catalog entries or a short form with just a message by the field?
- F4 (behavior, medium) Background surfaces (import Reason, homework Failure, jobs Error, model usage red rows) migrate to catalog ids: all now, or in phases?
- F5 (delivery, medium) Errors table: schema, retention, what context is stored (no keys or prompt text), dev page location (/errors next to /components?).
- F6 (delivery, medium) The lint rule's exact shape, given what the linter change picked.
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
