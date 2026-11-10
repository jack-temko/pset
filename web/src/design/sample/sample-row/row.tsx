import { CircleAlert, MoreHorizontal } from 'lucide-react';

import { waits, type Loads, type Waits } from '@/design/loading';
import { Fill } from '@/units/bone';
import { RHYTHM } from '@/units/bone/rhythm';

/** What sizes the row while it loads: nothing, it is always two lines. */
export type RowShape = Record<string, never>;

interface RowData {
  title: string;
  detail: string;
}

/** A fixture for the design page, not a product component: a list row with
 *  a title, a second line and a menu. The reference for the loading
 *  contract: one component, one layout; loading, the two lines are bones and
 *  the button is drawn real. */
export const SampleRow = waits(
  {
    data: ['title', 'detail'],
    shapeOf: (): RowShape => ({}),
  } satisfies Loads<RowData, RowShape>,
  function SampleRow({
    title,
    detail,
    menuOpen,
    failed,
    loading,
  }: Waits<{ menuOpen?: boolean; failed?: boolean }, RowData, RowShape>) {
    const on = loading !== undefined;
    return (
      <div className="rounded-(--ds-radius-panel) border border-(--ds-border-muted) bg-(--ds-bg-raised)">
        <div className="flex min-h-(--ds-row) items-center gap-3 px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="ds-body truncate font-medium">
              <Fill ch={RHYTHM.title}>{title}</Fill>
            </p>
            <p
              className={
                failed && !on
                  ? 'ds-small flex items-center gap-1 text-(--ds-danger)'
                  : 'ds-small truncate text-(--ds-fg-muted)'
              }
            >
              {failed && !on && (
                <CircleAlert className="size-4 shrink-0" aria-hidden />
              )}
              <span className="truncate">
                <Fill ch={RHYTHM.meta}>{detail}</Fill>
              </span>
            </p>
          </div>
          <button
            type="button"
            aria-label="More"
            className="flex size-(--ds-control) shrink-0 items-center justify-center rounded-(--ds-radius-control) text-(--ds-fg-muted) hover:bg-(--ds-border-muted)"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>
        {menuOpen && !on && (
          <ul className="ds-body border-t border-(--ds-border-muted) px-4 py-1">
            <li className="py-1">Open</li>
            <li className="py-1 text-(--ds-danger)">Delete</li>
          </ul>
        )}
      </div>
    );
  },
);
