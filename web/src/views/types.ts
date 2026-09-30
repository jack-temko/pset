import type { ComponentType } from 'react'

import type { GalleryEntry } from '@/pages/gallery/registry'
import type { Scenario } from './mock/scenario'

/** One way a view sends the student on: to which view, and what travels. */
export interface Handoff {
  /** The view it goes to: "Ask", "Settings". */
  to: string
  /** The action, in the student's words: "Ask about this question". */
  what: string
  /** What travels with it, as a person would say it. */
  carries?: string
}

/** What /views gives a view's stage: a way to say where the view would
 *  have sent the student, and the width the page is set to. */
export interface Harness {
  handoff: (h: Handoff) => void
  wide: boolean
  /** The scenario's `props`. */
  props: Record<string, unknown>
}

/** A view on /views. Its `Stage` draws it where it sits in the product
 *  (a panel's width, the providers its screen gives it) with the handoffs
 *  wired to `harness.handoff`, so it can be used with nothing behind it. */
export interface ViewEntry extends GalleryEntry {
  scenarios: Scenario[]
  /** The view's spec.md, loaded when the page shows it. */
  spec: () => Promise<string>
  Stage: ComponentType<{ harness: Harness }>
  /** Set when the view has a wider face (the panel's Focus): what the
   *  toggle is called. */
  wideLabel?: string
}
