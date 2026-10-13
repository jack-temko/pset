import { SampleRow, SampleRowSkeleton } from '@/design/sample/sample-row/row';

/** A fixture view: a list of rows, or one item opened. */
export function SampleScreen({
  items,
  open,
}: {
  items: { title: string; detail: string }[];
  open?: boolean;
}) {
  return (
    <div className="space-y-3">
      <h2 className="ds-heading">{open ? 'Item' : 'Items'}</h2>
      {(open ? items.slice(0, 1) : items).map((i) => (
        <SampleRow key={i.title} title={i.title} detail={i.detail} />
      ))}
    </div>
  );
}

export function SampleScreenSkeleton() {
  return (
    <div className="space-y-3">
      <h2 className="ds-heading">Items</h2>
      <SampleRowSkeleton />
      <SampleRowSkeleton />
    </div>
  );
}
