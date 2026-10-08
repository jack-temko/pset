# Transcript

The Ask conversation's pieces, from the 2026-09-18 transcript grill
(design/workspace.md has the full spec).

**Asymmetric by design:** `UserTurn` is a compact `primary-soft` block on
the right; `AssistantTurn` is full-width quiet text on the panel ground:
chat where you ask, page where it answers. No bubbles.

- **`Steps`**: the visible step feed, one `text-xs` muted line per tool
  call, "verb · object · count". The line is the whole story; nothing
  expands. A turn draws **one group per position**, inside
  `AssistantTurn` and between the paragraphs the calls ran between: the
  page tells `Steps` which slice goes where. The group carries
  `data-copy-skip`, so Copy takes the answer without the feed.
- **`PageRef`**: the inline citation, a small mono `primary-soft` chip
  ("p. 142") that reads as an object in the prose. Click jumps the scan;
  hover fills `primary`.
- **`MathInline` / `MathDisplay`**: KaTeX, `throwOnError: false` so bad
  TeX renders as its source instead of crashing a turn.
- **`AssistantTurn`** carries Copy on hover: the only action a past turn
  has, and it copies its children in order, skipping anything marked
  `data-copy-skip` (the step feed). History is append-only: no edit, no
  retry.
- **`DayDivider`**: a quiet centered mark on a hairline when the date
  changes.
- **`ConversationStart`**: the top of the endless history:
  "Start of conversation · Clear". Clear asks first, in a
  ConfirmPopover under it.
- **`FailedTurn`**: one destructive-ink line + Try again; the feed above
  stays frozen, partial text stays. A setup failure (no OpenRouter key) passes
  `onSetup` and gains **Open Settings**, which leads (outline) while Try
  again steps back to ghost: retrying can't help until Settings is fixed.
  The two buttons take their own row under the sentence, which is too
  long to share a line with them in the panel.
  The same line serves a question that never sent.

**Don't:** give steps chevrons or results; render citations as bare
links or cards; put actions on user turns; auto-clear anything.

## Answer cards (`cards.tsx`)

A short list on purpose, for the three things prose does badly:

- **`Statement`**: a definition or theorem as the book numbers it, with
  its name and a page chip, in a Box-like frame with a header band.
- **`WorkedSteps`**: a numbered derivation, all shown, one line of math
  per step with an optional why. No scroll wrapper: an overflow
  container clipped tall glyphs and showed a scrollbar, so KaTeX breaks
  long lines at `=` and `+` instead.
- **`Plot`**: one or two functions, chart-1 then chart-2, one y-axis,
  ticks that always contain the data, a legend and no labels on the lines
  (they collided with the legend in a 400px panel), a hover crosshair
  with each series' nearest value inside its own range, and an sr-only
  table.

And two plain blocks: **`AnswerTable`** and **`CodeBlock`**, each
sideways-scrolling in its own frame when wide.

`Steps` takes `running` for the call in flight (a Spinner at the start of
the last line), and **`StoppedNote`** is the quiet line after a stopped
answer.

A step line can carry **one action** after a middle dot, drawn with
**`StepAction`**: text in the line's own size, primary ink, underlined on
hover. It exists for the remember step's **Undo** ("Remembered ·
Use SI units · Undo"), and a line never gets two.

## Guide pieces (`guide.tsx`)

What a structured guide (ideas/structured-guides.md, "Look") is made of
beyond prose, math and the cards above. All take plain props, not wire
types: the renderer maps blocks onto them.

- **`PartHeader`** `{label, title, first?}`: an Inter eyebrow in `primary`
  (`text-xs`, tracked) over the title in Newsreader at `text-2xl`, with a
  hairline above. The guide's first part passes `first` and has no rule.
- **`StepHeading`** `{number, title}`: the number in Inter, `primary`,
  `tabular-nums`, before a Newsreader `text-xl` title. The renderer
  numbers steps, restarting in each part.
- **`GuidePara`**: a paragraph at `text-reading` (18/30) whose inline math
  is 1.1em (the `.guide-prose` class in `index.css`, which a run renderer
  can put on any wrapper). `Prose` takes the same look with `reading`;
  its default is unchanged.
- **`Note`**: `text-xs`, `muted-foreground`, for an aside.
- **`Callout`** `{tone: 'insight' | 'caveat' | 'check', title?, children}`:
  a 2px left rule on the tone's ground. Insight is success ink on
  `success-soft`, caveat warning on `warning-soft`; check is muted, with a
  hairline frame. The title is in the tone's ink, the text in foreground.
- **`AnswersCard`** `{title?, answers: {label?, children}[]}`: a Box, a row
  per part, the label in `primary` in a 48px column and the answer beside
  it. It wraps rather than breaking at a width: on a panel too narrow for
  both, the answer drops under its label. An answer with no label takes the
  whole row.

**`Plot` marks**: `marks?: {x, y?, label?}[]`. With `y`, a dot with its
label; without, a dashed vertical guide with its label at the top. The
axes make room for every mark. Each label tries the corners around its
dot (then the sides) and takes the first spot that stays inside the plot
and touches no series line, dot, guide or earlier label, so a label never
sits on a curve or leaves the plot. If nothing is free the least-crowded
spot is used. Label ink is text, in foreground, with a card halo across the
grid.

## Changes from baseline

- The baseline has no transcript components: the old app's chat was part
  of what the overhaul deletes. This is new surface, specced by grill
  rather than derived from the artifact.

## Open

- Streaming states (Send→Stop, the "stopped" note, steps ticking in) are
  specced but need the loop backend's events to exist.
- Answers here are JSX; the structured-guides renderer maps a guide's
  blocks onto these pieces (ideas/structured-guides.md).
