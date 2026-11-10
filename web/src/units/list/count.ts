import { LIST_CAP } from './index';

/** The count beside a list's heading, or none: a zero says nothing, and past
 *  the cap the "Show all N" foot already says it (list-d5). */
export function countBeside(n: number): number | undefined {
  return n === 0 || n > LIST_CAP ? undefined : n;
}
