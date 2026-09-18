# Ask page redesign — spec (v1)

Grilled and decided 2026-09-14. Mock lives at `/ask2` (stub data, no backend);
after approval it replaces `/ask` wholesale.

## Landing

- CTA above a centered composer: **"What do you want to learn?"**
- Book selection is a **chip inside the composer** that opens a picker
  (cover minis, clamped titles). **No default book**: typing is free, the
  Ask button stays disabled until a book is picked.
- No starter suggestions — users arrive mid-problem, they know their question.

## History

- One home for history: **left rail on desktop, drawer on mobile** (opened
  from the header). Same list in both.
- Flat list sorted by last activity, newest first.
- **Pinned** section at the top, rendered only when something is pinned.
- Row anatomy: conversation title (truncates), cover-color dot + book title
  (clamps, one line), relative time. Actions on hover/focus: pin toggle,
  inline rename, delete (with confirm).
- Relative times: `just now`, `7m ago`, `3h ago`, `yesterday`, `5d ago`,
  then `Mar 3` style dates.

## Messages

- **Bubbles for both roles.** A plain text answer looks shaped like the
  user's bubble; answers render on paper (card) rather than ink.
- Rich blocks the answer bubble can host (backend prompt adapts later):
  - **Equation block** — title, one or more equations (KaTeX), optional note.
  - **Step-by-step solution** — numbered reasoning steps.
  - **Theorem / definition cards** — textbook-native cards with page chip.
  - **Graph + slider** — deferred to v2 (see Element envelopes below).
- Once a conversation starts, its book is locked: the dock composer shows a
  static book label, not the picker. The picker only exists on the landing
  composer.
- Under each answer: copy button directly below the bubble, then the
  **Pages cited** strip.
- **Citations**: inline `[p. N]` chips are fully inert (not links). A chip is
  emitted **only when the cited page changes** within a message — no repeated
  `p. 60` seven times in a row.
- **Pages cited** strip under each answer: small real page thumbnails with a
  page badge; clicking one opens the reader at that page (live in the real
  build; inert in the mock).
- **Copy** on every message, sent and received: always-visible small button,
  "Copied" flash. Answers copy raw markdown; user messages copy plain text.
- **Streaming**: exactly one status area per answer — Thinking → Reading
  pages N, M → typing cursor. Never two spinners for one thing.

## Element envelopes (v1)

The protocol the backend prompt and the web renderer share, decided
2026-09-14.

### Syntax

An envelope is a **fenced code block whose language tag names the kind**,
extending the existing theorem/definition callout convention:

````
```equation
Bayes' theorem
P(A\mid B) = \frac{P(B\mid A)\,P(A)}{P(B)}
> posterior is proportional to likelihood times prior
```
````

- **v1 kinds:** `equation`, `steps`, `theorem`, `definition`, `note`.
  `graph` is **deferred to v2**, where the model fills a curated-family
  form (gaussian / beta / sine / line + params + slider) rather than
  writing free expressions.
- **Payload grammar — line protocol:** line 1 is the title; the remaining
  lines are content (TeX lines for equations, one sentence per step); a
  trailing `> …` line is the optional note. No JSON, no key:value.
- Citations `[p. N]` are allowed inside envelopes and follow the same
  inert-chip, changed-page-only rendering as prose.
- Prompt rule: envelopes never nest; content containing triple backticks
  is not allowed inside v1 kinds.

### Streaming

Parsing is client-side over the existing SSE delta stream:

1. While the buffer ends inside an **unclosed fence with a known kind
   tag**, everything from that fence is held back from prose rendering and
   shown as a **shaped glimmer skeleton** with a label — equation: a
   centered shimmer bar; steps: stacked shimmer lines; theorem/definition:
   a card outline. Labels in the app voice ("Writing an equation…").
2. When the closing fence arrives, the skeleton swaps for the parsed
   element.
3. **Abort mid-envelope:** whatever arrived renders as a muted plain code
   block — nothing silently disappears.
4. **Unknown fence tag or unparseable payload:** render as a plain code
   block. Never an error chip, never dropped.

### Prompt contract (backend)

The system prompt enumerates the kinds with one worked example each, when
to reach for each (equation for any displayed math longer than inline,
steps for multi-step reasoning, theorem/definition when the book states
one), the line protocol, the no-nesting rule, and that unknown tags fall
back to code blocks in the UI.

## Carried-over behavior

- Reader deep link "ask about page N" lands as a chip in the composer.
- Opening an old conversation locks its book; changing books mid-thread
  starts a new conversation.

## Layout rules

- Mobile-first: base layout at ~390px, enhanced upward. Desktop adds the
  persistent (collapsible) rail and a wider transcript column.
- Long book titles clamp everywhere (`min-w-0` + `line-clamp`/truncate);
  nothing overlaps or overflows.
- Prose follows the app voice: plain, warm, no AI-tell phrases.

## Data model (real build)

- `conversations` gains `last_activity_at` (touched on every message append)
  and `pinned` (boolean). Migration adds both columns.
- API: list returns both fields; rename and pin go through a conversation
  update endpoint.

## Deferred

- Backend prompt changes to emit the v1 envelopes (equation, steps,
  theorem, definition, note).
- Graph element in v2, as a curated-family form, not free expressions.
- History search, conversation export.

## Testing

- Envelope parser (deterministic, web): open fence → skeleton, close →
  swap, abort → muted code block, unknown tag → code block, line-protocol
  payloads for each kind, citation chips inside envelopes.
- Store/API tiers unchanged (lastActivityAt, pinned, rename per the data
  model above); prompt conformance lives in the costly tier.
