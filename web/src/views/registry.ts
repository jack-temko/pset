import { HomeworkStage } from './homework/stage'
import { SCENARIOS as homework } from './homework/scenarios'
import type { ViewEntry } from './types'

/** Every view on /views, in the sidebar's order. A view is added here when
 *  it is extracted from its screen (design: ideas/views-gallery.md). */
export const VIEWS: ViewEntry[] = [
  {
    id: 'homework',
    title: 'Homework panel',
    group: 'Workspace',
    note: 'The panel’s Homework tab: the book’s sets, then one set’s walkthrough, a question at a time.',
    scenarios: homework,
    spec: () => import('./homework/spec.md?raw').then((m) => m.default),
    Stage: HomeworkStage,
    wideLabel: 'Focus',
  },
]
