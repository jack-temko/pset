import { ListRow } from '@/units/list-row';
import { ProgressBar } from '@/units/progress-bar';
import { dueBadge } from './badge';
import { dueText, timeLeft } from './dates';

const ASIDE = 120;

export interface SetLineProps {
  /** The set's name. */
  set: string;
  done: number;
  total: number;
  /** Shown only when PSet knows it. */
  minutesLeft?: number;
  /** A local calendar date: build it with `parseDueDate('2026-10-19')`. */
  due?: Date;
  /** Where the title goes: the set in the workspace. */
  href: string;
  /** The day "within 2 days" counts from (the design page and tests). */
  today?: Date;
}

/** The due date of a set, always plain: "Due Thu", "Due Oct 23", and nothing
 *  without a date (set-line-d7). */
export function DueStatus({
  due,
  today = new Date(),
}: {
  due?: Date;
  today?: Date;
}) {
  if (due === undefined) return null;
  return <>{dueText(due, today).text}</>;
}

/** The meta of a set: the time left when PSet knows it. */
function setMeta({ minutesLeft }: Pick<SetLineProps, 'minutesLeft'>) {
  const time = minutesLeft === undefined ? '' : timeLeft(minutesLeft);
  return time ? [time] : [];
}

/** One active set as a list row, for the window pane: opens the set in the
 *  workspace (set-line-d3). It has no course name. */
export function SetLine({
  set,
  done,
  total,
  minutesLeft,
  due,
  href,
  today,
}: SetLineProps) {
  return (
    <ListRow
      title={set}
      href={href}
      label={dueBadge(due, today)}
      status={<DueStatus due={due} today={today} />}
      meta={setMeta({ minutesLeft })}
      aside={<ProgressBar done={done} total={total} />}
      asideWidth={ASIDE}
    />
  );
}
