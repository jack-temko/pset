import { assets } from '@/api/client'
import type { MockServer } from './server'

/**
 * Points the app's API layer at a mock server for as long as a view is
 * mounted, and returns what puts it back.
 *
 * Every `/api/` call goes to the mock and only there: nothing is forwarded
 * when the mock has no answer (that is a 404, see server.ts). Requests that
 * aren't the API (the dev server's own modules) pass through untouched.
 * Pictures load by URL, not `fetch`, so `assetUrl` maps those to samples.
 */
export function installMock(server: MockServer, assetUrl: (path: string) => string): () => void {
  const real = window.fetch
  const url = assets.url
  window.fetch = (input, init) => {
    const target = new URL(input instanceof Request ? input.url : String(input), location.href)
    if (target.origin === location.origin && target.pathname.startsWith('/api/')) {
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
      return server.handle(method, target.pathname + target.search, init)
    }
    return real(input, init)
  }
  assets.url = assetUrl
  return () => {
    window.fetch = real
    assets.url = url
  }
}
