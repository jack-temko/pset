import { spawnSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { chromium } from 'playwright'

import { writeGallery } from './gallery.ts'
import { hideHud, hudScriptSource, renderHud, showHud, wrapPage, type HudKind, type HudLine } from './hud.ts'
import { startLive } from './live.ts'
import { startMockServer } from './mock/server.ts'
import { getSeed } from './seeds/index.ts'
import { repoRoot, states } from './states.ts'
import type { Mode, NetworkCondition, StateDef, StateResult, Step, Theme } from './types.ts'

interface Args {
  filters: string[]
  mode: Mode
  theme: Theme | 'both'
  watch: boolean
  noBuild: boolean
  viewport?: { width: number; height: number }
}

function parseArgs(argv: string[]): Args {
  const args: Args = { filters: [], mode: 'mock', theme: 'both', watch: false, noBuild: false }
  for (const arg of argv) {
    if (arg === '--watch') args.watch = true
    else if (arg === '--no-build') args.noBuild = true
    else if (arg.startsWith('--viewport=')) {
      const [w, h] = arg.split('=')[1].split('x').map(Number)
      if (!w || !h) {
        console.error('bad --viewport, use WxH like 1440x900')
        process.exit(2)
      }
      args.viewport = { width: w, height: h }
    } else if (arg === '--mode=mock' || arg === '--mode=live') args.mode = arg.split('=')[1] as Mode
    else if (arg === '--theme=light' || arg === '--theme=dark' || arg === '--theme=both')
      args.theme = arg.split('=')[1] as Theme | 'both'
    else if (arg === '--help') {
      console.log(`usage: npm run visual -- [filters...] [--mode=mock|live] [--theme=light|dark|both] [--viewport=WxH] [--watch] [--no-build]

  filters    substring match against state id, title, and tags (OR)
  --watch    headed browser at human pace; the gallery is still written
  --viewport WxH browser viewport, default 1440x900
  --no-build reuse web/dist and the last go build as they are`)
      process.exit(0)
    } else if (arg.startsWith('--')) {
      console.error(`unknown flag: ${arg} (see --help)`)
      process.exit(2)
    } else args.filters.push(arg)
  }
  return args
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const sanitize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

function buildWebDist(): void {
  console.log('building web/dist...')
  const build = spawnSync('npm', ['run', 'build'], { cwd: join(repoRoot, 'web'), stdio: 'inherit' })
  if (build.status !== 0) throw new Error('web build failed')
}

function selectStates(args: Args): StateDef[] {
  const plan = states.filter((s) => {
    if (!(s.modes ?? ['mock', 'live']).includes(args.mode)) return false
    if (args.filters.length === 0) return true
    const haystack = [s.id, s.title, ...(s.tags ?? [])].join(' ').toLowerCase()
    return args.filters.some((f) => haystack.includes(f.toLowerCase()))
  })
  return plan
}

function networkHandler(condition: NetworkCondition) {
  return async (route: import('playwright').Route): Promise<void> => {
    switch (condition.kind) {
      case 'offline':
        return route.abort()
      case 'error':
        return route.fulfill({
          status: condition.status ?? 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'injected network failure' }),
        })
      case 'hang':
        return // neither continue nor fulfill: the request stays pending
      case 'slow':
        await sleep(condition.delayMs ?? 1500)
        return route.continue()
    }
  }
}

async function runStep(step: Step, ctx: import('./types.ts').RunCtx): Promise<void> {
  if ('shot' in step) return
  await step.run(ctx)
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const plan = selectStates(args)
  if (plan.length === 0) {
    console.error(`no states match: ${args.filters.join(' ')} in ${args.mode} mode`)
    process.exit(2)
  }
  const themes: Theme[] = args.theme === 'both' ? ['light', 'dark'] : [args.theme]

  const distDir = join(repoRoot, 'web', 'dist')
  if (!args.noBuild) buildWebDist()

  const runId = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const runDir = join(repoRoot, 'web', 'e2e', 'artifacts', `${runId}-${args.mode}`)
  await mkdir(join(runDir, 'png'), { recursive: true })

  const mock = args.mode === 'mock' ? await startMockServer(distDir) : null
  const live = args.mode === 'live' ? await startLive(repoRoot, join(runDir, 'pset-live')) : null
  const base = mock ? `http://127.0.0.1:${mock.port}` : live!.base

  console.log(`${args.mode} mode on ${base}; ${plan.length} state(s) x ${themes.length} theme(s)`)

  const browser = await chromium.launch({
    headless: !args.watch,
    slowMo: args.watch ? 400 : 0,
  })
  const results: StateResult[] = []
  let failures = 0

  try {
    for (const [stateIndex, state] of plan.entries()) {
      if (live) await live.prepare(state)
      for (const theme of themes) {
        if (mock) mock.apply(getSeed(state.seed), state.mock ?? {})
        const context = await browser.newContext({
          viewport: args.viewport ?? { width: 1440, height: 900 },
          deviceScaleFactor: 2,
          colorScheme: theme,
          // Stills must be settled: headless runs suppress motion (the app's
          // transitions honour motion-safe) so a shot never catches a panel
          // mid-growth. Watch mode keeps real motion — that is its point.
          reducedMotion: args.watch ? 'no-preference' : 'reduce',
        })
        await context.addInitScript(`localStorage.setItem('pset-theme', '${theme}')`)
        if (args.watch) await context.addInitScript(hudScriptSource)
        if (state.network) await context.route(state.network.pattern ?? '**/api/**', networkHandler(state.network))

        const page = await context.newPage()
        const consoleErrors: string[] = []
        const hudLines: HudLine[] = []
        const hud = (text: string, kind: HudKind = 'action') => {
          hudLines.push({ text, kind })
        }
        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            consoleErrors.push(msg.text())
            if (args.watch) hud(`console: ${msg.text().slice(0, 90)}`, 'error')
          }
        })
        page.on('pageerror', (err) => {
          consoleErrors.push(`pageerror: ${err.message}`)
          if (args.watch) hud(`pageerror: ${err.message.slice(0, 90)}`, 'error')
        })

        const result: StateResult = {
          stateId: state.id,
          page: state.page,
          title: state.title,
          note: state.note,
          tags: state.tags ?? [],
          seed: state.seed,
          mock: state.mock ?? {},
          network: state.network,
          modes: state.modes ?? ['mock', 'live'],
          theme,
          mode: args.mode,
          shots: [],
          consoleErrors,
          durationMs: 0,
        }
        const startedAt = Date.now()
        const driven = args.watch ? wrapPage(page, hud) : page
        const ctx = { page: driven, base, mode: args.mode, goto: (path: string) => page.goto(base + path) }
        const banner = `${stateIndex + 1}/${plan.length} · ${state.id} [${theme}]`
        if (args.watch) {
          hud('state starting', 'info')
          await renderHud(page, banner, state.note, hudLines)
          await sleep(1000)
        }
        try {
          for (const step of state.steps) {
            if ('shot' in step) {
              if (args.watch) {
                hud(`camera: ${step.shot}`, 'shot')
                await renderHud(page, banner, state.note, hudLines)
                await sleep(1500)
                await hideHud(page)
              }
              const file = `${sanitize(state.id)}--${sanitize(step.shot)}--${theme}.png`
              await page.screenshot({ path: join(runDir, 'png', file) })
              result.shots.push({ name: step.shot, theme, file })
              if (args.watch) await showHud(page)
            } else {
              await runStep(step, ctx)
              if (args.watch) {
                await renderHud(page, banner, state.note, hudLines)
                await sleep(650)
              }
            }
          }
        } catch (err) {
          result.error = err instanceof Error ? err.message : String(err)
          if (args.watch) {
            hud(result.error, 'error')
            await renderHud(page, banner, state.note, hudLines)
          }
        }
        result.durationMs = Date.now() - startedAt
        results.push(result)
        const status = result.error ? 'FAIL' : 'ok'
        if (result.error) failures++
        console.log(
          `  ${status.padEnd(4)} ${state.id} [${theme}] ${result.shots.length} shot(s)` +
            `${result.error ? ` | ${result.error}` : ''}${consoleErrors.length ? ` | ${consoleErrors.length} console error(s)` : ''}`,
        )
        await context.close()
      }
    }
  } finally {
    await browser.close()
    await mock?.close()
    await live?.close()
  }

  const gallery = await writeGallery(runDir, { runId, mode: args.mode, themes, filters: args.filters, watch: args.watch, createdAt: new Date().toISOString() }, results)
  console.log(`\n${failures} failed, ${results.length - failures} passed`)
  console.log(`gallery: ${gallery}`)
  process.exitCode = failures > 0 ? 1 : 0
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
