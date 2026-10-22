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

/** The last stop of a set, as a box like a list: a header with how far it is
 *  ("All 8 done", "5 of 8 done" or "Turned in Oct 14") and Turn in or Take
 *  back at its right, then a row each for the total time, when it was
 *  finished against the due date, and the longest problem, and last the time
 *  per problem as a bar each in its segment's colour, the longest at full
 *  colour. Back to the course is a link under the box. It says nothing about
 *  help, and nothing the set line already says, such as the due date. It
 *  stands alone in the pane, centred. */
export function Summary({
  problems,
  due,
  finished,
  turnedIn,
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
  const top = Math.max(1, ...problems.map((p) => p.minutes));

  const count = all
    ? `All ${String(total)} done`
    : `${String(done)} of ${String(total)} done`;
  const heading = turnedIn ? `Turned in ${MONTH_DAY.format(turnedIn)}` : count;

  return (
    <section className="mx-auto w-full min-w-0 space-y-3">
      <List
        title={heading}
        action={
          turnedIn ? (
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
          )
        }
      >
        {turnedIn && (
          <Fact icon={CircleCheck} label="Done">
            {done} of {total}
          </Fact>
        )}
        {minutes > 0 && (
          <Fact icon={Clock} label="Total time">
            {minutesText(minutes)}
          </Fact>
        )}
        {all && finished && (
          <Fact icon={CalendarCheck} label="Finished">
            {WEEKDAY.format(finished)}
            {due ? ` · ${earlyOrLate(finished, due)}` : ''}
          </Fact>
        )}
        {longest && longest.minutes > 0 && (
          <Fact icon={Timer} label="Longest">
            {longest.label} {longest.title} · {minutesText(longest.minutes)}
          </Fact>
        )}
        {minutes > 0 && (
          <div className="min-w-0 space-y-2 px-4 py-3">
            <span className="ds-body flex items-center gap-2 text-(--ds-fg-muted)">
              <ChartColumn className="size-4" aria-hidden />
              Time per problem
            </span>
            <ul className="flex h-14 w-full items-end" style={{ gap: 2 }}>
              {problems.map((p) => (
                <li
                  key={p.id}
                  className="flex h-full min-w-0 flex-1 items-end [&>span]:h-full [&>span]:w-full [&>span]:items-end"
                >
                  <Tooltip
                    text={`${p.label} ${p.title} · ${minutesText(p.minutes)}`}
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
          </div>
        )}
      </List>
      <Link
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onBack?.();
        }}
      >
        Back to the course
      </Link>
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

/** The summary while its set loads: the box with a header bar and button,
 *  three rows, the bars and the link, in the heights of the real thing. */
export function SummarySkeleton({
  turnedIn = false,
  count = 8,
}: {
  turnedIn?: boolean;
  count?: number;
}) {
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
            <div className="flex h-(--ds-body-line) items-center">
              <Bar className="h-4 w-36" />
            </div>
            <div className="flex h-14 w-full items-end" style={{ gap: 2 }}>
              {Array.from({ length: count }, (_, i) => (
                <span
                  key={i}
                  className="block min-w-px flex-1 animate-pulse rounded-t-(--ds-radius-segment) bg-(--ds-border-muted) motion-reduce:animate-none"
                  style={{ height: `${String(40 + ((i * 23) % 55))}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex h-(--ds-body-line) items-center">
        <Bar className="h-4 w-36" />
      </div>
    </div>
  );
}
