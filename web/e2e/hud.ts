import type { Page } from 'playwright'

export type HudKind = 'action' | 'shot' | 'nav' | 'error' | 'info'
export interface HudLine {
  text: string
  kind: HudKind
}
export type HudLog = (text: string, kind?: HudKind) => void

/**
 * The HUD's in-page renderer, injected via addInitScript on every
 * navigation. This MUST stay a plain string: Playwright serializes
 * function-form init scripts with Function.toString(), and the esbuild
 * transform behind tsx injects __name helpers into nested functions that
 * do not exist in the browser, killing the script at call time. A string
 * is never transformed.
 */
export const hudScriptSource = `
(() => {
  window.__psetHud = {
    render(banner, note, lines) {
      let el = document.getElementById('pset-hud')
      if (!el) {
        el = document.createElement('div')
        el.id = 'pset-hud'
        el.style.cssText =
          'position:fixed;left:16px;bottom:16px;z-index:2147483647;' +
          'background:rgba(13,16,22,.93);color:#e6e9f2;border:1px solid rgba(255,255,255,.09);' +
          'font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;padding:12px 16px;' +
          'border-radius:10px;max-width:480px;pointer-events:none;box-shadow:0 10px 34px rgba(0,0,0,.4)'
        ;(document.body || document.documentElement).appendChild(el)
      }
      el.style.display = ''
      const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      const color = { shot: '#7cc4ff', nav: '#93d29a', error: '#ff9d9d', info: '#b7bfcc', action: '#e6e9f2' }
      el.innerHTML =
        '<div style="font-weight:700;font-size:13px">' + esc(banner) + '</div>' +
        (note ? '<div style="color:#9aa3b2;margin:2px 0 7px;max-width:44ch">' + esc(note) + '</div>' : '') +
        lines.slice(-9).map((l) =>
          '<div style="color:' + (color[l.kind] || '#e6e9f2') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">› ' + esc(l.text) + '</div>'
        ).join('')
    },
  }
})()
`

export async function renderHud(page: Page, banner: string, note: string, lines: HudLine[]): Promise<void> {
  await page
    .evaluate(
      ([b, n, l]) =>
        (window as unknown as { __psetHud: { render(b: string, n: string, l: HudLine[]): void } }).__psetHud.render(b, n, l),
      [banner, note, lines] as const,
    )
    .catch(() => {})
}

const setHudVisibility = (page: Page, visible: boolean): Promise<void> =>
  page
    .evaluate((v) => {
      const el = document.getElementById('pset-hud')
      if (el) el.style.display = v ? '' : 'none'
    }, visible)
    .catch(() => {})

export const hideHud = (page: Page) => setHudVisibility(page, false)
export const showHud = (page: Page) => setHudVisibility(page, true)

// — watch-mode action narration -------------------------------------------------------

const CHAIN = new Set([
  'first', 'last', 'nth', 'locator', 'getByRole', 'getByText', 'getByLabel', 'getByTestId',
  'getByAltText', 'getByPlaceholder', 'getByTitle', 'filter', 'and', 'or',
])
const ACTIONS = new Set([
  'click', 'dblclick', 'hover', 'fill', 'press', 'setInputFiles', 'check', 'uncheck', 'selectOption', 'tap',
])

function summarize(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return `'${a}'`
      if (a instanceof RegExp) return a.toString()
      if (a !== null && typeof a === 'object') {
        return Object.entries(a as Record<string, unknown>)
          .map(([k, v]) => `${k} ${typeof v === 'string' ? `'${v}'` : v instanceof RegExp ? v.toString() : String(v)}`)
          .join(', ')
      }
      return String(a)
    })
    .join(', ')
}

function wrapLocator(loc: unknown, desc: string, log: HudLog): unknown {
  return new Proxy(loc as object, {
    get(target, prop: string | symbol) {
      const value = Reflect.get(target, prop, target)
      if (typeof value !== 'function' || typeof prop === 'symbol') return value
      const fn = value as (...args: unknown[]) => unknown
      return (...args: unknown[]) => {
        const result = fn.apply(target, args)
        if (CHAIN.has(prop)) return wrapLocator(result, `${desc}.${prop}(${summarize(args)})`, log)
        if (ACTIONS.has(prop)) log(`${prop} ${desc}`)
        else if (prop === 'waitFor') log(`wait for ${desc}`)
        return result
      }
    },
  })
}

/** Wraps a Page so every navigation, locator action, and wait narrates itself
 *  to the HUD log. Unknown methods pass through untouched. Watch mode only. */
export function wrapPage(page: Page, log: HudLog): Page {
  return new Proxy(page, {
    get(target, prop: string | symbol) {
      const value = Reflect.get(target, prop, target)
      if (typeof value !== 'function' || typeof prop === 'symbol') return value
      const fn = value as (...args: unknown[]) => unknown
      return (...args: unknown[]) => {
        const result = fn.apply(target, args)
        if (CHAIN.has(prop)) return wrapLocator(result, `${prop}(${summarize(args)})`, log)
        if (prop === 'goto') log(`go to ${summarize(args)}`, 'nav')
        else if (prop === 'waitForFunction') log('wait for page condition')
        else if (prop === 'waitForTimeout') log(`pause ${summarize(args)}`, 'info')
        else if (ACTIONS.has(prop)) log(`${prop} page`)
        return result
      }
    },
  }) as Page
}
