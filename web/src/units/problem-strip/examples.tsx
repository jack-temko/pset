import { defineExamples } from '@/design/examples';
import { ProblemStrip, type Chip } from './index';
import spec from './spec';

const chips = (over: Record<number, Chip['state']> = {}): Chip[] =>
  Array.from({ length: 8 }, (_, i) => ({
    id: `p${String(i + 1)}`,
    label: `4.${String(58 + i)}`,
    title: `Title ${String(i + 1)}`,
    state: over[i] ?? (i < 3 ? 'done' : 'todo'),
  }));

export default defineExamples(spec, {
  states: {
    'in-progress': () => <ProblemStrip chips={chips()} current="p4" />,
    failed: () => <ProblemStrip chips={chips({ 4: 'failed' })} current="p5" />,
    finding: () => (
      <ProblemStrip chips={chips({ 4: 'finding' })} current="p5" />
    ),
    'all-done': () => (
      <ProblemStrip
        chips={chips({ 3: 'done', 4: 'done', 5: 'done', 6: 'done', 7: 'done' })}
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
        state: i % 7 === 3 ? 'failed' : i % 3 === 0 ? 'done' : 'todo',
      }))}
      current="s5"
    />
  ),
});
