import type { LucideIcon } from 'lucide-react';

import { Tooltip } from '@/units/tooltip';

/** A muted count for a list row's meta line, like GitHub's counts: a 12px
 *  glyph and a number, its words in a tooltip (list-row-d8). */
export function MetaStat({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: number;
  /** What it counts in words, for the tooltip: "3 sets". */
  label: string;
}) {
  return (
    <Tooltip text={label}>
      <span className="inline-flex items-center gap-1 align-middle">
        <Icon className="size-3 shrink-0" aria-hidden />
        {value}
      </span>
    </Tooltip>
  );
}
