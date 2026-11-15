import { listAssignments, type Listable } from './listed';

/** One assignment as Home lists it. */
export interface HomeSet extends Listable {
  set: string;
  course: string;
  done: number;
  total: number;
  minutesLeft?: number;
}

/** One course as Home lists it. */
export interface CourseSummary {
  name: string;
  todo: number;
  materials: number;
  weekMinutes: number;
}

/** What sizes Home's lists while they load: how many rows each holds. */
export interface ListsShape {
  assignments: number;
  courses: number;
}

export const listsShape = (
  sets: readonly HomeSet[],
  courses: readonly CourseSummary[],
  today: Date,
): ListsShape => ({
  assignments: listAssignments(sets, today).length,
  courses: courses.length,
});

/** The sample's courses. */
export const COURSES: CourseSummary[] = [
  {
    name: 'Circuits I',
    todo: 2,
    materials: 7,
    weekMinutes: 190,
  },
  {
    name: 'Signals and systems',
    todo: 5,
    materials: 12,
    weekMinutes: 45,
  },
  {
    name: 'Thermodynamics',
    todo: 10,
    materials: 31,
    weekMinutes: 0,
  },
  {
    name: 'Differential equations',
    todo: 1,
    materials: 1,
    weekMinutes: 130,
  },
  { name: 'Linear algebra', todo: 0, materials: 0, weekMinutes: 0 },
  { name: 'Statics', todo: 0, materials: 4, weekMinutes: 0 },
  { name: 'Dynamics', todo: 3, materials: 6, weekMinutes: 20 },
  { name: 'Materials science', todo: 0, materials: 2, weekMinutes: 0 },
];
