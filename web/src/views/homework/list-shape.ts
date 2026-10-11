import type { Variant } from '@/variants';

/** How many sets the list showed last time, per book, for its skeleton. */
export type ListShape = { active: number; turnedIn: number };
export const isListShape = (x: unknown): x is ListShape => {
  if (typeof x !== 'object' || x === null) return false;
  const s = x as Partial<ListShape>;
  return Number.isInteger(s.active) && Number.isInteger(s.turnedIn);
};

export const listVariant = (
  active: number,
  turnedIn: number,
): Variant<'homeworkList'> =>
  turnedIn > 0 ? 'turnedIn' : active > 0 ? 'active' : 'empty';
