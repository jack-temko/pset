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
    {
      id: 'ps4',
      name: 'Problem set 4',
      material: 'griffiths',
      problems: [
        {
          id: 'p1',
          title: 'Problem 1',
          text: 'Find the equivalent resistance seen by the source in the ladder network.',
          page: 112,
        },
        {
          id: 'p2',
          title: 'Problem 2',
          text: 'Use mesh analysis to find the current through the 4 ohm resistor.',
          page: 118,
        },
        {
          id: 'p3',
          title: 'Problem 3',
          text: 'State and apply the superposition principle to the circuit of problem 2.',
          page: 121,
        },
      ],
    },
    {
      id: 'ps5',
      name: 'Problem set 5',
      material: 'notes',
      problems: [
        {
          id: 'q1',
          title: 'Problem 1',
          text: 'Derive the step response of a series RC circuit.',
          page: 4,
        },
      ],
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
