import { Fragment, isValidElement, type ReactNode } from 'react';

import { Link } from '@/units/link';
import { MetaStat } from './stat';
import { isNarrowOnly, type NarrowOnly } from './meta';

/** The aside shows from this width of the row; narrower, it goes first. */
const ASIDE_MIN = '@min-[440px]';

const isStat = (x: unknown) => isValidElement(x) && x.type === MetaStat;

/** The one row shape: a title on line one, small meta on line two, the
 *  status and an optional aside at the right, each centred vertically in
 *  the row (list-row-d1, d5). Only the title is a link, so a meta link
 *  never sits inside another. */
export function ListRow({
  title,
  href,
  label,
  status,
  meta = [],
  aside,
  asideWidth = 120,
}: {
  title: string;
  /** Makes the title a link. */
  href?: string;
  /** A Tag right after the title on line one, like a GitHub label. The title
   *  truncates first. */
  label?: ReactNode;
  /** A Tag or a short muted text, at the right of the row, centred in it. */
  status?: ReactNode;
  /** Short items joined by " · ", truncating as a whole; a `MetaStat` is
   *  a muted icon and number. */
  meta?: readonly (ReactNode | NarrowOnly)[];
  /** At the right, spanning both lines, such as a progress bar. */
  aside?: ReactNode;
  /** The aside's width: a number is px, a string any CSS width, so asides
   *  align down a list. */
  asideWidth?: number | string;
}) {
  return (
    <div className="@container min-h-14 min-w-0">
      <div className="flex min-w-0 items-center gap-4 px-4 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-h-6 min-w-0 items-center gap-2">
            <div className="min-w-0">
              {href === undefined ? (
                <span className="ds-body block truncate font-medium text-(--ds-fg)">
                  {title}
                </span>
              ) : (
                <Link
                  href={href}
                  title={title}
                  tone="fg"
                  weight="medium"
                  className="block w-fit max-w-full truncate"
                >
                  {title}
                </Link>
              )}
            </div>
            {label !== undefined && <div className="shrink-0">{label}</div>}
          </div>
          <p className="ds-small ds-tabular min-h-5 truncate text-(--ds-fg-muted)">
            {meta.map((item, i) => {
              const narrow = isNarrowOnly(item);
              // A stat, and what follows one, is set apart by a gap, not a dot.
              const stat = isStat(item);
              const gap = i > 0 && (stat || isStat(meta[i - 1]));
              return (
                <span
                  key={i}
                  className={
                    [narrow ? `${ASIDE_MIN}:hidden` : '', gap ? 'ml-3' : '']
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                >
                  {i > 0 && !gap && <Fragment> · </Fragment>}
                  {narrow ? item.node : item}
                </span>
              );
            })}
          </p>
        </div>
        {status !== undefined && (
          <div className="ds-small ds-tabular flex h-6 shrink-0 items-center whitespace-nowrap text-(--ds-fg-muted)">
            {status}
          </div>
        )}
        {aside !== undefined && (
          <div
            data-aside
            style={{ width: asideWidth }}
            className={`hidden shrink-0 ${ASIDE_MIN}:block`}
          >
            {aside}
          </div>
        )}
      </div>
    </div>
  );
}
