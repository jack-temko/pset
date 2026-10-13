import { describe, expect, it } from 'vitest';

import {
  COLOURS,
  contrast,
  colour,
  BORDER,
  FOCUS,
  FONTS,
  ROOM,
  LAYOUT,
  MUTED_FLOOR,
  RADII,
  SPACING,
  TEXT_FLOOR,
  TYPE,
} from './tokens';
import css from './tokens.css?raw';

/** The custom properties declared in the `.ds` block. */
function declared(): Map<string, string> {
  const block = /\n\.ds \{([^}]*)\}/.exec(css);
  if (!block) throw new Error('tokens.css has no .ds block');
  return new Map(
    [...block[1].matchAll(/--ds-([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [
      m[1],
      m[2].trim(),
    ]),
  );
}

describe('contrast', () => {
  const cases = COLOURS.flatMap((c) =>
    c.on.map((a) => ({ text: c.name, ...a })),
  );

  it('declares grounds for every text colour', () => {
    for (const n of [
      'fg',
      'fg-muted',
      'accent',
      'attention',
      'danger',
      'success',
      'on-accent',
    ])
      expect(cases.some((c) => c.text === n)).toBe(true);
  });

  it('holds the floors: 4.5 for text, 7 for grey text', () => {
    for (const c of cases)
      expect(c.floor, c.text).toBe(
        c.text === 'fg-muted' ? MUTED_FLOOR : TEXT_FLOOR,
      );
  });

  it.each(cases)(
    '$text on $ground reaches $floor',
    ({ text, ground, floor }) => {
      const ratio = contrast(colour(text), colour(ground));
      expect(
        ratio,
        `${text} on ${ground} is ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(floor);
    },
  );
});

describe('tokens.css and tokens.ts', () => {
  const vars = declared();

  it('agree on every colour', () => {
    for (const c of COLOURS) expect(vars.get(c.name), c.name).toBe(c.value);
  });

  it('agree on the fonts', () => {
    for (const [k, v] of Object.entries(FONTS))
      expect(vars.get(`font-${k}`), k).toBe(v);
  });

  it('agree on the type steps', () => {
    for (const t of TYPE) {
      expect(vars.get(`${t.id}-size`), t.id).toBe(`${String(t.size)}px`);
      expect(vars.get(`${t.id}-line`), t.id).toBe(`${String(t.line)}px`);
      expect(vars.get(`${t.id}-weight`), t.id).toBe(String(t.weight));
      expect(vars.get(`${t.id}-font`), t.id).toBe(`var(--ds-font-${t.face})`);
    }
  });

  it('agree on space and shape', () => {
    for (const s of SPACING)
      expect(vars.get(`space-${String(s)}`)).toBe(`${String(s)}px`);
    expect([...vars.keys()].filter((k) => k.startsWith('space-'))).toHaveLength(
      SPACING.length,
    );
    for (const [k, v] of Object.entries(LAYOUT))
      expect(vars.get(k)).toBe(`${String(v)}px`);
    for (const r of RADII)
      expect(vars.get(`radius-${r.name}`)).toBe(`${String(r.px)}px`);
  });

  it('agree on the border, the focus ring and the room around big type', () => {
    expect(vars.get('border-width')).toBe(`${String(BORDER)}px`);
    expect(vars.get('focus-width')).toBe(`${String(FOCUS.width)}px`);
    expect(vars.get('focus-offset')).toBe(`${String(FOCUS.offset)}px`);
    for (const [step, r] of Object.entries(ROOM)) {
      const m = new RegExp(`\\.ds-room-${step} \\{([^}]*)\\}`).exec(css);
      const body = m?.[1] ?? '';
      expect(body, step).toContain(
        `margin-top: var(--ds-space-${String(r.above)})`,
      );
      expect(body, step).toContain(
        `margin-bottom: var(--ds-space-${String(r.below)})`,
      );
    }
  });

  it('declares nothing that tokens.ts does not know', () => {
    const known = new Set<string>([
      ...COLOURS.map((c) => c.name),
      ...Object.keys(FONTS).map((k) => `font-${k}`),
      ...TYPE.flatMap((t) =>
        ['size', 'line', 'weight', 'font'].map((p) => `${t.id}-${p}`),
      ),
      ...SPACING.map((s) => `space-${String(s)}`),
      ...Object.keys(LAYOUT),
      ...RADII.map((r) => `radius-${r.name}`),
      'border-width',
      'focus-width',
      'focus-offset',
    ]);
    for (const k of vars.keys()) expect(known.has(k), k).toBe(true);
  });
});

describe('space', () => {
  it('is in multiples of 4', () => {
    for (const s of [...SPACING, ...Object.values(LAYOUT)])
      expect(s % 4, String(s)).toBe(0);
  });
});
