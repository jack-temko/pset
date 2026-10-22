import { TODAY } from '@/units/assignment-row/sample';
import { parseDueDate } from '@/units/set-line/dates';

export { TODAY };

export interface CourseSet {
  id: string;
  name: string;
  /** A local calendar date; none when the sheet gives none. */
  due?: Date;
  done: number;
  total: number;
  /** Shown only when PSet knows it. */
  minutesLeft?: number;
}

export interface CourseMaterial {
  id: string;
  name: string;
  /** "Textbook", "Slides", "Assignment sheet", "Past exam". */
  kind: string;
  pages: number;
  /** Set while PSet is still reading it in: about how many minutes to go. */
  readingMinutes?: number;
}

export interface CourseData {
  name: string;
  sets: readonly CourseSet[];
  materials: readonly CourseMaterial[];
  studiedMinutes: number;
  weekMinutes: number;
  /** Dollars spent on the course so far. */
  cost: number;
  /** What PSet remembers about the course, one line each. */
  memories: readonly string[];
}

const day = (d: number) =>
  parseDueDate(`2026-10-${String(d).padStart(2, '0')}`);

const finished = (n: number): CourseSet => ({
  id: `done-${String(n)}`,
  name: `Problem set ${String(n)}`,
  due: day(n * 2),
  done: 5,
  total: 5,
});

export const MEMORIES = [
  'Prefers worked examples before the answer',
  'Uses SI units in every answer',
  'Skips the review of vector calculus',
  'Studies in the evening, in short sessions',
  'Wants the reason for each step, not only the steps',
  'Is weakest on Gauss’s law with a changing field',
  'Writes answers with the units spelled out',
  'Checks the guide only after a first try',
];

/** The usual course: one set to do, three materials, six finished sets. */
export const ECE: CourseData = {
  name: 'ECE 210',
  sets: [
    {
      id: 'ps7',
      name: 'Problem set 7',
      due: day(15),
      done: 2,
      total: 6,
      minutesLeft: 70,
    },
    ...[1, 2, 3, 4, 5, 6].map(finished),
  ],
  materials: [
    { id: 'griffiths', name: 'Griffiths', kind: 'Textbook', pages: 640 },
    {
      id: 'slides',
      name: 'Lecture slides, weeks 1 to 6',
      kind: 'Slides',
      pages: 212,
    },
    {
      id: 'sheet7',
      name: 'Problem set 7',
      kind: 'Assignment sheet',
      pages: 3,
    },
  ],
  studiedMinutes: 1120,
  weekMinutes: 130,
  cost: 4.2,
  memories: MEMORIES,
};

/** Every set is finished or none has a date. */
export const NOTHING_DUE: CourseData = {
  ...ECE,
  sets: ECE.sets.filter((s) => s.done === s.total),
};

export const EMPTY: CourseData = {
  ...ECE,
  sets: [],
  materials: [],
  studiedMinutes: 0,
  weekMinutes: 0,
  cost: 0,
  memories: [],
};

export const READING_IN: CourseData = {
  ...ECE,
  materials: [
    ...ECE.materials,
    {
      id: 'exam',
      name: 'Midterm 2024',
      kind: 'Past exam',
      pages: 0,
      readingMinutes: 2,
    },
  ],
};

const LONG =
  'Electromagnetics and the physics of electrical machines, lecture notes, week 6: magnetic circuits';

export const STRESS: CourseData = {
  ...ECE,
  name: 'Electromagnetics and the physics of electrical machines',
  sets: Array.from({ length: 12 }, (_, i) => ({
    id: `s${String(i)}`,
    name: `Problem set ${String(i + 1)}: ${LONG}`,
    due: i < 8 ? day(14 + i * 2) : undefined,
    done: i < 8 ? i % 5 : 6,
    total: i < 8 ? 99 : 6,
    minutesLeft: i < 8 ? 600 + i : undefined,
  })),
  materials: Array.from({ length: 9 }, (_, i) => ({
    id: `m${String(i)}`,
    name: `${LONG} (${String(i + 1)})`,
    kind: 'Lecture notes',
    pages: 1200 + i,
    readingMinutes: i === 8 ? 45 : undefined,
  })),
  studiedMinutes: 99 * 60 + 59,
  weekMinutes: 40 * 60,
  cost: 1234.5,
  memories: MEMORIES.map((m) => `${m}: ${LONG}`),
};
