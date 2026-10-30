import { sampleStudy } from '@/design/study-sample';
import { TODAY } from '@/units/assignment-row/sample';
import type { StudyDay } from '@/units/heatmap';
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
  /** Set while PSet is still reading the sheet in: about how many minutes to go. */
  readingMinutes?: number;
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
  /** Study by day for this course alone, oldest first: the heatmap and the
   *  week's figures come from it. */
  study: readonly StudyDay[];
  /** Dollars spent on the course so far. */
  cost: number;
  /** Dollars spent on the course this month. */
  monthCost: number;
  /** The last 14 days' spend, oldest first, for the sparkline. */
  costSpark: readonly number[];
  /** What PSet remembers about the course, one line each. */
  memories: readonly string[];
}

/** One course's slice of the sample year, kept for it alone. */
const STUDY: StudyDay[] = sampleStudy().map((d) => ({
  ...d,
  courses: d.courses.map((c) => ({ ...c, course: 'ECE 210' })),
}));
const COST = 4.2;
const dayMinutes = (d: StudyDay) =>
  d.courses.reduce((n, c) => n + c.minutes, 0);
const TOTAL_MINUTES = STUDY.reduce((n, d) => n + dayMinutes(d), 0);

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
  study: STUDY,
  cost: COST,
  monthCost: 1.1,
  costSpark: STUDY.slice(-14).map(
    (d) => (dayMinutes(d) / TOTAL_MINUTES) * COST,
  ),
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
  study: [],
  cost: 0,
  monthCost: 0,
  costSpark: Array.from({ length: 14 }, () => 0),
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
  study: STUDY.map((d) => ({
    ...d,
    questions: (d.questions ?? 0) * 80,
    courses: d.courses.map((c) => ({
      course: 'Electromagnetics and the physics of electrical machines',
      minutes: c.minutes * 40,
    })),
  })),
  cost: 1234.5,
  monthCost: 321.5,
  memories: MEMORIES.map((m) => `${m}: ${LONG}`),
};
