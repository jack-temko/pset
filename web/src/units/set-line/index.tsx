import { Clock, TriangleAlert } from 'lucide-react';

import { ListRow, narrowOnly } from '@/units/list-row';
import { ProgressBar } from '@/units/progress-bar';
import { Tag } from '@/units/tag';
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

/** The due date of a set: an attention tag within 2 days, a red "Overdue"
 *  when past, otherwise plain text, and nothing without a date. */
export function DueStatus({
  due,
  today = new Date(),
}: {
  due?: Date;
  today?: Date;
}) {
  if (due === undefined) return null;
  const when = dueText(due, today);
  if (when.kind === 'overdue')
    return (
      <Tag tone="danger" icon={TriangleAlert}>
        {when.text}
      </Tag>
    );
  if (when.kind === 'soon')
    return (
      <Tag tone="attention" icon={Clock}>
        {when.text}
      </Tag>
    );
  return <>{when.text}</>;
}

/** The meta of a set: the time left when PSet knows it, and the count where
 *  the progress bar is not drawn. */
export function setMeta({
  done,
  total,
  minutesLeft,
}: Pick<SetLineProps, 'done' | 'total' | 'minutesLeft'>) {
  const time = minutesLeft === undefined ? '' : timeLeft(minutesLeft);
  return [
    narrowOnly(`${String(done)} of ${String(total)}`),
    ...(time ? [time] : []),
  ];
}

/** One active set as a list row, for the window pane: opens the set in the
 *  workspace (set-line-d3). It has no course name. At pane widths the bar goes
 *  first and the count stays in the meta (set-line-d6). */
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
      status={<DueStatus due={due} today={today} />}
      meta={setMeta({ done, total, minutesLeft })}
      aside={<ProgressBar done={done} total={total} />}
      asideWidth={ASIDE}
    />
  );
}
