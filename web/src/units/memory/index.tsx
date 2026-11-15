import type { ComponentProps } from 'react';

import { waits, type Loads, type Waits } from '@/design/loading';
import { Area, Waiting, type MemoryShape } from './area';
import { SIDES } from './sides';
import type { Memory } from './sample';

export type { MemoryShape };

type Props = ComponentProps<typeof Area>;

/** The side the area opens on, by the rule it uses loaded: the one asked
 *  for, else New while Ask saved something, else Yours. */
function memoryShape(d: {
  memories: readonly Memory[];
  side?: Props['side'];
}): MemoryShape {
  const sideOf = (m: Memory) => (m.fresh === true ? 'new' : m.source);
  const count = (id: string) =>
    d.memories.filter((m) => sideOf(m) === id).length;
  const sides = SIDES.map((s) => s.id).filter(
    (id) => id !== 'new' || count('new') > 0,
  );
  const picked = d.side ?? (count('new') > 0 ? 'new' : 'you');
  const side = sides.includes(picked) ? picked : 'you';
  return { total: d.memories.length, sides, side, rows: count(side) };
}

const memoryLoads = {
  data: ['memories'],
  shapeOf: memoryShape,
} satisfies Loads<
  { memories: readonly Memory[]; side?: Props['side'] },
  MemoryShape
>;

/** The memory area (memory-d1, memory-d6): the add field, then one list with
 *  New, Yours and From Ask as its header switch, five rows and "Show all N" to
 *  the list page (the list pattern). Loading, the heading, the add field and
 *  the switch are real and the rows are bar lines that grow (memory-d10). */
export const MemoryArea = waits(
  memoryLoads,
  function MemoryArea(
    props: Waits<
      Omit<Props, 'memories'>,
      { memories: readonly Memory[] },
      MemoryShape
    >,
  ) {
    if (props.loading === undefined) return <Area {...props} />;
    return (
      <Waiting
        shape={props.loading === 'unknown' ? undefined : props.loading}
        showAllHref={props.showAllHref}
      />
    );
  },
);
