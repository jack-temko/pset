/** "about 20 s": the wait as the student reads it. */
export function waitText(seconds: number): string {
  const s = Math.max(1, Math.round(seconds));
  if (s < 60) return `about ${String(s)} s`;
  const m = Math.round(s / 60);
  return `about ${String(m)} min`;
}
