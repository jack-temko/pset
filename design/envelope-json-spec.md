# JSON envelopes — schema validation + repair loop (v2)

Grilled and decided 2026-09-14. Supersedes the "Element envelopes (v1)"
syntax/streaming/prompt sections of `ask-redesign-spec.md`; that spec's UX,
layout, and citation rules carry over unchanged.

## Principle

The codeblock form exists only while an answer is streaming from the model.
The engine parses it out of the stream; everything downstream — the SSE wire,
the stored conversation, the web renderer — sees structured data that
represents what the message is: ordered prose and typed, schema-validated
envelope payloads. No layer after the engine ever parses a fence.

## Model-facing format

Fenced code block, language tag names the kind (no `kind` field inside the
JSON — the tag picks the schema):

````
```equation
{"title":"Bayes' theorem",
 "equations":["P(A\\mid B) = \\frac{P(B\\mid A)\\,P(A)}{P(B)}"],
 "note":"posterior is proportional to likelihood times prior"}
```
````

v1 kinds unchanged: `equation`, `steps`, `theorem`, `definition`, `note`.
`graph` stays deferred to v2 of the redesign. No nesting; unknown fence tags
still degrade to plain code blocks in the UI.

## Payload schemas

Authored once as JSON Schema (draft 2020-12) files in
`internal/engine/schemas/`, `go:embed`-ded into the binary. The engine
validates with them; repair prompts quote the failing schema verbatim.
`additionalProperties: false` everywhere so validation has teeth. Sane
`maxLength`/`maxItems` caps (implementer's judgment, documented in the
schema files).

- `equation`: `{title: string, equations: string[] (≥1, each nonempty), note?: string}`
- `steps`: `{title: string, steps: string[] (≥1, each nonempty), note?: string}`
- `theorem`: `{title: string, statement: string, note?: string}`
- `definition`: `{title: string, statement: string, note?: string}`
- `note`: `{title: string, body: string[] (≥1, each nonempty)}`

**LaTeX semantics (this is the fix for the smooshed-fraction and runaway-`$$`
bugs):** `equations[]` entries are bare TeX rendered with KaTeX
`displayMode: true` — no `$$` delimiters exist anywhere, so there is nothing
to mis-pair. Text fields (`title`, `statement`, `steps[]`, `body[]`, `note`)
may carry inline `$…$` math and `[p. N]` citations, rendered exactly like
prose today (inert chips, emitted only when the cited page changes).

## Engine pipeline (mid-stream)

The engine consumes the model's streamed text and re-emits typed events:

1. Prose passes through as text deltas.
2. A fence with a known kind tag opens → emit `envelope-start {kind}`; the
   client shows the shaped skeleton ("Writing an equation…").
3. Closing fence arrives → extract payload, `json.Unmarshal`, validate
   against the kind's schema.
4. **Repair loop** — triggers on JSON parse failure or schema violation
   only (LaTeX content is never inspected; a non-empty string is valid):
   one targeted, non-streaming LLM call carrying the kind, the invalid
   payload, the validator's error list, and the schema verbatim; the model
   returns corrected JSON only. Re-validate; on success emit the envelope.
   Emit `envelope-repairing {kind}` when the round starts so the skeleton
   label can swap ("Tidying an equation…").
5. Still invalid, or the repair call errors/times out → `envelope-failed
   {kind, raw}`; the client renders the raw payload as a muted code block.
   Nothing is ever dropped.
6. Abort mid-envelope → emit `envelope-failed` with whatever arrived; the
   muted code block shows it.

Repair uses the same model and connection config as ask (no new config
knob). Worst case is one extra LLM round trip per envelope.

## Wire contract (api layer)

The ask SSE stream becomes typed events (names above are the contract):
status events (Thinking / Reading pages / typing — one status area, per the
redesign spec), `delta` (prose), `envelope-start`, `envelope-repairing`,
`envelope {kind, payload}` (validated), `envelope-failed {kind, raw}`, plus
the existing done/error/citation behavior. Pages-cited extraction moves
into the engine and runs over prose plus envelope text fields.

## Persistence (store layer)

Completed answers persist as an ordered segment list —
`[{type:"prose", text}, {type:"envelope", kind, payload}, …]` — not raw
model text. What is stored is exactly what the user saw, repairs included.
Replay is render-only. Storage shape (column vs. JSON blob vs. table) is
the store layer's call per its README.

**Existing conversations are deleted, not migrated.** They were test data
with known rendering issues (user call, 2026-09-14). The store migration
that introduces segment-list messages clears existing conversations. There
is no legacy format anywhere: `web/src/lib/envelopes.ts` and its tests are
deleted, and the messages API speaks segments only.

## Prompt contract (backend)

Rewrite the envelope instructions in the ask system prompt: fenced
`\`\`\`kind` blocks containing only a JSON object of the kind's shape, one
worked example per kind (schema examples double as prompt examples),
no nesting, unknown tags fall back to code blocks, `[p. N]` citations only
inside text fields. The prompt lands in the same change as the pipeline —
the repair loop must never be the primary path.

## Testing (one-layer rule)

- **store**: segment-list persistence round-trip; the migration clears
  existing conversations.
- **engine** (deterministic, fake LLM): stream extraction (open/close/abort,
  unknown tags), validation matrix per kind (each schema rule), repair loop
  (repairable, unrepairable, erroring repair call), typed event ordering,
  pages-cited extraction over segments.
- **api**: SSE wire contract — event sequence and shapes; messages endpoint
  returns segments.
- **web**: rendering each kind from typed events, skeleton label swap,
  `envelope-failed` degrade.
- **Costly tier (`llm` tag)**: prompt conformance — the real model emits
  schema-valid envelopes across all five kinds; a deliberately broken
  payload survives one repair round.

## Deferred

- Graph element (v2 curated-family form), unchanged.
- Client-side KaTeX render feedback as a second repair trigger.
- History search, conversation export.
