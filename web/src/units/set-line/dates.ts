/** A set due within this many days carries the attention tag (set-line-d2). */
export const SOON_DAYS = 2;

const DAY_MS = 86_400_000;

/** Whole calendar days from `today` to `due`, in the student's own days. */
export function daysUntil(due: Date, today: Date): number {
  const d = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d - t) / DAY_MS);
}

export const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

/** "About 1 h 10 m left". */
export function timeLeft(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  const parts = [h > 0 ? `${String(h)} h` : '', m > 0 ? `${String(m)} m` : ''];
  return `About ${parts.filter(Boolean).join(' ') || '0 m'} left`;
}
