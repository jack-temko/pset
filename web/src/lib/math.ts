/**
 * The KaTeX options the renderer and the server's check share, so a
 * formula that passes the check renders: `strict: 'ignore'` because the
 * models write a Unicode letter in math now and then, which is not an
 * error. The check (lib/katex-check.ts) throws on any failure; the page
 * shows a failure as its source, never in red.
 */
export const MATH_OPTIONS = { strict: 'ignore', output: 'html' } as const
