// The layout-jump audit's CLI: drives the app in Chromium, each scenario real
// and slow, and writes the report. See ideas/layout-jumps.md.
//
//   node scripts/jumps/run.mjs --url http://localhost:5180 [--runs 5]
//        [--slow-ms 600] [--only <scenario>] [--out <dir>]
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

import { aggregate, analyzeRun } from './analyze.mjs'
import { writeReport } from './report.mjs'
import { discover, locate, scenarios } from './scenarios.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const QUIET_MS = 750
const TIMEOUT_MS = 8000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

class Missing extends Error {}

/** Wait until nothing has moved, resized, loaded or spun for QUIET_MS. */
async function settle(page, track) {
  const start = Date.now()
  for (;;) {
    await sleep(50)
    const now = Date.now()
    if (now - start > TIMEOUT_MS) return true
    let page_ = null
    try {
      page_ = await page.evaluate(() => {
        const J = window.__jumps
        return J && { last: J.origin + J.last, skel: J.visible('[data-skeleton], .skeleton').length, status: J.visible('[role=status]').length }
      })
    } catch {
      continue // navigating
    }
    if (!page_ || page_.skel || page_.status || track.inflight() > 0) continue
    if (now - Math.max(start, page_.last, track.lastEnd()) >= QUIET_MS) return false
  }
}

async function runOne(browser, app, sc, mode, opts) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  try {
    await ctx.addInitScript({ path: path.join(here, 'probe.js') })
    if (mode === 'slow') {
      await ctx.route(
        (u) => u.pathname.startsWith('/api/') && !u.pathname.startsWith('/api/events'),
        async (route) => {
          if (route.request().resourceType() !== 'image') await sleep(opts.slowMs)
          await route.continue().catch(() => {})
        },
      )
    }
    const page = await ctx.newPage()

    const reqs = []
    const open = new Map()
    page.on('request', (r) => {
      if (['image', 'eventsource', 'websocket'].includes(r.resourceType()) || r.url().includes('/api/events')) return
      const u = new URL(r.url())
      const rec = { start: Date.now(), end: null, url: (u.pathname + u.search).slice(0, 120) }
      open.set(r, rec)
      reqs.push(rec)
    })
    const done = (r) => {
      const rec = open.get(r)
      if (rec) rec.end = Date.now()
      open.delete(r)
    }
    page.on('requestfinished', done)
    page.on('requestfailed', done)
    const track = {
      inflight: () => open.size,
      lastEnd: () => Math.max(0, ...reqs.map((r) => r.end ?? 0)),
    }

    const cdp = await ctx.newCDPSession(page)
    const frames = []
    cdp.on('Page.screencastFrame', (f) => {
      frames.push({ ts: f.metadata.timestamp * 1000, data: f.data })
      cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
    })

    const steps = sc.steps ?? []
    let t0
    let timedOut
    if (steps.length === 0) {
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, everyNthFrame: 1 })
      t0 = Date.now()
      await page.goto(app + sc.url, { waitUntil: 'commit' })
      timedOut = await settle(page, track)
    } else {
      await page.goto(app + sc.url, { waitUntil: 'commit' })
      await settle(page, track)
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, everyNthFrame: 1 })
      for (const [i, step] of steps.entries()) {
        const target = locate(page, step)
        try {
          await target.waitFor({ state: 'visible', timeout: 4000 })
        } catch {
          throw new Missing(`no ${JSON.stringify(step)} on ${sc.url}`)
        }
        if (i === steps.length - 1) t0 = Date.now()
        await target.click({ timeout: 4000 })
        if (i < steps.length - 1) await settle(page, track)
      }
      timedOut = await settle(page, track)
    }
    const end = Date.now()
    await cdp.send('Page.stopScreencast').catch(() => {})
    const raw = await page.evaluate(() => JSON.parse(JSON.stringify(window.__jumps)))
    const log = {
      t0,
      end,
      timedOut,
      origin: raw.origin,
      shifts: raw.shifts,
      sizes: raw.sizes,
      frames: raw.frames,
      requests: reqs,
    }

    // The first frame after t0 worth showing: the first one drawn once
    // something moved, an overlay appeared or a skeleton came up.
    const abs = (t) => raw.origin + t
    const firstEvents = [
      ...raw.shifts.map((s) => abs(s.t)),
      ...raw.sizes.filter((z) => z.w > 0 && z.h > 0).map((z) => abs(z.t)),
      ...raw.frames.filter((f) => f.skel > 0).map((f) => abs(f.t)),
    ].filter((t) => t >= t0)
    const since = frames.filter((f) => f.ts >= t0)
    const wanted = firstEvents.length ? Math.min(...firstEvents) - 16 : t0
    const first = since.find((f) => f.ts >= wanted) ?? since[0] ?? frames[frames.length - 1]
    const settled = await page.screenshot({ type: 'jpeg', quality: 70 })
    return { log, firstShot: first && Buffer.from(first.data, 'base64'), settledShot: settled }
  } finally {
    await ctx.close()
  }
}

/** Open a page, then find what on it opens something: buttons that say they
 *  have a popup or expand, and inside each opened menu the items that are
 *  plain actions. Each becomes a scenario. Nothing is clicked beyond opening. */
const DESTRUCTIVE = /delete|remove|reset|clear|erase|discard|sign out|quit/i
const TRIGGERS = 'button[aria-haspopup], button[aria-expanded]'
const MAX_EXPANDERS = 8

async function discoverOverlays(browser, app, pages) {
  const found = []
  for (const pg0 of pages) {
    const pg = { ...pg0, name: pg0.name.replace(/, cold load$/, '') }
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    try {
      await ctx.addInitScript({ path: path.join(here, 'probe.js') })
      const page = await ctx.newPage()
      const track = { inflight: () => 0, lastEnd: () => 0 }
      await page.goto(app + pg.url, { waitUntil: 'commit' })
      await settle(page, track)
      const triggers = await page.evaluate((css) => {
        const seen = new Set()
        const out = []
        for (const el of window.__jumps.visible(css)) {
          const label = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50)
          if (!label || seen.has(label)) continue
          seen.add(label)
          out.push({ label, menu: el.getAttribute('aria-haspopup') === 'menu' })
        }
        return out
      }, TRIGGERS)
      let expanders = 0
      for (const t of triggers) {
        if (!t.menu && ++expanders > MAX_EXPANDERS) continue
        const step = { role: 'button', name: t.label }
        found.push({ name: `${pg.name}: ${t.label}`, label: t.label, url: pg.url, steps: [step] })
        if (!t.menu) continue
        await page.reload({ waitUntil: 'commit' })
        await settle(page, track)
        try {
          await locate(page, step).click({ timeout: 4000 })
        } catch {
          continue
        }
        await sleep(300)
        const items = await page.evaluate(() =>
          window.__jumps.visible('[role=menuitem]').map((el) => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50)),
        )
        for (const name of [...new Set(items)]) {
          if (!name || DESTRUCTIVE.test(name)) continue
          found.push({
            name: `${pg.name}: ${t.label} > ${name}`,
            label: `${t.label} > ${name}`,
            url: pg.url,
            steps: [step, { role: 'menuitem', name }],
          })
        }
      }
    } finally {
      await ctx.close()
    }
  }
  return found
}

/** The hand-written scenario a discovered one repeats, by its last two steps. */
const stepKey = (sc) => (sc.steps ?? []).slice(-2).map((s) => s.name ?? s.text ?? s.css).join('>')

async function main() {
  const { values: v } = parseArgs({
    options: {
      url: { type: 'string' },
      runs: { type: 'string', default: '5' },
      'slow-ms': { type: 'string', default: '600' },
      only: { type: 'string' },
      'no-discover': { type: 'boolean' },
      out: { type: 'string' },
    },
  })
  if (!v.url) throw new Error('--url is required')
  const app = v.url.replace(/\/$/, '')
  const runs = Number(v.runs)
  const slowMs = Number(v['slow-ms'])
  const out = path.resolve(v.out ?? `/tmp/pset-jumps/${new Date().toISOString().replace(/[:.]/g, '-')}`)
  fs.mkdirSync(path.join(out, 'shots'), { recursive: true })
  fs.mkdirSync(path.join(out, 'raw'), { recursive: true })

  const found = await discover(app)
  let list = scenarios(found)
  if (v.only) list = list.filter((s) => s.name === v.only || slug(s.name) === slug(v.only))
  if (list.length === 0) throw new Error(`no scenario named ${v.only}`)

  const browser = await chromium.launch()
  const rows = []
  try {
    // Vite compiles on first request and may reload once it has found its
    // dependencies; do that before anything is measured.
    for (const sc of list.filter((s) => !s.skip && !s.steps).slice(0, 4)) {
      await runOne(browser, app, sc, 'real', { slowMs }).catch(() => {})
    }
    if (!v['no-discover'] && !v.only) {
      const handwritten = new Set(list.map(stepKey))
      const pages = list.filter((s) => !s.skip && !s.steps)
      const extra = (await discoverOverlays(browser, app, pages)).filter((d) => !handwritten.has(stepKey(d)))
      for (const d of extra) list.push({ ...d, discovered: true })
      process.stderr.write(`discovered ${extra.length} overlays\n`)
    }
    for (const sc of list) {
      for (const mode of ['real', 'slow']) {
        const row = { name: sc.name, mode, url: sc.url, trigger: sc.discovered ? sc.label : undefined }
        rows.push(row)
        if (sc.skip) {
          row.skipped = sc.skip
          continue
        }
        const results = []
        for (let i = 0; i < runs; i++) {
          process.stderr.write(`${sc.name} (${mode}) ${i + 1}/${runs}\n`)
          // A run that fails (a click that never lands) is tried once more,
          // then reported as an error rather than ending the audit.
          let r
          let failure
          for (let attempt = 0; attempt < 2 && !r; attempt++) {
            try {
              r = await runOne(browser, app, sc, mode, { slowMs })
            } catch (e) {
              if (e instanceof Missing) {
                row.skipped = e.message
                break
              }
              failure = String(e.message ?? e).split('\n')[0]
            }
          }
          if (row.skipped) break
          if (!r) {
            row.skipped = `failed twice: ${failure}`
            break
          }
          const base = `${slug(sc.name)}-${mode}-${i + 1}`
          fs.writeFileSync(path.join(out, 'raw', `${base}.json`), JSON.stringify(r.log))
          if (r.firstShot) fs.writeFileSync(path.join(out, 'shots', `${base}-first.jpg`), r.firstShot)
          fs.writeFileSync(path.join(out, 'shots', `${base}-settled.jpg`), r.settledShot)
          results.push({ run: i + 1, base, ...analyzeRun(r.log) })
        }
        if (!row.skipped) {
          row.runs = results
          row.agg = aggregate(results)
        }
      }
    }
  } finally {
    await browser.close()
  }
  const meta = { app, runs, slowMs, book: found.book?.title, set: found.set?.title, at: new Date().toISOString() }
  writeReport(out, meta, rows)
  console.log(path.join(out, 'report.md'))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
