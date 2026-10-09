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
//   frames    [{ t, skel, status, skelSel, statusSel }] skeletons and spinners in the
//             viewport, on change, with a selector for the first of each
//   requests  [{ start, end, url }] wall-clock, end null while in flight

export function median(xs) {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Nearest rank: the smallest value with p of the runs at or below it. */
export function percentile(xs, p) {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil(p * s.length) - 1)];
}

const round = (n) => Math.round(n * 1000) / 1000;

/** When something (skeleton or spinner) was last on screen after t0, as ms
 *  after t0, and the selector it had then. 0 if it never was; the run's
 *  length if it still is at the end. */
function lastSeen(log, key) {
  const frames = [...log.frames].sort((a, b) => a.t - b.t);
  let on = false;
  let end = null;
  let what = '';
  const sel = key === 'skel' ? 'skelSel' : 'statusSel';
  for (const f of frames) {
    const at = log.origin + f.t;
    const now = f[key] > 0;
    if (at <= log.t0) {
      on = now;
      if (on) {
        end = log.t0;
        what = f[sel] ?? '';
      }
    } else {
      if (on || now) end = at;
      if (now) what = f[sel] ?? '';
      on = now;
    }
  }
  if (on) end = log.end;
  return end === null
    ? { ms: 0, what: '' }
    : { ms: Math.max(0, end - log.t0), what };
}

export function analyzeRun(log) {
  const at = (t) => log.origin + t;
  const shifts = log.shifts.filter((s) => at(s.t) >= log.t0);

  // A shift's score is split evenly among the elements that moved.
  const byEl = new Map();
  for (const s of shifts) {
    const srcs = s.sources.length ? s.sources : [{ sel: 'unknown' }];
    for (const src of srcs) {
      const e = byEl.get(src.sel) ?? { sel: src.sel, value: 0, count: 0 };
      e.value += s.value / srcs.length;
      e.count++;
      byEl.set(src.sel, e);
    }
  }
  const moved = [...byEl.values()]
    .map((e) => ({ ...e, value: round(e.value) }))
    .sort((a, b) => b.value - a.value);

  // Each overlay: first nonzero size after t0, last size, and when it last changed.
  const names = new Map();
  for (const z of [...log.sizes].sort((a, b) => a.t - b.t)) {
    if (at(z.t) < log.t0 || z.w === 0 || z.h === 0) continue;
    const key = z.id ?? z.name;
    const list = names.get(key) ?? [];
    list.push(z);
    names.set(key, list);
  }
  const overlays = [...names.values()].map((list) => {
    const first = list[0];
    const last = list[list.length - 1];
    // Called by the last real name it had, else the last it had at all.
    const name = (list.filter((z) => z.named !== false).pop() ?? last).name;
    return {
      name,
      first: { w: first.w, h: first.h },
      final: { w: last.w, h: last.h },
      growthPx: Math.abs(last.h - first.h) + Math.abs(last.w - first.w),
      appearMs: Math.max(0, at(first.t) - log.t0),
      settleMs: Math.max(0, at(last.t) - log.t0),
    };
  });

  const skel = lastSeen(log, 'skel');
  const spin = lastSeen(log, 'status');
  const skeletonMs = skel.ms;
  const spinnerMs = spin.ms;
  // Everything the settle could have waited on, each with its time; the
  // latest is what it waited on last.
  const events = [{ ms: 0, kind: 'nothing', what: '' }];
  if (skel.ms) events.push({ ms: skel.ms, kind: 'skeleton', what: skel.what });
  if (spin.ms) events.push({ ms: spin.ms, kind: 'spinner', what: spin.what });
  for (const s of shifts)
    events.push({
      ms: at(s.t) - log.t0,
      kind: 'shift',
      what: s.sources[0]?.sel ?? 'unknown',
    });
  for (const o of overlays)
    events.push({ ms: o.settleMs, kind: 'overlay', what: o.name });
  for (const r of log.requests ?? []) {
    const end = r.end ?? log.end;
    if (end >= log.t0)
      events.push({ ms: end - log.t0, kind: 'request', what: r.url ?? '' });
  }
  const last = events.reduce((a, e) => (e.ms > a.ms ? e : a));
  const settleMs = log.timedOut ? log.end - log.t0 : Math.max(0, last.ms);

  // Loaded boxes: how well each skeleton matched its content, any variant
  // change after a reveal, and any box revealed twice in one navigation.
  const after = (list) => (list ?? []).filter((x) => at(x.t) >= log.t0);
  const fidelity = after(log.swaps).map((w) => {
    const same = w.skeletonBlocks.length === w.contentBlocks.length;
    return {
      box: w.box,
      skeleton: w.skeleton,
      content: w.content,
      blockPx: same
        ? Math.max(
            0,
            ...w.skeletonBlocks.map((h, i) => Math.abs(h - w.contentBlocks[i])),
          )
        : 0,
      blocks: [w.skeletonBlocks.length, w.contentBlocks.length],
      totalPx: Math.abs(w.skeletonHeight - w.contentHeight),
    };
  });
  const flashes = after(log.changes).map((c) => ({
    box: c.box,
    from: c.from,
    to: c.to,
  }));
  const tally = new Map();
  for (const r of after(log.reveals)) {
    const k = `${r.box} | ${r.epoch}`;
    tally.set(k, { box: r.box, count: (tally.get(k)?.count ?? 0) + 1 });
  }
  const doubles = [...tally.values()].filter((d) => d.count > 1);

  return {
    fidelity,
    flashes,
    doubles,
    jump: round(shifts.reduce((n, s) => n + s.value, 0)),
    shiftCount: shifts.length,
    moved,
    overlays,
    skeletonMs,
    spinnerMs,
    settleMs,
    waitedOn: last.kind === 'nothing' ? '' : `${last.kind}: ${last.what}`,
    timedOut: !!log.timedOut,
  };
}

/** Median and p95 across a scenario's runs (each an analyzeRun result). */
export function aggregate(runs) {
  const stat = (f) => ({
    median: round(median(runs.map(f))),
    p95: round(percentile(runs.map(f), 0.95)),
  });

  const sels = new Set(runs.flatMap((r) => r.moved.map((m) => m.sel)));
  const moved = [...sels]
    .map((sel) => ({
      sel,
      value: round(
        median(runs.map((r) => r.moved.find((m) => m.sel === sel)?.value ?? 0)),
      ),
      runs: runs.filter((r) => r.moved.some((m) => m.sel === sel)).length,
    }))
    .sort((a, b) => b.value - a.value || b.runs - a.runs);

  const names = [
    ...new Set(runs.flatMap((r) => r.overlays.map((o) => o.name))),
  ];
  const overlays = names.map((name) => {
    const of = (r) => r.overlays.find((o) => o.name === name);
    const have = runs.map(of).filter(Boolean);
    const med = (f) => round(median(have.map(f)));
    return {
      name,
      first: { w: med((o) => o.first.w), h: med((o) => o.first.h) },
      final: { w: med((o) => o.final.w), h: med((o) => o.final.h) },
      growthPx: med((o) => o.growthPx),
      appearMs: med((o) => o.appearMs),
      settleMedian: med((o) => o.settleMs),
      settleP95: round(
        percentile(
          have.map((o) => o.settleMs),
          0.95,
        ),
      ),
    };
  });

  // What the settle waited on last, most often across the runs.
  const tally = new Map();
  for (const r of runs)
    if (r.waitedOn) tally.set(r.waitedOn, (tally.get(r.waitedOn) ?? 0) + 1);
  const waitedOn = [...tally].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

  return {
    runs: runs.length,
    waitedOn,
    jump: stat((r) => r.jump),
    settleMs: stat((r) => r.settleMs),
    skeletonMs: stat((r) => r.skeletonMs),
    spinnerMs: stat((r) => r.spinnerMs),
    growthPx: stat((r) => Math.max(0, ...r.overlays.map((o) => o.growthPx))),
    timeouts: runs.filter((r) => r.timedOut).length,
    moved,
    overlays,
    boxes: aggregateBoxes(runs),
  };
}

/** Box findings over all the runs: the worst fidelity of each box, and every
 *  flash and double reveal any run saw. */
function aggregateBoxes(runs) {
  const worst = new Map();
  for (const r of runs)
    for (const f of r.fidelity ?? []) {
      const k = `${f.box} | ${f.skeleton} | ${f.content}`;
      const w = worst.get(k);
      if (!w) worst.set(k, { ...f });
      else {
        w.blockPx = Math.max(w.blockPx, f.blockPx);
        w.totalPx = Math.max(w.totalPx, f.totalPx);
      }
    }
  const once = (lists, key) => [
    ...new Map(lists.flat().map((x) => [key(x), x])).values(),
  ];
  return {
    fidelity: [...worst.values()],
    flashes: once(
      runs.map((r) => r.flashes ?? []),
      (x) => `${x.box} | ${x.from} | ${x.to}`,
    ),
    doubles: once(
      runs.map((r) => r.doubles ?? []),
      (x) => x.box,
    ),
  };
}
