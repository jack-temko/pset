export type ProgressMark = 'done' | 'current' | 'waiting' | 'failed'

export interface ProgressSegment {
  mark: ProgressMark
  /** How much of the bar it takes: how hard the question is. Missing or
   *  not above zero counts as 1, so with no weights the segments are equal. */
  weight?: number
}

/** The flex-grow each segment gets: its weight, or 1. */
export const segmentWeights = (segments: ProgressSegment[]): number[] =>
  segments.map((s) => (s.weight !== undefined && Number.isFinite(s.weight) && s.weight > 0 ? s.weight : 1))
