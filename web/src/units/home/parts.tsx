import { ArrowDown, ArrowUp } from 'lucide-react';

import { Row } from './layouts';
import type { Change } from './stats';

function Bar({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-(--ds-radius-tag) bg-(--ds-border-muted) ${className}`}
    />
  );
}

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

/** A figure row while it loads, for Course until its own loading form
 *  (step 8 of the loading skeleton plan). */
export function RowSkeleton({ first }: { first?: boolean }) {
  return (
    <Row
      first={first}
      figure={
        <p className="ds-heading flex h-(--ds-heading-line) items-center">
          <Bar className="h-5 w-8" />
        </p>
      }
      label={
        <p className="ds-small flex h-(--ds-small-line) items-center">
          <Bar className="h-3 w-24" />
        </p>
      }
      caption={
        <p className="ds-small flex h-(--ds-small-line) items-center">
          <Bar className="h-3 w-32" />
        </p>
      }
      trailing={<Bar className="h-7 w-full" />}
    />
  );
}
