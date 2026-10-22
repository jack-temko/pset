import { defineExamples } from '@/design/examples';
import { Summary, type SummaryProblem } from './index';
import spec from './spec';

const DUE = new Date(2026, 9, 15);
const FINISHED = new Date(2026, 9, 13, 11);
const MINUTES = [18, 25, 22, 31, 34, 12, 20, 8];
const TITLES = [
  'Resistor power',
  'Equivalent resistance',
  'RC step response',
  'Node currents',
  'Energy in a capacitor',
  'Parallel branches',
  'Capacitor at steady state',
  'Discharge time',
];

const problems = (done: number): SummaryProblem[] =>
  MINUTES.map((minutes, i) => ({
    id: `p${String(i + 1)}`,
    label: `4.${String(58 + i)}`,
    title: TITLES[i],
    state: i < done ? 'done' : i === done ? 'started' : 'todo',
    minutes: i <= done ? minutes : 0,
  }));

const show = (status: 'finished' | 'unfinished' | 'turned-in') => (
  <Summary
    problems={problems(status === 'unfinished' ? 5 : 8)}
    due={DUE}
    finished={status === 'unfinished' ? undefined : FINISHED}
    turnedIn={status === 'turned-in' ? new Date(2026, 9, 14) : undefined}
  />
);

export default defineExamples(spec, {
  states: {
    finished: () => show('finished'),
    unfinished: () => show('unfinished'),
    'turned-in': () => show('turned-in'),
    'no-time': () => (
      <Summary
        problems={problems(0).map((p) => ({ ...p, minutes: 0 }))}
        due={DUE}
      />
    ),
  },
  stress: () => (
    <Summary
      due={DUE}
      finished={new Date(2026, 9, 20)}
      turnedIn={new Date(2026, 9, 21)}
      problems={Array.from({ length: 30 }, (_, i) => ({
        id: `s${String(i)}`,
        label: `Chapter 12 review, section 12.${String(i + 1)}`,
        title:
          'Hysteresis loss in a laminated transformer core with a gapped limb',
        state: i % 7 === 3 ? 'failed' : i % 3 === 0 ? 'done' : 'started',
        minutes: 60 + ((i * 37) % 200),
      }))}
    />
  ),
});
