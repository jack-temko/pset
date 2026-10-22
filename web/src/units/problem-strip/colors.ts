/** Where a problem stands, from the student's side. One set of colours serves
 *  the strip and the summary's bars. */
export type ChipState =
  | 'done'
  | 'started'
  | 'todo'
  | 'working'
  | 'queued'
  | 'failed';

/** The colour of a segment or a bar. */
export const FILL: Record<ChipState, string> = {
  done: 'var(--ds-success)',
  started: 'var(--ds-accent-solid)',
  todo: 'var(--ds-border)',
  working: 'var(--ds-attention)',
  queued: 'color-mix(in srgb, var(--ds-attention) 40%, transparent)',
  failed: 'var(--ds-danger)',
};

/** The underline of the current segment: its segment's colour, so it reads
 *  as part of it. A not-started segment is the neutral track, which would
 *  vanish, so its line is the muted text colour. A queued segment stays
 *  faint but its line is the full yellow. */
export const LINE: Record<ChipState, string> = {
  ...FILL,
  todo: 'var(--ds-fg-muted)',
  queued: 'var(--ds-attention)',
};
