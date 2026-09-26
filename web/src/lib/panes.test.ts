import { beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_RATIOS, PANEL_MIN, RAIL_MIN, SCAN_MIN, layout, readRatios } from './panes'

describe('layout', () => {
  it('keeps the ratios at any width, so a layout survives a resized screen', () => {
    const r = { rail: 0.25, panel: 0.3, panelFocus: 0.5 }
    for (const total of [1280, 1920, 2560]) {
      const l = layout(total, r, false, true)
      expect(l.rail / total).toBeCloseTo(0.25)
      expect(l.panel / total).toBeCloseTo(0.3)
    }
  })

  it('holds each pane inside its limits', () => {
    const tiny = layout(1440, { rail: 0.01, panel: 0.01, panelFocus: 0.01 }, false, true)
    expect(tiny.rail).toBe(RAIL_MIN)
    expect(tiny.panel).toBe(PANEL_MIN)
    const huge = layout(1440, { rail: 0.9, panel: 0.9, panelFocus: 0.9 }, false, true)
    expect(huge.rail).toBeCloseTo(1440 * 0.35)
    expect(1440 - huge.rail - huge.panel).toBeGreaterThanOrEqual(SCAN_MIN)
  })

  it('gives the panel way before the rail on a narrow screen, and never below the minimums', () => {
    const l = layout(1000, { rail: 0.3, panel: 0.45, panelFocus: 0.5 }, false, true)
    expect(1000 - l.rail - l.panel).toBe(SCAN_MIN)
    expect(l.rail).toBeCloseTo(300)
    const cramped = layout(700, DEFAULT_RATIOS, false, true)
    expect(cramped.rail).toBe(RAIL_MIN)
    expect(cramped.panel).toBe(PANEL_MIN)
  })

  it('uses the Focus ratio, and no rail, in Focus', () => {
    const l = layout(1440, DEFAULT_RATIOS, true, true)
    expect(l.rail).toBe(0)
    expect(l.panel).toBeCloseTo(800)
  })

  it('lets a book with no contents give the rail nothing', () => {
    expect(layout(1440, DEFAULT_RATIOS, false, false).rail).toBe(0)
  })

  it('offers each handle only the room the other pane leaves', () => {
    const l = layout(1440, DEFAULT_RATIOS, false, true)
    expect(l.railRange[1]).toBeLessThanOrEqual(1440 - l.panel - SCAN_MIN)
    expect(l.panelRange[1]).toBeLessThanOrEqual(1440 - l.rail - SCAN_MIN)
  })
})

describe('readRatios', () => {
  beforeEach(() => localStorage.clear())

  it('falls back to the defaults for nothing stored, or nonsense', () => {
    expect(readRatios()).toEqual(DEFAULT_RATIOS)
    localStorage.setItem('pset-panes', '{"rail": 7, "panel": "wide"}')
    expect(readRatios()).toEqual(DEFAULT_RATIOS)
    localStorage.setItem('pset-panes', 'not json')
    expect(readRatios()).toEqual(DEFAULT_RATIOS)
  })

  it('keeps the good values of a partial record', () => {
    localStorage.setItem('pset-panes', '{"rail": 0.2}')
    expect(readRatios()).toEqual({ ...DEFAULT_RATIOS, rail: 0.2 })
  })
})
