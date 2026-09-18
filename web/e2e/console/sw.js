/* Console network conditioning. Registered by the console page on the app
 * origin; rules come from the console server (source of truth) either via
 * postMessage or rehydrated at startup. In-memory only: closing the browser
 * clears them, and the origin only exists while the console server runs. */

let rules = []

async function rehydrate() {
  try {
    const res = await fetch('/__control/rules', { cache: 'no-store' })
    if (res.ok) rules = (await res.json()).rules ?? []
  } catch {
    // console server not up yet; the page pushes rules once it loads
  }
}

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(rehydrate())
})
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'rules') rules = e.data.rules ?? []
})

// In-memory rules die with the worker; every startup (install or a wake-up
// for any event) refetches them so a terminated worker comes back correct.
rehydrate()

const toRe = (source) => {
  try {
    return new RegExp(source)
  } catch {
    return null
  }
}

async function applyRule(rule, request) {
  switch (rule.kind) {
    case 'slow': {
      await new Promise((r) => setTimeout(r, rule.delayMs || 1500))
      return fetch(request)
    }
    case 'error':
      return new Response(JSON.stringify({ error: rule.message || 'injected failure' }), {
        status: rule.status || 500,
        headers: { 'Content-Type': 'application/json' },
      })
    case 'offline':
    case 'killsse':
      return Response.error()
    case 'hang':
      return new Promise(() => {})
    default:
      return fetch(request)
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/api/')) return
  const rule = rules.find((r) => {
    const re = toRe(r.pattern)
    return re && re.test(url.pathname)
  })
  if (!rule) return
  event.respondWith(applyRule(rule, event.request))
})
