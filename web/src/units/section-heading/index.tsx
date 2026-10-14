import type { ReactNode } from 'react';

import { Counter } from '@/units/counter';

/** Titles a list or a group on a screen, as the old Home's SectionHeader
 *  did: the serif title, a Counter right after it, one quiet action at the
 *  right, no rule. It carries no outer margin: the parent applies
 *  `room-for-big-type` (section-heading-d1, d2). */
export function SectionHeading({
  children,
  count,
  action,
}: {
  children: ReactNode;
  /** How many things follow, such as 8, shown as a Counter. */
  count?: ReactNode;
  /** A text link, such as "Show all". */
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-8 min-w-0 items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="ds-heading min-w-0 text-(--ds-fg) [overflow-wrap:anywhere]">
          {children}
        </h2>
        {count !== undefined && (
          <span className="flex h-7 items-center">
            <Counter>{count}</Counter>
          </span>
        )}
      </div>
      {action !== undefined && (
        <div className="ds-small flex h-7 shrink-0 items-center whitespace-nowrap">
          {action}
        </div>
      )}
    </div>
  );
}
