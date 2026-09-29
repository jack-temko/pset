# doc

The document a model writes and the UI draws: a list of typed blocks that
the server checks, repairs and stores, and the UI renders without parsing
anything. Ask answers and homework guides both write through it. Decided
2026-09-28, built 2026-09-29; the grill and the evaluation are in git
history (`ideas/structured-guides.md`).

Files: `parser.go` (the stream), `lenient.go` (reading almost-JSON),
`split.go` and `text.go` (strings to runs and back), `validate.go` and
`schemas/` (one JSON Schema per block type), `check.go` and
`katex-check.js` (KaTeX in goja), `repair.go` (the repair calls),
`finalize.go` (whole-document checks), `prompt.go` (`GuideWriting`,
`AskWriting`), `source.go` (blocks back to the string form for the model),
`wire.go` (the block types, generated into `web/src/api/gen/doc.ts`).

**The blocks.** `hint`, `part`, `step`, `para`, `note`, `math`,
`derivation`, `callout`, `statement`, `table`, `plot`, `code`, `answer`,
and `raw` (what could not be made valid). `part` and `step` are flat
markers like headings: everything after one belongs to it until the
next, and the renderer builds the tree. Each type has a JSON Schema
(`schemas/`, `additionalProperties: false`); the Go wire types
(`wire.go`) are generated into `web/src/api/gen/doc.ts` by tygo.

**Text is written as strings and stored as runs.** The model writes
inline math as `\(...\)` and a `$` is only ever money. `Split` turns a
string into runs (`{t}` with `b`, `i`, `code`; `{m}` math, `d` for
display; `{cite}` a PDF page, moved from the printed one). A `$...$` the
model wrote anyway is converted by the strict pandoc rule: an opening
`$` has a non-space after it, a closing one a non-space before it and no
digit after it, `\$` inside math is a dollar, and a bare `$` that can't
close holds no math ("costs $20 ... $M$" is money, then math). Math that
is only money (`$\$20$`) becomes the text "$20", `\$` outside math is a
dollar, `\textit` and `\textbf` are marks. Statements, professor's notes
and figure readings are runs too, split when written (`doc.Text`: math
KaTeX can't parse is marked `raw`, never repaired, since it isn't the
model's writing) and shown to the model, or to the student to edit, as
the string form again (`doc.Source`).

**Streaming.** The model's reply is JSON lines in plain content, after
its tool calls (a final "write" tool call arrives all at once, and
Z.ai's `tool_choice` only takes `auto`). The parser reads leniently
first: a backslash that starts no JSON escape is doubled (`\(`), a
control character before letters in a `tex` field or a math run is the
backslash a JSON escape ate (`\frac` read as a form feed), a raw newline
in a string is escaped, and an object may run over lines.
`block.start {type}` fires as soon as the type has arrived; a text
block's open field streams, words as they come, a math run or a bold
phrase whole once it has closed. **Only the final round is the
document**: text a guide writes in a round that ends in tool calls is
narration and is dropped (`agent.Loop.Aside`), and so is text before the
first block ("Here is the guide."). Ask's blocks may come between tool
calls; its step feed records how many blocks were written when each call
ran. A guide is `Complete` once a hint and an answer have arrived, so a
guide that writes itself and then calls `remember` is finished.

**Checks, in order, for each block:** its schema; the split; TeX or a
math delimiter left in plain text; every math run, `tex` field and
derivation line through **KaTeX in goja** (`web/src/lib/katex-check.ts`
bundled by `npm run build:check` into `internal/doc/katex-check.js`,
embedded, loaded lazily, run under a lock with a 3 second cap, with the
options the renderer uses, `web/src/lib/math.ts`; a test ties the
bundle's version to the pin in `web/package.json`); and citations (every
page is in the book). A plot's numbers written as constants in strings
("11/12") are read, and an expression in the axis's own variable
(`b^2 - b`, x-axis `b`) is sampled as written.

**Repair is targeted**, at most two tries per failure and six calls per
document, at `reasoning_effort: "low"` (`llm.Client.Mechanical`). A bad
math run sends only that span and KaTeX's message and is spliced back; a
text field with TeX in it sends the field; a bad block sends the block,
its schema and the problems; a line that isn't JSON (after the lenient
parse) is rewritten as blocks. The UI's label is "Tidying". When the
document ends, the whole-document checks: a guide with no hint gets one
call ("write the hint"), and a part with no answer one call each ("write
the answer for (b)"); both go through the block checks. Still bad: a
math run is kept with `raw: true` and shown as its source in muted mono,
a block becomes a `raw` block, muted. **Nothing renders red and nothing
is dropped.**

**Plots are expressions, sampled by `mathx`.** A series is `{label,
expr, domain}` (or `{label, points}`); the wire payload is always
points. Optional `marks` are labeled points `{x, y, label}` and
vertical guides `{x, label}`. At most two series; one y-axis.

**Storage.** A turn stores its blocks. A question's `hint` and
`walkthrough` are blocks: the first `hint` is the hint, any other
becomes a note, and the Answers veil is derived from the walkthrough's
`answer` blocks. **Guides use the same machinery, stage by stage:** the
hint is published (as `question.changed`) as soon as the block after it
arrives, so a student can open it while the rest is written; the
walkthrough is saved once its parts all have answers. A guide that comes
back without a hint or an answer is asked for once more.

**The prompt.** The guide prompt is the one tested against the real
model, verbatim: homework's "How to work" rules, then `doc.GuideWriting`
(the format, the blocks, the marks in text fields, how it should read,
and a worked example from a subject no book on the shelf covers). Ask
shares the block lines and the text rules (`doc.AskWriting`: no hint, no
answer). The static part comes first and the problem and the book last,
so the endpoint's implicit cache holds the long prefix.

**The wipe** (migrations `homework/12` and `ask/2`, 2026-09-29): every
Ask turn deleted; every question's `hint`, `walkthrough`, `revealed`,
saved rounds and the memory lines its guide made cleared, and a question
that had a guide set to `unwritten`; statements, notes and readings
re-split into runs. Books, sets, questions, due dates and Complete marks
stay. An `unwritten` question offers **Write the guide**
(`POST /api/questions/{id}/guide`); nothing writes one unasked.
