import { greeting } from '@/lib/greeting';
import { dueLine, type GreetingSet } from './due';

/** Home's greeting: a line for the hour in the display step, and one muted
 *  line under it for what is due next (D4, D5, D11). It carries no outer
 *  margin: the parent applies `room-for-big-type`. */
export function Greeting({
  name,
  hour,
  pick,
  sets,
  today,
}: {
  /** The student's name; empty drops it from the line. */
  name: string;
  /** The hour of the day, 0 to 23. */
  hour: number;
  /** A number in [0, 1): which of the hour's lines. The page holds one for
   *  its visit; the design page and tests fix it. */
  pick: number;
  /** The student's sets, for the muted line. */
  sets: readonly GreetingSet[];
  /** The day the muted line counts from. */
  today: Date;
}) {
  return (
    <div className="min-w-0">
      <h1 className="ds-display text-(--ds-fg) [overflow-wrap:anywhere]">
        {greeting(hour, name, pick)}
      </h1>
      <p className="ds-body mt-2 text-(--ds-fg-muted) [overflow-wrap:anywhere]">
        {dueLine(sets, today)}
      </p>
    </div>
  );
}

function Bar({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-(--ds-radius-tag) bg-(--ds-border-muted) ${className}`}
    />
  );
}

/** The greeting while the name and the sets load: a bar for each line. */
export function GreetingSkeleton() {
  return (
    <div className="min-w-0">
      <div className="flex h-(--ds-display-line) items-center">
        <Bar className="h-9 w-3/4 max-w-120" />
      </div>
      <div className="mt-2 flex h-(--ds-body-line) items-center">
        <Bar className="h-4 w-1/2 max-w-80" />
      </div>
    </div>
  );
}
