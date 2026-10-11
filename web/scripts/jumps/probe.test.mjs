// @vitest-environment node
// The probe and the fidelity check on synthetic pages in a real Chromium: the
// layouts of the misses that screenshots found. Skipped where Chromium is not
// installed (it is installed for the jump guard, not for the unit tests).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { analyzeRun, aggregate } from './analyze.mjs';
import { check } from './check.mjs';

const probe = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'probe.js',
);

let browser;
beforeAll(async () => {
  try {
    browser = await chromium.launch();
  } catch {
    browser = undefined;
  }
});
afterAll(async () => {
  await browser?.close();
});

/** A box whose skeleton and content layers hold blocks of the given heights
 *  (or [height, marginTop]), in a box of fixed height (a fill-height panel),
 *  then the content is revealed. Returns what the check says about it. */
async function judge({
  skeleton,
  content,
  boxHeight = 800,
  variant = ['a', 'a'],
  scroller = 0,
}) {
  const ctx = await browser.newContext();
  await ctx.addInitScript({ path: probe });
  const page = await ctx.newPage();
  const html = (blocks) =>
    blocks
      .map((b) => {
        const [h, mt = 0] = Array.isArray(b) ? b : [b];
        return `<div style="height:${h}px;margin-top:${mt}px;background:#ccc"></div>`;
      })
      .join('');
  const open = scroller
    ? `<div style="height:${scroller}px;overflow:auto">`
    : '';
  const close = scroller ? '</div>' : '';
  await page.setContent(`<body style="margin:0">${open}<div id="box" data-view="v" style="display:grid;${scroller ? '' : `height:${boxHeight}px`}">
    <div aria-hidden="true" data-view="v" data-variant="${variant[0]}" style="grid-area:1/1">${html(skeleton)}</div>
    <div id="c" data-view="v" data-variant="${variant[1]}" style="grid-area:1/1"></div></div>${close}</body>`);
  await page.waitForFunction(() => !!window.__jumps, null, { timeout: 4000 });
  await page.waitForTimeout(150);
  await page.evaluate((h) => {
    document.getElementById('c').innerHTML = h;
  }, html(content));
  await page.waitForFunction(() => window.__jumps.reveals.length > 0, null, {
    timeout: 4000,
  });
  const raw = await page.evaluate(() =>
    JSON.parse(JSON.stringify(window.__jumps)),
  );
  await ctx.close();
  const log = {
    t0: 0,
    end: 1,
    timedOut: false,
    origin: raw.origin,
    shifts: [],
    sizes: [],
    frames: [],
    requests: [],
    swaps: raw.swaps,
    changes: raw.changes,
    reveals: raw.reveals,
    variants: raw.variants,
  };
  const run = analyzeRun(log);
  const row = { name: 'synthetic', mode: 'real', agg: aggregate([run]) };
  return {
    fid: run.fidelity[0],
    why: check({ rows: [row] }).failed.flatMap((f) => f.why),
  };
}

describe('fidelity on a real page', () => {
  const need = (fn) => async () => {
    if (!browser) return; // no Chromium here: nothing to measure with
    await fn();
  };

  it(
    'passes a skeleton that matches its content',
    need(async () => {
      const r = await judge({
        skeleton: [40, 120, 30, 30],
        content: [40, 120, 30, 30],
      });
      expect(r.fid.extentPx).toBeLessThanOrEqual(1);
      expect(r.why).toEqual([]);
    }),
  );

  it(
    '(a) Home: a content block the skeleton lacks, 62px, is caught though the box is fixed',
    need(async () => {
      const r = await judge({
        skeleton: [40, 80, 200],
        content: [40, 62, 80, 200],
      });
      expect(r.fid.blocks).toEqual([3, 4]);
      expect(r.fid.extentPx).toBe(62);
      expect(r.why.join(' ')).toContain('62px in how far it reaches');
    }),
  );

  it(
    '(b) a question: a figure and an open help panel the skeleton does not draw',
    need(async () => {
      const r = await judge({
        skeleton: [30, 60, 40, 40, 40],
        content: [30, 60, 190, 40, 120, 40, 40],
      });
      expect(r.fid.extentPx).toBeGreaterThan(100);
      expect(r.why.length).toBe(1);
    }),
  );

  it(
    '(c) Settings: a line more than the real one, 4px, is caught',
    need(async () => {
      const r = await judge({ skeleton: [20, 20, 20], content: [20, 20, 16] });
      expect(r.fid.blockPx).toBe(4);
      expect(r.fid.extentPx).toBe(4);
      expect(r.why.join(' ')).toContain('4px');
    }),
  );

  it(
    'a block that starts lower, with equal heights, is caught by its offset',
    need(async () => {
      const r = await judge({
        skeleton: [40, 40, 40],
        content: [40, [40, 12], 40],
      });
      expect(r.fid.blockPx).toBe(0);
      expect(r.fid.offsetPx).toBe(12);
      expect(r.why.join(' ')).toContain('12px in where its blocks start');
    }),
  );

  it(
    'a variant mismatch is caught',
    need(async () => {
      const r = await judge({
        skeleton: [40],
        content: [40],
        variant: ['question', 'finish'],
      });
      expect(r.why.join(' ')).toContain(
        '"question" variant but the content is "finish"',
      );
    }),
  );

  it(
    'a difference below the fold of a scroll container is not a mismatch',
    need(async () => {
      const r = await judge({
        skeleton: [100, 100, 100, 400],
        content: [100, 100, 100, 700],
        scroller: 350,
      });
      expect(r.fid.extentPx).toBe(0);
      expect(r.fid.fullExtent).toEqual([700, 1000]);
      expect(r.why).toEqual([]);
    }),
  );

  it(
    'a block that starts below the fold is not compared',
    need(async () => {
      const r = await judge({
        skeleton: [100, 100, 100, 100],
        content: [100, 100, 100, [100, 50]],
        scroller: 250,
      });
      expect(r.fid.offsetPx).toBe(0);
      expect(r.why).toEqual([]);
    }),
  );

  it(
    'a block inserted inside the visible region of a scroll container still fails',
    need(async () => {
      const r = await judge({
        skeleton: [60, 100, 100, 400],
        content: [60, 62, 100, 100, 400],
        scroller: 400,
      });
      expect(r.fid.extentPx).toBe(0);
      // The content's third block starts 38px higher than the skeleton's.
      expect(r.fid.offsetPx).toBe(38);
      expect(r.why.join(' ')).toContain('38px in where its blocks start');
    }),
  );

  it(
    'a visible extent that differs by 62px fails',
    need(async () => {
      const r = await judge({
        skeleton: [60, 100],
        content: [60, 62, 100],
        scroller: 600,
      });
      expect(r.fid.extentPx).toBe(62);
      expect(r.why.join(' ')).toContain('62px in how far it reaches');
    }),
  );
});
