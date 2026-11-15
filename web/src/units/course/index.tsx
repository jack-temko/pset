import { waits, type Loads, type Waits } from '@/design/loading';
import { ErrorNotice } from '@/units/error-notice';
import { Loaded, Waiting } from './page';
import type { CourseData } from './sample';
import { courseShape, type CourseShape } from './shape';

export type { CourseShape };

const courseLoads = {
  data: ['course'],
  shapeOf: (d: { course: CourseData; today: Date }): CourseShape =>
    courseShape(d.course, d.today),
} satisfies Loads<{ course: CourseData; today: Date }, CourseShape>;

/** The course page (C1 to C13, confirmed by Jack in course-view-grill): the
 *  name, where it stands, the work and materials lists each with its own Add,
 *  Home's stats box, and a fold of what PSet remembers. Files dropped on the
 *  page are added too. It reads sample data; nothing is saved. Loading, it
 *  draws its frame at the shape (course-d32); a failed read keeps that shape
 *  under its notice (skeleton-grill S4). */
export const Course = waits(
  courseLoads,
  function Course({
    course,
    failed,
    today,
    unfolded,
    workHref,
    materialsHref,
    memoriesHref = '#',
    homeHref = '/',
    settingsHref = '/settings',
    loading,
  }: Waits<
    {
      /** The read failed: the page keeps its shape under the notice. */
      failed?: boolean;
      /** The moment due dates count from. */
      today: Date;
      /** Opens every fold (the design page only). */
      unfolded?: boolean;
      /** Where Work's "Show all" goes. */
      workHref: string;
      /** Where Materials' "Show all" goes. */
      materialsHref: string;
      /** Where the memories' "Show all" goes. */
      memoriesHref?: string;
      homeHref?: string;
      settingsHref?: string;
    },
    { course: CourseData },
    CourseShape
  >) {
    const hrefs = {
      workHref,
      materialsHref,
      memoriesHref,
      homeHref,
      settingsHref,
    };
    if (loading === undefined && failed !== true)
      return (
        <Loaded course={course} today={today} unfolded={unfolded} {...hrefs} />
      );
    const shape =
      loading === undefined
        ? courseShape(course, today)
        : loading === 'unknown'
          ? undefined
          : loading;
    const waiting = (
      <Waiting shape={shape} today={today} unfolded={unfolded} {...hrefs} />
    );
    if (loading !== undefined) return waiting;
    // Failed: the page keeps its shape, unseen, and the notice lies over it.
    return (
      <div className="grid">
        <div aria-hidden className="invisible [grid-area:1/1]">
          {waiting}
        </div>
        <div className="flex justify-center pt-24 [grid-area:1/1]">
          <ErrorNotice
            error={{
              what: "Couldn't load this course",
              why: "PSet couldn't read this course from your library. Nothing in it was lost.",
              chain: ['course.load'],
            }}
            actions={[{ label: 'Try again' }]}
          />
        </div>
      </div>
    );
  },
);
