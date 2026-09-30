import { composedSections } from './composed'
import { containersSections } from './containers'
import { controlsSections } from './controls'
import { documentSections } from './document'
import { feedbackSections } from './feedback'
import { foundationsSections } from './foundations'
import { overlaysSections } from './overlays'
import type { ComponentEntry } from './types'

/** Every section of /components, in the sidebar's order. */
export const SECTIONS: ComponentEntry[] = [
  ...foundationsSections,
  ...controlsSections,
  ...containersSections,
  ...feedbackSections,
  ...overlaysSections,
  ...documentSections,
  ...composedSections,
]
