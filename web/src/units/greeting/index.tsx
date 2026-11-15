import { waits, type Loads, type Waits } from '@/design/loading';
import { greeting } from '@/lib/greeting';
import { FillBlock } from '@/units/bone';
import { RHYTHM } from '@/units/bone/rhythm';
import { dueLine, type GreetingSet } from './due';

/** The facts of the greeting that size a box: none. Its lines may wrap, and
 *  each loads as one bar line that grows when the text comes (bone-d4). */
export type GreetingShape = Record<string, never>;

interface GreetingData {
  /** The student's name; empty drops it from the line. */
  name: string;
  /** The student's sets, for the muted line. */
  sets: readonly GreetingSet[];
}

/** Home's greeting: a line for the hour in the display step, and one muted
 *  line under it for what is due next (D4, D5, D11). It carries no outer
 *  margin: the parent applies `room-for-big-type`. Loading, each line is a
 *  bar (greeting-d6). */
export const Greeting = waits(
  {
    data: ['name', 'sets'],
    shapeOf: (): GreetingShape => ({}),
  } satisfies Loads<GreetingData, GreetingShape>,
  function Greeting({
    name,
    hour,
    pick,
    sets,
    today,
    loading,
  }: Waits<
    {
      /** The hour of the day, 0 to 23. */
      hour: number;
      /** A number in [0, 1): which of the hour's lines. The page holds one
       *  for its visit; the design page and tests fix it. */
      pick: number;
      /** The day the muted line counts from. */
      today: Date;
    },
    GreetingData,
    GreetingShape
  >) {
    const on = loading !== undefined;
    return (
      <div className="min-w-0">
        <FillBlock
          as="h1"
          ch={RHYTHM.title}
          className="ds-display text-(--ds-fg) [overflow-wrap:anywhere]"
        >
          {on ? undefined : greeting(hour, name, pick)}
        </FillBlock>
        <FillBlock
          ch={RHYTHM.meta}
          className="ds-body mt-2 text-(--ds-fg-muted) [overflow-wrap:anywhere]"
        >
          {on ? undefined : dueLine(sets, today)}
        </FillBlock>
      </div>
    );
  },
);
