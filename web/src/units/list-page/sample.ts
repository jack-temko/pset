import { TODAY } from '@/units/assignment-row/sample';

export { TODAY };

export interface PageSet {
  id: string;
  name: string;
  course: string;
  /** A local calendar date; none when the sheet gives none. */
  due?: Date;
  done: number;
  total: number;
  /** Shown only when PSet knows it. */
  minutesLeft?: number;
  /** When the last question was finished; set on a finished set. */
  finished?: Date;
}

export interface PageMemory {
  id: string;
  text: string;
  course: string;
  /** Where it came from: the student wrote it, or PSet's Ask suggested it. */
  source: 'yours' | 'ask';
  added: Date;
}

export type PageData =
  | { kind: 'work'; items: readonly PageSet[] }
  | { kind: 'memories'; items: readonly PageMemory[] };

/** A calendar date this many days from the sample's today. */
const on = (offset: number) =>
  new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + offset);

/** Each course with how many finished and how many to-do sets it has. */
const COURSES = [
  { name: 'ECE 210', done: 6, todo: 1 },
  { name: 'Circuits I', done: 8, todo: 2 },
  { name: 'Signals and systems', done: 7, todo: 1 },
  { name: 'Thermodynamics', done: 9, todo: 2 },
  { name: 'Linear algebra', done: 5, todo: 1 },
  { name: 'Differential equations', done: 8, todo: 1 },
];

export const COURSE_NAMES = COURSES.map((c) => c.name);

/** The sets of every course: `scale` times as many, for the page that holds
 *  hundreds. Finished ones count back a week apiece; the sets to do fall due
 *  in the next fortnight, and every third has no date. */
function sets(scale: number): PageSet[] {
  return COURSES.flatMap((c, ci) =>
    Array.from({ length: (c.done + c.todo) * scale }, (_, i) => {
      const finished = i < c.done * scale;
      const n = i + 1;
      const base = {
        id: `${String(ci)}-${String(n)}`,
        name: `Problem set ${String(n)}`,
        course: c.name,
      };
      if (finished) {
        const ago = (c.done * scale - i) * 7;
        return {
          ...base,
          due: on(-ago - 2),
          done: 5,
          total: 5,
          finished: on(-ago),
        };
      }
      const k = i - c.done * scale;
      return {
        ...base,
        due: (k + ci) % 3 === 2 ? undefined : on(2 + ci * 2 + k * 3),
        done: k % 3,
        total: 6,
        minutesLeft: k % 2 === 0 ? 70 : undefined,
      };
    }),
  );
}

export const WORK: PageData = { kind: 'work', items: sets(1) };

/** About three hundred sets, for the scroll. */
export const MANY_SETS = sets(6);
export const MANY: PageData = { kind: 'work', items: MANY_SETS };

const YOURS = [
  'Prefers worked examples before the answer',
  'Uses SI units in every answer',
  'Skips the review of vector calculus',
  'Studies in the evening, in short sessions',
  'Wants the reason for each step, not only the steps',
  'Writes answers with the units spelled out',
  'Has a Circuits I exam on the first Friday of December',
  'Prefers a diagram before a long derivation',
  'Does the odd-numbered questions first',
  'Rounds to three significant figures',
  'Checks the guide only after a first try',
  'Wants matrices written with brackets, not bars',
];
const ASKED = [
  'Is weakest on Gauss’s law with a changing field',
  'Mixes up series and parallel resistance under time pressure',
  'Forgets the sign of the eigenvalue in a stability question',
  'Needs a reminder to state the units of every answer',
  'Struggles with partial fractions in inverse Laplace transforms',
  'Does better when a hint starts from a picture',
  'Often drops a factor of two in Fourier series',
  'Asks for the next hint before trying the last one',
];
const MEMORY_COURSES = ['ECE 210', 'Circuits I', 'Linear algebra'];

/** Twelve things the student wrote and eight Ask suggested, newest first. */
export const MEMORIES: PageData = {
  kind: 'memories',
  items: [
    ...YOURS.map((text, i) => ({ text, source: 'yours' as const, i })),
    ...ASKED.map((text, i) => ({ text, source: 'ask' as const, i })),
  ].map((m, n) => ({
    id: `m${String(n)}`,
    text: m.text,
    source: m.source,
    course: MEMORY_COURSES[n % MEMORY_COURSES.length],
    added: on(-(m.i * 4 + (m.source === 'ask' ? 1 : 2))),
  })),
};
