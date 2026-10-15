import { describe, expect, it } from 'vitest';

import type { Block } from '@/api/gen/doc';

import { runsSource, runsText } from './runs';
import { answersOf, buildTree } from './tree';

const t = (text: string) => [{ t: text }];

describe('buildTree', () => {
  const doc: Block[] = [
    { type: 'para', text: t('Before any part.') },
    { type: 'part', label: '(a)', title: t('First') },
    { type: 'para', text: t('Straight into the part.') },
    { type: 'step', title: t('One') },
    { type: 'para', text: t('a') },
    { type: 'math', tex: 'x' },
    { type: 'step', title: t('Two') },
    { type: 'answer', label: '(a)', text: t('42') },
    { type: 'part', label: '(b)', title: t('Second') },
    { type: 'step', title: t('One again') },
    { type: 'para', text: t('b') },
    { type: 'answer', label: '(b)', text: t('7') },
  ];

  it('nests steps under parts, numbers them from 1 in each part, and keeps flat indexes', () => {
    const tree = buildTree(doc);
    expect(tree.map((s) => s.part?.label)).toEqual([undefined, '(a)', '(b)']);
    const a = tree[1];
    expect(a.index).toBe(1);
    // The blocks before the part's first step have a group of their own, with no step.
    expect(
      a.groups.map((g) => [g.step ? g.number : 0, g.items.map((i) => i.index)]),
    ).toEqual([
      [0, [2]],
      [1, [4, 5]],
      [2, [7]],
    ]);
    // Numbering starts over in the next part.
    expect(tree[2].groups[0].number).toBe(1);
    expect(tree[2].groups[0].index).toBe(9);
  });

  it('draws every block exactly once', () => {
    const seen = buildTree(doc).flatMap((s) =>
      s.groups.flatMap((g) => g.items.map((i) => i.index)),
    );
    const markers = doc.flatMap((b, i) =>
      b.type === 'part' || b.type === 'step' ? [i] : [],
    );
    expect([...seen, ...markers].sort((x, y) => x - y)).toEqual(
      doc.map((_, i) => i),
    );
  });

  it('a guide with no parts is one section of steps', () => {
    const tree = buildTree([
      { type: 'step', title: t('Only') },
      { type: 'para', text: t('x') },
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].part).toBeUndefined();
    expect(tree[0].groups[0].number).toBe(1);
  });

  it('an empty document has no sections', () => {
    expect(buildTree([])).toEqual([]);
  });

  it('collects the answers in order', () => {
    expect(answersOf(doc).map((a) => a.label)).toEqual(['(a)', '(b)']);
  });
});

describe('runs', () => {
  const runs = [
    { t: 'a ' },
    { t: 'bold', b: true },
    { t: ' and ' },
    { m: 'x^2' },
    { t: ' see ' },
    { cite: 44 },
    { t: ' ' },
    { m: 'y', d: true },
  ];
  it('reads back as the source the model writes', () => {
    expect(runsSource(runs)).toBe(
      'a **bold** and \\(x^2\\) see [p. 44] \\[y\\]',
    );
  });
  it('reads as bare text for a label', () => {
    expect(runsText(runs)).toBe('a bold and x^2 see p. 44 y');
  });
});
