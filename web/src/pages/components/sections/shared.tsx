import type { ReactNode } from 'react';

/** One labelled shelf of specimens. The label is mono so it never reads as
 *  part of the thing being shown. */
export function Shelf({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[10rem_minmax(0,1fr)] items-start gap-6">
      <div className="pt-2 font-mono text-xs text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
