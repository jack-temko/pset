import { Button } from '@/units/button';
import { Link } from '@/units/link';
import { FILL, type ChipState } from '@/units/problem-strip/colors';
import { daysUntil, dueText, minutesText } from '@/units/set-line/dates';
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

function Stat({ figure, caption }: { figure: string; caption: string }) {
  return (
    <div className="min-w-0 text-center">
      <p className="ds-heading ds-tabular text-(--ds-fg)">{figure}</p>
      <p className="ds-small text-(--ds-fg-muted)">{caption}</p>
    </div>
  );
}

/** The last stop of a set: where it stands and how it went, in a few figures
 *  and no more. A heading ("All 8 done", "5 of 8 done" or "Turned in Oct
 *  14"), the total time, when it was finished against the due date (or when
 *  it is due), time per problem as a bar each in its segment's colour with the
 *  longest named under them, then Turn in or Take back and Back to the
 *  course. Nothing about help. It stands alone in the pane, centred. */
export function Summary({
  problems,
  due,
  finished,
  turnedIn,
  today = new Date(),
  onTurnIn,
  onTakeBack,
  onBack,
}: {
  problems: readonly SummaryProblem[];
  due?: Date;
  /** When the last problem was marked done. */
  finished?: Date;
  /** When it was turned in; set means turned in. */
  turnedIn?: Date;
  /** The day "Due Thu" counts from (the design page and tests). */
  today?: Date;
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

  let when: { figure: string; caption: string } | undefined;
  if (all && finished) {
    when = {
      figure: WEEKDAY.format(finished),
      caption: due ? `Finished · ${earlyOrLate(finished, due)}` : 'Finished',
    };
  } else if (!all && due) {
    when = {
      figure: dueText(due, today).text.replace(/^Due /, ''),
      caption: 'Due',
    };
  }

  return (
    <section className="mx-auto flex w-full max-w-[520px] min-w-0 flex-col items-center gap-6 text-center">
      <div className="space-y-1">
        <h2 className="ds-heading text-(--ds-fg) [overflow-wrap:anywhere]">
          {heading}
        </h2>
        {turnedIn && <p className="ds-small text-(--ds-fg-muted)">{count}</p>}
      </div>

      {(minutes > 0 || when) && (
        <div className="flex w-full min-w-0 justify-center gap-12">
          {minutes > 0 && (
            <Stat figure={minutesText(minutes)} caption="Total time" />
          )}
          {when && <Stat figure={when.figure} caption={when.caption} />}
        </div>
      )}

      {minutes > 0 && (
        <div className="w-full min-w-0 space-y-2">
          <p className="ds-small text-(--ds-fg-muted)">Time per problem</p>
          <ul
            className="mx-auto flex h-14 w-full max-w-[360px] items-end"
            style={{ gap: 2 }}
          >
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
          {longest && (
            <p className="ds-small mx-auto max-w-full text-(--ds-fg-muted) [overflow-wrap:anywhere]">
              Longest: {longest.label} {longest.title},{' '}
              {minutesText(longest.minutes)}
            </p>
          )}
        </div>
      )}

      <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {turnedIn ? (
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
        )}
        <Link
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onBack?.();
          }}
        >
          Back to the course
        </Link>
      </div>
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

/** The summary while its set loads: a heading bar, the two figures, the bars
 *  of time per problem, the longest line and two button stubs, in the heights
 *  of the real thing. */
export function SummarySkeleton({
  turnedIn = false,
  count = 8,
}: {
  turnedIn?: boolean;
  count?: number;
}) {
  return (
    <div
      aria-hidden
      className="mx-auto flex w-full max-w-[520px] min-w-0 flex-col items-center gap-6"
    >
      <div className="space-y-1">
        <div className="flex h-(--ds-heading-line) items-center justify-center">
          <Bar className="h-5 w-40" />
        </div>
        {turnedIn && (
          <div className="flex h-(--ds-small-line) items-center justify-center">
            <Bar className="h-3 w-20" />
          </div>
        )}
      </div>
      <div className="flex w-full min-w-0 justify-center gap-12">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="flex h-(--ds-heading-line) items-center">
              <Bar className="h-5 w-20" />
            </div>
            <div className="flex h-(--ds-small-line) items-center">
              <Bar className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
      <div className="w-full min-w-0 space-y-2">
        <div className="flex h-(--ds-small-line) items-center justify-center">
          <Bar className="h-3 w-28" />
        </div>
        <div
          className="mx-auto flex h-14 w-full max-w-[360px] items-end"
          style={{ gap: 2 }}
        >
          {Array.from({ length: count }, (_, i) => (
            <span
              key={i}
              className="block min-w-px flex-1 animate-pulse rounded-t-(--ds-radius-segment) bg-(--ds-border-muted) motion-reduce:animate-none"
              style={{ height: `${String(40 + ((i * 23) % 55))}%` }}
            />
          ))}
        </div>
        <div className="flex h-(--ds-small-line) items-center justify-center">
          <Bar className="h-3 w-56" />
        </div>
      </div>
      <div className="flex h-(--ds-control) items-center justify-center gap-4">
        <Bar className="h-(--ds-control) w-24" />
        <Bar className="h-4 w-36" />
      </div>
    </div>
  );
}
