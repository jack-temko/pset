// Pure functions from one run's raw log to numbers, then across runs.
//
// A raw log is what run.mjs collects:
//   t0        wall-clock ms of the navigation or the click being measured
//   end       wall-clock ms the run stopped looking
//   timedOut  the scenario never settled
//   origin    the page's performance.timeOrigin; probe times are origin + t
//   shifts    [{ t, value, hadRecentInput, sources: [{ sel, prev, cur }] }]
//   sizes     [{ id, name, named, t, w, h }]  an overlay's size each time it changed;
//             id is stable per element, named false when name is only its role
//   frames    [{ t, skel, status }] skeletons and spinners on screen, on change
//   requests  [{ start, end }]      wall-clock, end null while in flight

export function median(xs) {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Nearest rank: the smallest value with p of the runs at or below it. */
export function percentile(xs, p) {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.max(0, Math.ceil(p * s.length) - 1)]
}

const round = (n) => Math.round(n * 1000) / 1000

/** When something (skeleton or spinner) was last on screen after t0, as ms
 *  after t0. 0 if it never was; the run's length if it still is at the end. */
function lastSeen(log, key) {
  const frames = [...log.frames].sort((a, b) => a.t - b.t)
  let on = false
  let end = null
  for (const f of frames) {
    const at = log.origin + f.t
    const now = f[key] > 0
    if (at <= log.t0) {
      on = now
      if (on) end = log.t0
    } else {
      if (on || now) end = at
      on = now
    }
  }
  if (on) end = log.end
  return end === null ? 0 : Math.max(0, end - log.t0)
}

export function analyzeRun(log) {
  const at = (t) => log.origin + t
  const shifts = log.shifts.filter((s) => at(s.t) >= log.t0)

  // A shift's score is split evenly among the elements that moved.
  const byEl = new Map()
  for (const s of shifts) {
    const srcs = s.sources.length ? s.sources : [{ sel: 'unknown' }]
    for (const src of srcs) {
      const e = byEl.get(src.sel) ?? { sel: src.sel, value: 0, count: 0 }
      e.value += s.value / srcs.length
      e.count++
      byEl.set(src.sel, e)
    }
  }
  const moved = [...byEl.values()].map((e) => ({ ...e, value: round(e.value) })).sort((a, b) => b.value - a.value)

  // Each overlay: first nonzero size after t0, last size, and when it last changed.
  const names = new Map()
  for (const z of [...log.sizes].sort((a, b) => a.t - b.t)) {
    if (at(z.t) < log.t0 || z.w === 0 || z.h === 0) continue
    const key = z.id ?? z.name
    const list = names.get(key) ?? []
    list.push(z)
    names.set(key, list)
  }
  const overlays = [...names.values()].map((list) => {
    const first = list[0]
    const last = list[list.length - 1]
    // Called by the last real name it had, else the last it had at all.
    const name = (list.filter((z) => z.named !== false).pop() ?? last).name
    return {
      name,
      first: { w: first.w, h: first.h },
      final: { w: last.w, h: last.h },
      growthPx: Math.abs(last.h - first.h) + Math.abs(last.w - first.w),
      appearMs: Math.max(0, at(first.t) - log.t0),
      settleMs: Math.max(0, at(last.t) - log.t0),
    }
  })

  const skeletonMs = lastSeen(log, 'skel')
  const spinnerMs = lastSeen(log, 'status')
  const events = [skeletonMs, spinnerMs]
  for (const s of shifts) events.push(at(s.t) - log.t0)
  for (const o of overlays) events.push(o.settleMs)
  for (const r of log.requests ?? []) if (r.end !== null && r.end >= log.t0) events.push(r.end - log.t0)
  const settleMs = log.timedOut ? log.end - log.t0 : Math.max(0, ...events)

  return {
    jump: round(shifts.reduce((n, s) => n + s.value, 0)),
    shiftCount: shifts.length,
    moved,
    overlays,
    skeletonMs,
    spinnerMs,
    settleMs,
    timedOut: !!log.timedOut,
  }
}

/** Median and p95 across a scenario's runs (each an analyzeRun result). */
export function aggregate(runs) {
  const stat = (f) => ({ median: round(median(runs.map(f))), p95: round(percentile(runs.map(f), 0.95)) })

  const sels = new Set(runs.flatMap((r) => r.moved.map((m) => m.sel)))
  const moved = [...sels]
    .map((sel) => ({
      sel,
      value: round(median(runs.map((r) => r.moved.find((m) => m.sel === sel)?.value ?? 0))),
      runs: runs.filter((r) => r.moved.some((m) => m.sel === sel)).length,
    }))
    .sort((a, b) => b.value - a.value || b.runs - a.runs)

  const names = [...new Set(runs.flatMap((r) => r.overlays.map((o) => o.name)))]
  const overlays = names.map((name) => {
    const of = (r) => r.overlays.find((o) => o.name === name)
    const have = runs.map(of).filter(Boolean)
    const med = (f) => round(median(have.map(f)))
    return {
      name,
      first: { w: med((o) => o.first.w), h: med((o) => o.first.h) },
      final: { w: med((o) => o.final.w), h: med((o) => o.final.h) },
      growthPx: med((o) => o.growthPx),
      appearMs: med((o) => o.appearMs),
      settleMedian: med((o) => o.settleMs),
      settleP95: round(percentile(have.map((o) => o.settleMs), 0.95)),
    }
  })

  return {
    runs: runs.length,
    jump: stat((r) => r.jump),
    settleMs: stat((r) => r.settleMs),
    skeletonMs: stat((r) => r.skeletonMs),
    spinnerMs: stat((r) => r.spinnerMs),
    growthPx: stat((r) => Math.max(0, ...r.overlays.map((o) => o.growthPx))),
    timeouts: runs.filter((r) => r.timedOut).length,
    moved,
    overlays,
  }
}
