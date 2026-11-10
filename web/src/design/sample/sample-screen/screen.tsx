import { waits, type Loads, type Waits } from '@/design/loading';
import { SampleRow } from '@/design/sample/sample-row/row';

interface Item {
  title: string;
  detail: string;
}

/** What sizes the screen while it loads: how many rows. */
export interface ScreenShape {
  count: number;
}

/** A fixture view: a list of rows, or one item opened. Loading, the heading
 *  is drawn real and each row draws its own loading form, at the count the
 *  shape gives; nothing here measures a height. */
export const SampleScreen = waits(
  {
    data: ['items'],
    shapeOf: (d): ScreenShape => ({ count: d.items.length }),
  } satisfies Loads<{ items: Item[] }, ScreenShape>,
  function SampleScreen({
    items,
    open,
    loading,
  }: Waits<{ open?: boolean }, { items: Item[] }, ScreenShape>) {
    const count =
      loading === undefined
        ? undefined
        : loading === 'unknown'
          ? 0
          : open
            ? Math.min(1, loading.count)
            : loading.count;
    return (
      <div className="space-y-3">
        <h2 className="ds-heading">{open ? 'Item' : 'Items'}</h2>
        {count === undefined
          ? (open ? (items ?? []).slice(0, 1) : (items ?? [])).map((i) => (
              <SampleRow key={i.title} title={i.title} detail={i.detail} />
            ))
          : Array.from({ length: count }, (_, i) => (
              <SampleRow key={i} loading={{}} />
            ))}
      </div>
    );
  },
);
