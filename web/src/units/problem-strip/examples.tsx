import { defineExamples } from '@/design/examples';
import { ProblemStrip, type Chip } from './index';
import spec from './spec';

/** One problem in each state, the fourth current. */
const chips = (): Chip[] =>
  [
    { state: 'done', word: 'Done' },
    { state: 'done', word: 'Done' },
    { state: 'started', word: 'Started' },
    { state: 'started', word: 'Started' },
    { state: 'working', word: 'Writing the guide' },
    { state: 'queued', word: 'Queued' },
    { state: 'failed', word: 'Not found' },
    { state: 'todo', word: 'Not started' },
  ].map((s, i) => ({
    id: `p${String(i + 1)}`,
    label: `4.${String(58 + i)}`,
    title: `Title ${String(i + 1)}`,
    ...s,
  })) as Chip[];

export default defineExamples(spec, ProblemStrip, {
  states: {
    'in-progress': () => <ProblemStrip chips={chips()} current="p4" />,
    'each-state': () => (
      <div className="space-y-4">
        {[1, 3, 8, 5, 6, 7].map((n) => (
          <ProblemStrip key={n} chips={chips()} current={`p${String(n)}`} />
        ))}
      </div>
    ),
    'all-done': () => (
      <ProblemStrip
        chips={chips().map((c) => ({ ...c, state: 'done', word: 'Done' }))}
      />
    ),
  },
  stress: () => (
    <ProblemStrip
      chips={Array.from({ length: 30 }, (_, i) => ({
        id: `s${String(i)}`,
        label: `4.${String(i)}`,
        title:
          'Hysteresis loss in a laminated transformer core with a gapped limb',
        state: (
          ['done', 'started', 'todo', 'working', 'queued', 'failed'] as const
        )[i % 6],
        word: 'State',
      }))}
      current="s5"
    />
  ),
});
