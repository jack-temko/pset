import { waits, type Loads, type Waits } from '@/design/loading';
import { SampleRow } from '@/design/sample/sample-row/row';

interface Item {
  title: string;
  detail: string;
}

/** A fixture view: a list of rows, or one item opened. Its quiet form is the
 *  heading alone: the heading is known from where the student is, and the
 *  rows' number is not, so it stops there (loading D2). */
export const SampleScreen = waits(
  { data: ['items'] } satisfies Loads<{ items: Item[] }>,
  function SampleScreen({
    items,
    open,
    loading,
  }: Waits<{ open?: boolean }, { items: Item[] }>) {
    const shown = loading === true ? [] : open ? items.slice(0, 1) : items;
    return (
      <div className="space-y-3">
        <h2 className="ds-heading">{open ? 'Item' : 'Items'}</h2>
        {shown.map((i) => (
          <SampleRow key={i.title} title={i.title} detail={i.detail} />
        ))}
      </div>
    );
  },
);
