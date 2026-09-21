import type { Code, Error as WireError } from './gen/httpx'

/**
 * Every failed call throws this: the server's `{code, message, field?, id?}`
 * shape, so a screen switches on `code`, shows `message` as written, and
 * marks `field` when there is one.
 */
export class ApiError extends Error {
  readonly code: Code
  readonly field?: string
  readonly id?: string
  readonly status: number

  constructor(status: number, body: WireError) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.field = body.field
    this.id = body.id
  }
}

/** One fetch wrapper for the whole app. JSON in, JSON out; 204 is
 *  `undefined`. A server that doesn't answer at all is `unreachable`. */
export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, { code: 'unreachable', message: "PSet's server isn't answering." })
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data && typeof data.code === 'string'
        ? data
        : { code: 'internal', message: `The server answered ${res.status}.` },
    )
  }
  return data as T
}

export const get = <T>(path: string) => api<T>('GET', path)
export const post = <T>(path: string, body?: unknown) => api<T>('POST', path, body)
export const put = <T>(path: string, body?: unknown) => api<T>('PUT', path, body)
export const patch = <T>(path: string, body?: unknown) => api<T>('PATCH', path, body)
export const del = <T>(path: string) => api<T>('DELETE', path)
