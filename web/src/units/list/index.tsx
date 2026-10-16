import { Children, type ReactNode } from 'react';

import { Counter } from '@/units/counter';

/** The old Box, in `ds` tokens: a bordered box of rows, with an optional
 *  header band. The list draws the rules between its rows, so a row draws
 *  none (list-d1). */
export function List({
  title,
  count,
  action,
  empty = 'Nothing here yet',
  children,
}: {
  /** The header's title; without it there is no header. */
  title?: string;
  /** A Counter after the header's title, such as 8. */
  count?: ReactNode;
  /** A Text link at the right of the header, such as "Show all". */
  action?: ReactNode;
  /** The one line shown when there are no rows. */
  empty?: string;
  children?: ReactNode;
}) {
  const rows = Children.toArray(children);
  return (
    <div className="min-w-0 overflow-hidden rounded-(--ds-radius-control) border border-(--ds-border) bg-(--ds-bg)">
      {title !== undefined && (
        <div className="flex min-h-10 min-w-0 items-center justify-between gap-3 border-b border-(--ds-border) bg-(--ds-bg-raised) px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="ds-body min-w-0 truncate font-medium text-(--ds-fg)">
              {title}
            </h2>
            {count !== undefined && <Counter>{count}</Counter>}
          </div>
          {action !== undefined && (
            <div className="ds-small shrink-0 whitespace-nowrap">{action}</div>
          )}
        </div>
      )}
      {rows.length === 0 ? (
        <p className="ds-small px-4 py-4 text-(--ds-fg-muted)">{empty}</p>
      ) : (
        <div className="divide-y divide-(--ds-border-muted)">{rows}</div>
      )}
    </div>
  );
}
