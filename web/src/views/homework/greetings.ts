import { bandFor, fill } from '@/lib/greeting'

/**
 * The line on the finish page, when the last question is done: Home's
 * mechanism (seven stretches of the day, a few short lines each, one picked
 * at random, `{name}` dropping out whole when there is no name) with lines
 * for finishing rather than arriving. Drafted by the agent for Jack to
 * approve or rewrite (the grill's A15).
 */
const LINES: Record<number, string[]> = {
  // Keyed by the stretch's first hour, which is how Home's bands name themselves.
  0: ['Done at last, {name}.', 'Sleep has earned this, {name}.', 'Bed now, {name}. You finished.'],
  3: ['Done before sunrise, {name}.', 'That took dedication, {name}.', 'Sleep now, {name}.'],
  6: ['Done, and it is morning, {name}.', 'Off the list before the day starts, {name}.', 'Nicely early, {name}.'],
  11: ['Done before lunch, {name}.', 'Lunch is earned, {name}.', 'All of it, {name}.'],
  14: ['That is a wrap, {name}.', 'Snack earned, {name}.', 'Done for the afternoon, {name}.'],
  17: ['Done before dinner, {name}.', 'The evening is yours, {name}.', 'Every last one, {name}.'],
  21: ['Long night, {name}. It shows.', 'Done for the night, {name}.', 'Rest is earned, {name}.'],
}

export const finishBands = Object.entries(LINES).map(([from, lines]) => ({ from: Number(from), lines }))

/** `pick` is a number in [0, 1), held for the whole visit, as for Home. */
export function finishLine(hour: number, name: string, pick: number): string {
  const lines = LINES[bandFor(hour).from]
  return fill(lines[Math.min(lines.length - 1, Math.floor(pick * lines.length))], name)
}
