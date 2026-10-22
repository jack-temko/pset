import { defineExamples } from '@/design/examples';
import { Summary, type SummaryProblem } from './index';
import spec from './spec';
import type { SummaryView } from './views';

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

const show = (
  view: SummaryView,
  status: 'finished' | 'unfinished' | 'turned-in',
) => (
  <Summary
    view={view}
    problems={problems(status === 'unfinished' ? 5 : 8)}
    due={DUE}
    finished={status === 'unfinished' ? undefined : FINISHED}
    turnedIn={status === 'turned-in' ? new Date(2026, 9, 14) : undefined}
  />
);

export default defineExamples(spec, {
  states: {
    'box-finished': () => show('box', 'finished'),
    'box-unfinished': () => show('box', 'unfinished'),
    'box-turned-in': () => show('box', 'turned-in'),
    'home-finished': () => show('home', 'finished'),
    'home-unfinished': () => show('home', 'unfinished'),
    'home-turned-in': () => show('home', 'turned-in'),
    'plain-finished': () => show('plain', 'finished'),
    'plain-unfinished': () => show('plain', 'unfinished'),
    'plain-turned-in': () => show('plain', 'turned-in'),
    'tiles-finished': () => show('tiles', 'finished'),
    'tiles-unfinished': () => show('tiles', 'unfinished'),
    'tiles-turned-in': () => show('tiles', 'turned-in'),
  },
  stress: () => (
    <div className="space-y-10">
      {(['box', 'home', 'plain', 'tiles'] as const).map((view) => (
        <Summary
          key={view}
          view={view}
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
      ))}
    </div>
  ),
});
