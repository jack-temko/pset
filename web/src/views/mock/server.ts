import type { Code } from '@/api/gen/httpx'

/**
 * A stand-in for the PSet server, for /views: routes answered from memory.
 *
 * It speaks the server's own shapes. A handler returns the JSON body (or
 * nothing, for a 204) and throws `MockError` to fail as the server does:
 * `{code, message, field?}` with a status, which `api()` turns into the
 * `ApiError` a screen switches on. A path no route answers is a 404 in the
 * same shape, so a view that asks for something a scenario didn't provide
 * fails loudly and never falls through to a real server.
 */
export interface MockRequest {
  method: string
  /** The path without its query. */
  path: string
  params: Record<string, string>
  query: URLSearchParams
  /** The parsed JSON body, if there was one. */
  body: any
  /** The multipart body of an upload. */
  form?: FormData
}

export type Handler = (req: MockRequest) => unknown
export type Route = readonly [method: string, pattern: string, handler: Handler]

export class MockError extends Error {
  readonly status: number
  readonly code: Code
  readonly field?: string

  constructor(status: number, code: Code, message: string, field?: string) {
    super(message)
    this.status = status
    this.code = code
    this.field = field
  }
}

export interface Traffic {
  at: number
  method: string
  path: string
  status: number
}

const segments = (path: string) => path.split('/').filter(Boolean)

/** The params of `path` under `pattern` (`/api/homework/:id`), or null. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const want = segments(pattern)
  const got = segments(path)
  if (want.length !== got.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < want.length; i++) {
    if (want[i].startsWith(':')) params[want[i].slice(1)] = decodeURIComponent(got[i])
    else if (want[i] !== got[i]) return null
  }
  return params
}

type Options = {
  /** Milliseconds every answer waits, or a function of the request. */
  latency?: number | ((req: MockRequest) => number)
  onTraffic?: (t: Traffic) => void
}

export class MockServer {
  private routes: Route[]
  private opts: Options

  constructor(routes: Route[], opts: Options = {}) {
    this.routes = routes
    this.opts = opts
  }

  async handle(method: string, url: string, init?: RequestInit): Promise<Response> {
    const u = new URL(url, 'http://mock.invalid')
    let body: any
    let form: FormData | undefined
    if (init?.body instanceof FormData) form = init.body
    else if (typeof init?.body === 'string' && init.body) body = JSON.parse(init.body)

    let req: MockRequest = { method, path: u.pathname, params: {}, query: u.searchParams, body, form }
    let handler: Handler | undefined
    for (const [m, pattern, h] of this.routes) {
      const params = m === method ? match(pattern, u.pathname) : null
      if (params) {
        req = { ...req, params }
        handler = h
        break
      }
    }

    const wait = typeof this.opts.latency === 'function' ? this.opts.latency(req) : (this.opts.latency ?? 0)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))

    let res: Response
    try {
      if (!handler) throw new MockError(404, 'not_found', `No sample answers ${method} ${u.pathname}.`)
      const out = handler(req)
      res = out === undefined ? new Response(null, { status: 204 }) : json(200, out)
    } catch (e) {
      if (!(e instanceof MockError)) throw e
      res = json(e.status, { code: e.code, message: e.message, ...(e.field && { field: e.field }) })
    }
    this.opts.onTraffic?.({ at: Date.now(), method, path: u.pathname + u.search, status: res.status })
    return res
  }
}

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
