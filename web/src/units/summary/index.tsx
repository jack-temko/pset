import {
  CalendarCheck,
  ChartColumn,
  CircleCheck,
  Clock,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/units/button';
import { Link } from '@/units/link';
import { List } from '@/units/list';
import { FILL, type ChipState } from '@/units/problem-strip/colors';
import { daysUntil, minutesText } from '@/units/set-line/dates';
import { Tooltip } from '@/units/tooltip';
import type { SummaryView } from './views';

export interface SummaryProblem {
  id: string;
  /** The book's label, "4.62". */
  label: string;
  title: string;
  state: ChipState;
  /** Time spent, in minutes. */
  minutes: number;
}

const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const MONTH_DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const plural = (n: number, one: string) =>
  `${String(n)} ${one}${n === 1 ? '' : 's'}`;

/** When it was finished against when it was due, in words:
 *  "2 days early", "on the due date", "1 day late". */
function earlyOrLate(finished: Date, due: Date): string {
  const days = daysUntil(due, finished);
  if (days > 0) return `${plural(days, 'day')} early`;
  if (days === 0) return 'on the due date';
  return `${plural(-days, 'day')} late`;
}

/** One row of the box: a muted icon and label at the left, the value at the
 *  right in the figures. */
function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-11 min-w-0 items-center justify-between gap-4 px-4 py-2">
      <span className="ds-body flex shrink-0 items-center gap-2 text-(--ds-fg-muted)">
        <Icon className="size-4" aria-hidden />
        {label}
      </span>
      <span className="ds-body ds-tabular min-w-0 text-right text-(--ds-fg) [overflow-wrap:anywhere]">
        {children}
      </span>
    </div>
  );
}

/** The time-per-problem bars, each in its segment's colour, the longest at
 *  full colour and the rest dimmed a little. */
function Bars({
  problems,
  longest,
  className = '',
}: {
  problems: readonly SummaryProblem[];
  longest?: SummaryProblem;
  className?: string;
}) {
  const top = Math.max(1, ...problems.map((p) => p.minutes));
  return (
    <ul
      className={`flex h-14 w-full items-end ${className}`}
      style={{ gap: 2 }}
    >
      {problems.map((p) => (
        <li
          key={p.id}
          className="flex h-full min-w-0 flex-1 items-end [&>span]:h-full [&>span]:w-full [&>span]:items-end"
        >
          <Tooltip
            text={`${p.label} ${p.title} \u00b7 ${minutesText(p.minutes)}`}
          >
            <span
              className="block w-full min-w-px rounded-t-(--ds-radius-segment) hover:brightness-125"
              style={{
                opacity: longest && p.id !== longest.id ? 0.55 : 1,
                height: `${String(Math.max(4, (p.minutes / top) * 100))}%`,
                background: FILL[p.state],
              }}
            />
          </Tooltip>
        </li>
      ))}
    </ul>
  );
}

/** The last stop of a set, in one of four looks (`view`). Each says the same
 *  few things: how far it is ("All 8 done", "5 of 8 done" or "Turned in Oct
 *  14"), the total time, when it was finished against the due date, the
 *  longest problem and the time per problem as bars (the longest at full
 *  colour), then Turn in or Take back and Back to the course. Nothing about
 *  help, and no due date: the set line has it. It stands alone in the pane,
 *  centred. */
export function Summary({
  problems,
  due,
  finished,
  turnedIn,
  view = 'box',
  onTurnIn,
  onTakeBack,
  onBack,
}: {
  problems: readonly SummaryProblem[];
  /** Only to say how early or late it was finished; never shown on its own. */
  due?: Date;
  /** When the last problem was marked done. */
  finished?: Date;
  /** When it was turned in; set means turned in. */
  turnedIn?: Date;
  view?: SummaryView;
  onTurnIn?: () => void;
  onTakeBack?: () => void;
  onBack?: () => void;
}) {
  const total = problems.length;
  const done = problems.filter((p) => p.state === 'done').length;
  const all = total > 0 && done === total;
  const minutes = problems.reduce((n, p) => n + p.minutes, 0);
  const longest = problems.reduce<SummaryProblem | undefined>(
    (m, p) => (p.minutes > (m?.minutes ?? 0) ? p : m),
    undefined,
  );

  const count = all
    ? `All ${String(total)} done`
    : `${String(done)} of ${String(total)} done`;
  const heading = turnedIn ? `Turned in ${MONTH_DAY.format(turnedIn)}` : count;
  const time = minutes > 0 ? minutesText(minutes) : undefined;
  const day = all && finished ? WEEKDAY.format(finished) : undefined;
  const early = day && due && finished ? earlyOrLate(finished, due) : undefined;
  const longestText =
    longest && longest.minutes > 0
      ? `${longest.label} ${longest.title}\u00a0\u00b7\u00a0${minutesText(longest.minutes)}`
      : undefined;

  const action = turnedIn ? (
    <Button
      onPress={() => {
        onTakeBack?.();
      }}
    >
      Take back
    </Button>
  ) : (
    <Button
      variant="primary"
      onPress={() => {
        onTurnIn?.();
      }}
    >
      Turn in
    </Button>
  );
  const back = (
    <Link
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onBack?.();
      }}
    >
      Back to the course
    </Link>
  );
  const bars = time ? <Bars problems={problems} longest={longest} /> : null;
  const sub = turnedIn ? (
    <p className="ds-small text-(--ds-fg-muted)">{count}</p>
  ) : null;

  if (view === 'home')
    return (
      <section className="mx-auto w-full min-w-0 space-y-3">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] rounded-(--ds-radius-control) border border-(--ds-border) p-5">
          <div className="flex min-w-0 flex-col gap-2 pr-5">
            <h2 className="ds-heading text-(--ds-fg) [overflow-wrap:anywhere]">
              {heading}
            </h2>
            {sub}
            {time && (
              <p className="ds-body ds-tabular text-(--ds-fg-muted)">
                <span className="text-(--ds-fg)">{time}</span> total
              </p>
            )}
            {day && (
              <p className="ds-body ds-tabular text-(--ds-fg-muted)">
                Finished <span className="text-(--ds-fg)">{day}</span>
                {early ? ` \u00b7 ${early}` : ''}
              </p>
            )}
          </div>
          {bars && (
            <div className="flex min-w-0 flex-col justify-end gap-2 border-l border-(--ds-border-muted) pl-5">
              {bars}
              {longestText && (
                <p className="ds-small text-(--ds-fg-muted) [overflow-wrap:anywhere]">
                  Longest: {longestText}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          {action}
          {back}
        </div>
      </section>
    );

  if (view === 'plain')
    return (
      <section className="mx-auto flex w-full max-w-[520px] min-w-0 flex-col items-center gap-8 text-center">
        <div className="space-y-2">
          <h2 className="ds-heading text-(--ds-fg) [overflow-wrap:anywhere]">
            {heading}
          </h2>
          {sub}
          {(time ?? day) && (
            <p className="ds-body ds-tabular text-(--ds-fg-muted)">
              {[
                time && `${time} total`,
                day && `finished ${day}${early ? `, ${early}` : ''}`,
              ]
                .filter(Boolean)
                .join(' \u00b7 ')}
            </p>
          )}
        </div>
        {bars && (
          <div className="w-full max-w-[360px] space-y-2">
            {bars}
            {longestText && (
              <p className="ds-small text-(--ds-fg-muted) [overflow-wrap:anywhere]">
                Longest: {longestText}
              </p>
            )}
          </div>
        )}
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {action}
          {back}
        </div>
      </section>
    );

  if (view === 'tiles') {
    const tiles: [string, string][] = [
      ...(time ? [['Total time', time] as [string, string]] : []),
      ...(day
        ? [
            ['Finished', `${day}${early ? ` \u00b7 ${early}` : ''}`] as [
              string,
              string,
            ],
          ]
        : []),
      ...(longestText ? [['Longest', longestText] as [string, string]] : []),
    ];
    return (
      <section className="mx-auto w-full min-w-0 space-y-4">
        <div className="space-y-1">
          <h2 className="ds-heading text-(--ds-fg) [overflow-wrap:anywhere]">
            {heading}
          </h2>
          {sub}
        </div>
        {tiles.length > 0 && (
          <div
            className="grid min-w-0 gap-3"
            style={{
              gridTemplateColumns: `repeat(${String(tiles.length)}, minmax(0, 1fr))`,
            }}
          >
            {tiles.map(([label, value]) => (
              <div
                key={label}
                className="min-w-0 rounded-(--ds-radius-control) border border-(--ds-border) px-4 py-3"
              >
                <p className="ds-small text-(--ds-fg-muted)">{label}</p>
                <p className="ds-body ds-tabular text-(--ds-fg) [overflow-wrap:anywhere]">
                  {value}
                </p>
              </div>
            ))}
          </div>
        )}
        {bars}
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          {action}
          {back}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full min-w-0 space-y-3">
      <List title={heading} action={action}>
        {turnedIn && (
          <Fact icon={CircleCheck} label="Done">
            {done} of {total}
          </Fact>
        )}
        {time && (
          <Fact icon={Clock} label="Total time">
            {time}
          </Fact>
        )}
        {day && (
          <Fact icon={CalendarCheck} label="Finished">
            {day}
            {early ? ` \u00b7 ${early}` : ''}
          </Fact>
        )}
        {longestText && (
          <Fact icon={Timer} label="Longest">
            {longestText}
          </Fact>
        )}
        {time && (
          <div className="min-w-0 space-y-2 px-4 py-3">
            <span className="ds-body flex items-center gap-2 text-(--ds-fg-muted)">
              <ChartColumn className="size-4" aria-hidden />
              Time per problem
            </span>
            {bars}
          </div>
        )}
      </List>
      {back}
    </section>
  );
}

function Bar({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-(--ds-radius-tag) bg-(--ds-border-muted) motion-reduce:animate-none ${className}`}
    />
  );
}

/** The summary while its set loads, in the shape of its look and the heights
 *  of the real thing. */
export function SummarySkeleton({
  view = 'box',
  turnedIn = false,
  count = 8,
}: {
  view?: SummaryView;
  turnedIn?: boolean;
  count?: number;
}) {
  const bars = (
    <div className="flex h-14 w-full items-end" style={{ gap: 2 }}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="block min-w-px flex-1 animate-pulse rounded-t-(--ds-radius-segment) bg-(--ds-border-muted) motion-reduce:animate-none"
          style={{ height: `${String(40 + ((i * 23) % 55))}%` }}
        />
      ))}
    </div>
  );
  const heading = (
    <div className="flex h-(--ds-heading-line) items-center">
      <Bar className="h-5 w-40" />
    </div>
  );
  const sub = turnedIn && (
    <div className="flex h-(--ds-small-line) items-center">
      <Bar className="h-3 w-20" />
    </div>
  );
  const actions = (justify: string) => (
    <div className={`flex h-(--ds-control) items-center gap-4 ${justify}`}>
      <Bar className="h-(--ds-control) w-24" />
      <Bar className="h-4 w-36" />
    </div>
  );
  const line = (w: string) => (
    <div className="flex h-(--ds-body-line) items-center">
      <Bar className={`h-4 ${w}`} />
    </div>
  );

  if (view === 'home')
    return (
      <div aria-hidden className="mx-auto w-full min-w-0 space-y-3">
        <div className="grid grid-cols-2 rounded-(--ds-radius-control) border border-(--ds-border-muted) p-5">
          <div className="flex flex-col gap-2 pr-5">
            {heading}
            {sub}
            {line('w-32')}
            {line('w-48')}
          </div>
          <div className="flex flex-col justify-end gap-2 border-l border-(--ds-border-muted) pl-5">
            {bars}
            {line('w-56')}
          </div>
        </div>
        {actions('')}
      </div>
    );
  if (view === 'plain')
    return (
      <div
        aria-hidden
        className="mx-auto flex w-full max-w-[520px] min-w-0 flex-col items-center gap-8"
      >
        <div className="flex flex-col items-center gap-2">
          {heading}
          {sub}
          {line('w-64')}
        </div>
        <div className="w-full max-w-[360px] space-y-2">
          {bars}
          {line('w-56')}
        </div>
        {actions('justify-center')}
      </div>
    );
  if (view === 'tiles')
    return (
      <div aria-hidden className="mx-auto w-full min-w-0 space-y-4">
        <div className="space-y-1">
          {heading}
          {sub}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="space-y-1 rounded-(--ds-radius-control) border border-(--ds-border-muted) px-4 py-3"
            >
              <div className="flex h-(--ds-small-line) items-center">
                <Bar className="h-3 w-16" />
              </div>
              {line('w-24')}
            </div>
          ))}
        </div>
        {bars}
        {actions('')}
      </div>
    );
  return (
    <div aria-hidden className="mx-auto w-full min-w-0 space-y-3">
      <div className="min-w-0 overflow-hidden rounded-(--ds-radius-control) border border-(--ds-border)">
        <div className="flex min-h-10 items-center justify-between gap-3 border-b border-(--ds-border) bg-(--ds-bg-raised) px-4 py-2">
          <Bar className="h-4 w-32" />
          <Bar className="h-(--ds-control) w-24" />
        </div>
        <div className="divide-y divide-(--ds-border-muted)">
          {Array.from({ length: turnedIn ? 4 : 3 }, (_, i) => (
            <div
              key={i}
              className="flex min-h-11 items-center justify-between gap-4 px-4 py-2"
            >
              <Bar className="h-4 w-28" />
              <Bar className="h-4 w-36" />
            </div>
          ))}
          <div className="space-y-2 px-4 py-3">
            {line('w-36')}
            {bars}
          </div>
        </div>
      </div>
      {line('w-36')}
    </div>
  );
}
