import { Fragment, type ReactNode } from 'react';

import { Link } from '@/units/link';
import { isNarrowOnly, type NarrowOnly } from './meta';

/** The aside shows from this width of the row; narrower, it goes first. */
const ASIDE_MIN = '@min-[440px]';

/** The one row shape: a title and a status on line one, small meta on line
 *  two, an optional aside at the right (list-row-d1). Only the title is a
 *  link, so a meta link never sits inside another. */
export function ListRow({
  title,
  href,
  status,
  meta = [],
  aside,
  asideWidth = 120,
}: {
  title: string;
  /** Makes the title a link. */
  href?: string;
  /** A Tag or a short muted text, at the far right of line one. */
  status?: ReactNode;
  /** Short items joined by " · ", truncating as a whole. */
  meta?: readonly (ReactNode | NarrowOnly)[];
  /** At the right, spanning both lines, such as a progress bar. */
  aside?: ReactNode;
  /** The aside's width in px, so asides align down a list. */
  asideWidth?: number;
}) {
  return (
    <div className="@container min-h-14 min-w-0 hover:bg-(--ds-hover)">
      <div className="flex min-w-0 items-center gap-4 px-4 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-h-6 min-w-0 items-center gap-3">
            <div className="min-w-0 flex-1">
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
                  className="block truncate"
                >
                  {title}
                </Link>
              )}
            </div>
            {status !== undefined && (
              <div className="ds-small ds-tabular flex h-6 shrink-0 items-center whitespace-nowrap text-(--ds-fg-muted)">
                {status}
              </div>
            )}
          </div>
          {meta.length > 0 && (
            <p className="ds-small ds-tabular truncate text-(--ds-fg-muted)">
              {meta.map((item, i) => {
                const narrow = isNarrowOnly(item);
                return (
                  <span
                    key={i}
                    className={narrow ? `${ASIDE_MIN}:hidden` : undefined}
                  >
                    {i > 0 && <Fragment> · </Fragment>}
                    {narrow ? item.node : item}
                  </span>
                );
              })}
            </p>
          )}
        </div>
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
