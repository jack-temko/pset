import type { AnySpec } from './spec';

/** Whether a unit draws a quiet form (loading D1, D2): a screen or a pane
 *  that reads data. A part inside one has no loading form of its own: its
 *  screen holds until the data is in. */
export const hasQuietForm = (spec: AnySpec): boolean =>
  spec.kind !== 'component' && (spec.data?.length ?? 0) > 0;
