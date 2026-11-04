import type { Block, Call, Turn } from './types';

/** Sample data for the design page: the server has no conversation for a
 *  course yet. */

export const COURSE = 'ECE 210';
export const ABOUT = '3.A.4 · (a)';

const t = (text: string) => ({ t: text });
const m = (tex: string) => ({ m: tex });
const ref = (page: number) => ({ ref: { material: 'griffiths', page } });

export const READ: Call = { kind: 'read', what: 'Griffiths p. 142', pages: 2 };
export const SEARCH: Call = { kind: 'search', what: 'eigenvalue' };
export const CALLS: readonly Call[] = [
  SEARCH,
  READ,
  { kind: 'read', what: 'Lecture notes p. 6' },
  { kind: 'search', what: 'node voltage' },
];

const decay = (tau: number, scale: number) =>
  Array.from({ length: 11 }, (_, i) => {
    const x = i * 0.5;
    return [x, scale * (1 - Math.exp(-x / tau))] as const;
  });

/** A whole answer: prose with page chips, a statement, a derivation, a plot,
 *  a table, a callout and code, in the order it streams. */
export const ANSWER: readonly Block[] = [
  {
    k: 'p',
    runs: [
      t('The voltage '),
      m('V_0'),
      t(
        ' at the node comes from the current law written there, as the book does on ',
      ),
      ref(142),
      t('. Start from what the law says.'),
    ],
  },
  {
    k: 'statement',
    name: 'Kirchhoff’s current law',
    ref: { material: 'griffiths', page: 142 },
    runs: [
      t('The currents leaving a node add up to zero: '),
      m('\\sum_k i_k = 0'),
    ],
  },
  {
    k: 'steps',
    steps: [
      {
        tex: '\\frac{V_0 - V_s}{R_1} + \\frac{V_0}{R_2} + C\\frac{dV_0}{dt} = 0',
        why: 'The current law at the node',
      },
      {
        tex: '\\frac{dV_0}{dt} + \\frac{V_0}{\\tau} = \\frac{V_s}{R_1 C}',
        why: 'Divide by C and collect the V_0 terms',
      },
      {
        tex: 'V_0(t) = V_s\\,\\frac{R_2}{R_1+R_2}\\left(1 - e^{-t/\\tau}\\right)',
        why: 'Solve it with V_0(0) = 0',
      },
    ],
  },
  {
    k: 'plot',
    title: 'V_0 against time, in seconds',
    series: [
      { name: 'R2 = 2 kΩ', points: decay(1, 4) },
      { name: 'R2 = 1 kΩ', points: decay(1, 2.5) },
    ],
  },
  {
    k: 'table',
    head: ['Time', 'V_0 (V)', 'Share of final'],
    rows: [
      ['1 τ', '2.53', '63%'],
      ['2 τ', '3.46', '86%'],
      ['3 τ', '3.80', '95%'],
    ],
  },
  {
    k: 'callout',
    runs: [
      t('Check it: when t is large the capacitor is open, so '),
      m('V_0'),
      t(' is the divider ratio. It is, at 4 V.'),
    ],
  },
  { k: 'code', code: 'v0 = vs * r2 / (r1 + r2)  # the final value, 4.0' },
];

const short: readonly Block[] = ANSWER.slice(0, 2);

const turn = (over: Partial<Turn> & Pick<Turn, 'id' | 'question'>): Turn => ({
  day: 'Today',
  status: 'done',
  calls: [],
  blocks: [],
  ...over,
});

/** A question asked, an answer done, with the calls it made. */
export const DONE: Turn = turn({
  id: 'd',
  question: 'Why does V_0 start at zero here?',
  about: ABOUT,
  calls: CALLS,
  blocks: ANSWER,
});

export const THINKING: Turn = turn({
  id: 'k',
  question: 'Where does the time constant come from?',
  about: ABOUT,
  status: 'working',
});

export const IN_FLIGHT: Turn = {
  ...THINKING,
  id: 'f',
  calls: [SEARCH],
  inFlight: READ,
};

export const STREAMING: Turn = {
  ...THINKING,
  id: 's',
  calls: [SEARCH, READ],
  blocks: short.slice(0, 1),
};

export const REMEMBERED: Turn = {
  ...DONE,
  id: 'r',
  question: 'I always call the node voltages V_0, V_1 and so on.',
  about: undefined,
  calls: [],
  remembered: 'you use V_0 for node voltages',
  blocks: [
    {
      k: 'p',
      runs: [
        t('Got it. I will write the node voltages as '),
        m('V_0, V_1'),
        t(' from now on.'),
      ],
    },
  ],
};

export const STOPPED: Turn = {
  ...DONE,
  id: 'x',
  status: 'stopped',
  calls: [SEARCH, READ],
  blocks: short,
};

export const FAILED: Turn = {
  ...DONE,
  id: 'e',
  status: 'failed',
  calls: [SEARCH],
  blocks: [],
  failure: { why: 'the model took too long to reply.' },
};

export const FAILED_SETUP: Turn = {
  ...FAILED,
  id: 'g',
  calls: [],
  failure: { why: 'no OpenRouter key is saved.', setup: true },
};

export const WITH_IMAGE: Turn = {
  ...DONE,
  id: 'i',
  question: 'Is my second line right?',
  image: `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="96" viewBox="0 0 160 96"><rect width="160" height="96" fill="#fff"/><text x="10" y="40" font-size="18" font-family="serif" fill="#222">V0 = Vs R2/(R1+R2)</text><path d="M10 56H150" stroke="#222"/></svg>',
  )}`,
  blocks: short,
  calls: [READ],
};

/** A conversation over days: older questions, one of them with a picture. */
export const HISTORY: readonly Turn[] = [
  turn({
    id: 'h1',
    day: 'Sep 12',
    question: 'What is an eigenvalue, in one line?',
    calls: [SEARCH, READ],
    blocks: short,
  }),
  turn({
    id: 'h2',
    day: 'Sep 12',
    question: 'And for a 2 by 2 matrix?',
    calls: [READ],
    blocks: short,
  }),
  turn({
    id: 'h3',
    day: 'Yesterday',
    question: 'Check my sketch of the step response.',
    about: '3.A.2',
    image: WITH_IMAGE.image,
    calls: CALLS,
    blocks: ANSWER,
  }),
  turn({
    id: 'h4',
    day: 'Today',
    question: 'I always call the node voltages V_0, V_1 and so on.',
    remembered: 'you use V_0 for node voltages',
    blocks: REMEMBERED.blocks,
  }),
];

/** Fifty questions over many days, for the worst case. */
export const LONG_HISTORY: readonly Turn[] = Array.from(
  { length: 50 },
  (_, i) =>
    turn({
      id: `l${String(i)}`,
      day: i < 20 ? 'Sep 12' : i < 40 ? 'Oct 3' : 'Today',
      question: `Question ${String(i + 1)}: what does the book say about the time constant on page ${String(100 + i)}?`,
      calls: i % 2 ? CALLS : [READ],
      blocks: i % 5 === 0 ? ANSWER : short,
    }),
);

/** The worst names: a 90 character about line and a very long question. */
export const WORST: Turn = {
  ...DONE,
  id: 'w',
  about:
    '3.A.4 · (a) Problem 4.62 from Introduction to Electrodynamics, fourth edition, Griffiths',
  question:
    'Could you walk me through why the capacitor voltage cannot jump when the switch closes, and then show how that sets the starting value, using the same node voltage names as before? '.repeat(
      2,
    ),
};
