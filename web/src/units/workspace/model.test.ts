import { describe, expect, it } from 'vitest';

import {
  add,
  askAbout,
  close,
  closeOthers,
  decode,
  encode,
  find,
  foldedSide,
  follow,
  move,
  openSet,
  openTab,
  select,
  showing,
  splitOpen,
  swap,
  type State,
} from './model';

const start = () => openSet('ps4', { ref: 'griffiths', page: 112 });
const refs = (st: State, side: 0 | 1) =>
  st.sides[side].map((t) =>
    t.kind === 'material' ? `${t.ref}@${String(t.page)}` : t.ref || t.kind,
  );

describe('opening a set', () => {
  it('puts the material left at the problem page and the set right', () => {
    const st = start();
    expect(refs(st, 0)).toEqual(['griffiths@112']);
    expect(refs(st, 1)).toEqual(['ps4']);
    expect(openTab(st, 0)?.ref).toBe('griffiths');
    expect(openTab(st, 1)?.ref).toBe('ps4');
  });
});

describe('closing', () => {
  it('folds a side whose last tab closes', () => {
    const st = start();
    const left = st.sides[0][0].id;
    const after = close(st, left);
    expect(foldedSide(after)).toBe(0);
    expect(after.open[0]).toBeNull();
  });

  it('opens the most recently used remaining tab when the open one closes', () => {
    let st = start();
    st = add(st, 0, { kind: 'material', ref: 'notes', page: 1 });
    st = add(st, 0, { kind: 'material', ref: 'extra', page: 1 });
    const [a, b, c] = st.sides[0];
    // Used in the order a, c, b: b is open, c was used before it.
    st = select(select(st, a.id), c.id);
    st = select(st, b.id);
    expect(close(st, b.id).open[0]).toBe(c.id);
    expect(close(close(st, b.id), c.id).open[0]).toBe(a.id);
    // Closing a tab that is not open leaves the open one.
    expect(close(st, a.id).open[0]).toBe(b.id);
  });

  it('closes the others', () => {
    let st = start();
    st = add(st, 1, { kind: 'ask', ref: '' });
    const set = st.sides[1][0];
    const after = closeOthers(st, set.id);
    expect(after.sides[1]).toEqual([set]);
    expect(after.open[1]).toBe(set.id);
    expect(after.sides[0]).toHaveLength(1);
  });
});

describe('moving', () => {
  it('moves a tab across, opens it there and folds the side it left', () => {
    const st = start();
    const book = st.sides[0][0];
    const after = move(st, book.id, 1, undefined);
    expect(foldedSide(after)).toBe(0);
    expect(refs(after, 1)).toEqual(['ps4', 'griffiths@112']);
    expect(after.open[1]).toBe(book.id);
  });

  it('reorders within a side and brings a folded side back', () => {
    let st = start();
    st = add(st, 1, { kind: 'ask', ref: '' });
    const [set, ask] = st.sides[1];
    expect(refs(move(st, ask.id, 1, set.id), 1)).toEqual(['ask', 'ps4']);
    const folded = move(st, st.sides[0][0].id, 1, undefined);
    const back = move(folded, ask.id, 0, undefined);
    expect(foldedSide(back)).toBeUndefined();
    expect(find(back, ask.id)?.side).toBe(0);
  });

  it('swaps the sides, the open tabs and the split', () => {
    const st = { ...start(), split: 0.3 };
    const after = swap(st);
    expect(refs(after, 0)).toEqual(['ps4']);
    expect(openTab(after, 1)?.ref).toBe('griffiths');
    expect(after.split).toBeCloseTo(0.7);
  });
});

describe('a material twice', () => {
  it('adds a second tab at its own page', () => {
    let st = start();
    st = add(st, 1, { kind: 'material', ref: 'griffiths', page: 45 });
    expect(refs(st, 1)).toEqual(['ps4', 'griffiths@45']);
    expect(refs(st, 0)).toEqual(['griffiths@112']);
  });

  it('shows an open set or Ask instead of a copy', () => {
    let st = start();
    st = add(st, 0, { kind: 'set', ref: 'ps4' });
    expect(refs(st, 1)).toEqual([]);
    expect(refs(st, 0)).toEqual(['griffiths@112', 'ps4']);
  });
});

describe('a page link', () => {
  it('turns the showing tab, on either side', () => {
    const st = start();
    const after = follow(st, 1, 'griffiths', 230);
    expect(refs(after, 0)).toEqual(['griffiths@230']);
    expect(after.sides[0]).toHaveLength(1);
    // The work on the left, the book showing on the right.
    const swapped = swap(st);
    expect(refs(follow(swapped, 0, 'griffiths', 230), 1)).toEqual([
      'griffiths@230',
    ]);
  });

  it('prefers the one opposite the work when both are showing', () => {
    let st = start();
    st = add(st, 1, { kind: 'material', ref: 'griffiths', page: 45 });
    st = select(st, st.sides[1][1].id);
    const after = follow(st, 1, 'griffiths', 300);
    expect(refs(after, 0)).toEqual(['griffiths@300']);
    expect(refs(after, 1)).toEqual(['ps4', 'griffiths@45']);
  });

  it('shows a hidden tab opposite the work, turned', () => {
    let st = start();
    st = add(st, 0, { kind: 'material', ref: 'notes', page: 1 });
    const after = follow(st, 1, 'griffiths', 118);
    expect(openTab(after, 0)?.ref).toBe('griffiths');
    expect(openTab(after, 0)?.page).toBe(118);
    expect(after.sides[0]).toHaveLength(2);
  });

  it('opens one opposite the work when there is none, even on a folded side', () => {
    const st = start();
    const folded = close(st, st.sides[0][0].id);
    const after = follow(folded, 1, 'griffiths', 120);
    expect(refs(after, 0)).toEqual(['griffiths@120']);
    expect(foldedSide(after)).toBeUndefined();
    expect(showing(after)).toHaveLength(2);
  });
});

describe('ask about this', () => {
  it('opens Ask opposite the work with the problem attached', () => {
    const after = askAbout(start(), 1, 'p2');
    const ask = openTab(after, 0);
    expect(ask?.kind).toBe('ask');
    expect(ask?.problem).toBe('p2');
  });

  it('keeps one Ask, brought to the other side', () => {
    let st = askAbout(start(), 1, 'p2');
    st = askAbout(st, 0, 'p3');
    const asks = [...st.sides[0], ...st.sides[1]].filter(
      (t) => t.kind === 'ask',
    );
    expect(asks).toHaveLength(1);
    expect(asks[0].problem).toBe('p3');
    expect(find(st, asks[0].id)?.side).toBe(1);
  });
});

describe('the address', () => {
  it('round trips tabs, open tabs, pages and the split', () => {
    let st = start();
    st = add(st, 1, { kind: 'material', ref: 'griffiths', page: 45 });
    st = askAbout(st, 1, 'p2');
    st = { ...st, split: 0.4 };
    const back = decode(encode(st));
    expect(refs(back, 0)).toEqual(refs(st, 0));
    expect(refs(back, 1)).toEqual(refs(st, 1));
    expect(openTab(back, 0)?.kind).toBe('ask');
    expect(openTab(back, 0)?.problem).toBe('p2');
    expect(back.split).toBeCloseTo(0.4);
    expect(encode(back)).toBe(encode(st));
  });

  it('leaves out what it cannot read', () => {
    const st = decode('l=x:y,m:book:-4&x=7');
    expect(refs(st, 0)).toEqual(['book@1']);
    expect(st.split).toBe(0.5);
  });
});

describe('splitting the one open side (workspace-d14)', () => {
  const one = () => {
    // The set alone on the right, with Ask beside it; the left is folded.
    let st = start();
    st = close(st, st.sides[0][0].id);
    return add(st, 1, { kind: 'ask', ref: '' });
  };

  it('opens a new left side with the tab, whichever side is open', () => {
    const st = one();
    const ask = st.sides[1][1].id;
    const left = splitOpen(st, ask, 0);
    expect(refs(left, 0)).toEqual(['ask']);
    expect(refs(left, 1)).toEqual(['ps4']);
    expect(left.split).toBe(0.5);
    // The same with the open side on the left.
    const mirrored = swap(st);
    const right = splitOpen(mirrored, ask, 1);
    expect(refs(right, 1)).toEqual(['ask']);
    expect(refs(right, 0)).toEqual(['ps4']);
    const same = splitOpen(mirrored, ask, 0);
    expect(refs(same, 0)).toEqual(['ask']);
    expect(refs(same, 1)).toEqual(['ps4']);
  });

  it('starts half and half whatever the split was', () => {
    const st = { ...one(), split: 0.3 };
    expect(splitOpen(st, st.sides[1][1].id, 1).split).toBe(0.5);
  });

  it('makes the dropped tab the open tab of its side and keeps the other open', () => {
    const st = one();
    const ask = st.sides[1][1].id;
    const after = splitOpen(st, ask, 0);
    expect(after.open[0]).toBe(ask);
    expect(openTab(after, 1)?.ref).toBe('ps4');
  });

  it('changes nothing for the only tab of the only side', () => {
    const st = close(start(), start().sides[0][0].id);
    const only = st.sides[1][0].id;
    expect(splitOpen(st, only, 0)).toBe(st);
    expect(splitOpen(st, only, 1)).toBe(st);
  });

  it('does nothing when two sides are open', () => {
    const st = start();
    expect(splitOpen(st, st.sides[0][0].id, 1)).toBe(st);
  });
});

describe('moving the last tab, and recency', () => {
  it('folds the source and gives the other the full width', () => {
    const st = start();
    const after = move(st, st.sides[0][0].id, 1, undefined);
    expect(foldedSide(after)).toBe(0);
    expect(refs(after, 1)).toEqual(['ps4', 'griffiths@112']);
    expect(after.open[1]).toBe(st.sides[0][0].id);
  });

  it('shows the most recently used tab on the side a tab left', () => {
    let st = start();
    st = add(st, 0, { kind: 'material', ref: 'notes', page: 1 });
    st = add(st, 0, { kind: 'material', ref: 'extra', page: 1 });
    const [a, b, c] = st.sides[0];
    st = select(select(st, a.id), c.id);
    st = select(st, b.id);
    // b leaves: c was used just before it.
    expect(move(st, b.id, 1, undefined).open[0]).toBe(c.id);
  });

  it('keeps recency per side and through swap', () => {
    let st = start();
    st = add(st, 1, { kind: 'ask', ref: '' });
    const [set, ask] = st.sides[1];
    st = swap(select(st, set.id));
    // Right (formerly left) has only the book; left has ask then set.
    expect(close(st, set.id).open[0]).toBe(ask.id);
  });
});
