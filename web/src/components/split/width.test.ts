import { describe, expect, it } from 'vitest';

import { leftWidth } from './width';

describe('leftWidth', () => {
  it('is the ratio of the width', () => {
    expect(leftWidth(1200, 0.5, 360)).toBe(600);
  });
  it('holds each pane at the minimum', () => {
    expect(leftWidth(1200, 0.1, 360)).toBe(360);
    expect(leftWidth(1200, 0.95, 360)).toBe(840);
  });
  it('holds the left at the minimum when the split is too narrow for two', () => {
    expect(leftWidth(600, 0.5, 360)).toBe(360);
  });
});
