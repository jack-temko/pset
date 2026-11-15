import type { ComponentProps } from 'react';

import { waits, type Loads, type Waits } from '@/design/loading';
import { Pane, Waiting } from './pane';
import type { Turn } from './types';

export type { Question, Turn } from './types';

/** What sizes the Ask pane while it loads: whether the last visit had turns.
 *  The pane fills its frame and the conversation is anchored to its foot, so
 *  the turns' own heights move nothing outside it. */
export interface AskShape {
  turns: number;
}

const askLoads = {
  data: ['turns'],
  shapeOf: (d: { turns: readonly Turn[] }): AskShape => ({
    turns: d.turns.length,
  }),
} satisfies Loads<{ turns: readonly Turn[] }, AskShape>;

/** The Ask pane: one running conversation about a course, and the box that
 *  adds to it. Loading, the composer is real and not ready, and the
 *  conversation is bars at its foot (ask-d29). */
export const Ask = waits(
  askLoads,
  function Ask(
    props: Waits<
      Omit<ComponentProps<typeof Pane>, 'turns'>,
      { turns: readonly Turn[] },
      AskShape
    >,
  ) {
    if (props.loading === undefined) return <Pane {...props} />;
    return (
      <Waiting
        turns={props.loading === 'unknown' ? undefined : props.loading.turns}
        about={props.about}
        startImage={props.startImage}
      />
    );
  },
);
