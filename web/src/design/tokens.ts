/** The foundations (`ideas/theme-grill.md`): the one theme's colour, type,
 *  space and shape as typed data. `tokens.css` carries the same values as CSS
 *  variables under the `ds` class; `tokens.test.ts` keeps the two equal and
 *  measures every text colour on every ground it may sit on. */

/** A ground a text colour may sit on, and the contrast it must reach there. */
export interface Allowed {
  ground: string;
  floor: number;
}

export interface Colour {
  name: string;
  value: string;
  /** What it is for. */
  use: string;
  /** For a text colour: its grounds. Empty for a colour that is only a ground
   *  or an edge. */
  on: readonly Allowed[];
}

/** The floor for text (WCAG AA) and for grey text (T6). */
export const TEXT_FLOOR = 4.5;
export const MUTED_FLOOR = 7;

/** A soft ground is its hue at this share over `bg-raised`. */
export const SOFT_SHARE = 0.15;

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** `hue` at `share` over `ground`, as a hex colour. */
export function mix(hue: string, ground: string, share: number): string {
  const h = channels(hue);
  const g = channels(ground);
  return `#${h
    .map((c, i) =>
      Math.round(c * share + g[i] * (1 - share))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

const BG = '#0f1114';
const BG_RAISED = '#16191d';
const BG_INSET = '#08090b';
const ATTENTION = '#d29922';
const DANGER = '#f85149';
const SUCCESS = '#3fb950';
const FG = '#f0f3f6';
const ACCENT_SOLID = '#1f6feb';
/** The smallest step from #da3633 that keeps white at 4.5:1 or more is none:
 *  it already reaches 4.61:1. */
const DANGER_SOLID = '#da3633';

/** Interaction steps (A5): hover and pressed are the control's ground with
 *  something mixed in. A solid ground takes black, since mixing `fg` into it
 *  lightens it and its white label falls below 4.5:1; a transparent control
 *  takes `fg` over `bg-raised`. */
export const HOVER_SHARE = 0.08;
export const PRESSED_SHARE = 0.14;

/** `danger` at 15 percent over `bg-raised` is #382124, where `danger` reaches
 *  4.44:1. This is the smallest step that reaches 4.5: the red channel down
 *  by 4 (A4). */
const DANGER_SOFT = '#342124';

const plain = ['bg', 'bg-raised', 'bg-inset'];
const on = (grounds: readonly string[], floor: number): Allowed[] =>
  grounds.map((ground) => ({ ground, floor }));

export const COLOURS: readonly Colour[] = [
  { name: 'bg', value: BG, use: 'the page ground', on: [] },
  {
    name: 'bg-raised',
    value: BG_RAISED,
    use: 'rows, panels, bands',
    on: [],
  },
  {
    name: 'bg-inset',
    value: BG_INSET,
    use: 'wells, the area behind the textbook page',
    on: [],
  },
  { name: 'border', value: '#3a3f46', use: 'control and panel edges', on: [] },
  {
    name: 'border-muted',
    value: '#282c32',
    use: 'rules between rows',
    on: [],
  },
  {
    name: 'fg',
    value: FG,
    use: 'text',
    on: on(
      [
        ...plain,
        'attention-soft',
        'danger-soft',
        'success-soft',
        'neutral-soft',
        'hover',
        'pressed',
      ],
      TEXT_FLOOR,
    ),
  },
  {
    name: 'fg-muted',
    value: '#9da4ad',
    use: 'secondary text',
    on: on(plain, MUTED_FLOOR),
  },
  {
    name: 'accent',
    value: '#4493f8',
    use: 'links, progress, focus',
    on: on(plain, TEXT_FLOOR),
  },
  {
    name: 'accent-solid',
    value: ACCENT_SOLID,
    use: 'the one primary button',
    on: [],
  },
  {
    name: 'accent-solid-hover',
    value: mix('#000000', ACCENT_SOLID, HOVER_SHARE),
    use: 'the primary button under the pointer',
    on: [],
  },
  {
    name: 'accent-solid-pressed',
    value: mix('#000000', ACCENT_SOLID, PRESSED_SHARE),
    use: 'the primary button while pressed',
    on: [],
  },
  {
    name: 'on-accent',
    value: '#ffffff',
    use: 'text on the primary button',
    on: on(
      ['accent-solid', 'accent-solid-hover', 'accent-solid-pressed'],
      TEXT_FLOOR,
    ),
  },
  {
    name: 'danger-solid',
    value: DANGER_SOLID,
    use: 'the solid destructive button',
    on: [],
  },
  {
    name: 'danger-solid-hover',
    value: mix('#000000', DANGER_SOLID, HOVER_SHARE),
    use: 'the destructive button under the pointer',
    on: [],
  },
  {
    name: 'danger-solid-pressed',
    value: mix('#000000', DANGER_SOLID, PRESSED_SHARE),
    use: 'the destructive button while pressed',
    on: [],
  },
  {
    name: 'on-danger',
    value: '#ffffff',
    use: 'text on the destructive button',
    on: on(
      ['danger-solid', 'danger-solid-hover', 'danger-solid-pressed'],
      TEXT_FLOOR,
    ),
  },
  {
    name: 'hover',
    value: mix(FG, BG_RAISED, HOVER_SHARE),
    use: 'a transparent control under the pointer: fg mixed over bg-raised, used on every plain ground',
    on: [],
  },
  {
    name: 'pressed',
    value: mix(FG, BG_RAISED, PRESSED_SHARE),
    use: 'a transparent control while pressed, and the tooltip ground: fg mixed over bg-raised, used on every plain ground',
    on: [],
  },
  {
    name: 'neutral-soft',
    value: mix(FG, BG_RAISED, HOVER_SHARE),
    use: 'the ground under a neutral tag',
    on: [],
  },
  {
    name: 'attention',
    value: ATTENTION,
    use: 'needs attention soon',
    on: on([...plain, 'attention-soft'], TEXT_FLOOR),
  },
  {
    name: 'attention-soft',
    value: mix(ATTENTION, BG_RAISED, SOFT_SHARE),
    use: 'the ground under attention',
    on: [],
  },
  {
    name: 'danger',
    value: DANGER,
    use: 'failed or destructive',
    on: on([...plain, 'danger-soft'], TEXT_FLOOR),
  },
  {
    name: 'danger-soft',
    value: DANGER_SOFT,
    use: 'the ground under danger',
    on: [],
  },
  {
    name: 'success',
    value: SUCCESS,
    use: 'done',
    on: on([...plain, 'success-soft'], TEXT_FLOOR),
  },
  {
    name: 'success-soft',
    value: mix(SUCCESS, BG_RAISED, SOFT_SHARE),
    use: 'the ground under success',
    on: [],
  },
  { name: 'page', value: '#e4e7ea', use: 'the textbook sheet', on: [] },
  {
    name: 'page-ink',
    value: '#2b2823',
    use: 'text on the textbook sheet',
    on: on(['page'], TEXT_FLOOR),
  },
];

export const FONTS = {
  serif: "'Source Serif 4 Variable', serif",
  sans: "'IBM Plex Sans Variable', sans-serif",
  mono: "'IBM Plex Mono', monospace",
} as const;

export type Face = keyof typeof FONTS;

export interface TypeStep {
  id: string;
  size: number;
  line: number;
  face: Face;
  weight: number;
  use: string;
  sample: string;
}

export const TYPE: readonly TypeStep[] = [
  {
    id: 'display',
    size: 44,
    line: 48,
    face: 'serif',
    weight: 500,
    use: 'one greeting or title a screen',
    sample: 'Good evening, Jack',
  },
  {
    id: 'heading',
    size: 22,
    line: 28,
    face: 'serif',
    weight: 500,
    use: 'section headings',
    sample: 'This week',
  },
  {
    id: 'reading-l',
    size: 20,
    line: 30,
    face: 'serif',
    weight: 400,
    use: 'the problem',
    sample: 'Problem 5.3. Find the current through the 4 ohm resistor.',
  },
  {
    id: 'reading',
    size: 17,
    line: 28,
    face: 'serif',
    weight: 400,
    use: 'help and other text the student reads',
    sample: 'Start from what the problem gives you: the source and the loop.',
  },
  {
    id: 'body',
    size: 15,
    line: 22,
    face: 'sans',
    weight: 400,
    use: 'the interface; labels at 500',
    sample: 'Problem set 4, due Friday',
  },
  {
    id: 'small',
    size: 14,
    line: 20,
    face: 'sans',
    weight: 400,
    use: 'secondary lines, tags',
    sample: '6 questions, 2 done',
  },
  {
    id: 'code',
    size: 14,
    line: 20,
    face: 'mono',
    weight: 400,
    use: 'codes, ids, anything copied',
    sample: 'ps4-q3 a1b2c3',
  },
];

/** The widest a line of reading text runs, in characters. */
export const READING_MEASURE = 66;

/** Multiples of 4. */
export const SPACING: readonly number[] = [
  4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 96,
];

export const LAYOUT = { gutter: 40, row: 44, control: 32 } as const;

export const RADII = [
  { name: 'tag', px: 4 },
  { name: 'control', px: 6 },
  { name: 'panel', px: 8 },
] as const;

export const BORDER = 1;
export const FOCUS = { width: 2, offset: 2, colour: 'accent' } as const;

/** The room around big type (T9): above and below, in pixels. */
export const ROOM = {
  display: { above: 96, below: 56 },
  heading: { above: 64, below: 16 },
} as const;

/** Relative luminance (WCAG 2). */
function lum(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two hex colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function colour(name: string): string {
  const c = COLOURS.find((x) => x.name === name);
  if (!c) throw new Error(`no colour ${name}`);
  return c.value;
}
