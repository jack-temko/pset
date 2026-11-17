import { Arrives } from '@/design/arrives';
import { waits, type Loads, type Waits } from '@/design/loading';
import { Material as Loaded, Quiet, type MaterialProps } from './pane';
import type { Book } from './types';

export type { MaterialProps } from './pane';

/** The material pane: one continuous scroll of a book under a thin line
 *  (M1, M2). Its quiet form is the line and the page area, empty: nothing in
 *  either is known before the book (loading D2). */
export const Material = waits(
  { data: ['book'] } satisfies Loads<{ book: Book }>,
  function Material(props: Waits<Omit<MaterialProps, 'book'>, { book: Book }>) {
    return (
      <Arrives
        screen="material"
        ready={props.loading !== true}
        className="h-full"
      >
        {props.loading === true ? <Quiet /> : <Loaded {...props} />}
      </Arrives>
    );
  },
);
