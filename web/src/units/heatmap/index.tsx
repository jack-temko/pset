import { minutesText } from '@/units/set-line/dates';
import { Tooltip } from '@/units/tooltip';
import { addDays, dayKey, mondayOf, shade } from './day';
import {
  LABEL_W,
  LABELS_H,
  MONTH_GAP,
  MONTH_H,
  ROWS,
  gridFor,
  gridHeight,
  monthColumns,
  naturalWidth,
  spanName,
} from './layout';
import { useWidth } from './use-width';

/** One day's study, by course. */
export interface StudyDay {
  /** The study day, "2026-10-13" (see `studyDay`). */
  date: string;
  courses: readonly { course: string; minutes: number }[];
  /** Questions done that day, when the screen has them. */
  questions?: number;
  /** Sets finished that day, when the screen has them. */
  sets?: number;
  /** Questions still to do in sets due within a week, as of that day. */
  left?: number;
}

const DAY_FORMAT = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const dayTotal = (d: StudyDay | undefined) =>
  d ? d.courses.reduce((n, c) => n + c.minutes, 0) : 0;

/** The tooltip: the day, its total, then each course, most time first (D7). */
function dayTip(date: Date, day: StudyDay | undefined): string {
  const head = DAY_FORMAT.format(date);
  const total = dayTotal(day);
  if (!day || total <= 0) return `${head}\nNo time studied`;
  const courses = [...day.courses]
    .filter((c) => c.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .map((c) => `${c.course}: ${minutesText(c.minutes)}`);
  return [head, minutesText(total), ...courses].join('\n');
}

/** "41 h" for a long total, "50 m" for a short one. */
function totalText(minutes: number): string {
  return minutes >= 60
    ? `${String(Math.round(minutes / 60))} h`
    : minutesText(minutes);
}

/** The labels and the grid sit bare under the heading: no outline, no room
 *  of their own (heatmap-d9). */
const BOX = 'mt-3 flex-1';
const boxWidth = (weeks: number) => naturalWidth(weeks);

const WEEKDAYS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

/** Time studied per day (D1): columns of weeks from Monday, today in the
 *  last, month names above and Mon, Wed and Fri beside, five shades, a
 *  heading with the total, and a tooltip on each square. It shows `weeks` at
 *  most and fewer when its container is narrower, ending today, never
 *  scrolling sideways (heatmap-d3). `grow` lets the squares fill the
 *  container, up to 32 each (heatmap-d8). */
export function Heatmap({
  days,
  today,
  weeks = 26,
  grow = false,
  openDay,
}: {
  days: readonly StudyDay[];
  /** The study day that is today: the last column's last square. */
  today: Date;
  /** The most weeks to show: 26 for about 6 months, 53 for a year (D2). */
  weeks?: number;
  /** Fill the container's width, the squares up to 32 and the gaps wider. */
  grow?: boolean;
  /** A date "2026-10-13" whose tooltip is held open: the design page. */
  openDay?: string;
}) {
  const [box, width] = useWidth<HTMLDivElement>();
  const { weeks: shown, size, gap } = gridFor(width, weeks, grow);
  const first = addDays(mondayOf(today), -(shown - 1) * 7);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const cells: { date: Date; day?: StudyDay; future: boolean }[] = [];
  let total = 0;
  for (let i = 0; i < shown * 7; i++) {
    const date = addDays(first, i);
    const future = date > today;
    const day = future ? undefined : byDate.get(dayKey(date));
    total += dayTotal(day);
    cells.push({ date, day, future });
  }
  const months = monthColumns(
    Array.from({ length: shown }, (_, c) => addDays(first, c * 7)),
  );
  const rowsAt = `repeat(${String(ROWS)}, ${String(size)}px)`;

  const radius =
    size >= 24 ? 'var(--ds-radius-control)' : 'var(--ds-radius-segment)';
  return (
    <div
      className="flex min-w-0 flex-col"
      style={grow ? undefined : { width: boxWidth(weeks), maxWidth: '100%' }}
    >
      <p className="ds-body ds-tabular text-(--ds-fg)">
        {total > 0
          ? `${totalText(total)} studied in the last ${spanName(shown)}`
          : 'No time studied yet'}
      </p>
      <div className={BOX}>
        <div ref={box} className="min-w-0">
          <div
            aria-hidden
            className="ds-label relative whitespace-nowrap text-(--ds-fg-muted)"
            style={{ height: MONTH_H, marginLeft: LABEL_W }}
          >
            {months.map(({ col, name }) => (
              <span
                key={col}
                className="absolute top-0"
                style={{ left: col * (size + gap) }}
              >
                {name}
              </span>
            ))}
          </div>
          <div className="flex" style={{ marginTop: MONTH_GAP }}>
            <div
              aria-hidden
              className="ds-label grid shrink-0 text-(--ds-fg-muted)"
              style={{ width: LABEL_W, gridTemplateRows: rowsAt, rowGap: gap }}
            >
              {WEEKDAYS.map((d, i) => (
                <span key={i} className="flex items-center">
                  {d}
                </span>
              ))}
            </div>
            <div
              className="grid grid-flow-col"
              style={{
                gridTemplateRows: rowsAt,
                gridAutoColumns: `${String(size)}px`,
                gap,
              }}
            >
              {cells.map(({ date, day, future }) =>
                future ? (
                  <span
                    key={dayKey(date)}
                    className="block border border-(--ds-border-muted)"
                    style={{ width: size, height: size, borderRadius: radius }}
                  />
                ) : (
                  <Tooltip
                    key={dayKey(date)}
                    text={dayTip(date, day)}
                    open={dayKey(date) === openDay}
                  >
                    <span
                      className="block"
                      style={{
                        width: size,
                        height: size,
                        borderRadius: radius,
                        background: `var(--ds-heat-${String(shade(dayTotal(day)))})`,
                      }}
                    />
                  </Tooltip>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
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

/** The heatmap while the days load: the heading line as a bar and, in the
 *  outline, a block the height of the labels and the grid, which a grown one works out from
 *  its width as the heatmap does. */
export function HeatmapSkeleton({
  weeks = 26,
  grow = false,
}: {
  weeks?: number;
  grow?: boolean;
}) {
  const [box, width] = useWidth<HTMLDivElement>();
  const { size, gap } = gridFor(width, weeks, grow);
  return (
    <div
      className="flex min-w-0 flex-col"
      style={grow ? undefined : { width: boxWidth(weeks), maxWidth: '100%' }}
    >
      <p
        className="ds-body flex items-center"
        style={{ height: width > 0 && width < 340 ? 44 : 22 }}
      >
        <Bar className="h-4 w-2/5 max-w-60" />
      </p>
      <div className={BOX}>
        <div ref={box} style={{ height: LABELS_H + gridHeight(size, gap) }}>
          <Bar className="h-full w-full" />
        </div>
      </div>
    </div>
  );
}
