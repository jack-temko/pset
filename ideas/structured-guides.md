# Structured guides

## Status

**Planned** (grilled 2026-09-28), not started. Replaces the envelope
format (design/backend.md, "Cards (envelopes)") for Ask answers and
homework guides alike. When it ships, design/backend.md and
design/workspace.md take the spec and this file is marked Done.

## Information

### Why

Guides and Ask answers render red and garbled. Assignment #5 (the
phone-plan problems 3.6.6 and 3.7.8) had 21 formulas KaTeX could not
parse, all from one cause: the model writes money as math, `$\$20$`,
and remark-math closes the math at the `$` right after the backslash.
The math is then just `\` (red), and the leftover `20$` pairs with the
next `$` further on, turning whole sentences into italic math. The
prompt invites it ("every symbol ... goes in $...$"), nothing checks
prose, and KaTeX's `throwOnError: false` paints what fails in red.

A second problem hides behind the first: the model is already trying
to write structure the format has no room for. 78 of 283 stored
paragraphs open with a bold lead-in that is really a heading:
`**Step 1 — convert the three parallel pairs.**`, `**Part (a): ...**`,
`**Check.**`, `**Answer.**`. The hint and walkthrough themselves are
found by `## Hint` / `## Walkthrough` headings in the prose.

The fix is a document the model writes as typed blocks, which the
server checks, repairs and stores, and which the UI renders without
parsing anything. The look comes from the phone-plan walkthrough made
on 2026-09-27 (claude.ai artifact "Phone Plan Sums"), which Jack
liked: it reads like a textbook, but an intuitive one.

### Decided (2026-09-28)

- **One schema for Ask and homework guides.** One block vocabulary, one
  checker and repair loop, one renderer. Ask uses everything but `hint`
  and `answer`.
- **The model writes JSON lines**: one block per line, in the reply's
  content, after its tool calls. Not a final "write" tool call (it
  arrives all at once, one bad field sinks the whole document, and
  Z.ai's `tool_choice` only takes `auto`, so it can't be forced). Not
  provider JSON mode either (Z.ai offers only `json_object`, one object
  per reply, and warns it makes writing less natural).
- **Text is written as strings, stored as runs.** The model writes
  inline math as `\(...\)`; a `$` is always a dollar sign. The server
  splits each text field into runs at validation, and runs are what is
  stored and sent. The renderer parses nothing. Measured on the stored
  walkthroughs: `\(...\)` strings cost about 1.1× the tokens of `$...$`,
  runs written by the model about 1.6×, so the model never writes runs.
- **Inline marks**: math `\(...\)`, citations `[p. N]`, `**bold**`,
  `*italic*`, `` `code` ``. Nothing else from markdown: lists, headings,
  quotes and links either are blocks or aren't allowed.
- **Flat markers.** `part` and `step` are markers like headings:
  everything after one belongs to it until the next. The renderer
  builds the tree.
- **Blocks beyond today's cards**: `part`, `step`, `callout`, `answer`,
  `note`, `hint`. Named sub-moves were considered and dropped: a
  `derivation` with a "why" on each line does that job.
- **Three veils**: Hint · Walkthrough · Answers. Answers collects every
  part's `answer` block, so a student can check paper work without
  seeing the working. Each answer also shows in place at the end of its
  part.
- **The check runs in the server, with goja** (a pure-Go JavaScript
  engine) running the web app's own KaTeX build: the exact parser the
  browser uses, so they can never disagree. A Go checker built from
  KaTeX's command list and server-rendered MathML (TreeBlood) were
  weighed and passed over: the first misses rarer errors, the second is
  young, weakest in Chromium and changes the look.
- **A line that isn't JSON is repaired**, not salvaged as a paragraph.
- **Whole-document checks**: a guide has a hint, and every part has an
  answer.
- **One text format everywhere**: a question's statement, the
  professor's notes and the figure reading are runs too.
- **The look** (see "Look" below): the part header's blue eyebrow over a
  big Newsreader title, Newsreader step titles, callouts on status
  `*-soft` tints, the answers card, guide prose at `text-reading`, notes
  small and muted. No new font, and nothing a person reads in mono.
- **The prompt teaches the look**: a writing guide that knows how each
  block renders, plus a compact worked example.
- **When it ships, the old guides and Ask answers are deleted**, not
  converted: most are broken in some way. Books, homework sets,
  questions, statements, due dates and Complete marks stay. Guides are
  **not** rewritten automatically: each question offers "Write the
  guide" until asked.

### The document

A document is an ordered list of blocks. On the wire and in storage
each block is an object with a `type`; text fields hold **runs**. The
model writes the same blocks with plain strings in those fields.

| Block | Model writes | Notes |
|---|---|---|
| `hint` | `text` | Guides only, first, exactly one. One or two sentences. |
| `part` | `label`, `title` | A labeled part of the problem: `"(a)"`, `"3.6.6"`. |
| `step` | `title` | The renderer numbers steps, restarting in each part. |
| `para` | `text` | Prose. |
| `note` | `text` | An aside: small, muted. A sanity check, a "why not the other way", a tidbit. |
| `math` | `tex` | Display math, bare TeX, no delimiters. |
| `derivation` | `steps: [{tex, why?}]` | Today's `steps` card: one line of TeX per step, an optional one-sentence reason. |
| `callout` | `tone`, `title?`, `text` | `insight` (why it's obviously right), `caveat` (a common slip), `check` (verify your work). |
| `statement` | `kind`, `number`, `name?`, `page`, `text` | A definition or theorem as the book states it. As today. |
| `table` | `columns`, `rows` | Cells and headers are text. As today. |
| `plot` | `title?`, `x`, `y`, `series`, `marks?` | As today (series are expressions sampled by `mathx`, or points), plus `marks`: labeled points `{x, y, label?}` and vertical guides `{x, label?}`. |
| `code` | `language`, `code` | As today. |
| `answer` | `label?`, `text` | Guides only. The final result of its part, which is its label; one without a part is the whole problem's. |

Runs:

```json
[{"t": "since $1 a minute turns "}, {"m": "1/p"}, {"t": " minutes into dollars "},
 {"cite": 108}, {"t": ". "}, {"t": "That's the only reason", "b": true}]
```

- `{t}` text, with `b` (bold), `i` (italic) or `code` flags.
- `{m}` inline math, TeX without delimiters.
- `{cite}` a PDF page (the model cites printed pages; the split moves
  them, the way `cards.Cite` does now).

Each block's JSON Schema is embedded as today (`additionalProperties:
false`), one per type, and the Go wire types are generated into TS by
tygo.

### Writing and checking a block

The model's reply streams through a new parser in `internal/cards`
(rename it, e.g. `internal/doc`, if it reads better). For each line:

1. **Open.** As soon as `{"type":"<t>"` has arrived, emit
   `block.start {type}`: the UI draws that block's skeleton. For a text
   block (`para`, `note`, `callout`, `hint`), stream the open text field
   as it arrives: text words go out as they come, and a math run goes
   out whole once its `\)` has closed.
2. **Close.** A line that parses as one JSON object is a block. A line
   that doesn't parse and isn't an unfinished object continuing onto the
   next line is **not JSON**: it goes to repair ("rewrite this as
   blocks").
3. **Check**, in order:
   1. **Schema** for its type.
   2. **Split** each text field into runs:
      - `\(...\)` becomes math.
      - A `$...$` the model wrote anyway is converted first by the
        strict pandoc rule: an opening `$` has a non-space after it, a
        closing `$` has a non-space before it and no digit after it, and
        `\$` inside math is a dollar sign. Math that is only money
        (`$\$20$`) becomes the text "$20".
      - `\textit{..}` and `\textbf{..}` outside math become italic and
        bold (4.25's `\textit{PSpice}`, in ideas/loose-ends.md).
      - `[p. N]` becomes a citation, and `**`, `*` and backticks become
        flags.
   3. **Math**: every math run, `tex` field and derivation line must
      parse in KaTeX (goja, below). A stray `\` or a delimiter left in
      plain text is a failure too.
   4. **Citations**: every page is in the book.
4. **Repair**, targeted, at most two tries per failure and six repair
   calls per document:
   - A bad math run sends only that span and KaTeX's message ("fix
     `\tfrac{1}{2}(10.85) \approx \`: Unexpected character '\'"), and
     splices the answer back.
   - A bad block sends the block, its schema and the problems.
   - Repair calls use `reasoning_effort: "low"`: they are small and
     mechanical.
   - The UI's label is "Tidying" while a repair runs, as today.
5. **Emit** `block {block}`, which replaces the skeleton. If it is
   still bad after repair:
   - A failed math run is kept as a run with `raw: true`, shown as its
     source in muted mono.
   - A failed block becomes `raw {type, text}`, shown muted.
   - Nothing renders red, and nothing is dropped.

When the document ends, the whole-document checks run:

- A guide with no `hint` gets one call: "write the hint".
- A `part` with no `answer` gets "write the answer for (b)", with that
  part's blocks as context.

Both go through the same block checks.

**KaTeX in Go.** A small entry in `web/` (e.g. `src/lib/katex-check.ts`)
bundles KaTeX into one IIFE with a single function, `check(tex,
display) -> error message | ""`, with the same options the renderer
uses. The build writes it where Go can `//go:embed` it; goja loads it
lazily, once, and a test fails if the embedded KaTeX version differs
from `web/package.json`. goja runs only this pure function: no file,
network or timer access is given to it.

### Streams and storage

- Ask events replace `turn.delta` and `turn.card*`:
  - `turn.block.start {turnId, type}`
  - `turn.block.text {turnId, runs}`: the open text block's new runs
  - `turn.block.repairing {turnId, type}`
  - `turn.block {turnId, block}`
  - `turn.block.failed {turnId, block}`

  The step feed still sits between blocks where tools ran.
- Guides keep `question.stage`, once for the hint and once for the
  whole walkthrough, each as soon as it is complete. The Answers veil is
  derived from the walkthrough's `answer` blocks; it is not a stage.
- A turn's `answer` column and a question's `hint`, `walkthrough`,
  `statement`, `notes` and `reading` hold documents or runs. The wipe
  migration (below) empties the old values.

### Look

In the panel, from the phone-plan page, fitted to design/design-system.md.
Each new or changed component goes on `/components`.

- **Part**: an eyebrow in Inter, `primary` ink, `text-xs` with a little
  tracking ("Problem 3.6.6", "(a)"), over the title in Newsreader at
  `text-2xl`. A hairline above it separates parts. This widens
  Newsreader from "display and leads" to guide headings; the spec's font
  line should say so.
- **Step**: its number in Inter, `primary`, `tabular-nums`, before the
  title in Newsreader at `text-xl`.
- **Para**: `text-reading` (18/30). Inline math slightly larger than the
  text, as on the page.
- **Note**: `text-xs`, `muted-foreground`.
- **Callout**: a 2px status rule on the left, on that status's `*-soft`
  ground. `insight` is success, `caveat` is warning, `check` is muted
  with a border. This is a new use of `*-soft` grounds (so far only
  badges and failed rows); it follows the rule that a status's soft tint
  is its only ground.
- **Math**: centered display, scrolling sideways in its own frame when
  wide.
- **Derivation, statement, table, plot, code**: today's components. The
  plot draws `marks`.
- **Answers card**: a Box, one row per part, the label in `primary` in a
  narrow column, the answer beside it. It is the Answers veil's content
  and also sits at the end of a walkthrough.
- **Raw math run**: its source in muted mono. Raw block: muted, as
  today's failed card.

Labels a person reads are Inter, never mono ("What a person reads is
never mono", design-system.md). No step below 15px.

### The prompt

`cards.Prompt` becomes the document's writing guide, shared by Ask and
guides, with each prompt adding its own part (guides: hint first, an
answer per part; Ask: no hint or answer). It says how each block
**renders**, because that is what the model is writing for:

- **The format.** One JSON object per line, nothing between lines, no
  fences. Inline math is `\(...\)`, with the backslash doubled in JSON
  (`"\\(x^2\\)"`). A `$` is only ever money: write "$20", never math
  around it. Display math is a `math` block, never inline.
- **Inline or display.** A symbol or short expression in a sentence is
  inline. An equation the reader should stop at, or one wider than half
  a line, is a `math` block. A chain of equations is a `derivation`.
- **Which block.** A `note` is for what a reader can skip (a sanity
  check, a "why this and not that", a pattern worth remembering). A
  `callout` is for what they shouldn't skip: `insight` when a result
  has a plain meaning, `caveat` for the slip students make, `check` to
  verify an answer. At most one or two callouts in a guide. A `table`
  compares; a `plot` shows a shape.
- **Naming.** A step's title says what the step does or finds, in
  sentence case, as a short phrase: "Where the sum from 31 comes from",
  "Collect the probability onto each cost". Never "Step 1", never a
  colon. A part's label is the problem's own ("(a)"); its title says
  what the part asks for.
- **Voice.** Like a good textbook, but intuitive. Say what a quantity
  means before manipulating it. Name the trick ("rename, factor out,
  recognize"). After a result, say why it's obviously right. Short
  paragraphs, one idea each. Use the book's notation and its theorem
  numbers, with the page.
- **The worked example**, about 40 lines in the house style, taken from
  the phone-plan walkthrough, placed after the rules. It shows a hint, a
  part, two steps, inline and display math, a derivation, a note, a
  callout and an answer. An opening excerpt:

```jsonl
{"type":"hint","text":"Write the bill as a function of \\(M\\) with two pieces, and let the second piece decide where your sums start."}
{"type":"part","label":"3.7.7","title":"The expected monthly cost"}
{"type":"step","title":"Where the sum from 31 comes from"}
{"type":"para","text":"To average a function of \\(M\\), weight each value by its probability (Theorem 3.10) [p. 90]. Because the bill has two pieces, the sum splits where the formula changes. **That's the only reason one sum stops at 30 and the next starts at 31.**"}
{"type":"math","tex":"E[C] = \\sum_{m=1}^{30} 20\\,p\\,q^{m-1} + \\sum_{m=31}^{\\infty}\\Big(20 + \\tfrac{1}{2}(m-30)\\Big)\\,p\\,q^{m-1}"}
{"type":"callout","tone":"caveat","title":"A common slip: a constant in the second sum","text":"Whatever multiplies \\(p\\,q^{m-1}\\) must be the actual bill for that \\(m\\). Past 30 minutes the bill depends on \\(m\\), so the \\(m\\) stays inside the sum."}
{"type":"step","title":"Collapsing it in three moves"}
{"type":"derivation","steps":[{"tex":"\\sum_{m=31}^{\\infty}(m-30)\\,p\\,q^{m-1} = \\sum_{k=1}^{\\infty} k\\,p\\,q^{k+29}","why":"Rename: let \\(k = m - 30\\), the overage minute."},{"tex":"= q^{30}\\sum_{k=1}^{\\infty} k\\,p\\,q^{k-1}","why":"Factor out \\(q^{30}\\), the same in every term."},{"tex":"= \\frac{q^{30}}{p}","why":"Recognize the geometric mean, \\(1/p\\) (Theorem 3.5) [p. 83]."}]}
{"type":"note","text":"The pattern for any tail sum over a geometric: shift the index to start at 1, factor out the common power of \\(q\\), recognize a sum you know."}
{"type":"answer","label":"3.7.7","text":"\\(E[C] = 20 + 15\\left(\\tfrac{29}{30}\\right)^{30}\\), about $25.42"}
```

**GLM-5.3-Flash** (researched 2026-09-28; it came out 2026-08-26, so
this is from its docs, not experience):

- Thinking is always on and can't be disabled. `reasoning_effort` is
  `low`, `high` or `max` (the default). Keep guides at the current
  setting; use `low` for repairs.
- Z.ai recommends `temperature: 1` and `top_p: 0.95`. Tune one at a
  time, if at all.
- Keep `clear_thinking: false` in the tool loop (Z.ai's advice for
  agentic use, and what `llm.shape` does), and return reasoning with
  tool results in order.
- Context caching is automatic and implicit. So the prompt's **static
  part comes first** (writing guide, example, tool rules), and the
  per-question material last, so the long prefix is cached on every
  call.
- Only one stop word is supported. `tool_choice` is `auto` only.
- JSON mode is `json_object` only, and Z.ai warns it can make writing
  less natural. Another reason the document is JSON lines in plain
  content.
- Examples anchor it better than rules, hence the worked example. Keep
  instructions and the problem's material apart with clear tags.
- 1M context and 128K output; $0.045 per million input tokens and $0.14
  per million output, so the example's cost is negligible.

Sources: [Z.ai GLM-5.3-Flash docs](https://docs.z.ai/guides/vlm/glm-5.3-flash),
[Z.ai structured output](https://docs.z.ai/guides/capabilities/struct-output),
[Hugging Face model card](https://huggingface.co/zai-org/GLM-5.3-Flash),
[OpenRouter](https://openrouter.ai/z-ai/glm-5.3-flash),
[Prompt Architects on GLM](https://prompt-architects.com/blog/396-how-to-prompt-glm-models)
(third-party).

The format must still work with small local models (llama3.1:8b on
Ollama was the backend's live test). JSON lines were chosen partly for
that; test the guide prompt on one before calling it done.

### The wipe

One migration, when the new format ships:

- Delete every Ask turn.
- Clear every question's `hint` and `walkthrough` (and `revealed`, since
  the veils change) and set it to a new state meaning "no guide yet".
- Re-split every `statement`, `notes` and `reading` into runs. That is a
  split, not a model call.
- Books, pages, contents, search, memories, homework sets, questions,
  due dates and Complete marks stay.

A question with no guide shows **Write the guide**, which queues its
guide job. Nothing is written automatically.

### Where it lands

- `internal/cards`: parser (JSON lines), schemas per block, split into
  runs, KaTeX check, repair, whole-document checks, prompt.
- `internal/homework`: `question.go` loses the `## Hint` sections, and
  the hint and walkthrough become the document's hint and the rest;
  `prompts.go` gets the guide part; plus the wipe and "Write the guide".
- `internal/ask`: the new events; `loop.go` uses the shared prompt.
- `internal/llm`: nothing new, beyond `reasoning_effort: "low"` for
  repairs.
- `web/src/lib/katex-check.ts` and its build into Go's embed.
- `web/src/components/segments` becomes the document renderer (runs,
  blocks, tree from markers) and loses `normalizeMath` and the markdown
  pipeline. The transcript components gain part, step, note, callout,
  the answers card and plot marks. The walkthrough gains the Answers
  veil.
- `design/backend.md` ("Cards (envelopes)", "Live updates") and
  `design/workspace.md` (Walkthrough, Transcript), and
  `design/design-system.md`'s font and `*-soft` lines.

### Tests

- **Split**: a table of real strings in, runs out, including the
  failures from Assignment #5: `$\$20$`, `$\$25.42$`, `costs \$15 per
  month plus \$1`, a table cell `$0.20`, `$$...0.1.$` + backtick (a
  mistyped close), `[c = 20.5,\ 21,\ \dots]` (TeX with no delimiters),
  and `\textit{PSpice}`.
- **KaTeX check** through goja, and the version test.
- **Parser**: blocks across chunk boundaries, an object split over two
  lines, a non-JSON line going to repair, a stream cut mid-block.
- **Repair**: a bad math run repaired as a span and spliced back; a
  second failure falling back to raw; the six-call cap.
- **Whole document**: a missing hint and a missing answer each fetched
  once.
- The UI checked in both themes at 1280, per AGENTS.md, and every block
  on `/components`.

### Weight

Large: a new parser, checker and renderer, a migration, events, and a
prompt rewrite. Likely two branches: the backend (format, checks,
events, wipe) with the renderer behind it, then the look and the
Answers veil.

### Open

- **The Answers veil for Ask**: none, as decided. Revisit if an Ask
  answer with parts wants one.
- **Where answers render inside the walkthrough**: in place at each
  part's end, and the card again at the end, or only in place. The page
  did both.
- **A plot's marks** could be computed (the crossing of two series)
  rather than given as numbers. Not decided; given numbers are simpler.
