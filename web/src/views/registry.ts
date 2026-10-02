import { HomeworkStage } from './homework/stage'
import { HomeworkWireframes } from './homework/wireframes'
import { SCENARIOS as homework } from './homework/scenarios'
import type { ViewEntry } from './types'

/** Every view on /views, in the sidebar's order. A view is added here when
 *  it is extracted from its screen (design: ideas/views-gallery.md). */
const GRILLS = import.meta.glob('./*/grill.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>

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
]

/** The views, each with its grill when `views/<id>/grill.md` exists. */
export const VIEWS: ViewEntry[] = ALL.map((v) => ({ ...v, grill: GRILLS[`./${v.id}/grill.md`] }))
