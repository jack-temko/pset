import { describe, expect, it } from 'vitest';

import { segmentWeights } from './weights';

describe('segmentWeights', () => {
  it('uses each weight as given', () => {
    expect(
      segmentWeights([
        { mark: 'done', weight: 2 },
        { mark: 'current', weight: 4 },
        { mark: 'waiting', weight: 1 },
      ]),
    ).toEqual([2, 4, 1]);
  });

  it('makes the segments equal when there are no weights', () => {
    expect(
      segmentWeights([
        { mark: 'done' },
        { mark: 'waiting' },
        { mark: 'waiting' },
      ]),
    ).toEqual([1, 1, 1]);
  });

  it('treats a weight that is zero, negative or not a number as 1', () => {
    expect(
      segmentWeights([
        { mark: 'done', weight: 0 },
        { mark: 'done', weight: -3 },
        { mark: 'waiting', weight: Number.NaN },
        { mark: 'waiting', weight: 3 },
      ]),
    ).toEqual([1, 1, 1, 3]);
  });
});
