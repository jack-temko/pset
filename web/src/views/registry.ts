import { HomeworkStage } from './homework/stage';
import { HomeworkWireframes } from './homework/wireframes';
import { SCENARIOS as homework } from './homework/scenarios';
import { ErrorNoticeStage } from './error-notice/stage';
import { SCENARIOS as errorNotice } from './error-notice/scenarios';
import type { ViewEntry } from './types';

/** Every view on /views, in the sidebar's order. A view is added here when
 *  it is extracted from its screen (design: ideas/views-gallery.md). */
const GRILLS = import.meta.glob('./*/grill.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

const ALL: ViewEntry[] = [
  {
    id: 'homework',
    title: 'Homework panel',
    group: 'Workspace',
    note: 'The panel’s Homework tab: the book’s sets, then one set’s walkthrough, a question at a time.',
    scenarios: homework,
    spec: () => import('./homework/spec.md?raw').then((m) => m.default),
    Stage: HomeworkStage,
    wideLabel: 'Focus',
    wireframes: HomeworkWireframes,
  },
  {
    id: 'error-notice',
    title: 'Error notice',
    group: 'Workspace',
    note: 'How PSet says something went wrong, in each place it says it: inline, on the shelf, as the screen banner, as a field line, and in Settings’ list of kept errors.',
    scenarios: errorNotice,
    spec: () => import('./error-notice/spec.md?raw').then((m) => m.default),
    Stage: ErrorNoticeStage,
  },
];

/** The views, each with its grill when `views/<id>/grill.md` exists. */
export const VIEWS: ViewEntry[] = ALL.map((v) => ({
  ...v,
  grill: GRILLS[`./${v.id}/grill.md`],
}));
