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
| `primary-soft` | Its only tint: selected rows, the active tab, an anchor chip. |
| `secondary` / `secondary-foreground` | The secondary button's fill. |
| `muted` | Quiet fills: ghost hover, skeletons, roundels, progress tracks. A row's hover wash is `muted/50`: hover only signals, it doesn't carry shape, and full muted reads as selection. |
| `muted-foreground` | Secondary text (leads, hints, meta lines) and icons at rest. |
| `accent` / `accent-foreground` | Ochre highlight **fill** only. Never as text. |
| `success` · `warning` · `destructive` | Status, as **ink**: text, icon, border. Never a solid fill. |
| `*-soft` | The one tint of each status: badges, a failed row's ground. |
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

Three faces: **Newsreader** for display and leads, **Inter** for everything
else, **JetBrains Mono** for machine strings: hashes, paths, versions,
counts, page numbers.

Nine steps, and no others. **14px is the floor**; nothing in the product is
smaller, chips and counters included.

| Step | Size / line | Role |
|---|---|---|
| `text-xs` | 14 / 20 | Labels, badges, timestamps, hints. The floor. |
| `text-sm` | 15 / 22 | Buttons, rail rows, tabs, table cells. |
| `text-base` | 16 / 24 | Default UI copy. |
| `text-reading` | 17 / 28 | Long-form text a student reads. |
| `text-lg` | 18 / 28 | Card titles (sans 600) and leads (serif italic). |
| `text-xl` | 20 / 28 | Section heads. |
| `text-2xl` | 24 / 32 | Panel and dialog titles. |
| `text-3xl` | 30 / 36 | The one `h1` on a page-shell page. |
| `text-4xl` | 36 / 40 | The dashboard greeting and empty-state heroes. |

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
are tokens too: `topbar` 56, `rail` 256, `panel` 440, `control` 32 (`-sm`
28, `-lg` 40), `row` 40, `mark` 30, `dialog` 400 (`-wide` 560).

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
is exactly the viewport, the top bar takes its 56px, and what remains is
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

A scrolling flex child must set `min-h-0`. Flex items default to
`min-height: auto` and refuse to shrink below their content, so a pane
without it silently pushes the layout taller instead of scrolling.

## Motion

Motion is functional and fast: **150ms, ease-out**. It exists to make a
state change legible, never to decorate. Two movements exist, and no
others:

- **A book cover lifts 4px** off the shelf on hover, with `shadow-lift`.
- **Veiled content resolves**: blur and opacity easing back to nothing
  when a hint or a walkthrough is revealed, and easing part of the way
  on hover.

Everything else is a colour or opacity change.

**Two things loop, and both mean "waiting".** The **Spinner** turns where
work is genuinely running and can't be counted: examining a PDF, building
a search index. The **Skeleton shimmers** where content is on its way.
Work that can be counted gets a determinate bar instead, and something
merely queued gets the word "Queued" and no motion at all: nothing is
happening to it yet. Anything that isn't waiting must not borrow the
meaning, which is why the Veil never shimmers.

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

Anything that moves states `transition duration-150 ease-out` explicitly.
A hover class without it doesn't animate, it snaps, and the difference is
quiet enough to ship by accident. Pair it with
`motion-reduce:transition-none`.

## Writing

**No em dashes, anywhere.** Not in UI copy, not in comments, not in these
docs. A dash is usually standing in for something more exact: a colon
when what follows explains, parentheses for an aside, a comma for a
pause, a period when it is really a new sentence. Use that instead. (An
en dash stays for ranges, as in "p. 142–145".)

## Rules the code enforces

- Semantic tokens only. No raw colour values in components.
- No type below 14px, and no size outside the nine steps.
- No fractional or arbitrary spacing: the scale is the scale.
- One focus ring, defined once in the base layer, on everything.
- A component never sets its own outer margin; the parent's stack does.

## Divergences from the baseline

Each is a deliberate change from the v2 artifact, kept here so the two do
not silently disagree.

| Change | Why |
|---|---|
| `muted` and `secondary` darkened: light 0.945 → **0.88**, dark 0.262 → **0.34** | At the baseline values they measured 1.06–1.16:1 against every surface, so ghost hover, skeletons, roundels and the secondary button were near-invisible. The new values are capped by text, not taste: `muted-foreground` on `muted` lands at 4.56:1 light and 4.75:1 dark, and one more step fails 4.5. |
| The mark is **30px**, the wordmark 16px | The baseline's 28px mark with an 18px name let the lockup dominate a 56px bar against 20px icons opposite. The name coming down was the actual fix; 30px is where the mark settled. |
| Counters and chips sit at **14px** | The baseline's Box and ActionList previews set them at 12px, which contradicts the system's own type floor. The floor wins. |
| The Counter's fill is translucent ink, not `muted` | It sits on `card-header`, the surface where `muted` is weakest even after the correction (1.24:1). Ink at 20% gives it 1.50:1 and inverts with the theme for free. |
| The date field is the browser's native `<input type="date">` | It is the one control in the app we don't draw. A correct, keyboard-reachable, locale-aware calendar is a large component to build and an easy one to build slightly wrong, and the value it carries is a date, not a brand moment. |
| Blur has **two** meanings, and they never share a layer | The Veil blurs content *you could read*, to say "not yet". A dialog's scrim blurs a *screen you are no longer on*, to say "not here". One is 6px on the content itself, the other 2px on a backdrop behind a card. |
| Night's `chart-1` and `chart-2` re-stepped to L 0.56 and 0.66 | At the baseline's 0.70 and 0.72 both sat above the dark lightness band and the pair measured dE 12.9 for normal vision, below the 15 floor: two lines in a plot read as one colour. Validated against the Night card: all five checks pass, dE 18.7 normal, 17.6 deutan. |
| `card-header` left at its baseline value | It is 1.08:1 against `card` and cannot improve without reading as a different surface. But it always carries a border, and that hairline is what separates the band. |
