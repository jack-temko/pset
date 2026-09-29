import katex from 'katex'

/**
 * The math check the server runs (goja, in internal/doc): the web app's
 * own KaTeX, so the server and the browser can never disagree about what
 * parses. Bundled by `npm run build:check` into internal/doc/katex-check.js
 * and embedded in the Go binary.
 *
 * `check` returns KaTeX's message, or "" when the TeX renders. The options
 * are the renderer's own (see MathInline in components/transcript).
 */
export function check(tex: string, display: boolean): string {
  try {
    katex.renderToString(tex, { ...MATH_OPTIONS, displayMode: display, throwOnError: true })
    return ''
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

/** Options shared by the check and the renderer. */
export const MATH_OPTIONS = { strict: 'ignore', output: 'html' } as const

/** The KaTeX version bundled, for the test that ties it to package.json. */
export const version: string = katex.version
