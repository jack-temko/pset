/** "2 h ago", "3 d ago", "just now": how long since the student opened it. */
export function openedAgo(openedAt: Date, now: Date): string {
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - openedAt.getTime()) / 60_000),
  );
  if (minutes < 1) return 'Opened just now';
  if (minutes < 60) return `Opened ${String(minutes)} m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Opened ${String(hours)} h ago`;
  return `Opened ${String(Math.floor(hours / 24))} d ago`;
}
