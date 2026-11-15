import { Button } from '@/units/button';
import { Link } from '@/units/link';
import { FILL, type ChipState } from '@/units/problem-strip/colors';
import { daysUntil, minutesText } from '@/units/set-line/dates';
import { Bone, BoneBlock, FillBlock } from '@/units/bone';
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

/** The last stop of a set, plain with no box. It says a few things: how far it is ("All 8 done", "5 of 8 done" or "Turned in Oct
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
  onTurnIn,
  onTakeBack,
  onBack,
  onContinue,
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
  /** Opens a problem that is not done yet: the summary's main action while
   *  any is left (summary-d9). */
  onContinue?: (id: string) => void;
}) {
  const total = problems.length;
  const done = problems.filter((p) => p.state === 'done').length;
  const all = total > 0 && done === total;
  const left = problems.findIndex((p) => p.state !== 'done');
  const next = left === -1 ? undefined : left;
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
    <>
      {/* While problems are left, the next one leads and Turn in steps back. */}
      {next !== undefined && (
        <Button
          variant="primary"
          onPress={() => {
            onContinue?.(problems[next].id);
          }}
        >
          {`Continue with problem ${String(next + 1)}`}
        </Button>
      )}
      <Button
        variant={next === undefined ? 'primary' : 'default'}
        onPress={() => {
          onTurnIn?.();
        }}
      >
        Turn in
      </Button>
    </>
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

  return (
    <section className="mx-auto flex w-full max-w-[520px] min-w-0 flex-col items-center gap-8 text-center">
      <div className="space-y-2">
        <FillBlock
          as="h2"
          ch={16}
          className="ds-heading text-(--ds-fg) [overflow-wrap:anywhere]"
        >
          {heading}
        </FillBlock>
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
            <FillBlock
              ch={30}
              className="ds-small text-(--ds-fg-muted) [overflow-wrap:anywhere]"
            >
              Longest: {longestText}
            </FillBlock>
          )}
        </div>
      )}
      <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {action}
        {back}
      </div>
    </section>
  );
}

/** What sizes the summary while its set loads: which lines it has, how many
 *  problems the bars stand for, and which buttons. */
export interface SummaryShape {
  count: number;
  turnedIn: boolean;
  /** The line of total time and when it was finished. */
  line: boolean;
  /** Time was spent: the bars, and the longest under them. */
  timed: boolean;
  longest: boolean;
  /** A problem is left: Continue leads. */
  next: boolean;
}

/** The summary while its set loads (summary-d10): its lines as bars that
 *  grow if they wrap, a bone column for each problem, and its buttons real
 *  and not ready, in the loaded layout. */
export function SummaryWaiting({
  shape,
  onBack,
}: {
  shape: SummaryShape;
  onBack?: () => void;
}) {
  const still = 'Still loading';
  return (
    <section className="mx-auto flex w-full max-w-[520px] min-w-0 flex-col items-center gap-8 text-center">
      <div className="space-y-2">
        <FillBlock
          as="h2"
          ch={16}
          className="ds-heading text-(--ds-fg) [overflow-wrap:anywhere]"
        >
          {undefined}
        </FillBlock>
        {shape.turnedIn && (
          <p className="ds-small">
            <Bone ch={10} />
          </p>
        )}
        {shape.line && (
          <p className="ds-body">
            <Bone ch={28} />
          </p>
        )}
      </div>
      {shape.timed && (
        <div className="w-full max-w-[360px] space-y-2">
          <ul className="flex h-14 w-full items-end" style={{ gap: 2 }}>
            {Array.from({ length: shape.count }, (_, i) => (
              <li key={i} className="flex h-full min-w-0 flex-1 items-end">
                <BoneBlock />
              </li>
            ))}
          </ul>
          {shape.longest && (
            <FillBlock
              ch={30}
              className="ds-small text-(--ds-fg-muted) [overflow-wrap:anywhere]"
            >
              {undefined}
            </FillBlock>
          )}
        </div>
      )}
      <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {shape.turnedIn ? (
          <Button notReady={still}>Take back</Button>
        ) : (
          <>
            {shape.next && (
              <Button variant="primary" notReady={still}>
                Continue with problem
              </Button>
            )}
            <Button
              variant={shape.next ? 'default' : 'primary'}
              notReady={still}
            >
              Turn in
            </Button>
          </>
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
