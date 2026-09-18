import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { StateDef } from './types.ts'

export interface LiveHandle {
  base: string
  /** Seeds the real backend once, the first time a state asks for data. */
  prepare(state: StateDef): Promise<void>
  close(): Promise<void>
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer()
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number }
      probe.close(() => resolvePort(port))
    })
    probe.on('error', reject)
  })
}

async function waitForHealth(base: string, stderrTail: () => string): Promise<void> {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/health`)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await sleep(250)
  }
  throw new Error(`pset did not come up on ${base}; stderr:\n${stderrTail()}`)
}

export function startLive(root: string, binPath: string): Promise<LiveHandle> {
  const build = spawnSync('go', ['build', '-o', binPath, './cmd/pset'], { cwd: root, stdio: 'inherit' })
  if (build.status !== 0) throw new Error(`go build failed with exit ${build.status}`)

  return (async () => {
    const home = await mkdtemp(join(tmpdir(), 'pset-live-'))
    const port = await freePort()
    const base = `http://127.0.0.1:${port}`

    let stderr = ''
    const proc = spawn(binPath, ['--addr', `127.0.0.1:${port}`, '--db', join(home, 'pset.db')], {
      env: { ...process.env, HOME: home },
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk).slice(-4000)
    })
    const stderrTail = () => stderr

    let seeded = false
    let seededBy: string | null = null

    async function seedPaths(paths: string[]): Promise<void> {
      for (const path of paths) {
        const res = await fetch(`${base}/api/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path }),
        })
        if (!res.ok) throw new Error(`import ${path} failed: ${res.status} ${await res.text()}`)
      }
      const deadline = Date.now() + 180_000
      for (;;) {
        const jobs = (await (await fetch(`${base}/api/jobs`)).json()) as {
          jobs: { status: string }[]
        }
        if (!jobs.jobs.some((j) => j.status === 'queued' || j.status === 'running')) return
        if (Date.now() > deadline) throw new Error('import jobs did not drain within 180s')
        await sleep(500)
      }
    }

    await waitForHealth(base, stderrTail)

    return {
      base,
      async prepare(state: StateDef) {
        const paths = state.liveSeed?.importPaths ?? []
        if (seeded && paths.length === 0 && state.liveSeed) {
          throw new Error(
            `state ${state.id} requires an empty library, but the live seed (${seededBy}) already ran; ` +
              'put empty states before seeded ones in the manifest order',
          )
        }
        if (paths.length === 0) return // indifferent, or explicitly empty and not yet seeded
        if (seeded && seededBy !== state.seed) {
          throw new Error(
            `state ${state.id} needs seed ${state.seed}, but ${seededBy} is already applied; ` +
              'run them as separate live invocations',
          )
        }
        if (seeded) return
        await seedPaths(paths)
        seeded = true
        seededBy = state.seed
      },
      async close() {
        proc.kill('SIGTERM')
        const exit = new Promise<void>((done) => proc.once('exit', () => done()))
        await Promise.race([exit, sleep(5000).then(() => proc.kill('SIGKILL'))])
        await rm(home, { recursive: true, force: true }).catch(() => {})
      },
    }
  })()
}
