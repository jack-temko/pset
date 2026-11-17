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
  /** The student's sets, for the muted line. */
  sets: readonly GreetingSet[];
  /** The hour of the day, 0 to 23. */
  hour: number;
  /** A number in [0, 1): which of the hour's lines. The page holds one for
   *  its visit; the design page and tests fix it. */
  pick: number;
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
