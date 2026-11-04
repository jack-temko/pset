import { defineExamples } from '@/design/examples';
import { ListPage, ListPageSkeleton } from './index';
import { MANY, MANY_SETS, MEMORIES, TODAY, WORK } from './sample';
import spec from './spec';

const view = (p: Partial<Parameters<typeof ListPage>[0]> = {}) => (
  <ListPage page={WORK} today={TODAY} {...p} />
);

const LONG =
  'Electromagnetics and the physics of electrical machines, lecture notes, week 6: magnetic circuits';

export default defineExamples(spec, ListPage, {
  states: {
    filtered: () => view({ initial: { course: 'ECE 210', state: 'done' } }),
    'all-courses': () => view(),
    'no-matches': () => view({ initial: { query: 'thermal' } }),
    many: () => view({ page: MANY, initial: { state: 'done' } }),
    memories: () => view({ page: MEMORIES }),
  },
  stress: () =>
    view({
      page: {
        kind: 'work',
        items: MANY_SETS.map((s, i) =>
          i % 7 === 0
            ? {
                ...s,
                name: `${LONG} (${String(i)})`,
                course:
                  'Electromagnetics and the physics of electrical machines',
              }
            : s,
        ),
      },
      initial: { state: 'done' },
    }),
  skeletons: {
    filtered: () => <ListPageSkeleton />,
    'all-courses': () => <ListPageSkeleton />,
    'no-matches': () => <ListPageSkeleton />,
    many: () => <ListPageSkeleton />,
    memories: () => <ListPageSkeleton />,
  },
});
