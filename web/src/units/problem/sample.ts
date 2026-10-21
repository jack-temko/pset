import type { Run } from './types';
import type { Figure, Help, ProblemData } from './types';

/** Sample problems for the design page: eight from one set, with labels,
 *  pages, math, a figure or two, a note, parts and the three help steps. The
 *  server has no such data yet. */

const t = (text: string): Run => ({ t: text });
const m = (tex: string): Run => ({ m: tex });
const d = (tex: string): Run => ({ m: tex, d: true });

const svg = (body: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160" viewBox="0 0 320 160" fill="none" stroke="#222" stroke-width="2" font-family="sans-serif" font-size="14">${body}</svg>`,
  )}`;

export const CIRCUIT_FIGURE: Figure = {
  id: 'rc',
  caption: 'Figure 4.31: a source, a resistor and a capacitor in series.',
  src: svg(
    '<path d="M40 40H110M150 40H220M220 40V60M220 100V120H40V40"/><path d="M110 28V52M150 28V52" /><rect x="205" y="60" width="30" height="40"/><circle cx="40" cy="80" r="16"/><text x="30" y="85" stroke="none" fill="#222">V</text><text x="224" y="85" stroke="none" fill="#222" dx="22">R</text><text x="118" y="22" stroke="none" fill="#222">C</text>',
  ),
};

export const SECOND_FIGURE: Figure = {
  id: 'divider',
  caption: 'Figure 4.32: a voltage divider with a load.',
  src: svg(
    '<path d="M60 20H160V50M160 110V140H60V20"/><rect x="145" y="50" width="30" height="30"/><rect x="145" y="80" width="30" height="30"/><path d="M160 80H250"/><text x="182" y="70" stroke="none" fill="#222">R1</text><text x="182" y="100" stroke="none" fill="#222">R2</text>',
  ),
};

const writing = (seconds: number): Help => ({ status: 'writing', seconds });
const ready = (...runs: Run[]): Help => ({ status: 'ready', runs });

const HELP: ProblemData['help'] = {
  hint: ready(
    t(
      'Start from what stays the same across the capacitor: its voltage cannot jump, so ',
    ),
    m('v_C(0^+) = v_C(0^-)'),
    t('.'),
  ),
  walkthrough: ready(
    t('Write the loop equation, '),
    d('V_s = R\\,i + \\frac{1}{C}\\int i\\,dt,'),
    t(
      'differentiate it, and solve the first-order equation with the starting value from the hint. The time constant is ',
    ),
    m('\\tau = RC'),
    t('.'),
  ),
  answer: ready(
    d('v_C(t) = V_s\\left(1 - e^{-t/RC}\\right)'),
    t('so after one time constant the capacitor is at about 63% of '),
    m('V_s'),
    t('.'),
  ),
};

const STATEMENTS: Run[][] = [
  [
    t(
      'A 12 V source is connected to a 4 kΩ resistor. Find the current and the power the resistor dissipates.',
    ),
  ],
  [
    t(
      'Find the equivalent resistance seen by the source in the network of Figure 4.32 when ',
    ),
    m('R_1 = 2\\,\\text{k}\\Omega'),
    t(' and '),
    m('R_2 = 3\\,\\text{k}\\Omega'),
    t('.'),
  ],
  [
    t('For the circuit of Figure 4.31, the switch closes at '),
    m('t = 0'),
    t(' with the capacitor uncharged. Find '),
    m('v_C(t)'),
    t(' for '),
    m('t > 0'),
    t(':'),
    d(
      'V_s = 10\\,\\text{V},\\quad R = 5\\,\\text{k}\\Omega,\\quad C = 2\\,\\mu\\text{F}.',
    ),
  ],
  [
    t(
      'State Kirchhoff’s current law and use it to find the unknown current at the node where three branches meet.',
    ),
  ],
  [
    t('Show that the energy stored in a capacitor is '),
    m('w = \\tfrac{1}{2} C v^2'),
    t(' by integrating the power delivered to it.'),
  ],
  [
    t(
      'Two resistors of 6 Ω and 3 Ω are in parallel across a 9 V source. Find each branch current and the total current.',
    ),
  ],
  [
    t(
      'Explain, in two sentences, why a capacitor acts as an open circuit to a constant source after a long time.',
    ),
  ],
  [
    t(
      'A 100 μF capacitor discharges through a 2 kΩ resistor from 5 V. How long until it falls below 1 V?',
    ),
  ],
];

const LABELS = ['4.58', '4.59', '4.60', '4.61', '4.62', '4.63', '4.64', '4.65'];
const PAGES = [110, 110, 111, 111, 112, 112, 113, 114];

export function problemAt(
  i: number,
  over: Partial<ProblemData> = {},
): ProblemData {
  const base: ProblemData = {
    id: `p${String(i + 1)}`,
    label: LABELS[i % LABELS.length],
    page: PAGES[i % PAGES.length],
    statement: STATEMENTS[i % STATEMENTS.length],
    figures: i === 2 ? [CIRCUIT_FIGURE] : i === 1 ? [SECOND_FIGURE] : [],
    parts: [],
    help: HELP,
    found: { status: 'ready' },
    done: false,
  };
  return { ...base, ...over };
}

/** A problem with a note and four parts, (a) and (b) skipped (P7, P15). */
export const WITH_PARTS: Partial<ProblemData> = {
  note: [t('Do (c) and (d) only. Show your work for (d).')],
  statement: [
    t('A series RC circuit is driven by a '),
    m('12\\,\\text{V}'),
    t(' step. With '),
    m('R = 1\\,\\text{k}\\Omega'),
    t(' and '),
    m('C = 10\\,\\mu\\text{F}'),
    t(':'),
  ],
  parts: [
    { label: 'a', runs: [t('Find the time constant.')], skipped: true },
    { label: 'b', runs: [t('Sketch '), m('v_C(t)'), t('.')], skipped: true },
    { label: 'c', runs: [t('How long until '), m('v_C'), t(' reaches 9 V?')] },
    {
      label: 'd',
      runs: [
        t('Find the energy stored at that moment: '),
        m('w = \\tfrac12 C v_C^2'),
        t('.'),
      ],
    },
  ],
};

export const WALKTHROUGH_WRITING: Partial<ProblemData> = {
  help: { ...HELP, walkthrough: writing(20) },
};

/** Eight problems, `done` of them marked done from the start. */
export function sampleProblems(done = 0): ProblemData[] {
  return Array.from({ length: 8 }, (_, i) =>
    problemAt(i, {
      ...(i === 3 ? WITH_PARTS : {}),
      done: i < done,
    }),
  );
}
