import { Runs } from '@/units/problem/math';
import type { Label } from './types';

/** A label: plain text as it is, runs through the same renderer as the prose,
 *  so math in a caption or a column head draws as math (ask-d27). */
export function LabelText({ value }: { value: Label }) {
  return typeof value === 'string' ? value : <Runs runs={value} />;
}
