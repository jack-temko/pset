import { waits, type Loads, type Waits } from '@/design/loading';
import { BoneBlock } from '@/units/bone';
import { Tooltip } from '@/units/tooltip';

/** One column of the chart: a day. */
export interface Bar {
  /** Under the bar: "Mon". Its first two letters show. */
  label: string;
  value: number;
  /** The tooltip, a few short lines split by a newline. */
  tip?: string;
  today?: boolean;
  /** A day still to come: no bar, only the track. */
  future?: boolean;
}

/** This week's shape, Monday first, for a screen that has only the date. */
export function weekShape(today: Date): BarChartShape {
  return {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    today: (today.getDay() + 6) % 7,
  };
}

/** The shortest a track gets, so a bar can still be read. */
const MIN_TRACK = 32;

/** What sizes the chart while it loads: its days' labels, which are known
 *  (the weekdays), and which is today. */
export interface BarChartShape {
  labels: readonly string[];
  today: number;
}

/** Days as vertical bars from a common baseline, each in a faint track so a
 *  quiet or coming day still holds its place: the figure over each when
 *  the first two letters of the day under it, today in the accent and its day
 *  in the full text colour at weight 500, a day with nothing or still to come
 *  as its bare track. The columns share the width; a bar is 28 wide; the
 *  tracks take the height they are given, 32 at least. Loading, the tracks
 *  and labels are real and the bars come with the data (bar-chart-d3). */
export const BarChart = waits(
  {
    data: ['bars'],
    shapeOf: (d): BarChartShape => ({
      labels: d.bars.map((b) => b.label),
      today: d.bars.findIndex((b) => b.today === true),
    }),
  } satisfies Loads<{ bars: readonly Bar[] }, BarChartShape>,
  function BarChart({
    bars: given,
    loading,
  }: Waits<Record<never, never>, { bars: readonly Bar[] }, BarChartShape>) {
    const on = loading !== undefined && loading !== 'unknown';
    const bars: readonly Bar[] = !on
      ? (given ?? [])
      : loading.labels.map((label, i) => ({
          label,
          value: 0,
          today: i === loading.today,
        }));
    const max = Math.max(1, ...bars.map((b) => (b.future ? 0 : b.value)));
    return (
      <div className="@container flex h-full gap-1">
        {bars.map((b) => {
          const pct = b.future
            ? 0
            : b.value > 0
              ? Math.max(6, (b.value / max) * 100)
              : 0;
          return (
            <div key={b.label} className="flex min-w-0 flex-1 flex-col">
              <div
                className="flex flex-1 [&>span]:flex-1"
                style={{ minHeight: MIN_TRACK }}
              >
                <Tooltip text={b.tip}>
                  <span className="relative mx-auto w-7 rounded-(--ds-radius-control) bg-(--ds-heat-0)">
                    {/* Loading, a day that has passed pulses in its track,
                        so a quiet week loading reads apart from a quiet week. */}
                    {on && b.future !== true ? (
                      <BoneBlock />
                    ) : (
                      <span
                        className="absolute inset-x-0 bottom-0 block rounded-(--ds-radius-control)"
                        style={{
                          height: `${String(pct)}%`,
                          background: b.today
                            ? 'var(--ds-accent)'
                            : 'var(--ds-heat-2)',
                        }}
                      />
                    )}
                  </span>
                </Tooltip>
              </div>
              <span
                className={`ds-label mt-1 h-[18px] text-center whitespace-nowrap ${
                  b.today
                    ? 'font-medium text-(--ds-fg)'
                    : 'text-(--ds-fg-muted)'
                }`}
              >
                {b.label.slice(0, 2)}
              </span>
            </div>
          );
        })}
      </div>
    );
  },
);
