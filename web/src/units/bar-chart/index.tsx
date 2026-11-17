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

/** The shortest a track gets, so a bar can still be read. */
const MIN_TRACK = 32;

/** Days as vertical bars from a common baseline, each in a faint track so a
 *  quiet or coming day still holds its place: the figure over each when
 *  the first two letters of the day under it, today in the accent and its day
 *  in the full text colour at weight 500, a day with nothing or still to come
 *  as its bare track. The columns share the width; a bar is 28 wide; the
 *  tracks take the height they are given, 32 at least. */
export function BarChart({ bars }: { bars: readonly Bar[] }) {
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
                  {/* Always here, so it slides when the day's minutes
                        change (bar-chart-d4). */}
                  <span
                    className="absolute inset-x-0 bottom-0 block rounded-(--ds-radius-control) transition-[height] duration-700 ease-out motion-reduce:transition-none"
                    style={{
                      height: `${String(pct)}%`,
                      background: b.today
                        ? 'var(--ds-accent)'
                        : 'var(--ds-heat-2)',
                    }}
                  />
                </span>
              </Tooltip>
            </div>
            <span
              className={`ds-label mt-1 h-[18px] text-center whitespace-nowrap ${
                b.today ? 'font-medium text-(--ds-fg)' : 'text-(--ds-fg-muted)'
              }`}
            >
              {b.label.slice(0, 2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
