import { waits, type Loads, type Waits } from '@/design/loading';
import { Pane, Waiting, type MaterialProps } from './pane';
import type { Book } from './types';

export type { MaterialProps };

/** What sizes the material pane while its book loads: the pages' shape. The
 *  pane fills its frame, so the book's length moves nothing outside it. */
export interface MaterialShape {
  aspect: number;
  /** A book still being read in, or one that could not be read, waits as a
   *  quiet pane: its loaded form has no top line to draw. */
  ready: boolean;
}

const materialLoads = {
  data: ['book'],
  shapeOf: (d: { book: Book; status?: MaterialProps['status'] }) => ({
    aspect: d.book.aspect,
    ready: (d.status ?? 'ready') === 'ready',
  }),
} satisfies Loads<
  { book: Book; status?: MaterialProps['status'] },
  MaterialShape
>;

/** The inside of the material pane: one continuous scroll of a book fitted to
 *  the side, under a thin line (M1, M2). Loading, the top line is real and a
 *  still page-shaped frame waits at the book's shape (material-d21). */
export const Material = waits(
  materialLoads,
  function Material(
    props: Waits<Omit<MaterialProps, 'book'>, { book: Book }, MaterialShape>,
  ) {
    if (props.loading === undefined) return <Pane {...props} />;
    return (
      <Waiting
        aspect={props.loading === 'unknown' ? undefined : props.loading.aspect}
        ready={props.loading === 'unknown' || props.loading.ready}
        boxing={props.boxing}
        onCancel={props.onCancel}
      />
    );
  },
);
