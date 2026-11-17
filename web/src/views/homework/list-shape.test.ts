import { describe, expect, it } from 'vitest';

import { isListShape } from './list-shape';

describe('a saved list shape', () => {
  it('is a small count of rows, never an absurd one', () => {
    expect(isListShape({ active: 2, turnedIn: 0 })).toBe(true);
    expect(isListShape({ active: 50, turnedIn: 50 })).toBe(true);
    expect(isListShape({ active: 51, turnedIn: 0 })).toBe(false);
    expect(isListShape({ active: -1, turnedIn: 0 })).toBe(false);
    expect(isListShape({ active: 1e9, turnedIn: 0 })).toBe(false);
    expect(isListShape(null)).toBe(false);
  });
});
