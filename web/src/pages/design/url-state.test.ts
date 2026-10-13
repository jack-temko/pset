import { describe, expect, it } from 'vitest';

import { fixture } from '@/design/registry';
import { parseStage, stageParams } from './url-state';

const ROW = fixture('sample-row').spec;
const SCREEN = fixture('sample-screen').spec;

describe('the stage state in the URL', () => {
  it('defaults by kind', () => {
    const q = new URLSearchParams();
    expect(parseStage(q, ROW)).toEqual({
      state: 'rest',
      load: 'loaded',
      stress: false,
      w: 480,
      theme: 'paper',
    });
    expect(parseStage(q, SCREEN).w).toBe('full');
  });

  it('reads every control', () => {
    const q = new URLSearchParams(
      'state=menu&load=both&stress=1&w=280&theme=night',
    );
    expect(parseStage(q, ROW)).toEqual({
      state: 'menu',
      load: 'both',
      stress: true,
      w: 280,
      theme: 'night',
    });
  });

  it('ignores what is not valid', () => {
    const q = new URLSearchParams('state=zzz&load=x&w=-4&theme=neon');
    expect(parseStage(q, ROW)).toEqual(parseStage(new URLSearchParams(), ROW));
  });

  it('writes only what differs from the default', () => {
    expect(
      stageParams(parseStage(new URLSearchParams(), ROW), ROW).toString(),
    ).toBe('');
    const q = new URLSearchParams('state=menu&stress=1&w=full');
    const back = stageParams(parseStage(q, ROW), ROW);
    expect(Object.fromEntries(back)).toEqual({
      state: 'menu',
      stress: '1',
      w: 'full',
    });
    expect(parseStage(back, ROW)).toEqual(parseStage(q, ROW));
  });
});
