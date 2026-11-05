import type { Variant } from '@/variants';

/** A saved count is drawn as that many rows: a small whole number. */
const count = (n: unknown): n is number =>
  Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 50;

/** How many sets the list showed last time, per book, for its skeleton. */
export type ListShape = { active: number; turnedIn: number };
export const isListShape = (x: unknown): x is ListShape => {
  if (typeof x !== 'object' || x === null) return false;
  const s = x as Partial<ListShape>;
  return count(s.active) && count(s.turnedIn);
};

export const listVariant = (
  active: number,
  turnedIn: number,
): Variant<'homeworkList'> =>
  turnedIn > 0 ? 'turnedIn' : active > 0 ? 'active' : 'empty';
