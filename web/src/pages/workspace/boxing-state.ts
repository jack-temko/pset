import { createContext, useContext } from 'react'

import type { Box, BoxKind } from '@/api/homework'

/** What the boxes are for: a new question in a set, or showing where a
 *  question already in one is. */
export type BoxingTarget = { kind: 'add'; setId: string } | { kind: 'find'; questionId: string; label: string }

export interface Boxing {
  /** Null when not boxing. */
  target: BoxingTarget | null
  boxes: Box[]
  /** What the next box drawn holds. */
  kind: BoxKind
  sending: boolean
  error: string
  /** The question the last boxing added, for the walkthrough to open. */
  added: string | null
  start: (target: BoxingTarget) => void
  cancel: () => void
  setKind: (kind: BoxKind) => void
  add: (box: Box) => void
  remove: (i: number) => void
  /** Switches a box between words and figure. */
  flip: (i: number) => void
  done: () => Promise<void>
}

const idle: Boxing = {
  target: null,
  boxes: [],
  kind: 'text',
  sending: false,
  error: '',
  added: null,
  start: () => {},
  cancel: () => {},
  setKind: () => {},
  add: () => {},
  remove: () => {},
  flip: () => {},
  done: async () => {},
}

export const BoxingContext = createContext<Boxing>(idle)

export const useBoxing = () => useContext(BoxingContext)
