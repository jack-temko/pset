# Theme and foundations: grill

- status: approved
- date: 2026-10-13
- brief: PSet's colour, type, spacing and shape from scratch, starting from the mix (V14 in `ideas/vision-grill.md`); judged from an ordinary student, maybe a bit tired, doing this week's work
- sources:
  - `web/src/index.css` (today's tokens, all OKLCH; one light and one dark set), `web/src/lib/theme.ts`, `web/src/design/themes.ts`, `web/package.json` (Inter, Newsreader, JetBrains Mono bundled)
  - `ideas/vision-grill.md`, `ideas/gallery-docs-grill.md`
  - https://primer.style/foundations/color (role-named tokens: `fgColor`, `bgColor`, `borderColor`, each with default, muted and so on; the same name changes value by mode)
  - https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale (12 steps: 1 to 2 backgrounds, 3 to 5 component fills, 6 to 8 borders, 9 to 10 solids, 11 to 12 text)
  - https://designsystem.digital.gov/components/typography/ (body at least 16px, line height at least 1.5 for long text, 45 to 90 characters a line with 66 recommended, serif suggested for long text and sans for interfaces)
  - https://w3c.github.io/wcag/understanding/contrast-minimum.html (4.5:1 for text, 3:1 for large text of 24px or 18.5px bold)
  - not found: Primer's type sizes and line heights

## Summary

### In one line

One dark theme on a near-black ground with a trace of blue: Source Serif to read, IBM
Plex Sans to act, one blue and three status colours, and room around big type.

### Decisions

| #   | Decision                                                                                                                           | Why                                                                               | Beat                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| T1  | One theme: dark, tuned to stay readable in bright rooms. No light theme                                                            | Jack: "I have never personally uses pset in light mode"                           | Dark primary with a real light theme; dark plus a high-contrast dark |
| T2  | This grill covers colour, type, spacing and shape. The mark, motion and icons come later                                           | Everything a component needs to be drawn                                          | Colour and type only; everything including the mark                  |
| T3  | The ground is "half blue": ink with half the blue taken out                                                                        | Ink was "a bit too blue, looks weird with the textbook"                           | Ink; a true neutral; a warm grey; warm paper; slate                  |
| T4  | Typefaces: Source Serif 4 to read, IBM Plex Sans for the interface, IBM Plex Mono for codes, ids and anything that might be copied | Chosen by eye from three sets                                                     | Newsreader with Inter; Literata with Geist                           |
| T5  | Figures are set in the same font as the text they sit in. No separate figures font                                                 | Jack: "Problem 5.3" must not be two fonts                                         | Mono figures; sans figures everywhere                                |
| T6  | Contrast: grey text at 7:1 or more, borders quiet                                                                                  | Holds up in daylight without a louder grid                                        | Normal throughout (first chosen); strong throughout                  |
| T7  | The textbook page is a slightly dimmed sheet in a cool off-white                                                                   | A white scan must not glare beside a dark panel                                   | As scanned; inverted; cream; grey                                    |
| T8  | Four colours carry meaning: blue (action, links, progress), amber (needs attention soon), red (failed, destructive), green (done)  | Jack asked for the smallest set that covers everything, then added green for done | Three hues with done neutral; two hues; course colours               |
| T9  | Big type gets room: 96 above and 56 below the display size, 64 above and 16 below a heading                                        | Jack: the welcome "needs to have some room around it"                             | The tighter first mock                                               |
| T10 | A test computes the contrast of every text token on every ground it may sit on and fails below the floor                           | A new token cannot land unreadable                                                | A rule checked by eye only                                           |

### The artifact(s)

**Colour** (role names; one value each, since there is one theme):

| Token          | Value   | For                                                       |
| -------------- | ------- | --------------------------------------------------------- |
| `bg`           | #0f1114 | the page ground                                           |
| `bg-raised`    | #16191d | rows, panels, bands                                       |
| `bg-inset`     | #08090b | wells, the area behind the textbook page                  |
| `border`       | #3a3f46 | control and panel edges                                   |
| `border-muted` | #282c32 | rules between rows                                        |
| `fg`           | #f0f3f6 | text                                                      |
| `fg-muted`     | #9da4ad | secondary text (7.0:1 on raised, 7.5:1 on the ground)     |
| `accent`       | #4493f8 | links, progress, focus                                    |
| `accent-solid` | #1f6feb | the one primary button                                    |
| `on-accent`    | #ffffff | text on the primary button                                |
| `attention`    | #d29922 | needs attention soon, with `attention-soft` as its ground |
| `danger`       | #f85149 | failed or destructive, with `danger-soft`                 |
| `success`      | #3fb950 | done, with `success-soft`                                 |
| `page`         | #e4e7ea | the textbook sheet, with `page-ink` #2b2823               |

A soft ground is its hue at 15 percent over `bg-raised`. Colour is never the only
signal: each status has its word or glyph.

**Type**

| Step      | Size / line | Face               | Use                                   |
| --------- | ----------- | ------------------ | ------------------------------------- |
| display   | 44 / 48     | Source Serif 4 500 | one greeting or title a screen        |
| heading   | 22 / 28     | Source Serif 4 500 | section headings                      |
| reading-l | 20 / 30     | Source Serif 4 400 | the problem                           |
| reading   | 17 / 28     | Source Serif 4 400 | help and other text the student reads |
| body      | 15 / 22     | IBM Plex Sans 400  | the interface; labels at 500          |
| small     | 14 / 20     | IBM Plex Sans 400  | secondary lines, tags                 |
| code      | 14 / 20     | IBM Plex Mono 400  | codes, ids, anything copied           |

Reading text is at most 66 characters wide. Columns of figures use tabular numbers.

**Space and shape.** Spacing in multiples of 4: 4, 8, 12, 16, 20, 24, 32, 40, 48, 56,
64, 96. Page gutter 40. Rows 44 high, controls 32. Corners 4 (tags), 6 (controls),
8 (panels). Borders 1px. No shadows. Focus ring 2px `accent`, offset 2.

### Assumed

- A1: the sizes, spacing and shape above are the second mock's, which Jack judged by
  eye and corrected only for room and colour. He was not asked each number.
- A2: the tokens live in a new `web/src/design/tokens.css`, applied under one root
  class that new units and `/design` examples use, so old components and
  `web/src/index.css` are untouched. `web/src/design/tokens.ts` holds the same values
  as typed data, with each text colour's allowed grounds, for the Foundations tab and
  the contrast test.
- A3: the three faces are bundled as `@fontsource` packages (new dependencies), not
  loaded from a CDN as in the mock.
- A4: `success` is #3fb950 and `danger-soft` is adjusted until `danger` on it passes
  4.5:1; neither was on the mock Jack saw.
- A5: six rules join the rulebook: serif to read and sans to act; mono only for codes,
  ids and what may be copied; a figure takes its text's font; colour never the only
  signal; text contrast floors (4.5:1, 7:1 for grey text); big type gets room.
- A6: the `/design` stage's Theme control goes, since there is one theme. The old
  app keeps its Paper and Night until its screens are replaced.
- A7: the Foundations tab shows colour, type, space and shape from `tokens.ts`.

### Open

- The mark, motion and icons (T2).
- Home's emptiness below the list, and every other layout matter: the screens grill.
- Primer's type sizes were not found; the scale above rests on the mock and on the
  16px and 1.5 guidance for long text (reading sizes meet it; the 15px interface size
  is below it by one pixel, on purpose, for density).

## Reversals

- The 2026-09-17 decisions of two themes (Paper and Night), ink and paper colours,
  and Newsreader, Inter and JetBrains Mono, in `design/design-system.md`: replaced by
  T1, T3 and T4 for new work.
- T6 reversed Jack's first answer (normal contrast) after one push back.
- T8 reversed my proposal of three hues.

## Disagreements

- Themes: recommended light and dark, then dark with a real light theme. Jack chose
  dark only (T1).
- Colour: my pick was warm, then warm grey. Jack chose ink, then half blue (T3).
- Page tone: recommended cream. Jack chose cool (T7).
- Meaning colours: recommended three hues with done neutral. Jack added green (T8).

## Frontier

Empty.

## Log

### Gate 0

Audit of today's tokens and the prior art above shown to Jack in brief.

### Batch 1, gate 1 (scope)

- What was off in snapshot D? (multi: The colours, The type, Too much mono, The layout)
  **"the color, but I would need to see a better mock to be sure about the rest"**
- Which themes does PSet have from day one? Light and dark (Recommended) / Light first
  / Dark first. **"I have never personally uses pset in light mode. so lets go dark
  first, but still looks good in high light level enviorments."**
- How much does this one grill cover? **Colour, type, spacing and shape
  (Recommended).**
- Typefaces: stay with the three, or look wider? **Look wider (Recommended).**

### Batch 2

- What does "dark first, but still looks good in high light level environments" mean?
  Dark is primary, light is a real second theme (Recommended) / Dark only, tuned for
  bright rooms / Dark, plus a high-contrast dark. **Dark only, tuned for bright rooms.**

### Batch 3, gate 2, on the built mock

Mock at `/theme-mock/<home|homework>?k=&t=&c=&f=` (temporary): three palettes, three
typeface sets, normal or strong contrast, figures in mono or sans.

- Which colour direction? Warm (my pick) / Ink / Slate / None of them yet. **Ink.**
- Which typeface set? 1: Newsreader, Inter, JetBrains Mono / 2: Source Serif, IBM Plex
  / 3: Literata, Geist / Mix across sets. **2: Source Serif, IBM Plex.**
- Figures: in the sans, aligned (Recommended) / in mono. **"figures can move to being
  the same font as its text, especially when its like Problem 5.3 and the text and
  numbers are a different font. Reserve mono for codes, ids, etc. Anything that might
  need to be copied."**
- Contrast: Strong (Recommended) / Normal / Somewhere between. **Normal.**

### Batch 4, gates 2 and 3

- With the colour changed, does anything still look off? (multi) **"background might be
  a bit too blue, looks weird with the textbook. And big typograph like the welcome
  call out needs to have some room around it"**
- The textbook page in a dark app? **Slightly dimmed (Recommended).**
- How many colours carry meaning? One accent, three status colours (Recommended) / One
  accent only / Accent, status and course colours. **"I want to pick the smallest
  subset possible that covers everything we might need, smartly"**
- Push back on contrast: keep normal? Strong text, normal borders / Keep normal.
  **Strong text, normal borders.**

Proposed to Jack for "smallest subset": one accent (blue) and two status hues,
attention (amber) and danger (red). Done is neutral with a check. Shown in round two
of the mock, with four grounds from ink to neutral and three page tones.

### Batch 5, on round two of the mock

Mock: `?k=ink|half|neutral|warmgrey`, `?p=cream|grey|cool`; typeface set 2, figures in
their text's font, strong text with normal borders, more room around big type, and
three meaning colours shown on Home.

- Which ground sits best with the textbook page? Warm grey (my pick) / Neutral / Half
  blue / Ink, as before. **Half blue.**
- Which tone for the dimmed textbook page? Cream (Recommended) / Grey / Cool. **Cool.**
- Is blue, amber, red, with done neutral, the set? Yes, three hues (Recommended) / Two
  hues / Add green for done. **Add green for done.**
- What keeps these colours readable? **A test on the tokens (Recommended).**
