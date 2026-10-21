import { defineExamples } from '@/design/examples';
import { ProblemNav, type NavItem, type NavView } from './index';
import spec from './spec';

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

const items = (): NavItem[] =>
  TITLES.map((title, i) => ({
    id: `p${String(i + 1)}`,
    label: `4.${String(58 + i)}`,
    title,
    state: i < 3 ? 'done' : i === 5 ? 'failed' : 'todo',
  }));

const show = (view: NavView) => (
  <ProblemNav view={view} items={items()} current="p4" />
);

const long = (): NavItem[] =>
  Array.from({ length: 30 }, (_, i) => ({
    id: `s${String(i)}`,
    label: `4.${String(i)}`,
    title:
      i === 3
        ? 'Hysteresis loss in a laminated transformer core with a gapped limb'
        : `Title ${String(i + 1)}`,
    state: i % 7 === 3 ? 'failed' : i % 3 === 0 ? 'done' : 'todo',
  }));

export default defineExamples(spec, {
  states: {
    segments: () => show('segments'),
    numbers: () => show('numbers'),
    picker: () => show('picker'),
    list: () => show('list'),
  },
  stress: () => (
    <div className="space-y-6">
      {(['segments', 'numbers', 'picker', 'list'] as const).map((v) => (
        <ProblemNav key={v} view={v} items={long()} current="s3" />
      ))}
    </div>
  ),
});
