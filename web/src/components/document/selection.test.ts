import { describe, expect, it } from 'vitest';

import type { Block } from '@/api/gen/doc';
import { PageMap } from '@/lib/pages';

import {
  answerAbout,
  blockText,
  chipOf,
  asked,
  excerptOf,
  guideAbout,
  heldSel,
  NOTHING_PENDING,
  pendingOf,
  picked,
  sent,
  nounOf,
  parseSel,
  pathOf,
  selBlock,
  selLine,
  selPart,
  selStep,
  selectionText,
} from './selection';

const t = (text: string) => [{ t: text }];

const DOC: Block[] = [
  { type: 'part', label: '(a)', title: t('The eigenvalues') },
  {
    type: 'para',
    text: [
      { t: 'We need ' },
      { m: '\\det(A - \\lambda I)' },
      { t: ' to vanish ' },
      { cite: 132 },
      { t: '.' },
    ],
  },
  { type: 'step', title: t('Solve it') },
  {
    type: 'derivation',
    steps: [
      { tex: '(2-\\lambda)^2 - 1', why: t('A difference of squares.') },
      { tex: '\\lambda = 1' },
    ],
  },
  {
    type: 'answer',
    label: '(a)',
    text: [
      { m: '\\lambda_1 = 1' },
      { t: ' and ' },
      { m: '\\lambda_2 = 3' },
      { t: '.' },
    ],
  },
  { type: 'part', label: '(b)', title: t('Eigenvectors') },
  { type: 'step', title: t('Find them') },
  { type: 'para', text: t('For each lambda.') },
];

// The book's pages sit 16 behind their PDF numbers.
const PAGES = PageMap.single(16);

describe('parseSel', () => {
  it('reads every kind back', () => {
    expect(parseSel('b12')).toEqual({ kind: 'block', index: 12 });
    expect(parseSel('l7.3')).toEqual({ kind: 'block', index: 7, line: 3 });
    expect(parseSel('p2')).toEqual({ kind: 'part', index: 2 });
    expect(parseSel('s4')).toEqual({ kind: 'step', index: 4 });
    expect(parseSel('x')).toBeNull();
  });
});

describe('nounOf', () => {
  it('names what the student pointed at', () => {
    expect(nounOf(selBlock(1), DOC[1])).toBe('this paragraph');
    expect(nounOf(selBlock(3), DOC[3])).toBe('this derivation');
    expect(nounOf(selLine(3, 1))).toBe('line 2');
    expect(nounOf(selPart(0))).toBe('this part');
    expect(nounOf(selStep(2))).toBe('this step');
  });
});

describe('pathOf and chipOf', () => {
  it('says where a selection sits, in words and as the chip says it', () => {
    expect(pathOf(DOC, selBlock(3))).toBe('part (a), step 1');
    expect(pathOf(DOC, selLine(3, 1))).toBe('part (a), step 1, line 2');
    expect(pathOf(DOC, selBlock(1))).toBe('part (a)');
    expect(pathOf(DOC, selPart(0))).toBe('part (a)');
    expect(pathOf(DOC, selStep(6))).toBe('part (b), step 1');
    expect(chipOf(DOC, selBlock(3))).toBe('(a).1');
    expect(chipOf(DOC, selLine(3, 1))).toBe('(a).1 line 2');
    expect(chipOf(DOC, selPart(0))).toBe('(a)');
  });

  it('numbers steps without a part by name', () => {
    const bare: Block[] = [
      { type: 'step', title: t('Only') },
      { type: 'para', text: t('x') },
    ];
    expect(pathOf(bare, selBlock(1))).toBe('step 1');
    expect(chipOf(bare, selBlock(1))).toBe('step 1');
  });
});

describe('selectionText', () => {
  it('gives one line of a derivation as the tutor receives it', () => {
    expect(selectionText(DOC, selLine(3, 0))).toBe(
      '1. \\[(2-\\lambda)^2 - 1\\] (A difference of squares.)',
    );
  });

  it('keeps math as TeX and moves citations to printed pages', () => {
    expect(selectionText(DOC, selBlock(1), PAGES)).toBe(
      'We need \\(\\det(A - \\lambda I)\\) to vanish [p. 116].',
    );
    expect(selectionText(DOC, selBlock(1))).toBe(
      'We need \\(\\det(A - \\lambda I)\\) to vanish [p. 132].',
    );
  });

  it('gives a heading with its whole group, heading first', () => {
    expect(selectionText(DOC, selPart(0))).toBe(
      [
        'The eigenvalues',
        'We need \\(\\det(A - \\lambda I)\\) to vanish [p. 132].',
        'Solve it',
        '1. \\[(2-\\lambda)^2 - 1\\] (A difference of squares.)',
        '2. \\[\\lambda = 1\\]',
        '(a): \\(\\lambda_1 = 1\\) and \\(\\lambda_2 = 3\\).',
      ].join('\n'),
    );
  });

  it('draws the other cards in words', () => {
    expect(
      blockText({
        type: 'plot',
        title: 'Cost',
        x: { label: 'p' },
        y: { label: 'dollars' },
        series: [{ label: 'New plan', points: [[0, 15]] }],
        marks: [{ x: 0.2, y: 20, label: 'cross' }],
      }),
    ).toBe(
      '[plot: Cost; dollars against p; New plan; marks: cross at 0.2, 20]',
    );
    expect(
      blockText(
        {
          type: 'statement',
          kind: 'Definition',
          number: '2.17',
          name: 'independent',
          page: 48,
          text: t('Only the zero choice.'),
        },
        PAGES,
      ),
    ).toBe('Definition 2.17 (independent), p. 32: Only the zero choice.');
    expect(
      blockText({
        type: 'table',
        columns: [t(''), t('Needs')],
        rows: [[t('Injective'), t('dim V ≤ dim W')]],
      }),
    ).toBe(' | Needs\nInjective | dim V ≤ dim W');
    expect(
      blockText({ type: 'code', code: '(fib 5)', language: 'scheme' }),
    ).toBe('(fib 5)');
    expect(
      blockText({ type: 'raw', of: 'plot', text: 'what the model wrote' }),
    ).toBe('what the model wrote');
  });
});

describe('excerptOf', () => {
  it('strips the source marks and cuts to fit', () => {
    expect(excerptOf('\\[E[C] = 15 + \\frac{1}{p}\\] dollars a month')).toBe(
      'E[C] = 15 + \\frac{1}{p} doll…',
    );
    expect(excerptOf('The **key idea** is `Kirchhoff`')).toBe(
      'The key idea is Kirchhoff',
    );
    expect(excerptOf('short')).toBe('short');
  });
});

describe('the About a selection becomes', () => {
  it('carries the problem and the exact selection, named by question and place', () => {
    const about = guideAbout({
      question: '4.72',
      problem: 'For what p is the new plan cheaper?',
      blocks: DOC,
      sel: selLine(3, 1),
      stage: 'walkthrough',
      pages: PAGES,
    });
    expect(about.label).toBe('4.72 · (a).1 line 2');
    expect(about.text).toBe(
      [
        'For what p is the new plan cheaper?',
        '',
        "The student selected part (a), step 1, line 2 of this problem's walkthrough:",
        '',
        '2. \\[\\lambda = 1\\]',
      ].join('\n'),
    );
  });

  it('names the hint as its own place', () => {
    const hint: Block[] = [
      { type: 'hint', text: t('Start from the determinant.') },
    ];
    const about = guideAbout({
      question: '4.72',
      problem: 'Find the eigenvalues.',
      blocks: hint,
      sel: selBlock(0),
      stage: 'hint',
    });
    expect(about.label).toBe('4.72');
    expect(about.text).toBe(
      "Find the eigenvalues.\n\nThe student selected this problem's hint:\n\nStart from the determinant.",
    );
  });

  it('labels a selection from an answer with an excerpt, and names the turn it came from', () => {
    const about = answerAbout({
      question: 'Why does every operator have one?',
      about: '4.72',
      blocks: DOC,
      sel: selBlock(3),
    });
    // A derivation's words would be TeX, so the chip names it instead.
    expect(about.label).toBe('derivation');
    expect(about.text).toBe(
      [
        'The student is looking at part (a), step 1 of an earlier answer, to the question "Why does every operator have one?", which you answered about 4.72. They selected:',
        '',
        '1. \\[(2-\\lambda)^2 - 1\\] (A difference of squares.)',
        '2. \\[\\lambda = 1\\]',
      ].join('\n'),
    );
  });
});

describe('answer chips', () => {
  const chip = (blocks: Block[], sel: string) =>
    answerAbout({ question: 'q', blocks, sel }).label;

  it('gives words as a few words, and TeX or nothing as a name', () => {
    expect(chip(DOC, selBlock(1))).toBe('We need \\det(A - \\lambda I)…');
    expect(chip(DOC, selLine(3, 1))).toBe('line 2');
    expect(chip([{ type: 'math', tex: '\\frac{a}{b}' }], selBlock(0))).toBe(
      'equation',
    );
    expect(chip([{ type: 'para', text: [] }], selBlock(0))).toBe('paragraph');
  });
});

describe('the pending selection', () => {
  const about = { label: 'x', text: 'y' };
  const sel = pendingOf('q:1:walkthrough', DOC, selBlock(1), PAGES);

  it('a first pick lands, whatever chip is riding', () => {
    expect(picked(NOTHING_PENDING, sel)).toEqual({ about: null, sel });
    // A question's chip has no selection of its own and stays.
    expect(picked({ about, sel: null }, sel)).toEqual({ about, sel });
  });

  it('a pick retires the chip of the selection it replaces', () => {
    expect(
      picked(
        { about, sel: pendingOf('q:1:walkthrough', DOC, selBlock(4), PAGES) },
        sel,
      ),
    ).toEqual({ about: null, sel });
  });

  it('sending spends only the chip that went out', () => {
    const staged = { about, sel };
    expect(sent(staged, about)).toBe(NOTHING_PENDING);
    // Another chip staged while it was in flight, or a retry that
    // carried none, leaves the staged one alone.
    expect(sent(asked({ ...about }, sel), about).about).not.toBeNull();
    expect(sent(staged, null)).toBe(staged);
  });

  it('the outline belongs to its document and to what it still reads as', () => {
    expect(heldSel(sel, 'q:1:walkthrough', DOC, PAGES)).toBe('b1');
    expect(heldSel(sel, 'q:2:walkthrough', DOC, PAGES)).toBeNull();
    expect(heldSel(null, 'q:1:walkthrough', DOC, PAGES)).toBeNull();
    // The guide rewritten under the same index: the outline goes quiet
    // rather than land on something the student never picked.
    const rewritten = DOC.map((b, i) =>
      i === 1 ? { type: 'para' as const, text: t('Something else.') } : b,
    );
    expect(heldSel(sel, 'q:1:walkthrough', rewritten, PAGES)).toBeNull();
  });
});
