import * as m from './model';

const start = () => m.openSet('ps4', { ref: 'griffiths', page: 112 });

const book = (ref: string, page: number): m.Spec => ({
  kind: 'material',
  ref,
  page,
});

/** The workspace's design-page states, each as the state it opens in. */
export const STATES = {
  opening: start,
  followed: () => m.follow(start(), 1, 'griffiths', 118),
  'two-materials': () => {
    const st = m.add(start(), 0, book('notes', 6));
    return m.select(st, st.sides[0][0].id);
  },
  folded: () => m.close(start(), start().sides[0][0].id),
  returned: () => {
    const first = start();
    const folded = m.add(m.close(first, first.sides[0][0].id), 1, {
      kind: 'ask',
      ref: '',
    });
    return m.move(folded, folded.sides[1][1].id, 0, undefined);
  },
  twice: () => m.add(start(), 1, book('griffiths', 45)),
  ask: () => m.askAbout(start(), 1, 'p2'),
  many: () => {
    let st = start();
    for (let i = 0; i < 9; i++)
      st = m.add(
        st,
        0,
        book(['griffiths', 'notes', 'lab'][i % 3], 10 + i * 17),
      );
    return st;
  },
  loading: start,
} satisfies Record<string, () => m.State>;
