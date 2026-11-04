import { describe, expect, it } from 'vitest';

import { pinchZoom, snapFit, stepZoom } from './zoom';

describe('pinch zoom', () => {
  it('scales by the ratio of the finger distances', () => {
    expect(pinchZoom(1, 100, 150)).toBeCloseTo(1.5);
    expect(pinchZoom(2, 200, 100)).toBeCloseTo(1);
  });
  it('stays within 0.5x to 4x', () => {
    expect(pinchZoom(1, 100, 1000)).toBe(4);
    expect(pinchZoom(1, 100, 1)).toBe(0.5);
  });
  it('snaps to fit within 2%', () => {
    expect(pinchZoom(1.5, 150, 101)).toBe(1);
    expect(snapFit(1.03)).toBeCloseTo(1.03);
  });
  it('ignores a zero distance', () => {
    expect(pinchZoom(1.3, 0, 50)).toBe(1.3);
  });
});

describe('zoom steps', () => {
  it('go up and down through the list', () => {
    expect(stepZoom(1, 1)).toBe(1.1);
    expect(stepZoom(1, -1)).toBe(0.9);
    expect(stepZoom(1.05, 1)).toBe(1.1);
    expect(stepZoom(1.05, -1)).toBe(1);
  });
  it('stop at the ends', () => {
    expect(stepZoom(4, 1)).toBe(4);
    expect(stepZoom(0.5, -1)).toBe(0.5);
  });
});
