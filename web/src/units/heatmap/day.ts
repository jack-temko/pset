/** A study day ends at 4am: work until then counts for the day before
 *  (home-info-grill D6). */
export const DAY_ENDS_HOUR = 4;

/** The study day an instant belongs to, as a local calendar date at midnight.
 *  Whoever buckets time into days calls this. */
export function studyDay(at: Date): Date {
  const shifted = new Date(at.getTime());
  shifted.setHours(shifted.getHours() - DAY_ENDS_HOUR);
  return new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate());
}

/** A local date moved by whole calendar days (daylight saving cannot skew it). */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** The Monday of `d`'s week (D8: weeks start Monday). */
export function mondayOf(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7));
}

/** "2026-10-13": a local date as the key a day is stored under. */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear())}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The shade of a day, 0 (nothing) to 4: under 30 m, under 1 h, under 2 h,
 *  2 h or more (D8, Assumed). */
export function shade(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (!(minutes > 0)) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  return 4;
}
