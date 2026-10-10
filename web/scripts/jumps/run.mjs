// The layout-jump audit's CLI: drives the app in Chromium, each scenario real
// and slow, and writes the report. See ideas/layout-jumps.md.
//
//   node scripts/jumps/run.mjs --url http://localhost:5180 [--runs 5]
//        [--slow-ms 600] [--only <scenario>] [--out <dir>]
//        [--no-discover] [--discover-only] [--parallel 3]
//
// --only takes one scenario name or its slug ("home-cold-load"), or a comma
// list of slugs ("home-cold-load,memory"; the comma form takes slugs only, as
// names have commas of their own). With --only, discovery looks only at the
// Book and Homework set pages. --no-discover runs only the hand-written
// scenarios; --discover-only prints what discovery finds and stops.
// --parallel N measures N (scenario, mode) jobs at once, one Chromium each.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import { aggregate, analyzeRun } from './analyze.mjs';
import { writeReport } from './report.mjs';
import { discover, locate, scenarios } from './scenarios.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const QUIET_MS = 750;
const TIMEOUT_MS = 8000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

class Missing extends Error {}

/** Wait until nothing has moved, resized, loaded or spun for QUIET_MS. */
async function settle(page, track) {
  const start = Date.now();
  for (;;) {
    await sleep(50);
    const now = Date.now();
    if (now - start > TIMEOUT_MS) return true;
    let page_ = null;
    try {
      page_ = await page.evaluate(() => {
        const J = window.__jumps;
        return (
          J && {
            last: J.origin + J.last,
            skel: J.visible('[data-skeleton], .skeleton').length,
            status: J.visible('[role=status]').length,
          }
        );
      });
    } catch {
      continue; // navigating
    }
    if (!page_ || page_.skel || page_.status || track.inflight() > 0) continue;
    if (now - Math.max(start, page_.last, track.lastEnd()) >= QUIET_MS)
      return false;
  }
}

/** Watch a page's requests: how many are in flight, when the last ended. */
function trackRequests(page) {
  const reqs = [];
  const open = new Map();
  page.on('request', (r) => {
    if (
      ['image', 'eventsource', 'websocket'].includes(r.resourceType()) ||
      r.url().includes('/api/events')
    )
      return;
    const u = new URL(r.url());
    const rec = {
      start: Date.now(),
      end: null,
      url: (u.pathname + u.search).slice(0, 120),
    };
    open.set(r, rec);
    reqs.push(rec);
  });
  const done = (r) => {
    const rec = open.get(r);
    if (rec) rec.end = Date.now();
    open.delete(r);
  };
  page.on('requestfinished', done);
  page.on('requestfailed', done);
  return {
    reqs,
    inflight: () => open.size,
    lastEnd: () => Math.max(0, ...reqs.map((r) => r.end ?? 0)),
  };
}

/** An element's label as discovery reads it. */
const textOf = (el) =>
  (el.getAttribute('aria-label') || el.innerText || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 50);

async function runOne(browser, app, sc, mode, opts) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  try {
    await ctx.addInitScript({ path: path.join(here, 'probe.js') });
    if (mode === 'slow') {
      await ctx.route(
        (u) =>
          u.pathname.startsWith('/api/') &&
          !u.pathname.startsWith('/api/events'),
        async (route) => {
          if (route.request().resourceType() !== 'image')
            await sleep(opts.slowMs);
          await route.continue().catch(() => {});
        },
      );
    }
    const page = await ctx.newPage();

    const track = trackRequests(page);
    const reqs = track.reqs;

    const cdp = await ctx.newCDPSession(page);
    const frames = [];
    cdp.on('Page.screencastFrame', (f) => {
      frames.push({ ts: f.metadata.timestamp * 1000, data: f.data });
      cdp
        .send('Page.screencastFrameAck', { sessionId: f.sessionId })
        .catch(() => {});
    });

    const steps = sc.steps ?? [];
    let t0;
    let timedOut;
    if (steps.length === 0) {
      await cdp.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 60,
        everyNthFrame: 1,
      });
      t0 = Date.now();
      await page.goto(app + sc.url, { waitUntil: 'commit' });
      timedOut = await settle(page, track);
    } else {
      await page.goto(app + sc.url, { waitUntil: 'commit' });
      await settle(page, track);
      await cdp.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 60,
        everyNthFrame: 1,
      });
      // A reopen opens it, closes it with Escape and opens it again; only the
      // second open is measured (a dialog may refetch each time it mounts).
      const again =
        steps[steps.length - 1]?.item ||
        steps[steps.length - 1]?.role === 'menuitem'
          ? -2
          : -1;
      const plan = sc.reopen
        ? [...steps, { key: 'Escape' }, ...steps.slice(again)]
        : steps;
      for (const [i, step] of plan.entries()) {
        if (step.key) {
          await page.keyboard.press(step.key);
          await settle(page, track);
          continue;
        }
        const target = locate(page, step);
        try {
          await target.waitFor({ state: 'visible', timeout: 4000 });
        } catch {
          throw new Missing(`no ${JSON.stringify(step)} on ${sc.url}`);
        }
        // A step found by its place is checked to still be what it was when
        // discovered, and still not something that changes or removes data.
        if (step.label) {
          const now = await target.evaluate(textOf);
          if (
            !(now.includes(step.label) || step.label.includes(now)) ||
            DESTRUCTIVE.test(now)
          ) {
            throw new Missing(
              `${JSON.stringify(step.label)} is now ${JSON.stringify(now)} on ${sc.url}`,
            );
          }
        }
        if (i === plan.length - 1) t0 = Date.now();
        await target.click({ timeout: 4000 });
        if (i < plan.length - 1) await settle(page, track);
      }
      timedOut = await settle(page, track);
    }
    const end = Date.now();
    await cdp.send('Page.stopScreencast').catch(() => {});
    const raw = await page.evaluate(() =>
      JSON.parse(JSON.stringify(window.__jumps)),
    );
    const log = {
      t0,
      end,
      timedOut,
      origin: raw.origin,
      shifts: raw.shifts,
      sizes: raw.sizes,
      frames: raw.frames,
      swaps: raw.swaps,
      changes: raw.changes,
      reveals: raw.reveals,
      variants: raw.variants,
      requests: reqs,
    };

    // The first frame after t0 worth showing: the first one drawn once
    // something moved, an overlay appeared or a skeleton came up.
    const abs = (t) => raw.origin + t;
    const firstEvents = [
      ...raw.shifts.map((s) => abs(s.t)),
      ...raw.sizes.filter((z) => z.w > 0 && z.h > 0).map((z) => abs(z.t)),
      ...raw.frames.filter((f) => f.skel > 0).map((f) => abs(f.t)),
    ].filter((t) => t >= t0);
    const since = frames.filter((f) => f.ts >= t0);
    const wanted = firstEvents.length ? Math.min(...firstEvents) - 16 : t0;
    const first =
      since.find((f) => f.ts >= wanted) ??
      since[0] ??
      frames[frames.length - 1];
    const settled = await page.screenshot({ type: 'jpeg', quality: 70 });
    return {
      log,
      firstShot: first && Buffer.from(first.data, 'base64'),
      settledShot: settled,
    };
  } finally {
    await ctx.close();
  }
}

/** Open a page, then find what on it opens something: buttons that say they
 *  have a popup or expand, and inside each opened menu the items that are
 *  plain actions. Each becomes a scenario. Nothing is clicked beyond opening. */
// Items that change data or leave the page are not opened; a menu of
// navigation (a list of questions) is sampled, not walked.
const DESTRUCTIVE =
  /delete|remove|reset|clear|erase|discard|sign out|quit|move |turn in|mark |undo|print/i;
const MAX_ITEMS = 5;
const TRIGGERS = 'button[aria-haspopup], button[aria-expanded]';
const MAX_EXPANDERS = 3;

async function discoverOverlays(browser, app, pages) {
  const found = [];
  for (const pg0 of pages) {
    const pg = { ...pg0, name: pg0.name.replace(/, cold load$/, '') };
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    try {
      await ctx.addInitScript({ path: path.join(here, 'probe.js') });
      const page = await ctx.newPage();
      const track = trackRequests(page);
      await page.goto(app + pg.url, { waitUntil: 'commit' });
      await settle(page, track);
      const triggers = await page.evaluate((css) => {
        const seen = new Set();
        const out = [];
        const all = [...document.querySelectorAll(css)];
        for (const el of window.__jumps.visible(css)) {
          const label = (el.getAttribute('aria-label') || el.innerText || '')
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 50);
          if (!label || seen.has(label)) continue;
          seen.add(label);
          const popup = el.getAttribute('aria-haspopup');
          out.push({
            label,
            nth: all.indexOf(el),
            menu: popup === 'menu',
            popup: !!popup && popup !== 'false',
          });
        }
        return out;
      }, TRIGGERS);
      let expanders = 0;
      for (const t of triggers) {
        if (!t.popup && ++expanders > MAX_EXPANDERS) continue;
        // Found again by its place among the page's triggers, not by its name: an
        // accessible name can differ from the text it was labelled by.
        const step = { css: TRIGGERS, nth: t.nth, label: t.label };
        found.push({
          name: `${pg.name}: ${t.label}`,
          label: t.label,
          url: pg.url,
          steps: [step],
        });
        if (!t.menu) continue;
        await page.reload({ waitUntil: 'commit' });
        await settle(page, track);
        try {
          await locate(page, step).click({ timeout: 4000 });
        } catch {
          continue;
        }
        await sleep(300);
        const items = await page.evaluate(() => {
          const all = [...document.querySelectorAll('[role=menuitem]')];
          const visible = window.__jumps.visible('[role=menuitem]');
          return visible.map((el) => ({
            name: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 50),
            nth: all.indexOf(el),
          }));
        });
        const seenItems = new Set();
        const wanted = items.filter(
          (i) =>
            i.name &&
            !DESTRUCTIVE.test(i.name) &&
            !seenItems.has(i.name) &&
            seenItems.add(i.name),
        );
        for (const it of wanted.slice(0, MAX_ITEMS)) {
          found.push({
            name: `${pg.name}: ${t.label} > ${it.name}`,
            label: `${t.label} > ${it.name}`,
            url: pg.url,
            steps: [
              step,
              {
                css: '[role=menuitem]',
                nth: it.nth,
                label: it.name,
                item: true,
              },
            ],
          });
        }
      }
    } finally {
      await ctx.close();
    }
  }
  return found;
}

/** The hand-written scenario a discovered one repeats, by its last two steps. */
const stepKey = (sc) =>
  (sc.steps ?? [])
    .slice(-2)
    .map((s) => s.name ?? s.text ?? s.label ?? s.css)
    .join('>');

async function main() {
  const { values: v } = parseArgs({
    options: {
      url: { type: 'string' },
      runs: { type: 'string', default: '5' },
      'slow-ms': { type: 'string', default: '600' },
      only: { type: 'string' },
      'no-discover': { type: 'boolean' },
      'discover-only': { type: 'boolean' },
      parallel: { type: 'string', default: '1' },
      out: { type: 'string' },
    },
  });
  if (!v.url) throw new Error('--url is required');
  const app = v.url.replace(/\/$/, '');
  const runs = Number(v.runs);
  const slowMs = Number(v['slow-ms']);
  const out = path.resolve(
    v.out ??
      `/tmp/pset-jumps/${new Date().toISOString().replace(/[:.]/g, '-')}`,
  );
  fs.mkdirSync(path.join(out, 'shots'), { recursive: true });
  fs.mkdirSync(path.join(out, 'raw'), { recursive: true });

  const found = await discover(app);
  let list = scenarios(found);
  // --only: the whole string is tried as one slug first, then split on commas.
  const whole = slug(v.only ?? '');
  const pieces = (v.only ?? '').split(',').map(slug).filter(Boolean);
  const only = whole ? [whole, ...pieces] : [];
  const named = (s) => only.length === 0 || only.includes(slug(s.name));
  const known = (o) => list.some((s) => slug(s.name) === o);
  const needDiscovery =
    !v.only || known(whole) ? !v.only : !pieces.every(known);

  const parallel = Math.max(1, Number(v.parallel));
  const browser = await chromium.launch();
  const rows = [];
  try {
    // Vite compiles on first request and may reload once it has found its
    // dependencies; do that before anything is measured.
    for (const sc of list.filter((s) => !s.skip && !s.steps).slice(0, 4)) {
      await runOne(browser, app, sc, 'real', { slowMs }).catch(() => {});
    }
    // --only names a hand-written scenario without discovering; any other name
    // is looked for among the discovered ones.
    if (!v['no-discover'] && (!v.only || v['discover-only'] || needDiscovery)) {
      const handwritten = new Set(list.map(stepKey));
      // With --only, just the pages the discovered scenarios live on.
      const pages = list.filter(
        (s) =>
          !s.skip &&
          !s.steps &&
          (!v.only || /^(Book|Homework set), cold load$/.test(s.name)),
      );
      const extra = (await discoverOverlays(browser, app, pages)).filter(
        (d) => !handwritten.has(stepKey(d)),
      );
      for (const d of extra) list.push({ ...d, discovered: true });
      process.stderr.write(`discovered ${extra.length} overlays\n`);
      if (v['discover-only']) {
        for (const d of extra) console.log(d.name);
        return;
      }
    }
    // The usage dialogs are opened twice: the second open is its own row.
    list = list.flatMap((sc) =>
      sc.twice || (sc.discovered && /usage/i.test(sc.label))
        ? [sc, { ...sc, name: `${sc.name}, second open`, reopen: true }]
        : [sc],
    );
    list = list.filter(named);
    if (list.length === 0)
      throw new Error(
        `no scenario named ${v.only}. Discovery covers only the Book and Homework set pages when --only is given; other discovered scenarios need a run without --only.`,
      );
    // Every (scenario, mode) is a job. Rows are made up front, in order, and
    // `parallel` workers, each with its own Chromium, take jobs as they free.
    // A run's measurements are timed in the page, so sharing the machine
    // slows the runs but does not skew what they record.
    const jobs = [];
    for (const sc of list) {
      for (const mode of ['real', 'slow']) {
        const row = {
          name: sc.name,
          mode,
          url: sc.url,
          trigger: sc.discovered ? sc.label : undefined,
          waits: sc.waits,
          variant: sc.variant,
        };
        rows.push(row);
        if (sc.skip) row.skipped = sc.skip;
        else jobs.push({ sc, mode, row });
      }
    }
    const measure = async (b, { sc, mode, row }) => {
      const results = [];
      for (let i = 0; i < runs; i++) {
        process.stderr.write(`${sc.name} (${mode}) ${i + 1}/${runs}\n`);
        // A run that fails (a click that never lands) is tried once more,
        // then reported as an error rather than ending the audit.
        let r;
        let failure;
        for (let attempt = 0; attempt < 2 && !r; attempt++) {
          try {
            r = await runOne(b, app, sc, mode, { slowMs });
          } catch (e) {
            if (e instanceof Missing) {
              row.skipped = e.message;
              break;
            }
            failure = String(e.message ?? e).split('\n')[0];
          }
        }
        if (row.skipped) break;
        if (!r) {
          row.skipped = `failed twice: ${failure}`;
          break;
        }
        const base = `${slug(sc.name)}-${mode}-${i + 1}`;
        fs.writeFileSync(
          path.join(out, 'raw', `${base}.json`),
          JSON.stringify(r.log),
        );
        if (r.firstShot)
          fs.writeFileSync(
            path.join(out, 'shots', `${base}-first.jpg`),
            r.firstShot,
          );
        fs.writeFileSync(
          path.join(out, 'shots', `${base}-settled.jpg`),
          r.settledShot,
        );
        results.push({ run: i + 1, base, ...analyzeRun(r.log) });
      }
      if (!row.skipped) {
        row.runs = results;
        row.agg = aggregate(results);
      }
    };
    let next = 0;
    const worker = async (b) => {
      while (next < jobs.length) await measure(b, jobs[next++]);
    };
    const extra = [];
    try {
      for (let i = 1; i < parallel; i++) extra.push(await chromium.launch());
      await Promise.all([browser, ...extra].map(worker));
    } finally {
      await Promise.all(extra.map((x) => x.close()));
    }
  } finally {
    await browser.close();
  }
  const meta = {
    app,
    runs,
    slowMs,
    book: found.book?.title,
    set: found.set?.title,
    at: new Date().toISOString(),
  };
  writeReport(out, meta, rows);
  console.log(path.join(out, 'report.md'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
