export interface Memory {
  id: string;
  text: string;
  /** Typed by the student, or saved by Ask when they asked it to remember. */
  source: 'you' | 'ask';
  /** ISO date. */
  at: string;
  /** For a memory from Ask: the chat it came from. */
  chat?: string;
  /** Saved by Ask and not yet kept (option D). */
  fresh?: boolean;
}

export const LONG =
  'When a problem has a figure, describe what you see in it before using it, and name every node and mesh the way the figure labels them, even if I name them differently in my own work';

/** Newest first, as the list shows them. */
export const SAMPLE: readonly Memory[] = [
  {
    id: 'm1',
    text: 'Check my sign conventions before the algebra',
    source: 'ask',
    at: '2026-10-28',
    chat: '#chat-9',
    fresh: true,
  },
  {
    id: 'm2',
    text: 'Use j, not i, for the imaginary unit',
    source: 'ask',
    at: '2026-10-24',
    chat: '#chat-8',
    fresh: true,
  },
  {
    id: 'm3',
    text: 'Keep answers short unless I ask for the derivation',
    source: 'ask',
    at: '2026-10-22',
    chat: '#chat-7',
  },
  {
    id: 'm4',
    text: 'Explain with phasors first',
    source: 'ask',
    at: '2026-10-21',
    chat: '#chat-6',
  },
  { id: 'm5', text: LONG, source: 'you', at: '2026-10-19' },
  {
    id: 'm6',
    text: 'Prefer Thevenin over superposition when both work',
    source: 'you',
    at: '2026-10-18',
  },
  {
    id: 'm7',
    text: 'Round to three significant figures',
    source: 'you',
    at: '2026-10-15',
  },
  {
    id: 'm8',
    text: 'Show units on every numeric answer',
    source: 'you',
    at: '2026-10-14',
  },
  { id: 'm9', text: 'No PSpice', source: 'you', at: '2026-10-12' },
  {
    id: 'm10',
    text: 'Use V_0, V_1 for nodal voltages',
    source: 'you',
    at: '2026-10-12',
  },
];

export const TODAY = '2026-10-30';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function when(iso: string): string {
  const [, m = '1', d = '1'] = iso.split('-');
  return `${MONTHS[Number(m) - 1] ?? ''} ${Number(d)}`;
}
