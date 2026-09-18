import { spawn, spawnSync } from 'node:child_process'
import { readdir, readFile, stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { basename, dirname, extname, join, resolve, sep } from 'node:path'

import { json, readBody, startMockServer } from './mock/server.ts'
import { getSeed } from './seeds/index.ts'
import { repoRoot, states } from './states.ts'
import type { MockScript } from './types.ts'

const PORT = 8431
const e2eDir = join(repoRoot, 'web', 'e2e')
const consoleDir = join(e2eDir, 'console')
const distDir = join(repoRoot, 'web', 'dist')
const artifactsDir = join(e2eDir, 'artifacts')

interface NetRule {
  id: string
  kind: 'slow' | 'offline' | 'error' | 'hang' | 'killsse'
  /** regex source tested against the request path, e.g. ^/api/books */
  pattern: string
  delayMs?: number
  status?: number
}

interface ShotInfo {
  name: string
  theme: string
  file: string
  url: string
}

interface RunInfo {
  kind: 'capture' | 'replay'
  id: string
  lines: string[]
  done: boolean
  exitCode: number | null
  galleryPath?: string
  galleryUrl?: string
  shots?: ShotInfo[]
}

let rules: NetRule[] = []
let staged: { stateId: string | null; seed: string; script: MockScript } = {
  stateId: null,
  seed: '',
  script: {},
}
let run: RunInfo | null = null

const sanitize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

function buildDist(): void {
  console.log('building web/dist...')
  const build = spawnSync('npm', ['run', 'build'], { cwd: join(repoRoot, 'web'), stdio: 'inherit' })
  if (build.status !== 0) throw new Error('web build failed')
}

/** Spawns the runner as a child of the console so capture/replay buttons
 *  work without leaving the page. One run at a time. */
function startRunner(kind: 'capture' | 'replay', id: string, args: string[]): boolean {
  if (run && !run.done) return false
  console.log(`[run] ${kind} ${id} args: ${args.join(' ')}`)
  run = { kind, id, lines: [], done: false, exitCode: null }
  const proc = spawn('npm', ['run', 'visual', '--', ...args], { cwd: e2eDir })
  const push = (chunk: Buffer) => {
    if (!run) return
    run.lines.push(...chunk.toString().split('\n').filter(Boolean))
    if (run.lines.length > 400) run.lines.splice(0, run.lines.length - 400)
  }
  proc.stdout.on('data', push)
  proc.stderr.on('data', push)
  void proc.on('exit', async (code) => {
    if (!run) return
    run.exitCode = code ?? 1
    if (kind === 'capture') {
      const line = run.lines.find((l) => l.startsWith('gallery: '))
      if (line) {
        const runDir = dirname(line.slice('gallery: '.length).trim())
        run.galleryPath = runDir
        run.galleryUrl = `/__artifacts/${basename(runDir)}/gallery.html`
        try {
          run.shots = await collectShots(runDir, id)
        } catch {
          run.shots = []
        }
      }
    }
    run.done = true
  })
  return true
}

async function collectShots(galleryPath: string, stateId: string): Promise<ShotInfo[]> {
  const prefix = `${sanitize(stateId)}--`
  const dir = join(galleryPath, 'png')
  const files = (await readdir(dir)).filter((f) => f.startsWith(prefix) && f.endsWith('.png'))
  return files.map((file) => {
    const rest = file.slice(prefix.length, -'.png'.length)
    const idx = rest.lastIndexOf('--')
    return {
      name: rest.slice(0, idx),
      theme: rest.slice(idx + 2),
      file,
      url: `/__artifacts/${basename(galleryPath)}/png/${file}`,
    }
  })
}

function serveFile(res: ServerResponse, file: string): Promise<void> {
  return readFile(file)
    .then((buf) => {
      // no-cache: the console front-end must never shadow-stale a copy
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' })
      res.end(buf)
    })
    .catch(() => {
      res.writeHead(404)
      res.end()
    })
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.txt': 'text/plain',
}

const extraRoutes = async (req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> => {
  const path = url.pathname

  if (path === '/__control') {
    await serveFile(res, join(consoleDir, 'index.html'))
    return true
  }
  if (path === '/__control/app.js') {
    await serveFile(res, join(consoleDir, 'app.js'))
    return true
  }
  if (path === '/__sw.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript', 'Service-Worker-Allowed': '/' })
    res.end(await readFile(join(consoleDir, 'sw.js')))
    return true
  }
  if (path.startsWith('/__artifacts/')) {
    const rel = resolve(join(artifactsDir, decodeURIComponent(path.slice('/__artifacts/'.length))))
    if (!rel.startsWith(artifactsDir + sep)) {
      res.writeHead(404)
      res.end()
      return true
    }
    await serveFile(res, rel)
    return true
  }

  if (path === '/__control/states' && req.method === 'GET') {
    json(res, 200, {
      states: states.map((s) => ({
        id: s.id,
        page: s.page,
        title: s.title,
        note: s.note,
        tags: s.tags ?? [],
        kind: s.kind ?? 'state',
        entry: s.entry ?? '/',
        seed: s.seed,
        mock: s.mock ?? {},
        modes: s.modes ?? ['mock', 'live'],
      })),
    })
    return true
  }

  if (path === '/__control/load' && req.method === 'POST') {
    const { id } = JSON.parse(await readBody(req)) as { id: string }
    const state = states.find((s) => s.id === id)
    if (!state) {
      json(res, 404, { error: `unknown state ${id}` })
      return true
    }
    const script = state.mock ?? {}
    mock.apply(getSeed(state.seed), script)
    staged = { stateId: state.id, seed: state.seed, script }
    json(res, 200, { ok: true, seed: state.seed, script })
    return true
  }

  if (path === '/__control/script-clear' && req.method === 'POST') {
    staged.script = {}
    if (staged.seed) mock.apply(getSeed(staged.seed), {})
    json(res, 200, { ok: true, seed: staged.seed, script: staged.script })
    return true
  }

  if (path === '/__control/rules' && req.method === 'GET') {
    json(res, 200, { rules })
    return true
  }
  if (path === '/__control/rules' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req)) as { rules: NetRule[] }
    rules = Array.isArray(body.rules) ? body.rules : []
    json(res, 200, { ok: true, rules })
    return true
  }

  if (path === '/__control/capture' && req.method === 'POST') {
    const { id } = JSON.parse(await readBody(req)) as { id: string }
    const state = states.find((s) => s.id === id)
    if (!state || (state.kind ?? 'state') !== 'state') {
      json(res, 400, { error: `not a state: ${id}` })
      return true
    }
    if (!startRunner('capture', id, [id, '--theme=both', '--no-build'])) {
      json(res, 409, { error: 'a run is already active' })
      return true
    }
    json(res, 200, { ok: true })
    return true
  }

  if (path === '/__control/replay' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req)) as { id: string; viewport?: string; theme?: string }
    const state = states.find((s) => s.id === body.id)
    if (!state || state.kind !== 'flow') {
      json(res, 400, { error: `not a flow: ${body.id}` })
      return true
    }
    const args = ['--watch', '--no-build', body.id]
    if (body.theme && body.theme !== 'both') args.push(`--theme=${body.theme}`)
    if (body.viewport) args.push(`--viewport=${body.viewport}`)
    if (!startRunner('replay', body.id, args)) {
      json(res, 409, { error: 'a run is already active' })
      return true
    }
    json(res, 200, { ok: true })
    return true
  }

  if (path === '/__control/run' && req.method === 'GET') {
    if (!run) {
      json(res, 200, { running: false })
      return true
    }
    json(res, 200, {
      running: !run.done,
      kind: run.kind,
      id: run.id,
      done: run.done,
      exitCode: run.exitCode,
      lines: run.lines.slice(-40),
      galleryUrl: run.galleryUrl,
      shots: run.shots,
    })
    return true
  }

  if (path === '/__control/rebuild' && req.method === 'POST') {
    if (run && !run.done) {
      json(res, 409, { error: 'a run is active' })
      return true
    }
    buildDist()
    json(res, 200, { ok: true })
    return true
  }

  return false
}

let mock: Awaited<ReturnType<typeof startMockServer>>

async function main(): Promise<void> {
  buildDist()
  mock = await startMockServer(distDir, extraRoutes, PORT).catch((err) => {
    throw new Error(`cannot listen on ${PORT} (another console running?): ${err}`)
  })
  // The mock answers /api from this data; stage something sane before any
  // iframe loads.
  mock.apply(getSeed('library:empty'), {})

  console.log(`console on http://127.0.0.1:${PORT}/__control`)
  const shutdown = () => {
    void mock.close().then(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
