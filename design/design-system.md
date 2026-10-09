# Ink & Paper

The design system, as the app actually implements it. It covers what has
been built and decided: it grows as the rewrite does, and nothing is
written here before it exists in code.

`web/src/index.css` is the machine-readable truth: every token below is a
custom property there, and the Tailwind theme is generated from them. This
file explains what the values mean and why they are what they are. Each
component carries its own `README.md` beside it in `web/src/components/`.

**Baseline.** The system started as the "Ink & Paper v2" artifact, locked on
2026-09-17. Where the app now differs, it is recorded under
[Divergences](#divergences-from-the-baseline) with the reason.

## The aesthetic

A quiet study room. Warm paper neutrals, ink text, one fountain-pen blue
for actions, serif display type. Calm and content-first: decoration never
competes with the textbook. Geometry is Primer's: 6px radius, 32px
controls, 40px rows. Desktop only; below 1024px the app hides and a static
gate shows instead.

## Color

OKLCH throughout, two themes: Paper (light) and Night study (dark). Use
the semantic token, never a raw value; both themes then come free.

| Token | Use |
|---|---|
| `background` / `foreground` | The page ground and its ink. |
| `card` / `card-foreground` | Every Box, dialog and menu. Always with a border. |
| `card-header` | The header band of a Box and the footer of a dialog. |
| `rail` | The workspace's contents rail and panel ground. Follows the theme. |
| `primary` / `primary-foreground` | The one blue: primary buttons, links, the current item. |
| `primary-soft` | Its only tint: selected rows, the active tab, an anchor chip, a selected document element. |
| `secondary` / `secondary-foreground` | The secondary button's fill. |
| `muted` | Quiet fills: ghost hover, skeletons, roundels, progress tracks. A row's hover wash is `muted/50`: hover only signals, it doesn't carry shape, and full muted reads as selection. |
| `muted-foreground` | Secondary text (leads, hints, meta lines) and icons at rest. |
| `accent` / `accent-foreground` | Ochre highlight **fill** only. Never as text. |
| `success` · `warning` · `destructive` | Status, as **ink**: text, icon, border. Never a solid fill. |
| `*-soft` | The one tint of each status: badges, a failed row's ground, a guide callout's (insight is success, caveat is warning). |
| `border` | The hairline that does the work of elevation. |
| `border-muted` | A quieter divider between rows inside a Box. |
| `input` | Control borders: fields, the outline button. Darker than `border` on purpose. |
| `ring` | Focus: a solid 2px ring, offset 2px. |
| `chart-1..5` | Data series, in order. |
| `cover-*` | The six book-cloth hues. Identical in both themes: a book is an object. A book's hue is picked when it's added (the one fewest books wear, seeded by its hash) and kept; the Book dialog can change it (design/import.md). Every picture of a book (cover, swatch, chart bar) draws the same stored hue. |

**Status is ink, not fill.** A status colour sets text, icons and borders;
its `-soft` tint is the only ground it gets. There is no solid red button.

**Contrast is measured, not assumed.** Body and secondary text clear 4.5:1
on every surface they land on. Quiet fills are checked against the surfaces
they sit on, not in isolation: the palette's neutrals sit close together,
so a fill that looks fine alone can vanish in place. The current floor for a
fill that carries shape is ~1.3:1 against its ground; anything thinner needs
a border to delineate it.

## Type

Three faces: **Newsreader** for display, leads and a guide's headings (its
parts and steps), **Inter** for everything else, **JetBrains Mono** for
what is copied and for data.

**Mono is for what you would copy, and for data** (2026-10-08, Jack;
this supersedes the 2026-09-25 rule that a person reads is never mono, for
figures in tables and stats only). The test is "would you copy it":

- **Mono, with tabular figures:** copyable identifiers (a model id, "asked
  X", a hash, a path, a version, raw TeX and math source, a request log)
  and data figures: the numeric cells of a table (a time of day too), the
  value of a stat (`StatTile`, the usage modal's totals), and a trailing
  data value (`RowValue`). The `figure` utility is mono plus tabular
  figures, for a number; `font-mono` alone is for a string.
- **Inter:** labels (column headers, a stage or kind name, a totals label),
  prose, buttons, a book's problem labels ("3.1 #7", "4.27", "2.1.4": said
  in words, never mono, because at the floor size in a pill its wide, round
  letterforms read as toy-like, Jack: "a bit cartoony"), and anything you
  only glance at and would not copy: the usage line that opens the dialog
  (its model name included), the PDF viewer's page number and zoom, the
  study timer, a page citation chip. Where figures should line up they take
  `tabular-nums`, still in Inter. Marks beside a mono figure (the "≥" that
  says a figure is a minimum) are Inter too: Mono's ≥ is short and narrow.

A table may mix the two: mono for its data, Inter for its labels
(`web/src/components/table`: numeric columns are mono by default, `mono`
sets any other).

Nine steps, and no others. **15px is the floor**; nothing in the product is
smaller, chips and counters included.

| Step | Size / line | Role |
|---|---|---|
| `text-xs` | 15 / 22 | Labels, badges, timestamps, hints. The floor. |
| `text-sm` | 16 / 24 | Buttons, rail rows, tabs, table cells. |
| `text-base` | 17 / 26 | Default UI copy. |
| `text-reading` | 18 / 30 | Long-form text a student reads. |
| `text-lg` | 19 / 28 | Card titles (sans 600) and leads (serif italic). |
| `text-xl` | 21 / 30 | Section heads. |
| `text-2xl` | 25 / 32 | Panel and dialog titles. |
| `text-3xl` | 31 / 36 | The one `h1` on a page-shell page. |
| `text-4xl` | 37 / 40 | The dashboard greeting and empty-state heroes. |

**A guide's headings** (2026-09-29) are the one place Newsreader heads
text a person reads through rather than a screen's title. A part is an
eyebrow in Inter (`text-xs`, `primary`, a little tracking: "Problem
3.6.6", "(a)") over its title at `text-2xl`, with a hairline above to
separate it from the part before. A step is its number in Inter
(`primary`, `tabular-nums`) before its title at `text-xl`. Guide prose is
`text-reading`, with inline math at 1.1em, a touch above the text. Asides
are `text-xs` `muted-foreground`. Components: `web/src/components/transcript`.

Each step carries its own weight and tracking, so a call site sets size
alone. `text-lg` is the exception and stays weightless: it is the one step
two styles share.

## Space, shape, elevation

**One lever.** Every spacing step is an integer multiple of 4px. The bare
Tailwind multiplier is removed, so fractional utilities (`p-2.5`, `gap-1.5`)
and arbitrary values do not compile. If a value you need does not exist,
that is a design question: add a named token, never an arbitrary value.

Semantic tokens own page rhythm: `page` (40px gutters), `section` (40px
between sections), `card` (16px Box interior). The shell's fixed dimensions
are tokens too: `topbar` 64, `rail` 320, `panel` 440 (`-wide` 800 in Focus) as the workspace's default widths, `control` 32 (`-sm`
28, `-lg` 40), `row` 40, `mark` 36, `dialog` 400 (`-wide` 560).

Radius: `sm` 4, **`md` 6: the default for controls and containers alike**,
`lg` 12 for large floating surfaces, `full` for pills.

Elevation is a hairline border. Two shadows exist: `floating` for layers
that genuinely float, `lift` for a book cover picked off the shelf. Static
surfaces get neither.

## Layout and scrolling

**Widths.** A document page is `layout-page` (72rem) wide with `page`
gutters. Anything read as prose is `layout-reading` (48rem): the measure,
not the container.

**The top bar's middle** names the book on the workspace, and is empty on
a document page while its h1 is on screen: the bar never repeats what the
page already says. **Once the h1 scrolls out of sight, the bar picks up
the page's name**, fading in, so you always know where you are.

**The shell is fixed chrome.** The window itself never scrolls: the shell
is exactly the viewport, the top bar takes its 64px, and what remains is
the scroll region. A scrollbar therefore starts *below* the bar rather than
running past it, and the bar cannot drift.

**There are two kinds of screen, and the screen decides, never the
component.**

- **A document page** (Home, Settings) has exactly one scroll region: the
  area under the bar. It is as tall as its content. **Nothing inside it
  gets its own vertical scrollbar.** Content that would be too long is
  truncated with a **Door**, one component used everywhere: a full-width
  quiet row at the bottom edge saying "Show all 9", which opens in place
  and flips to "Show fewer", because a scrollbar inside a scrolling page
  hides content twice over and traps the wheel.
- **A filled screen** (the book workspace) is exactly the remaining height
  and never scrolls as a whole. Its panes scroll independently, because
  each is a genuinely separate stream: the contents rail, the page scan,
  the Ask transcript. The frame stays put; the panes move.

**The one sanctioned inner scroll is horizontal**, for content that cannot
reflow: a wide table, a code block, a diagram. It goes in its own
container, and the page body never scrolls sideways.

**A dialog is the one exception, and it is a screen, not a component.**
It caps at 80vh, its header and footer are fixed, and its body scrolls,
because the primary action has to stay reachable however far the content
grows, and a dialog has nowhere else to put it. A dialog is also the one
place a **scrim** exists: `foreground/25` with a 2px backdrop blur, and
it is inert. A backdrop click never closes anything.

**One job, one control.** A dialog is left through Cancel in its footer,
or Esc, never also through an X in the corner. Anywhere the app offers
a way out, it offers exactly one, and it sits beside the action it
undoes.

**Deleting** (2026-09-24). Everything you make can be deleted, and every
delete asks first. Two rules keep that consistent:

- **One menu per thing.** A thing's actions live in one "⋯" Menu beside
  where it's named: the book's beside its title in the top bar, a
  homework set's in the walkthrough's header, and (2026-09-30) a question's
  on its label row. Every one is the same Menu: a radius-lg card of
  full-bleed 40px rows, joined flush to its trigger, one open at a time
  (`web/src/components/menu/README.md`). The destructive act is
  last, below a divider, in destructive ink. Edit dialogs only edit;
  none carries a delete.
- **A delete asks where you asked.** A **ConfirmPopover** opens under
  the control that was pressed, never a dialog in the middle of the
  screen: one sentence of what goes (and what stays, where that's the
  question), Cancel focused, the act named on a destructive button that
  is never under the pointer, so a double click can't confirm. Asked
  from a menu, the menu stays open behind it. A delete that is a single
  inline control (a question's trash, the conversation's Clear) asks the
  same way. Two things don't ask: a Memory, deleted in its dialog at
  once, since each is one sentence and Ask's saves have Undo;
  and Dismiss on a failed import, which holds nothing of yours yet.

**Informing, not asking** *(2026-10-08, Jack: superseded for usage. What a job spent is one muted line with a small chevron that opens a modal of the details; `web/src/components/usage/README.md`, `web/src/components/usage-modal/README.md`, `design/model-usage.md`. The popover geometry that stood here is gone; a thing that wants to inform from a line opens a Dialog.)*

**Selecting what you ask about** (2026-09-30). Every element of a live
document (a guide's stages, an answer) selects. Hover is the hover wash,
`muted/50` with a `border-muted` hairline, instant as every hover; the
pick is the selection pair, `primary-soft` under a `primary` outline,
rounded `sm` like a box on the page; and the toolbar on the pick is the
boxing toolbar's card (`shadow-floating`, the Menu's shape) pinned to
the outline's top-right corner, straddling its top edge, except inside
a framed card (a derivation) whose corners would clip it, where it sits
just inside. One element outlines at a time, held above the documents,
and the outline lives exactly as long as the composer's context chip.
Components: `web/src/components/document`.

A scrolling flex child must set `min-h-0`. Flex items default to
`min-height: auto` and refuse to shrink below their content, so a pane
without it silently pushes the layout taller instead of scrolling.

## Motion

Motion is functional and fast: **200ms, ease-out** for a state change and **100ms** for a hover (2026-09-30, Jack; both were 150ms and instant). It exists to make a
state change legible, never to decorate. One movement exists beyond
colour and opacity, and no others:

- **A book cover lifts 4px** off the shelf on hover, with `shadow-lift`.

(There was a second: frosted content resolving when a hint was revealed.
The Veil was removed with the homework redesign, 2026-09-30, and a
question's help is now rows that open in place: the Disclosure.)

Everything else is a colour or opacity change, and a hover's is
instant (below).

**Two things loop, and both mean "waiting".** The **Spinner** turns where
work is genuinely running and can't be counted: examining a PDF, building
a search index. The **Skeleton shimmers** where content is on its way.
Work that can be counted gets a determinate bar instead, and something
merely queued gets the word "Queued" and no motion at all: nothing is
happening to it yet. Anything that isn't waiting must not borrow the
meaning.

**Nothing flickers either** (2026-09-24). A state that may be over in a
moment (a wait between two of the engine's steps, a request in flight)
shows only once it has lasted 300ms: `useSettled` and `useShowPending`
in `web/src/lib/settled.ts`. Until then what was on screen stays, or a
blank of the same height when nothing was. Progress shows at once. A
quick answer never blinks a spinner, and a book passing from one step to
the next never says "Queued" for a frame.

**Nothing jumps when data arrives.** Anything that waits on a request
draws a **Skeleton** first: shimmering `muted` blocks at the size and
count of what's coming, inline in real line boxes so a skeleton row and
the row that replaces it measure the same.

`make jumps` measures where this is broken. It drives the real app in Chromium over a
copy of a library (default `~/.local/share/pset-test-library`, or `DATA=<dir>`), each screen
and overlay twice: **real** (no added latency) and **slow** (every `/api` request held
600ms), five runs each. It records the browser's own layout shifts (including those right
after a click, which Chrome's CLS leaves out) and the size of every dialog, popover and menu
as it changes, and writes `report.md` under `/tmp/pset-jumps-<topic>/<time>/`. Read the
table worst first: **jump score** is the sum of layout-shift scores after the click or load
(median and p95 over the runs); **overlay growth** is how many px an overlay changed from
its first frame (height plus width), the "opens small, then grows" case; **settle** is the
time to the last shift, resize, skeleton, spinner or request; **skeleton ms** is how long
placeholders were on screen; **moved** names the elements that shifted. The screenshots
below the table are the worst run's first frame and its settled frame. A skeleton or
spinner counts only while it is in the viewport, and the **settle waited on last** column
names what the settle waited on (a request URL, or the skeleton, spinner, overlay or shifted
element's selector). The audit also finds each page's overlay triggers and menu items itself
and measures them as extra scenarios, listed `discovered: <label>` (`--no-discover` skips
this); usage dialogs are opened twice, the second open its own row. `SRC=<checkout>` serves
another checkout while this worktree measures it, and
`ARGS="--only home-cold-load,memory"` runs just those scenarios, named by slug. Spec and
reasons: `ideas/layout-jumps.md`.

**One loading standard** (2026-10-09, `ideas/loading-standard-grill.md`). Everything that
waits on data opens at its final size and is written through one component,
`Loaded` (`web/src/components/loaded`), which owns the skeleton, the 300ms grace, the
fade, `aria-busy` and the error line, so screens cannot drift apart.

| Surface | Before data | When it arrives |
|---|---|---|
| Dialog, popover | Prefetched (so far the usage dialogs and Reset everything); else opens at final size with a skeleton | 150ms crossfade in place |
| Page section, list | Skeleton in the real layout, at the last known count | 150ms crossfade in place |
| Value in a sentence | Prefetched; else a slot of fixed width | The number appears, nothing reflows |
| Any wait under 300ms | Nothing drawn | Content at once |
| Cached data | Content at once, no fade | |

- **The fade is 150ms**, opacity only, ease-out (`fade-in`, `fade-out` in `index.css`), and
  off under reduced motion. A skeleton that was seen crossfades with its content in one grid
  cell, so no frame is empty; data inside the 300ms grace, and cached data, appear at once.
  The skeleton itself fades in over 150ms when the grace ends. The grace is for content
  inside a page; an overlay (`grace={false}`) shows its skeleton at once, from its first frame.
- **Skeletons are exact, not morphed.** A height animation between a skeleton and its content
  was tried (D9, 2026-10-09) and dropped: it jittered. The skeleton must be the content's
  size, and the jump check (`make jumps`) reports one that isn't; the CI guard comes in part 2.
- **Overlays prefetch**: so far only the usage dialogs, once the pointer has rested on the
  trigger for 60ms (`usePrefetchIntent`; at once on a press or keyboard focus, never on a
  touch hover), so the dialog usually opens complete. Usage stays cached and
  refreshes from the event stream, so a second open is instant.
- **A list's skeleton draws the count it showed last time**, saved per list in the browser
  (`useLastCount`), 3 the first time.
- **A number in a sentence** is fetched with the page; while missing, it holds a slot as
  wide (in `ch`) as the text it showed last time.
- **The latin and latin-ext subsets of every font start loading at app start** (`main.tsx`),
  so none of the text and figures arrives after first paint and reflows the screen. Each
  family has a metric-matched system fallback (`Inter Fallback` over Arial, `Newsreader
  Fallback` over Times New Roman, `JetBrains Mono Fallback` over Courier New; `size-adjust` and
  the ascent, descent and line-gap overrides in `index.css`) right after it in the font stack,
  so the swap moves almost nothing.

**Hover fades in over 100ms** (2026-09-30, Jack: "give hover a short fade", reversing
2026-09-25). A hover wash or ink change used to be instant, because a slower fade left a
swept list lighting rows late and trailing behind the pointer ("It seems to jitter and flash
away sometimes. Almost looks like its lagging. Its also quite slow."). The fade is now 100ms
ease-out, short enough that a swept list keeps up, and it is one rule in the base layer
(`web/src/index.css`, `:where(button, a, ...)`), so a hover class needs no transition of its
own. Changes of state, which happen once and are worth seeing happen (a checkbox's tick, a
radio's dot, a transcript step easing back, the cover lifting, a tooltip or a menu appearing),
take 200ms.

Anything that moves for a change of state says `transition duration-200 ease-out` explicitly,
paired with `motion-reduce:transition-none`. A hover class says nothing: the base layer does
it.

## Writing

**No em dashes, anywhere.** Not in UI copy, not in comments, not in these
docs. A dash is usually standing in for something more exact: a colon
when what follows explains, parentheses for an aside, a comma for a
pause, a period when it is really a new sentence. Use that instead. (An
en dash stays for ranges, as in "p. 142–145".)

## Rules the code enforces

- Semantic tokens only. No raw colour values in components.
- No type below 15px, and no size outside the nine steps.
- No fractional or arbitrary spacing: the scale is the scale.
- One focus ring, defined once in the base layer, on everything.
- A component never sets its own outer margin; the parent's stack does.

## Divergences from the baseline

Each is a deliberate change from the v2 artifact, kept here so the two do
not silently disagree.

| Change | Why |
|---|---|
| `muted` and `secondary` darkened: light 0.945 → **0.88**, dark 0.262 → **0.34** | At the baseline values they measured 1.06–1.16:1 against every surface, so ghost hover, skeletons, roundels and the secondary button were near-invisible. The new values are capped by text, not taste: `muted-foreground` on `muted` lands at 4.56:1 light and 4.75:1 dark, and one more step fails 4.5. |
| The bar is **64px**, the mark **36px**, the wordmark 21px, the icons 24px on 40px buttons | Jack found the whole product read small, so the bar grew with the type. At the old 56px the baseline's 28px mark and 18px name dominated against 20px icons; the icons growing with the lockup keeps the two ends in balance. |
| The scale is **one step bigger than the baseline's**: 15px floor, 16 for controls, 17 for UI copy | Jack found everything too small to read comfortably. The small steps grew most (+1px on 14–16px is 6–7%), the display steps least (+1px on 30–36px), since the small ones were the ones that needed it. |
| Counters and chips sit at **15px** | The baseline's Box and ActionList previews set them at 12px, which contradicts the system's own type floor. The floor wins. |
| The Counter's fill is translucent ink, not `muted` | It sits on `card-header`, the surface where `muted` is weakest even after the correction (1.24:1). Ink at 20% gives it 1.50:1 and inverts with the theme for free. |
| The date field is the browser's native `<input type="date">` | It is the one control in the app we don't draw. A correct, keyboard-reachable, locale-aware calendar is a large component to build and an easy one to build slightly wrong, and the value it carries is a date, not a brand moment. |
| Blur has **one** meaning now | A dialog's scrim blurs a *screen you are no longer on*, to say "not here": 2px on a backdrop behind a card. (It had two until the Veil, which blurred content you could read to say "not yet", was removed, 2026-09-30.) |
| Night's `chart-1` and `chart-2` re-stepped to L 0.56 and 0.66 | At the baseline's 0.70 and 0.72 both sat above the dark lightness band and the pair measured dE 12.9 for normal vision, below the 15 floor: two lines in a plot read as one colour. Validated against the Night card: all five checks pass, dE 18.7 normal, 17.6 deutan. |
| `card-header` left at its baseline value | It is 1.08:1 against `card` and cannot improve without reading as a different surface. But it always carries a border, and that hairline is what separates the band. |
