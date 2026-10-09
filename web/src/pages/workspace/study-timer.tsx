import { Tooltip } from '@/components/tooltip';
import { IDLE, type StudyTime } from '@/api/activity';

/** "1h 05m", or "42m" under the hour. */
function studyDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return m < 60
    ? `${m}m`
    : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

const minutes = (ms: number) => Math.round(ms / 60_000);

/**
 * The time this sitting has counted toward the week, in the top bar,
 * quiet: so the student can see it counts, and when it doesn't. Spec:
 * design/workspace.md, "Time".
 */
export function StudyTimer({ time }: { time: StudyTime }) {
  return (
    <Tooltip
      side="bottom"
      label={
        time.counting
          ? `This sitting, toward your week. It pauses after ${minutes(IDLE.reading)} min idle, ${minutes(IDLE.homework)} on homework.`
          : 'Paused: nothing clicked or typed for a while.'
      }
    >
      <span className="text-xs text-muted-foreground tabular-nums">
        {time.counting ? 'Studying' : 'Paused'} · {studyDuration(time.seconds)}
      </span>
    </Tooltip>
  );
}
