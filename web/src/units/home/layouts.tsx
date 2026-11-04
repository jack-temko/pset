import type { ReactNode } from 'react';

/** The info area: one outlined box, no fill, with the heatmap on the left
 *  and this week on the right, split by a hairline. The box has 20px on every side; the two columns are as
 *  tall as each other, the right one's bars taking up the difference. */
export function Beside({
  heatmap,
  week,
}: {
  heatmap: ReactNode;
  week: ReactNode;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_340px] rounded-(--ds-radius-control) border border-(--ds-border) p-5">
      <div className="flex min-w-0 flex-col pr-5">{heatmap}</div>
      <div className="flex min-w-0 flex-col gap-2 border-l border-(--ds-border-muted) pl-5">
        {week}
      </div>
    </div>
  );
}

/** The line over this week's bars: the same height as the heatmap's heading. */
export function Caption({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-(--ds-body-line) flex-wrap items-center justify-between gap-x-3">
      {children}
    </div>
  );
}

/** The figure rows under the bars share one grid: the first column is as wide
 *  as the widest figure, so every label starts at the same x. */
export function Rows({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[auto_minmax(max-content,1fr)_minmax(40px,6rem)] gap-x-3 gap-y-2">
      {children}
    </div>
  );
}

/** One figure under the bars, in a single compact row: the figure, what it
 *  counts and how it moved over two small lines, and a sparkline.
 *  A hairline sits above every row but the first. */
export function Row({
  first,
  figure,
  label,
  caption,
  trailing,
}: {
  first?: boolean;
  figure: ReactNode;
  label: ReactNode;
  caption: ReactNode;
  trailing: ReactNode;
}) {
  return (
    <div
      className={`col-span-3 grid grid-cols-subgrid items-center ${first ? '' : 'border-t border-(--ds-border-muted) pt-2'}`}
    >
      <div className="min-w-8">{figure}</div>
      <div>
        {label}
        {caption}
      </div>
      <div>{trailing}</div>
    </div>
  );
}
