import { describe, expect, it } from 'vitest'
import { check, format, MAX_GROWTH_PX, MAX_JUMP } from './check.mjs'

const agg = (over = {}) => ({
  runs: 3,
  waitedOn: '',
  jump: { median: 0, p95: 0 },
  growthPx: { median: 0, p95: 0 },
  timeouts: 0,
  moved: [],
  overlays: [],
  ...over,
})
const row = (over = {}) => ({ name: 'Memory', mode: 'real', agg: agg(), ...over })
const report = (...rows) => ({ meta: {}, rows })

describe('thresholds', () => {
  it('passes a quiet row', () => {
    expect(check(report(row())).failed).toEqual([])
  })
  it('passes exactly at the limits and fails just over', () => {
    expect(check(report(row({ agg: agg({ growthPx: { median: MAX_GROWTH_PX } }) }))).failed).toEqual([])
    expect(check(report(row({ agg: agg({ jump: { median: MAX_JUMP } }) }))).failed).toEqual([])
    expect(check(report(row({ agg: agg({ growthPx: { median: MAX_GROWTH_PX + 0.5 } }) }))).failed).toHaveLength(1)
    expect(check(report(row({ agg: agg({ jump: { median: MAX_JUMP + 0.0005 } }) }))).failed).toHaveLength(1)
  })
  it('names the numbers and the elements that moved', () => {
    const r = row({
      agg: agg({
        jump: { median: 0.05 },
        moved: [{ sel: 'main > section', value: 0.05, runs: 3 }],
        growthPx: { median: 40 },
        overlays: [{ name: 'Memory', growthPx: 40, first: { w: 500, h: 100 }, final: { w: 500, h: 140 } }],
      }),
    })
    const out = format(check(report(r)), 1)
    expect(out).toContain('FAIL: Memory (real)')
    expect(out).toContain('40px')
    expect(out).toContain('Memory 500x100 to 500x140')
    expect(out).toContain('main > section 0.050')
  })
})

describe('timeouts', () => {
  it('a scenario that never settles fails, even with no shift', () => {
    const r = row({ agg: agg({ timeouts: 1, waitedOn: 'skeleton' }) })
    const { failed } = check(report(r))
    expect(failed).toHaveLength(1)
    expect(failed[0].why[0]).toContain('never settled')
  })
})

describe('the allow-list', () => {
  const bad = { agg: agg({ jump: { median: 0.2 } }) }
  it('ignores a row it names, and keeps the reason', () => {
    const res = check(report(row(bad)), [{ scenario: 'Memory', reason: 'the dialog fades in by design' }])
    expect(res.failed).toEqual([])
    expect(res.ignored[0].reason).toBe('the dialog fades in by design')
    expect(format(res, 1)).toContain('allowed: Memory')
  })
  it('matches a mode only when the entry names one', () => {
    const entry = { scenario: 'Memory', mode: 'slow', reason: 'r' }
    expect(check(report(row({ ...bad, mode: 'real' })), [entry]).failed).toHaveLength(1)
    expect(check(report(row({ ...bad, mode: 'slow' })), [entry]).failed).toEqual([])
  })
  it('matches the scenario name exactly', () => {
    expect(check(report(row(bad)), [{ scenario: 'Memo', reason: 'r' }]).failed).toHaveLength(1)
  })
})

describe('skipped scenarios', () => {
  it('are listed, not failed', () => {
    const res = check(report(row({ name: 'Edit book', agg: undefined, skipped: 'the library has no book' })))
    expect(res.failed).toEqual([])
    expect(format(res, 1)).toContain('skipped: Edit book (real): the library has no book')
  })
})
