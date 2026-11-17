import { waits, type Loads } from '@/design/loading';
import { CoursePage } from './page';
import type { CourseData } from './sample';

/** The course page (C1 to C13, confirmed by Jack in course-view-grill): the
 *  name, where it stands, Home's stats box, then Work and Materials each with
 *  its own Add, and a fold of what PSet remembers. Its quiet form is the top
 *  bar and the name the link carried (loading D2). */
export const Course = waits(
  { data: ['course', 'failed'] } satisfies Loads<{
    course: CourseData;
    failed?: boolean;
  }>,
  CoursePage,
);
