import { defineExamples } from '@/design/examples';
import { parseDueDate } from '@/units/set-line/dates';
import { type GreetingSet } from './due';
import { Greeting } from './index';
import spec from './spec';

/** A fixed Tuesday, so "due Thu" reads the same on every visit. */
const TODAY = new Date(2026, 9, 13);
const day = (d: number) =>
  parseDueDate(`2026-10-${String(d).padStart(2, '0')}`);

const SETS: GreetingSet[] = [
  { set: 'Problem set 4', due: day(15), done: 1, total: 6 },
  { set: 'Homework 7', due: day(18), done: 3, total: 5 },
  { set: 'Problem set 2', due: day(10), done: 8, total: 8 },
  { set: 'Homework 3', due: day(27), done: 0, total: 3 },
];

const at = (hour: number, p: Partial<Parameters<typeof Greeting>[0]> = {}) => (
  <Greeting name="Jack" hour={hour} pick={0} sets={SETS} today={TODAY} {...p} />
);

export default defineExamples(spec, Greeting, {
  states: {
    'band-12am': () => at(1),
    'band-3am': () => at(4),
    'band-6am': () => at(8),
    'band-11am': () => at(12),
    'band-2pm': () => at(15),
    'band-5pm': () => at(18),
    'band-9pm': () => at(22),
    'no-name': () => at(18, { name: '' }),
    'nothing-due': () => at(18, { sets: [SETS[3]] }),
    overdue: () =>
      at(18, {
        sets: [
          ...SETS,
          { set: 'Problem set 3', due: day(9), done: 2, total: 6 },
        ],
      }),
  },
  stress: () => (
    <div className="w-[320px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      {at(18, {
        name: 'Maximilian Alexander Featherstonehaugh',
        sets: [
          {
            set: 'Problem set 4: magnetic circuits, hysteresis and transformer losses, parts A to F',
            due: day(15),
            done: 0,
            total: 6,
          },
        ],
      })}
    </div>
  ),
});
