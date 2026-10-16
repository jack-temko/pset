import type { LucideIcon } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';

import { Link } from '@/units/link';
import { Tooltip } from '@/units/tooltip';
import { isNarrowOnly, type NarrowOnly } from './meta';

/** The aside shows from this width of the row; narrower, it goes first. */
const ASIDE_MIN = '@min-[440px]';

/** One muted count right after the title, like GitHub's line diffs: a 12px
 *  glyph and a number, its label in a tooltip. */
export interface Stat {
  icon: LucideIcon;
  value: number;
  /** What it counts in words, for the tooltip: "7 materials". */
  label: string;
}

/** The one row shape: a title on line one, small meta on line two, the
 *  status and an optional aside at the right, each centred vertically in
 *  the row (list-row-d1, d5). Only the title is a link, so a meta link
 *  never sits inside another. */
export function ListRow({
  title,
  href,
  label,
  status,
  stats,
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
  /** Muted counts right after the title on line one, before the label, 8
   *  apart. They go below 440, before the label does. */
  stats?: readonly Stat[];
  /** Short items joined by " · ", truncating as a whole. */
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
            {stats !== undefined && stats.length > 0 && (
              <div
                data-stats
                className="ds-small ds-tabular hidden shrink-0 items-center gap-3 text-(--ds-fg-muted) @min-[440px]:flex"
              >
                {stats.map((s) => (
                  <Tooltip key={s.label} text={s.label}>
                    <span className="inline-flex items-center gap-1">
                      <s.icon className="size-3 shrink-0" aria-hidden />
                      {s.value}
                    </span>
                  </Tooltip>
                ))}
              </div>
            )}
            {label !== undefined && <div className="shrink-0">{label}</div>}
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
