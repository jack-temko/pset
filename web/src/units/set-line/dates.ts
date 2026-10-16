/** A set due within this many days carries the attention tag (set-line-d2). */
export const SOON_DAYS = 2;

/** Within this many days the due date is written as a weekday. */
export const WEEKDAY_DAYS = 6;

const DAY_MS = 86_400_000;

/** A due date is a local calendar date: this builds one from "2026-10-19"
 *  in the student's own time zone, never in UTC. */
export function parseDueDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`not a date: ${iso}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Whole calendar days from `today` to `due`, in the student's own days.
 *  Negative when it is past. */
export function daysUntil(due: Date, today: Date): number {
  const d = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d - t) / DAY_MS);
}

const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const MONTH_DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

export type DueKind = 'overdue' | 'soon' | 'plain';

/** How a due date reads, always as a date: "Due Fri" within 6 days, else
 *  "Due Oct 20" (also when past). `kind` says whether a badge goes beside
 *  the name: `soon` within 2 days, `overdue` when past (set-line-d7). */
export function dueText(
  due: Date,
  today: Date,
): { kind: DueKind; text: string } {
  const days = daysUntil(due, today);
  if (days < 0)
    return { kind: 'overdue', text: `Due ${MONTH_DAY.format(due)}` };
  if (days <= WEEKDAY_DAYS) {
    return {
      kind: days <= SOON_DAYS ? 'soon' : 'plain',
      text: `Due ${WEEKDAY.format(due)}`,
    };
  }
  return { kind: 'plain', text: `Due ${MONTH_DAY.format(due)}` };
}

/** "1 h 10 m", "45 m", "0 m": minutes as the student reads them. The total is
 *  rounded before it is split, so it never reads "1 h 60 m". */
export function minutesText(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${String(m)} m`;
  return m === 0 ? `${String(h)} h` : `${String(h)} h ${String(m)} m`;
}

/** "About 1 h 10 m left", or nothing for a time of zero or less. */
export function timeLeft(minutes: number): string {
  if (!(Math.round(minutes) > 0)) return '';
  return `About ${minutesText(minutes)} left`;
}
