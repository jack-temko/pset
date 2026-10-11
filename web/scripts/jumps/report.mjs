// report.json and report.md from the audit's rows (see run.mjs). The table is
// worst first: jump score (median), then overlay growth, then settle time.
import fs from 'node:fs';
import path from 'node:path';

const f = (n, d = 3) => (n === 0 ? '0' : Number(n).toFixed(d));
const ms = (a) => `${Math.round(a.median)} / ${Math.round(a.p95)}`;
const esc = (s) => String(s).replace(/\|/g, '\\|');

/** The run whose numbers are worst: highest jump, then growth, then settle. */
export function worstRun(runs) {
  return [...runs].sort(
    (a, b) =>
      b.jump - a.jump ||
      Math.max(0, ...b.overlays.map((o) => o.growthPx)) -
        Math.max(0, ...a.overlays.map((o) => o.growthPx)) ||
      b.settleMs - a.settleMs,
  )[0];
}

export function rank(rows) {
  return [...rows].sort(
    (a, b) =>
      (b.agg?.jump.median ?? -1) - (a.agg?.jump.median ?? -1) ||
      (b.agg?.growthPx.median ?? 0) - (a.agg?.growthPx.median ?? 0) ||
      (b.agg?.settleMs.median ?? 0) - (a.agg?.settleMs.median ?? 0),
  );
}

export function table(rows) {
  const lines = [
    '| Scenario | Mode | Jump score (median / p95) | Overlay growth px | Settle ms (median / p95) | Skeleton ms | Settle waited on last | Moved |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const r of rank(rows)) {
    const who =
      esc(r.name) + (r.trigger ? `<br>discovered: ${esc(r.trigger)}` : '');
    if (!r.agg) {
      lines.push(
        `| ${who} | ${r.mode} | skipped: ${esc(r.skipped)} | | | | | |`,
      );
      continue;
    }
    const a = r.agg;
    const moved = a.moved
      .slice(0, 3)
      .map((m) => `\`${esc(m.sel)}\` ${f(m.value)}`)
      .join('<br>');
    const grew = a.overlays
      .filter((o) => o.growthPx > 0)
      .map(
        (o) =>
          `${esc(o.name)} ${o.first.w}x${o.first.h} to ${o.final.w}x${o.final.h}`,
      );
    const growth = a.growthPx.median
      ? `${f(a.growthPx.median, 0)}<br>${grew.join('<br>')}`
      : '0';
    const settle =
      ms(a.settleMs) + (a.timeouts ? ` (${a.timeouts} timed out)` : '');
    lines.push(
      `| ${who} | ${r.mode} | ${f(a.jump.median)} / ${f(a.jump.p95)} | ${growth} | ${settle} | ${Math.round(a.skeletonMs.median)} | ${esc(a.waitedOn || 'nothing')} | ${moved} |`,
    );
  }
  return lines.join('\n');
}

export function writeReport(out, meta, rows) {
  fs.writeFileSync(
    path.join(out, 'report.json'),
    JSON.stringify({ meta, rows }, null, 2),
  );
  const md = [
    '# Layout jump audit',
    '',
    `${meta.at} against ${meta.app}. ${meta.runs} runs each. Slow mode holds every /api request ${meta.slowMs}ms.`,
    `Book: ${meta.book ?? 'none'}. Homework set: ${meta.set ?? 'none'}.`,
    '',
    'Worst first: jump score (median), then overlay growth, then settle time. Jump score is the Layout Instability API sum after t0, input-driven shifts included. Overlay growth is how far a dialog, popover or menu changed size from its first frame (height plus width, px). Settle is t0 to the last shift, resize, skeleton, spinner or request.',
    '',
    table(rows),
    '',
    '## Worst run of each',
    '',
  ];
  for (const r of rank(rows)) {
    if (!r.runs) continue;
    const w = worstRun(r.runs);
    md.push(`### ${r.name} (${r.mode}), run ${w.run}`, '');
    md.push(
      `Jump ${f(w.jump)}, settled after ${Math.round(w.settleMs)}ms.`,
      '',
    );
    md.push(`First frame after t0: ![](shots/${w.base}-first.jpg)`, '');
    md.push(`Settled: ![](shots/${w.base}-settled.jpg)`, '');
  }
  fs.writeFileSync(path.join(out, 'report.md'), md.join('\n') + '\n');
}
