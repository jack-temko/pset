import { describe, expect, it } from 'vitest'
import { aggregate, analyzeRun, median, percentile } from './analyze.mjs'

const base = { t0: 1000, end: 3000, timedOut: false, origin: 0, shifts: [], sizes: [], frames: [], requests: [] }
const src = (sel) => ({ sel, prev: { x: 0, y: 0, w: 1, h: 1 }, cur: { x: 0, y: 5, w: 1, h: 1 } })

describe('median and percentile', () => {
  it('takes the middle, or the mean of the two', () => {
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBe(0)
  })
  it('p95 of five runs is the worst', () => {
    expect(percentile([1, 2, 3, 4, 50], 0.95)).toBe(50)
    expect(percentile([7], 0.95)).toBe(7)
  })
})

describe('analyzeRun', () => {
  it('a run with no shifts is quiet and settles at once', () => {
    const r = analyzeRun(base)
    expect(r.jump).toBe(0)
    expect(r.moved).toEqual([])
    expect(r.overlays).toEqual([])
    expect(r.settleMs).toBe(0)
  })

  it('counts only shifts after t0, and keeps the ones after input', () => {
    const r = analyzeRun({
      ...base,
      shifts: [
        { t: 500, value: 0.9, hadRecentInput: false, sources: [src('a')] },
        { t: 1100, value: 0.1, hadRecentInput: true, sources: [src('a')] },
        { t: 1400, value: 0.2, hadRecentInput: false, sources: [src('b')] },
      ],
    })
    expect(r.jump).toBeCloseTo(0.3)
    expect(r.shiftCount).toBe(2)
    expect(r.settleMs).toBe(400)
  })

  it('groups by source selector, sharing a shift between its sources', () => {
    const r = analyzeRun({
      ...base,
      shifts: [
        { t: 1100, value: 0.2, hadRecentInput: false, sources: [src('a'), src('b')] },
        { t: 1200, value: 0.3, hadRecentInput: false, sources: [src('a')] },
      ],
    })
    expect(r.moved).toEqual([
      { sel: 'a', value: 0.4, count: 2 },
      { sel: 'b', value: 0.1, count: 1 },
    ])
  })

  it('measures an overlay that opens small and grows', () => {
    const r = analyzeRun({
      ...base,
      sizes: [
        { name: 'Memory', t: 200, w: 0, h: 0 },
        { name: 'Memory', t: 1050, w: 400, h: 200 },
        { name: 'Memory', t: 1600, w: 400, h: 340 },
      ],
    })
    expect(r.overlays).toEqual([
      { name: 'Memory', first: { w: 400, h: 200 }, final: { w: 400, h: 340 }, growthPx: 140, appearMs: 50, settleMs: 600 },
    ])
    expect(r.settleMs).toBe(600)
  })

  it('keeps one series for an overlay that is renamed mid-run', () => {
    const r = analyzeRun({
      ...base,
      sizes: [
        { id: 1, name: 'dialog', named: false, t: 1050, w: 400, h: 150 },
        { id: 1, name: 'Edit homework', named: true, t: 1300, w: 400, h: 260 },
        { id: 1, name: 'dialog', named: false, t: 1400, w: 400, h: 260 },
        { id: 2, name: 'Book actions menu', named: true, t: 1100, w: 243, h: 117 },
      ],
    })
    expect(r.overlays).toHaveLength(2)
    expect(r.overlays[0]).toMatchObject({ name: 'Edit homework', growthPx: 110, settleMs: 400 })
  })

  it('settles when the last skeleton goes, and counts a spinner apart', () => {
    const r = analyzeRun({
      ...base,
      frames: [
        { t: 0, skel: 0, status: 0 },
        { t: 1010, skel: 2, status: 0 },
        { t: 1700, skel: 0, status: 1 },
        { t: 2100, skel: 0, status: 0 },
      ],
    })
    expect(r.skeletonMs).toBe(700)
    expect(r.spinnerMs).toBe(1100)
    expect(r.settleMs).toBe(1100)
  })

  it('a skeleton still there at the end lasts to the end', () => {
    const r = analyzeRun({ ...base, frames: [{ t: 1010, skel: 1, status: 0 }] })
    expect(r.skeletonMs).toBe(2000)
    expect(r.settleMs).toBe(2000)
  })

  it('a skeleton already on at t0 counts until it goes, or to the end', () => {
    const gone = analyzeRun({
      ...base,
      frames: [
        { t: 900, skel: 3, status: 0 },
        { t: 1300, skel: 0, status: 0 },
      ],
    })
    expect(gone.skeletonMs).toBe(300)
    expect(analyzeRun({ ...base, frames: [{ t: 900, skel: 3, status: 0 }] }).skeletonMs).toBe(2000)
  })

  it('a request that ends last sets the settle time; a timeout is the whole run', () => {
    expect(analyzeRun({ ...base, requests: [{ start: 1000, end: 1900 }] }).settleMs).toBe(900)
    const t = analyzeRun({ ...base, timedOut: true })
    expect(t.settleMs).toBe(2000)
    expect(t.timedOut).toBe(true)
  })

  it('adds the page origin to probe times', () => {
    const r = analyzeRun({
      ...base,
      origin: 900,
      shifts: [{ t: 300, value: 0.5, hadRecentInput: false, sources: [src('a')] }],
    })
    expect(r.jump).toBe(0.5)
    expect(r.settleMs).toBe(200)
  })
})

describe('aggregate', () => {
  const run = (jump, settleMs, growth, sel) => ({
    jump,
    settleMs,
    skeletonMs: 0,
    spinnerMs: 0,
    timedOut: false,
    moved: jump ? [{ sel, value: jump, count: 1 }] : [],
    overlays: [
      { name: 'Dialog', first: { w: 400, h: 200 }, final: { w: 400, h: 200 + growth }, growthPx: growth, appearMs: 10, settleMs },
    ],
  })

  it('gives median and p95 across runs', () => {
    const a = aggregate([run(0.1, 100, 10, 'a'), run(0.2, 200, 20, 'a'), run(0.3, 300, 30, 'a'), run(0.4, 400, 40, 'b'), run(0.5, 900, 90, 'a')])
    expect(a.runs).toBe(5)
    expect(a.jump).toEqual({ median: 0.3, p95: 0.5 })
    expect(a.settleMs).toEqual({ median: 300, p95: 900 })
    expect(a.growthPx).toEqual({ median: 30, p95: 90 })
    expect(a.moved[0]).toMatchObject({ sel: 'a', runs: 4 })
    expect(a.overlays[0]).toMatchObject({ name: 'Dialog', growthPx: 30, settleMedian: 300, settleP95: 900 })
  })
})
