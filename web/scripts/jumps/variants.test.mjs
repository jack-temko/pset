import { describe, expect, it } from 'vitest';

import { scenarios } from './scenarios.mjs';
import { VARIANTS, variantIds } from './variants.mjs';

// What discovery finds in the fixture library: one of everything.
const book = { id: 'b1' };
const set = (id, extra = {}) => ({
  id,
  bookId: 'b1',
  total: 4,
  done: 0,
  turnedInAt: '',
  ...extra,
});
const found = {
  book,
  set: set('s1'),
  usageQuestion: { set: set('s1'), index: 0, label: '1.1' },
  askBook: book,
  inProgressSet: set('s1'),
  finishedSet: set('s2', { done: 4 }),
  turnedInSet: set('s3', { done: 4, turnedInAt: 'x' }),
  noContentsBook: { id: 'b3' },
  noTurnsBook: { id: 'b3' },
};

describe('variant coverage', () => {
  it('every variant of the manifest has a scenario', () => {
    const tagged = new Set(scenarios(found).map((s) => s.variant));
    const missing = variantIds().filter((v) => !tagged.has(v));
    expect(missing).toEqual([]);
  });

  it('fails for a variant nobody opens', () => {
    const tagged = new Set(scenarios(found).map((s) => s.variant));
    const manifest = { ...VARIANTS, ask: [...VARIANTS.ask, 'brand-new'] };
    expect(variantIds(manifest).filter((v) => !tagged.has(v))).toEqual([
      'ask/brand-new',
    ]);
  });

  it('a scenario is skipped, not absent, when the library lacks its variant', () => {
    const none = scenarios({ ...found, finishedSet: null });
    const sc = none.find((s) => s.variant === 'homework-set/finished');
    expect(sc.skip).toMatch(/finished/);
  });
});
