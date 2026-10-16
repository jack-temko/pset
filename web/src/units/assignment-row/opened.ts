const MONTH_DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

/** How long since the student opened it: "Opened just now", "Opened 2 h ago",
 *  "Opened yesterday", "Opened 3 d ago", and "Opened Oct 3" beyond a week. */
export function openedAgo(openedAt: Date, now: Date): string {
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - openedAt.getTime()) / 60_000),
  );
  if (minutes < 1) return 'Opened just now';
  if (minutes < 60) return `Opened ${String(minutes)} m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Opened ${String(hours)} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Opened yesterday';
  if (days <= 7) return `Opened ${String(days)} d ago`;
  return `Opened ${MONTH_DAY.format(openedAt)}`;
}
