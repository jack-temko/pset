import { Fragment, type ReactNode } from 'react';

import { Bone, Fill, FillBlock } from '@/units/bone';
import { RHYTHM } from '@/units/bone/rhythm';
import { Button } from '@/units/button';
import { Link } from '@/units/link';

/** A row while it loads: its place in the list, which picks the bars'
 *  widths, and whether it has a second line (list-row-d13). */
export interface RowLoading {
  row: number;
  lines: 1 | 2;
}

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
  statusWidth,
  rowLink,
  wrap,
  loading,
}: (
  | { title: string; loading?: undefined }
  | {
      title?: string;
      /** Draws the row's loading form: the title and meta as bars, the
       *  status and aside as the caller passes them, the frame real. */
      loading: RowLoading;
    }
) & {
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
  /** The status's width, so tags of different lengths start on one line down
   *  a list; without it the status takes its own width. */
  statusWidth?: number | string;
  /** The whole row opens `href`: a hover ground across it and the title
   *  underlined (list-row-d11). Only for a row with one destination; its
   *  buttons and other links stay their own targets. */
  rowLink?: boolean;
  /** Wraps the title onto as many lines as it needs, not one. */
  wrap?: boolean;
}) {
  const whole =
    loading === undefined &&
    rowLink === true &&
    href !== undefined &&
    titleField === undefined;
  const two = loading === undefined ? meta.length > 0 : loading.lines === 2;
  return (
    <div
      className={`min-w-0 ${two ? 'min-h-14' : ''} ${whole ? 'group/row relative hover:bg-(--ds-hover) [&_a:not([data-row-link])]:relative [&_a:not([data-row-link])]:z-[1] [&_button]:relative [&_button]:z-[1]' : ''}`}
    >
      <div className="flex min-w-0 items-center gap-4 px-4 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-h-6 min-w-0 items-center gap-2">
            <div className={`min-w-0 ${wrap ? 'flex-1' : ''}`}>
              {loading !== undefined && wrap === true ? (
                // A title that wraps loads as one bar line and grows when it
                // comes (bone-d4, list-row-d14).
                <FillBlock
                  as="span"
                  ch={RHYTHM.title}
                  row={loading.row}
                  className="ds-body block min-h-6 font-medium"
                >
                  {title}
                </FillBlock>
              ) : loading !== undefined ? (
                <span className="ds-body block truncate font-medium">
                  <Fill ch={RHYTHM.title} row={loading.row}>
                    {title}
                  </Fill>
                </span>
              ) : titleField !== undefined ? (
                titleField
              ) : href === undefined && wrap === true ? (
                <FillBlock
                  as="span"
                  ch={RHYTHM.title}
                  className="ds-body block min-h-6 font-medium whitespace-pre-wrap text-(--ds-fg) [overflow-wrap:anywhere]"
                >
                  {title}
                </FillBlock>
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
                  data-row-link={whole || undefined}
                  className={`block w-fit max-w-full truncate ${whole ? "group-hover/row:underline after:absolute after:inset-0 after:content-['']" : ''}`}
                >
                  {title}
                </Link>
              )}
            </div>
            {/* A label hangs off the title's width: not drawn until it is. */}
            {label !== undefined && loading === undefined && (
              <div className="shrink-0">{label}</div>
            )}
          </div>
          {two && loading !== undefined && (
            <p className="ds-small min-h-5 truncate">
              <Bone ch={RHYTHM.meta} row={loading.row} />
            </p>
          )}
          {two && loading === undefined && (
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
          <div
            style={{ width: statusWidth }}
            className="ds-small ds-tabular flex h-6 shrink-0 items-center whitespace-nowrap text-(--ds-fg-muted)"
          >
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

/** A removed row, kept in its place as one line ("Forgot ... · Undo") until
 *  the next action or 10 seconds (list-row-d12): the one shape of Undo in a
 *  list. */
export function UndoRow({
  text,
  onUndo,
}: {
  text: string;
  onUndo: () => void;
}) {
  return (
    <div className="ds-small flex min-h-10 items-center gap-2 px-4 text-(--ds-fg-muted)">
      <span className="min-w-0 truncate">{text}</span>
      <span aria-hidden>·</span>
      <Button variant="quiet" onPress={onUndo}>
        Undo
      </Button>
    </div>
  );
}

/** How long an Undo row waits before the removal is final. */
export const UNDO_ROW_MS = 10_000;
