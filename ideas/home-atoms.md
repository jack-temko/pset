# The first four components: button, text link, tag, tooltip

## Status

Built, awaiting approval (branch `home-atoms`, base `design`).

## Information

**Why.** Home is the first view to be built (S12 in `ideas/screens-grill.md`). These
are its four smallest parts, and the first real units in the new format, drawn with
the new foundations.

**Decisions.** Jack's, from a short grill on 2026-10-13 (prior art: GitHub's Primer
pages for Button, Link, Label, IconButton and ProgressBar, read that day). They go
into each unit's `spec.ts` as typed decisions, with the questions and answers below
copied word for word into the unit's `log.md`.

Button:

| Id        | Decision                                                                                                                                 | Why                                                                     | Beat                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| button-d1 | Four variants: primary, default, quiet, danger (solid red)                                                                               | Jack: a destructive action looks dangerous before the click             | Three variants with red text for destructive; two                     |
| button-d2 | One size, 32 high                                                                                                                        | Every control aligns; Primer steers to its medium                       | Two sizes; three                                                      |
| button-d3 | While it runs, the button keeps its exact size and a spinner replaces its icon, or its label if it has none. A second press does nothing | Nothing moves; as GitHub's Primer does it                               | The label changes; no busy state; a spinner squeezed beside the label |
| button-d4 | Never disabled. A button that cannot act yet is "not ready": it takes focus and a press and says why                                     | Primer: disabled buttons are unreachable by keyboard; `student-decides` | Greyed and inert; hidden                                              |
| button-d5 | One optional icon before the label. An icon-only button is a separate unit, built when a screen needs one                                | Home needs none                                                         | Text only; building the icon button now                               |

Text link:

| Id      | Decision                                                                         | Why                                            | Beat                          |
| ------- | -------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------- |
| link-d1 | Underlined inside text; plain when standing alone, underlined on hover and focus | Colour is never the only signal; Primer's rule | Always underlined; hover only |
| link-d2 | A link goes somewhere; a button does something                                   | So the two never blur                          | Low-priority actions as links |

Tooltip (added 2026-10-13, after Jack tried the button and disliked the boxed line under a
not-ready button):

| Id         | Decision                                                                                                                         | Why                                                                  | Beat                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| tooltip-d1 | A tooltip sits below its control, centred, and moves to another side or shifts when there is no room, never leaving the viewport | As Primer's tooltip does                                             | A line under the control that can be clipped or overlap |
| tooltip-d2 | It is at most 250 wide and its text wraps                                                                                        | Primer's limit                                                       | One unbroken line                                       |
| tooltip-d3 | A tooltip closes when its control is covered or leaves the window                                                                | It floats above everything, so it must not outlive what it points at | Staying open over a top bar                             |
| tooltip-d4 | The tooltip is our own code: placed once in page coordinates in the browser's top layer, with no positioning library             | No lag while scrolling and no new dependency                         | `@primer/behaviors`; Floating UI                        |

Scrolling log. Jack: **"The tooltip seems to lag slightly behind when scrolling"** and **"Can
we use the tooltip library github uses? Also one more issues, when the button scrolls out of
frame the tooltip displays over the top bar"**. How should the tooltip be positioned? Keep
ours, add the close-when-covered fix (Recommended) / Use GitHub's positioning function /
Use Floating UI. **Keep ours, add the close-when-covered fix (Recommended).**

Button button-d4 now reads: never disabled; a button that cannot act yet is not ready: it
takes focus and a press, and says why in a tooltip (beat: a boxed line under the button, first
built). The log: Jack, **"For the non disabled buttons, I don't love how the line that comes
down looks, it being in a box and all. Also how does github manage that line if the button is
in a spot where there is no space for it?"**; How should a not-ready button say why? On the
page, placed by the screen (Recommended) / A tooltip, as GitHub's optional one / The line
under the button, without the box / Pressing opens a small dialog. **A tooltip, as GitHub's
optional one.** Sources: https://primer.style/product/components/button/guidelines and
https://primer.style/product/components/tooltip/guidelines .

The tooltip unit is `web/src/units/tooltip/`: a small floating label tied to one control
(props `text`, `children`, `open?`, `side?`), shown on hover after 50ms and on keyboard focus,
hidden on pointer leave, blur and Escape; drawn in the top layer with the Popover API (a
absolute element on the body without it) and placed in document coordinates from the control's rect: below, centred, 4
away, else the opposite side, then right, then left, shifted to stay 8 inside the viewport.
Ground `pressed`, text `fg` small, 4 radius, 4 by 8 padding, at most 250 wide.

Tag:

| Id     | Decision                                                                                   | Why                                                 | Beat                                   |
| ------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------- | -------------------------------------- |
| tag-d1 | One shape: a soft ground with its text, an optional glyph before the word, never clickable | A tag is always recognisable as a tag               | Outlined and soft shapes; neutral only |
| tag-d2 | Two tones to start: neutral and attention. More are added when a screen needs them         | Jack: "the tones got out of hand, lets start small" | Five tones                             |

The log, for each unit's `log.md` (questions, options, answers verbatim):

- Button: which variants exist? Primary, default, quiet (Recommended) / Add a solid
  danger button / Primary and default only. **Add a solid danger button.**
- Button: how many sizes? **One, 32px (Recommended).**
- Button: what happens while its action is running? **Spinner in the button, label
  stays, width kept (Recommended).**
- Button: can a button be disabled? **No: it stays pressable and says why
  (Recommended).**
- Button: icons? **An optional icon before the label (Recommended).**
- Button: a busy button with no icon cannot keep its label in place, keep its width and
  show a spinner all at once. Which gives? The spinner replaces the label (Recommended) /
  A thin moving line, no spinner / As built: spinner squeezed before the label / Let the
  button grow. **"how does github do it?"**
- Button: do it GitHub's way? Yes, GitHub's way (Recommended) / A thin moving line, no
  spinner / As built. **Yes, GitHub's way (Recommended).** Sources:
  https://primer.style/product/components/button/ and
  `packages/react/src/Button/ButtonBase.module.css` in primer/react. The label keeps its
  box with `visibility: hidden` and the spinner is drawn over it, so the size cannot
  change.
- Text link: when is it underlined? **Underlined inside text, plain when standing
  alone (Recommended).**
- Tag: what forms does it take? One shape, five tones (Recommended) / Two shapes /
  Neutral only. **"one shape, but the tones got out of hand, lets start small like the
  buttons and grow if needed"**

### Capitalisation

Jack, 2026-10-13:

- Jack: **"What about the capitalization of words in headers, buttons, and other
  components. Sometimes the all lowercase for stuff like chips seems weird but maybe I am
  crazy"**
- Make sentence case a rule for every label? Yes, sentence case everywhere
  (Recommended) / Sentence case, but tags stay lowercase / Title Case for headings and
  buttons. **Yes, sentence case everywhere (Recommended).** It is the rule
  `sentence-case`; the tag examples are "Generated" and "Due Fri".

Settled 2026-10-13 after the builder found the first plan broke the contrast floors
(the coordinator's choices, flagged to Jack):

- Neutral tag: `fg` text on `neutral-soft`, which is `fg` at 8 percent over `bg-raised`
  (#272a2e), pinned as a token. `fg` on `neutral-soft` is a declared contrast pair.
  (`fg-muted` cannot reach 7:1 on any ground lighter than `bg-raised`.)
- Hover and pressed: on the solid grounds (`accent-solid`, `danger-solid`) black is
  mixed in, 8 percent for hover and 14 percent for pressed, with `on-accent` and
  `on-danger` declared on all four results at 4.5. On the transparent variants (default,
  quiet) `fg` is mixed in at 8 and 14 percent over the ground beneath. (Mixing `fg` into
  a solid took white below 4.5.)
- A not-ready button has no hover or pressed fill: its muted text and reason line mark it.

Assumed (mine, flagged to Jack): the tag's two starting tones; the "not ready" look
and where its reason shows; hover and pressed colours; the two new rules below; the
danger button's solid red.

### Files

First: `git merge --ff-only origin/design` so the branch has the screens spec.

- `web/src/design/tokens.ts`, `tokens.css`, `tokens.test.ts`: add `danger-solid`
  (start from #da3633) and `on-danger` #ffffff, at least 4.5:1, adjusted minimally if
  not; add the interaction steps as tokens used by every control: hover is the
  control's ground with `fg` mixed in at 8 percent, pressed at 14 percent, computed and
  pinned like the soft grounds. The Foundations tab shows them.
- `web/src/design/rules.ts`: two rules, `one-primary` (use one primary button in a
  region; check: count primary buttons in each region) and `links-go-buttons-do` (use
  a link to go somewhere and a button to do something; check: no link runs an action,
  no button only navigates).
- `web/src/units/button/`: `index.tsx`, `spec.ts`, `examples.tsx`, `log.md`.
  Props: `variant` (`primary | default | quiet | danger`, default `default`),
  `icon?` (a lucide icon component), `busy?`, `notReady?: string` (the reason),
  `onPress`, `children`, plus `type`. 32 high, 6 radius, 12 horizontal padding, sans
  15/22 weight 500, label on one line. Grows to its label; in a container narrower
  than its label it truncates with an ellipsis and never wraps; narrowest 64.
  Looks: primary `accent-solid` with `on-accent`; default transparent with a 1px
  `border` and `fg`; quiet no border, `fg`; danger `danger-solid` with `on-danger`.
  Hover and pressed use the interaction steps. Focus ring from the tokens. Busy: a 16
  spinner takes the icon's place (or sits before the label if there is no icon, with
  the label's position unchanged: reserve nothing, overlay the spinner in a slot that
  is always 0 wide unless an icon or busy is present, and say in the report how you
  kept the width fixed), `aria-busy`, presses ignored, focus kept. Not ready: text
  at `fg-muted`, the same shape, `aria-disabled="true"` while still focusable; on a
  press or on keyboard focus its reason shows as one small muted line anchored under
  the button, positioned so nothing moves, announced politely, gone on blur. Respects
  reduced motion for the spinner.
  States for the spec and examples: one per variant at rest; with icon; busy; not
  ready; in a 64px container. Stress: a 60 character label in a 160px container.
  Actions: `press` (label "the button's own", key Enter or Space, no target: it runs
  the caller's action), `press-not-ready` (shows the reason). No data, no flows.
  Priority: seen first, its label. Sizes: narrowest 64; gives way: the label
  truncates. Rules cited: `one-primary`, `links-go-buttons-do`, `student-decides`,
  `honest-waits`, `colour-has-a-word`, `contrast-floors`, `serif-to-read`. Local rule:
  keep a button's label on one line. Inputs: the props above.
- `web/src/units/link/`: same four files. Props: `href`, `inline?` (default false),
  `children`. Colour `accent`. Inline: underlined, inherits the size and face of the
  text it sits in. Standalone: sans 15/22, no underline, underlined on hover and focus.
  Focus ring from the tokens. States: standalone; inline in a serif sentence; inline in
  a sans line; hover and focus shown by a forced-state prop in examples only. Stress:
  a 90 character link in a 200px container, which wraps like text. Action: `follow`
  (key Enter), target left to the caller. Rules cited: `links-go-buttons-do`,
  `colour-has-a-word`, `contrast-floors`, `figures-follow-text`. Decisions above.
- `web/src/units/tag/`: same four files. Props: `tone` (`neutral | attention`,
  default `neutral`), `icon?`, `children`. 24 high, 4 radius, 8 horizontal padding,
  sans 14/20, one line. Neutral: `bg-raised` mixed toward `fg` enough to read as a
  ground on both `bg` and `bg-raised` (pin it as a token, `neutral-soft`), text
  `fg-muted`. Attention: `attention-soft` with `attention` text. Not focusable, no
  hover. States: neutral ("generated"); attention with a clock glyph ("due Fri");
  attention without a glyph. Stress: a 40 character tag in a 120px container, which
  truncates with an ellipsis. No actions, data or flows. Rules cited:
  `colour-has-a-word`, `contrast-floors`. Local rule: write a tag as one or two words.
- Each unit's contrast pairs are declared in `tokens.ts` so the test covers them
  (`fg-muted` on `neutral-soft`, `on-danger` on `danger-solid`, and so on).
- `web/src/design/checks.test.ts` or the registry test: only if the count of units or
  rules is asserted.
- `design/design-docs.md`: one short section, "The first units", naming the four and
  that the Components tab now appears.
- `ideas/README.md`: this file's row. This file's Status when done.

### Steps

1. Fast-forward to `origin/design`; commit this plan.
2. Tokens and the two rules.
3. Button. 4. Text link. 5. Tag. Each with its spec, examples and log.
4. Docs and Status.

### Tests

- `make check`, which runs the spec checks on the four real units (every state has a
  render, a stress render, cited rules exist, limits) and the contrast test.
- A small behaviour test per unit: button ignores a press while busy and shows its
  reason when not ready; link renders an anchor with its href; tag is not focusable.
- To photograph at 1280: `/design/component/button` in each state and with Stress,
  `/design/component/link`, `/design/component/tag`, `/design/foundations`,
  `/design/rules`.

### Acceptance

The Components tab lists Button, Text link and Tag. Each page shows its states live in
the dark theme, its props, its rules and its decisions with a Full log link. A button
is never disabled: a not-ready button can be tabbed to and says why. A busy button
does not change width. Twenty rules are on the Rules tab. `make check` passes.

### Out of scope

- Any other component, Home itself, and any change to the old app.
- An icon-only button, a tooltip or popover component, a link styled as a button.

If a decision is missing or two conflict, stop and report; do not guess.
