import type { ReactNode } from 'react';

/** Titles a list or a group on a screen. It carries no outer margin: the
 *  parent applies `room-for-big-type` (section-heading-d1). */
export function SectionHeading({
  children,
  count,
  action,
}: {
  children: ReactNode;
  /** How many things follow, such as 3 or "3 sets". */
  count?: ReactNode;
  /** A text link, such as "Show all". */
  action?: ReactNode;
}) {
  const hasSide = count !== undefined || action !== undefined;
  return (
    <div className="flex min-w-0 items-start justify-between gap-4 border-b border-(--ds-fg) pb-2">
      <h2 className="ds-heading min-w-0 text-(--ds-fg) [overflow-wrap:anywhere]">
        {children}
      </h2>
      {hasSide && (
        <div className="ds-small ds-tabular flex h-7 shrink-0 items-center gap-4 whitespace-nowrap text-(--ds-fg-muted)">
          {count !== undefined && <span>{count}</span>}
          {action}
        </div>
      )}
    </div>
  );
}
