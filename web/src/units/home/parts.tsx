import { ArrowDown, ArrowUp } from 'lucide-react';

import type { Change } from './stats';

/** A change as a glyph and its words, muted: being behind is not a warning. */
export function ChangeText({ change }: { change: Change }) {
  return (
    <span className="inline-flex items-center gap-[2px] text-(--ds-fg-muted)">
      {change.direction === 'up' ? (
        <ArrowUp size={14} aria-hidden />
      ) : (
        <ArrowDown size={14} aria-hidden />
      )}
      {change.text}
    </span>
  );
}

/** A muted line that truncates. */
export const small = 'ds-small truncate text-(--ds-fg-muted)';

/** The muted line under a row's label: last week and how it moved. */
export function Moved({ text, change }: { text: string; change?: Change }) {
  return (
    <p className="ds-small ds-tabular flex items-center gap-x-2 whitespace-nowrap text-(--ds-fg-muted)">
      <span className="truncate">{text}</span>
      {change && <ChangeText change={change} />}
    </p>
  );
}
