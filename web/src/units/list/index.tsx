import { Children, type ReactNode } from 'react';

import { UNKNOWN, type Unknown } from '@/design/loading';
import { Bone, Fill } from '@/units/bone';
import { Counter } from '@/units/counter';
import { Link } from '@/units/link';

/** The most rows a list shows on a summary screen (list-d3). */
export const LIST_CAP = 5;

export interface ListState {
  id: string;
  /** "To do", "Done", "Yours". */
  label: string;
  /** How many rows that side holds; always in view. */
  count: number;
}

/** What sizes a list while it loads: how many rows the chosen side holds. */
export interface ListShape {
  count: number;
}

/** The states as a switch in the header, as GitHub Issues' Open and Closed:
 *  text and a count each, the chosen one in full ink. */
function StateSwitch({
  states,
  state,
  onState,
  loading,
}: {
  states: readonly ListState[];
  state: string | undefined;
  onState: (id: string) => void;
  loading: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Show"
      className="flex min-w-0 items-center gap-4"
    >
      {states.map((s) => {
        const on = s.id === state;
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              onState(s.id);
            }}
            className={`ds-body ds-tabular flex h-8 items-center gap-2 whitespace-nowrap ${on ? 'font-medium text-(--ds-fg)' : 'text-(--ds-fg-muted) hover:text-(--ds-fg)'}`}
          >
            {s.label}
            {loading ? <Counter loading /> : <Counter>{s.count}</Counter>}
          </button>
        );
      })}
    </div>
  );
}

/** What heads the box: a title with a Counter, or the states as a switch
 *  (a title and a count are not drawn beside a switch: the screen's heading
 *  above the list names it). */
type Header =
  | {
      title?: string;
      count?: ReactNode;
      states?: undefined;
    }
  | {
      /** The list's states as a switch: two or more, each with its count. A
       *  list with one state has none (list-d4). */
      states: readonly ListState[];
      title?: undefined;
      count?: undefined;
    };

/** A cap and where "Show all" goes come together: a capped list always knows
 *  its list page. */
type Cap =
  | { cap?: undefined; showAllHref?: undefined }
  | {
      /** Rows shown before "Show all"; the rest wait on the list page. */
      cap: number;
      /** Where "Show all" goes: the list page, filtered to this list. */
      showAllHref: string;
    };

type ListProps = Header &
  Cap & {
    /** A Text link at the right of the header, for a list that is never capped. */
    action?: ReactNode;
    /** The chosen state's id. */
    state?: string;
    onState?: (id: string) => void;
    /** The one quiet line shown when there are no rows; it may hold one action. */
    empty?: ReactNode;
    children?: ReactNode;
    /** Draws the list's loading form at its shape: the frame, header and
     *  rules real, `row(i)` for each row, cut by the same cap (list-d6).
     *  With nothing known the list stays quiet (skeleton-grill S2). */
    loading?: ListShape | Unknown;
    /** One row's loading form, by its place in the list. */
    row?: (i: number) => ReactNode;
  };

/** The old Box, in `ds` tokens: a bordered box of rows, with an optional
 *  header band. The list draws the rules between its rows, so a row draws
 *  none (list-d1). A list with states shows them as a switch in the header
 *  (list-d4); one with a cap shows that many rows and a "Show all N" row at
 *  the foot (list-d3). */
export function List({
  title,
  count,
  action,
  states,
  state,
  onState,
  cap,
  showAllHref,
  empty = 'Nothing here yet',
  children,
  loading,
  row,
}: ListProps) {
  if (loading === UNKNOWN) return null;
  const on = loading !== undefined;
  const all = on
    ? Array.from({ length: loading.count }, (_, i) => row?.(i))
    : Children.toArray(children);
  const rows = cap === undefined ? all : all.slice(0, cap);
  const switched = states !== undefined && states.length > 1;
  const header = title !== undefined || switched;
  return (
    <div className="min-w-0 overflow-hidden rounded-(--ds-radius-control) border border-(--ds-border) bg-(--ds-bg)">
      {header && (
        <div className="flex min-h-10 min-w-0 items-center justify-between gap-3 border-b border-(--ds-border) bg-(--ds-bg-raised) px-4 py-1">
          {switched ? (
            <StateSwitch
              states={states}
              state={state}
              onState={(id) => {
                onState?.(id);
              }}
              loading={on}
            />
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="ds-body min-w-0 truncate font-medium text-(--ds-fg)">
                {title}
              </h2>
              {count !== undefined &&
                (on ? <Counter loading /> : <Counter>{count}</Counter>)}
            </div>
          )}
          {action !== undefined && (
            <div className="ds-small shrink-0 whitespace-nowrap">{action}</div>
          )}
        </div>
      )}
      {rows.length === 0 ? (
        <div className="ds-small flex min-h-14 flex-wrap items-center justify-center gap-x-3 px-4 py-2 text-center text-(--ds-fg-muted)">
          {/* The empty line is not said until it is true. */}
          {on ? <Bone ch={18} /> : empty}
        </div>
      ) : (
        <div className="divide-y divide-(--ds-border-muted)">{rows}</div>
      )}
      {rows.length < all.length && showAllHref !== undefined && (
        <div className="flex min-h-10 items-center justify-center border-t border-(--ds-border-muted) px-4">
          <Link href={showAllHref} size="small">
            Show all{' '}
            {/* As wide loading as loaded: a bar of the number's digits, in
                tabular figures, so "Show all" does not shift (list-d7). */}
            <span className="ds-tabular">
              <Fill ch={String(all.length).length}>
                {on ? undefined : all.length}
              </Fill>
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
