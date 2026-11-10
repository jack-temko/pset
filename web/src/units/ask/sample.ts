import type { Block, Call, Turn } from './types';

/** Sample data for the design page: the server has no conversation for a
 *  course yet. */

export const COURSE = 'ECE 210';
export const ABOUT = '3.A.4 · (a)';

const t = (text: string) => ({ t: text });
const m = (tex: string) => ({ m: tex });
const ref = (page: number) => ({ ref: { material: 'griffiths', page } });

export const READ: Call = { kind: 'read', what: 'Griffiths p. 142', pages: 3 };
export const SEARCH: Call = { kind: 'search', what: 'time constant' };
/** A run of finished steps, where they happened in the answer. */
export const run = (...calls: Call[]): Block => ({ k: 'run', calls });

const SUM: Call = {
  kind: 'compute',
  what: [m('V_0'), { t: ' at ' }, m('t = \\tau')],
};
export const CALLS: readonly Call[] = [
  SEARCH,
  READ,
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
  run(...CALLS),
  {
    k: 'p',
    runs: [
      t('The voltage '),
      m('V_0'),
      t(
        ' at the node comes from the current law written there, as your textbook does on ',
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
  run(SUM),
  {
    k: 'steps',
    steps: [
      {
        tex: '\\frac{V_0 - V_s}{R_1} + \\frac{V_0}{R_2} + C\\frac{dV_0}{dt} = 0',
        why: 'The current law at the node',
      },
      {
        tex: '\\frac{dV_0}{dt} + \\frac{V_0}{\\tau} = \\frac{V_s}{R_1 C}',
        why: [{ t: 'Divide by C and collect the ' }, m('V_0'), { t: ' terms' }],
      },
      {
        tex: 'V_0(t) = V_s\\,\\frac{R_2}{R_1+R_2}\\left(1 - e^{-t/\\tau}\\right)',
        why: [{ t: 'Solve it with ' }, m('V_0(0) = 0')],
      },
    ],
  },
  {
    k: 'plot',
    title: [m('V_0'), { t: ' against time, in seconds' }],
    series: [
      { name: 'R2 = 2 kΩ', points: decay(1, 4) },
      { name: 'R2 = 1 kΩ', points: decay(1, 2.5) },
    ],
  },
  {
    k: 'table',
    own: true,
    head: ['Time', [m('V_0'), { t: ' (V)' }], 'Share of final'],
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

const short: readonly Block[] = ANSWER.slice(1, 3);

const turn = (over: Partial<Turn> & Pick<Turn, 'id' | 'question'>): Turn => ({
  day: 'Today',
  status: 'done',
  blocks: [],
  ...over,
});

/** A question asked, an answer done, with the steps where they happened. */
export const DONE: Turn = turn({
  id: 'd',
  question: 'Why does V_0 start at zero here?',
  about: ABOUT,
  blocks: ANSWER,
});

/** Two runs of steps with text between them, short enough to see both. */
export const MID: Turn = {
  ...DONE,
  id: 'm',
  blocks: ANSWER.slice(0, 5),
};

export const THINKING: Turn = turn({
  id: 'k',
  question: 'Where does the time constant come from?',
  about: ABOUT,
  status: 'working',
});

export const IN_FLIGHT: Turn = {
  ...THINKING,
  id: 'f',
  blocks: [{ k: 'run', calls: [], current: SEARCH }],
};

export const STREAMING: Turn = {
  ...THINKING,
  id: 's',
  blocks: [run(SEARCH, READ), ...short.slice(0, 1)],
};

export const REMEMBERED: Turn = {
  ...DONE,
  id: 'r',
  question: 'I always call the node voltages V_0, V_1 and so on.',
  about: undefined,
  remembered: [{ t: 'you use ' }, m('V_0'), { t: ' for node voltages' }],
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
  blocks: [run(SEARCH, READ), ...short],
};

export const FAILED: Turn = {
  ...DONE,
  id: 'e',
  status: 'failed',
  blocks: [run(SEARCH)],
  failure: { why: 'the model took too long to reply.' },
};

export const FAILED_SETUP: Turn = {
  ...FAILED,
  id: 'g',
  blocks: [],
  failure: { why: 'no OpenRouter key is saved.', setup: true },
};

export const WITH_IMAGE: Turn = {
  ...DONE,
  id: 'i',
  question: 'Is my second line right?',
  image: `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="96" viewBox="0 0 160 96"><rect width="160" height="96" fill="#fff"/><text x="10" y="40" font-size="18" font-family="serif" fill="#222">V0 = Vs R2/(R1+R2)</text><path d="M10 56H150" stroke="#222"/></svg>',
  )}`,
  blocks: [run(READ), ...short],
};

/** A conversation over days: older questions, one of them with a picture. */
export const HISTORY: readonly Turn[] = [
  turn({
    id: 'h1',
    day: 'Sep 12',
    question: 'What is an eigenvalue, in one line?',
    blocks: [run(SEARCH, READ), ...short],
  }),
  turn({
    id: 'h2',
    day: 'Sep 12',
    question: 'And for a 2 by 2 matrix?',
    blocks: [run(READ), ...short],
  }),
  turn({
    id: 'h3',
    day: 'Yesterday',
    question: 'Check my sketch of the step response.',
    about: '3.A.2',
    image: WITH_IMAGE.image,
    blocks: ANSWER,
  }),
  turn({
    id: 'h4',
    day: 'Today',
    question: 'I always call the node voltages V_0, V_1 and so on.',
    remembered: [{ t: 'you use ' }, m('V_0'), { t: ' for node voltages' }],
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
      question: `Question ${String(i + 1)}: what does the textbook say about the time constant on page ${String(100 + i)}?`,
      blocks: i % 5 === 0 ? ANSWER : [run(READ), ...short],
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
