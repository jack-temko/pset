import { inProgress } from '@/units/work/sample';
import type { Course } from './course';

/** A fixed course for the design page: Circuits I, with one textbook, lecture
 *  notes and two sets. */
export const COURSE: Course = {
  id: 'circuits-1',
  name: 'Circuits I',
  materials: [
    { id: 'griffiths', name: 'Griffiths' },
    { id: 'notes', name: 'Lecture notes, week 6' },
    { id: 'lab', name: 'Lab manual' },
  ],
  sets: [
    { ...inProgress(), material: 'griffiths' },
    {
      ...inProgress(),
      id: 'ps5',
      name: 'Problem set 5',
      material: 'notes',
      minutesLeft: 45,
      problems: inProgress()
        .problems.slice(0, 3)
        .map((p, i) => ({ ...p, id: `q${String(i + 1)}`, page: 2 + i * 2 })),
    },
  ],
};

/** The same course with names at their worst: a 70 character course, set
 *  and material (workspace stress). */
export const LONG_COURSE: Course = {
  ...COURSE,
  name: 'Electromagnetics and the physics of electrical machines, second year, spring',
  materials: COURSE.materials.map((m) =>
    m.id === 'griffiths'
      ? {
          ...m,
          name: 'Introduction to Electrodynamics, fourth edition, by David J. Griffiths',
        }
      : m,
  ),
  sets: COURSE.sets.map((s) =>
    s.id === 'ps4'
      ? {
          ...s,
          name: 'Problem set 4: magnetic circuits, hysteresis and transformer losses, parts A to F',
        }
      : s,
  ),
};
