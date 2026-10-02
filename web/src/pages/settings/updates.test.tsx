import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Status } from '@/api/update'
import { Updates } from './updates'

// React reads this to know updates are wrapped in act().
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root
let calls: string[]

/** What fetch returns: the parts of a Response the app reads. */
const reply = (status: number, body: unknown) => ({ status, ok: status < 400, json: async () => body }) as unknown as Response

/** The server's answers, by "METHOD path". */
function serve(answers: Record<string, unknown>) {
  calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${path}`
      calls.push(key)
      if (!(key in answers)) return reply(404, { code: 'not_found', message: 'no' })
      return reply(200, answers[key])
    }),
  )
}

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

async function show() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <Updates />
      </QueryClientProvider>,
    )
  })
  await settle()
}
const button = (name: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(name))
const settle = async () => {
  for (let i = 0; i < 5; i++) await act(async () => void (await new Promise((r) => setTimeout(r, 0))))
}
const click = async (el: Element | undefined) => {
  await act(async () => void el?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await settle()
}

const base: Status = { version: '0.1.0', canUpdate: true, busy: 0 }

describe('Updates', () => {
  it('shows the version and asks nobody until Check is pressed', async () => {
    serve({ 'GET /api/update': base })
    await show()
    expect(host.textContent).toContain('PSet 0.1.0')
    expect(host.textContent).toContain('Press Check')
    expect(calls).toEqual(['GET /api/update'])
    expect(button('Update to')).toBeUndefined()
  })

  it('offers the newer version with its notes, and installs it on request', async () => {
    const found: Status = { ...base, checked: { version: '0.2.0', notes: '- a better thing', published: '', newer: true } }
    serve({ 'GET /api/update': base, 'POST /api/update/check': found, 'POST /api/update/apply': { version: '0.2.0', restarting: true } })
    await show()
    await click(button('Check for updates'))
    expect(host.textContent).toContain('PSet 0.2.0 is available.')
    expect(host.textContent).toContain('- a better thing')
    await click(button('Update to 0.2.0'))
    expect(calls).toContain('POST /api/update/apply')
    expect(host.textContent).toContain('PSet is restarting')
  })

  it('says it is up to date, without an Update button', async () => {
    serve({ 'GET /api/update': base, 'POST /api/update/check': { ...base, checked: { version: '0.1.0', notes: '', published: '', newer: false } } })
    await show()
    await click(button('Check for updates'))
    expect(host.textContent).toContain("You're on the newest version.")
    expect(button('Update to')).toBeUndefined()
  })

  it('warns that running jobs resume after the restart', async () => {
    const found: Status = { ...base, busy: 2, checked: { version: '0.2.0', notes: '', published: '', newer: true } }
    serve({ 'GET /api/update': found })
    await show()
    expect(host.textContent).toContain('2 jobs still running or waiting')
  })

  it('says why a build cannot update, and keeps the button off', async () => {
    const found: Status = { ...base, canUpdate: false, why: 'This is a build from source.', checked: { version: '0.2.0', notes: '', published: '', newer: true } }
    serve({ 'GET /api/update': found })
    await show()
    expect(host.textContent).toContain('This is a build from source.')
    expect((button('Update to 0.2.0') as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows what went wrong when GitHub could not be reached', async () => {
    serve({ 'GET /api/update': base })
    vi.mocked(fetch).mockImplementationOnce(async () => reply(200, base))
    await show()
    vi.mocked(fetch).mockImplementationOnce(async () => reply(502, { code: 'unreachable', message: "Couldn't reach GitHub to look for an update." }))
    await click(button('Check for updates'))
    expect(host.textContent).toContain("Couldn't reach GitHub")
  })
})
