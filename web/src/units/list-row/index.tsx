import { Fragment, type ReactNode } from 'react';

import { Link } from '@/units/link';

/** The one row shape: a title on line one, small meta on line two, the
 *  status and an optional aside at the right, each centred vertically in
 *  the row (list-row-d1, d5). Only the title is a link, so a meta link
 *  never sits inside another. */
export function ListRow({
  title,
  titleField,
  href,
  label,
  status,
  meta = [],
  aside,
  asideWidth = 120,
  wrap,
}: {
  title: string;
  /** Takes the title's place while it is being edited, so the row keeps its height. */
  titleField?: ReactNode;
  /** Makes the title a link. */
  href?: string;
  /** A Tag right after the title on line one, like a GitHub label. The title
   *  truncates first. */
  label?: ReactNode;
  /** A Tag or a short muted text, at the right of the row, centred in it. */
  status?: ReactNode;
  /** Short items joined by " · ", truncating as a whole. */
  meta?: readonly ReactNode[];
  /** At the right, spanning both lines, such as a progress bar. */
  aside?: ReactNode;
  /** The aside's width: a number is px, a string any CSS width, so asides
   *  align down a list. */
  asideWidth?: number | string;
  /** Wraps the title onto as many lines as it needs, not one. */
  wrap?: boolean;
}) {
  return (
    <div className={`min-w-0 ${meta.length > 0 ? 'min-h-14' : ''}`}>
      <div className="flex min-w-0 items-center gap-4 px-4 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-h-6 min-w-0 items-center gap-2">
            <div className={`min-w-0 ${wrap ? 'flex-1' : ''}`}>
              {titleField !== undefined ? (
                titleField
              ) : href === undefined ? (
                <span
                  title={title}
                  className={`ds-body block font-medium text-(--ds-fg) ${wrap ? 'whitespace-pre-wrap [overflow-wrap:anywhere]' : 'truncate'}`}
                >
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
          {meta.length > 0 && (
            <p className="ds-small ds-tabular min-h-5 truncate text-(--ds-fg-muted)">
              {meta.map((item, i) => (
                <span key={i}>
                  {i > 0 && <Fragment> · </Fragment>}
                  {item}
                </span>
              ))}
            </p>
          )}
        </div>
        {status !== undefined && (
          <div className="ds-small ds-tabular flex h-6 shrink-0 items-center whitespace-nowrap text-(--ds-fg-muted)">
            {status}
          </div>
        )}
        {aside !== undefined && (
          <div data-aside style={{ width: asideWidth }} className="shrink-0">
            {aside}
          </div>
        )}
      </div>
    </div>
  );
}
