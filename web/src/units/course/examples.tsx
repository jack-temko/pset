import { defineExamples } from '@/design/examples';
import { Course, CourseSkeleton } from './index';
import { ECE, EMPTY, NOTHING_DUE, READING_IN, STRESS, TODAY } from './sample';
import spec from './spec';

const view = (p: Partial<Parameters<typeof Course>[0]> = {}) => (
  <Course course={ECE} today={TODAY} {...p} />
);

export default defineExamples(spec, Course, {
  states: {
    normal: () => view(),
    'nothing-due': () => view({ course: NOTHING_DUE }),
    empty: () => view({ course: EMPTY }),
    'reading-in': () => view({ course: READING_IN }),
    failed: () => view({ failed: true }),
  },
  stress: () => view({ course: STRESS, unfolded: true }),
  skeletons: {
    normal: () => <CourseSkeleton />,
    'nothing-due': () => <CourseSkeleton />,
    empty: () => <CourseSkeleton />,
    'reading-in': () => <CourseSkeleton />,
    failed: () => <CourseSkeleton />,
  },
});
