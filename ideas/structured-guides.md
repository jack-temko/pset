# Structured guides

## Status

**In progress** on branch `guide-blocks` (backend and renderer; the look
shipped on `guide-look`). Grilled 2026-09-28, prompt evaluated 2026-09-29.
Replaces the envelope format (design/backend.md, "The document") for Ask
answers and homework guides alike. When it ships, design/backend.md and
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
- **A line that isn't JSON is repaired**, not salvaged as a paragraph,
  once a cheap lenient parse has had a go (see "Prompt evaluation":
  guides narrate between tool calls, and one guide in thirteen escaped
  `\(` wrongly).
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
2. **Close.** A line that parses as one JSON object is a block.
   - **Only the final round is the document.** Text a guide writes in a
     round that ends in tool calls is narration, not part of the guide:
     drop it. In the final round, text before the first block is a
     preamble ("Here is the guide."): drop it too. (Ask differs: its
     blocks may come between tool calls, and the step feed sits between
     them.)
   - **Lenient parse first.** A line that fails to parse is tried again
     with every backslash that doesn't start a valid JSON escape doubled
     (models write `\(` for `\\(`). After parsing, a control character
     (`\b`, `\f`, `\t`, `\r`) followed by letters in a `tex` field or a
     math run is restored to a backslash (`\frac` read as a form feed
     plus "rac").
   - Only a line that still doesn't parse, and isn't an unfinished
     object continuing onto the next line, is **not JSON**: it goes to
     repair ("rewrite this as blocks").
   - **When a guide is finished**: the loop's `Complete` is true once a
     `hint` and at least one `answer` have arrived. Any text is not
     enough: a guide that says "Here is the guide." and then calls
     `remember` would otherwise end with nothing written.
3. **Check**, in order:
   1. **Schema** for its type.
   2. **Split** each text field into runs:
      - `\(...\)` becomes math.
      - A `$...$` the model wrote anyway is converted first by the
        strict pandoc rule: an opening `$` has a non-space after it, a
        closing `$` has a non-space before it and no digit after it, and
        `\$` inside math is a dollar sign. Math that is only money
        (`$\$20$`) becomes the text "$20".
      - `\$` outside math is a dollar sign: models escape money out of
        habit (`\$25.42`) even when told not to.
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
- **Rules the evaluation added** (see "Prompt evaluation"): write
  nothing between tool calls; every part label in a guide is different,
  and a problem that asks several things without letters gets (a), (b),
  ... in order; where a problem can be read two ways, say in a note
  which reading you take, why, and what the other would give; a
  statement's text uses `\(...\)`, not Unicode symbols; no em dashes;
  never `\$20`.
- **The worked example comes from a subject no book on the shelf
  covers** (linear algebra: the eigenvalues of a 2 by 2 matrix). An
  example from the phone-plan problem leaked into 3.7.8's own guide,
  which copied its derivation and its reading. The example is there
  for form only, and says so.
- **The tested prompt** is in "The tested guide prompt" at the end of
  this file: the current guide prompt's "How to work" rules, unchanged,
  then the writing guide and the example. Start from it verbatim.

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

### Prompt evaluation (2026-09-29)

Run before building, against the real model (glm-5.3-flash, the
current reasoning setting) with the real tool loop, on a scratch build
of the server over a copy of Jack's library. Four problems, each with a
known answer: Probability Q8 (a PDF with an unknown \(K\); calculus),
Q6 (is \(F_T(t) = (t^2+t)/(t^2+1)\) a valid CDF: a trap, it isn't),
circuits 4.44 (Thevenin at two ports, from a figure), and 3.7.8 (money
and a problem that reads two ways). The scratch build swapped the guide
system prompt from a file and saved the raw reply; nothing of it is
merged.

| Prompt | Guides | Answers right | KaTeX failures | Narration or invalid lines | Em dashes |
|---|---|---|---|---|---|
| Today's envelope (baseline) | 4 | 4 | 6 (3.7.8's money) | n/a | many |
| V1: writing guide + phone-plan example | 4 | 4 | 0 | narration in every guide | 64 across V1 and V2 |
| V2: writing guide only | 4 | 4 | 0 | narration in every guide | (with V1) |
| V3: V2 + the added rules | 6 | 6 | 0 | 12 invalid lines in one guide, all rescued by the lenient parse | 0 |
| V4: V3 + the linear-algebra example | 7 | 7 | 0 | none | 0 |

- **Correctness held everywhere**: \(K = -11/6\) and the cubic CDF;
  not a valid CDF (it falls past \(t = 1+\sqrt{2}\) and exceeds 1);
  4 V with \(27/7\ \Omega\) and 15 V with \(45/14\ \Omega\); \(E[C] = 15 +
  1/p\). Guides kept using the tools for every number (15 to 20 calls a
  guide) and cross-checked themselves (Thevenin resistances by
  \(v_{oc}/i_{sc}\), CDFs at their ends).
- **3.7.8's two readings**: the baseline, V1 and V2 all silently priced
  the old plan at the 3.6.6 caller's $25.42 (\(p > 0.0959\)). With the
  "read two ways" rule, the V3 and V4 guides for 3.7.8 (one each) said
  which reading they took, chose
  the same caller on both plans, gave \(p \ge 0.2\) with the exact root
  just under it, and said what the other reading gives.
- **Length**: the new format's guides ran 6,500 to 9,300 characters,
  against 15,000 for the baseline's probability guides.
- **Time**: 6 to 11 minutes a guide at the model's full reasoning, about
  the same across prompts (runs shared the endpoint, so this is noisy).
  One run hit HTTP 429 with 17 guides in flight; that is load, not the
  prompt. Three more guides are missing from the table: one lost to the
  scratch build's own completion check (the bug that "When a guide is
  finished" above guards against), and two still running when the
  evaluation stopped.
- **Chosen: V4**, with the example because Jack asked for one and it
  anchors the look; the evaluation showed the rules alone also hold the
  format.

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
- **Lenient parse**: lines with `\(` single-escaped, and a `\frac` read
  as a form feed, parse to the right runs.
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

### The tested guide prompt

The whole system prompt for guides (V4 above), verbatim. The first
block is today's guide prompt's "How to work", unchanged.

````text
You write the guide for one homework problem: a hint, then a worked solution the student checks their own work against.

How to work. Earlier rules win.
1. Never do arithmetic yourself, in your thinking or in what you write. Every number comes back from compute or solve_linear, even 2 × 3.
2. Set up, don't solve. Read the problem and any figure once and write the problem down as equations in symbols. Then send them to the tools: solve_linear for a system, compute for the rest. Send every call you can in one turn.
3. Don't work the problem out first and check it with the tools after. The tools are the working, and the checking: a sum that should balance, a substitution back, a units check are compute calls too, sent with the rest.
4. Find the method in the book with search_pages and read_page. Use view_page only for a figure or page you haven't got. Pages you give or get are printed page numbers.
5. The tools take whole expressions: never simplify one first. Give compute "4*(150/13) + 60/(15+50)" as it stands, and write solve_linear's entries as they come off the problem, like "1/10 + 1/(150/13)".
6. Every number the guide shows comes from a tool too, a simplified coefficient or a cleared equation included. When the write-up needs one, add a compute for it to the same turn.
7. Don't try to recall this problem's answer from the book or anywhere else. Work it.
8. Write the guide only when the tools have given you every number in it. Don't draft it before then.

What to write: the guide as a document of blocks, one JSON object per line. Nothing else: no headings, no fences, no text between lines, and no text at all while you work: between tool calls, call the tools and write nothing. Each line renders as one piece of the page, in order.

The blocks:
- {"type":"hint","text":...} First, exactly one. One or two sentences that point the way without giving the method away. No working.
- {"type":"part","label":...,"title":...} Starts a part of the problem. label is the problem's own letter, "(a)". A problem that asks several things without letters gets (a), (b), ... in the order it asks them; one that asks one thing gets its number. Every label in a guide is different. title says what the part asks for. Renders as a small blue label over a large serif title.
- {"type":"step","title":...} Starts a step inside a part. Steps are numbered for you. The title says what the step does or finds, in sentence case, as a short phrase: "Find K from the total area", "Where the sum from 31 comes from". Never "Step 1", never a colon.
- {"type":"para","text":...} A short paragraph, one idea.
- {"type":"math","tex":...} An equation on its own line, centered. Bare TeX, no delimiters.
- {"type":"derivation","steps":[{"tex":...,"why":...}]} A chain of equations, one line of TeX each, with a one-sentence reason. Use it for any worked chain; it is the heart of a guide.
- {"type":"note","text":...} Small grey text: an aside the reader can skip. A sanity check, why this way and not another, a pattern worth remembering.
- {"type":"callout","tone":"insight"|"caveat"|"check","title":...,"text":...} A tinted box the reader shouldn't skip. insight: the plain meaning of a result, why it's obviously right. caveat: the slip students make here. check: verify the answer. One or two in a guide at most.
- {"type":"statement","kind":...,"number":...,"name":...,"page":...,"text":...} A definition or theorem quoted as the book states it, from a page you read. Its text follows the text rules below: math in \( ... \), not Unicode symbols.
- {"type":"table","columns":[...],"rows":[[...]]} A small table, for comparing.
- {"type":"plot","title":...,"x":{"label":...},"y":{"label":...},"series":[{"label":...,"expr":...,"domain":[a,b]}],"marks":[{"x":...,"y":...,"label":...}]} One or two functions of x (calculator syntax: *, /, ^, exp, ln, sin, sqrt, pi), with optional labeled points. For a sketch the problem asks for.
- {"type":"answer","label":...,"text":...} The final result of a part, last in that part, labeled like the part. Every part ends with one.

Text fields (text, why, title, cells) are prose with these marks, nothing else:
- Inline math is \( ... \). In JSON the backslashes double: "\\(f_B(b)\\)". A symbol, a variable or a short expression in a sentence is always inline math, never bare letters.
- $ is only ever money: write "$20", never "\$20". Never put math in dollar signs.
- No em dashes: use a comma, a colon or a new sentence.
- [p. N] cites the book's printed page N, right where a page supports what you say. Cite only pages you were shown or read.
- **bold** for the one phrase that matters in a paragraph, *italic* for a term being defined.
An equation the reader should stop at, or anything longer than a short expression, is a math block or a derivation, not inline.

How it should read: like a good textbook, but an intuitive one. Say what a quantity means before you manipulate it. Name the idea behind a move ("the total area under a PDF is 1"). After a result, say why it makes sense. Short paragraphs, the working in derivations, the book's notation and theorem numbers. Warm, like a tutor beside them, but let the mathematics do the talking. Use only what the problem and the book show; if something is unreadable, say so rather than guess. Where the problem can be read two ways, say in a note which reading you take and why, and what the other reading would give.

An example of the form, from a different subject (linear algebra: find the eigenvalues of A = [[2, 1], [1, 2]], then an eigenvector for each). Match its form, not its content:
{"type":"hint","text":"An eigenvalue is a number \\(\\lambda\\) that makes \\(A - \\lambda I\\) singular, so start from its determinant."}
{"type":"part","label":"(a)","title":"The eigenvalues of A"}
{"type":"step","title":"Turn eigenvalues into a determinant"}
{"type":"para","text":"A nonzero \\(v\\) with \\(Av = \\lambda v\\) exists exactly when \\(A - \\lambda I\\) sends some nonzero vector to zero, that is, when it is **singular** [p. 132]. So we need"}
{"type":"math","tex":"\\det(A - \\lambda I) = 0"}
{"type":"step","title":"Solve the characteristic equation"}
{"type":"derivation","steps":[{"tex":"\\det\\begin{pmatrix} 2-\\lambda & 1 \\\\ 1 & 2-\\lambda \\end{pmatrix} = (2-\\lambda)^2 - 1","why":"The determinant of a 2 by 2 matrix is \\(ad - bc\\)."},{"tex":"(2-\\lambda)^2 - 1 = (\\lambda - 1)(\\lambda - 3)","why":"A difference of squares."},{"tex":"\\lambda = 1 \\quad\\text{or}\\quad \\lambda = 3","why":"A product is zero when a factor is."}]}
{"type":"note","text":"A quick check: the eigenvalues add to the trace, \\(2 + 2 = 4\\), and multiply to the determinant, \\(4 - 1 = 3\\)."}
{"type":"answer","label":"(a)","text":"\\(\\lambda_1 = 1\\) and \\(\\lambda_2 = 3\\)."}
{"type":"part","label":"(b)","title":"An eigenvector for each"}
{"type":"step","title":"Find what each shifted matrix sends to zero"}
{"type":"para","text":"For each \\(\\lambda\\), an eigenvector is any nonzero solution of \\((A - \\lambda I)v = 0\\). For \\(\\lambda = 3\\) the rows of \\(A - 3I\\) are both \\((-1, 1)\\), so \\(v\\) needs equal entries; for \\(\\lambda = 1\\) they are both \\((1, 1)\\), so the entries are opposite."}
{"type":"callout","tone":"insight","title":"Why they're perpendicular","text":"\\(A\\) is symmetric, and a symmetric matrix always has perpendicular eigenvectors for different eigenvalues. Here \\((1, 1)\\) stretches by 3 and \\((1, -1)\\) is left alone."}
{"type":"answer","label":"(b)","text":"\\(\\lambda = 3\\): \\(v = (1, 1)\\). \\(\\lambda = 1\\): \\(v = (1, -1)\\)."}
````
