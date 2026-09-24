// Verifies that every theme-dependent utility used in web/src actually
// exists in the built CSS. The Tailwind theme lockdown (--spacing: initial,
// explicit --text-* steps) makes unsanctioned classes fail silently at
// build time; this checker makes them loud.
//
// Usage: node tools/verify-classes.mjs [web/]
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const web = process.argv[2] ?? 'web'
const cssFile = readdirSync(join(web, 'dist/assets')).find((f) => f.endsWith('.css'))
if (!cssFile) {
  console.error('no built CSS found — run `npm run build` first')
  process.exit(1)
}
// Comparisons run backslash-stripped: built CSS escapes variants
// (`sm\:max-w-sm`), source tokens do not.
const css = readFileSync(join(web, 'dist/assets', cssFile), 'utf8').replace(/\\/g, '')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|css)$/.test(name)) out.push(p)
  }
  return out
}
// Comments are stripped before matching — index.css documents the lockdown
// with literal examples like "p-2.5", which would otherwise read as usage.
const src = walk(join(web, 'src'))
  .map((f) => readFileSync(f, 'utf8'))
  .map((s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''))
  .join('\n')

// The scale is whatever index.css defines: numeric steps (--spacing-4) and
// named tokens (--spacing-card). A hard-coded copy drifted once, listing
// steps the theme never had.
const theme = readFileSync(join(web, 'src/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const defined = [...theme.matchAll(/--spacing-([\w-]+)\s*:/g)].map((m) => m[1])
const steps = new Set(defined.filter((t) => /^\d+$/.test(t)))
// Longest first, so control-sm is tried before control.
const named = defined.filter((t) => !steps.has(t)).sort((a, b) => b.length - a.length)
const SPACING = String.raw`(?:p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|w|h|min-w|min-h|max-w|max-h|size|top|right|bottom|left|inset|inset-x|inset-y|basis|space-x|space-y|translate-x|translate-y)`

const families = [
  // Any number is caught, on the scale or not, so a step the theme doesn't
  // define (w-72) is reported rather than skipped; a trailing decimal is
  // caught with it (space-y-1.5) so it can't pass as space-y-1.
  ['spacing', new RegExp(String.raw`(?<![\w-])-?${SPACING}-(?:\d+(?:\.\d+)?|${named.join('|')})(?![\w-])`, 'g')],
  ['type scale', /(?<![\w-])text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)(?![\w-])/g],
  ['radius', /(?<![\w-])rounded-4xl(?![\w-])/g],
]
const arbitrary = new RegExp(String.raw`(?<![\w-])${SPACING}-\[[^\]]+\]`, 'g')

// The whole class is the key. (It once kept only the spacing step, so the
// check below asked whether "72" appeared anywhere in the CSS, which it
// always did.)
const used = new Map()
for (const [family, re] of families) {
  for (const m of src.matchAll(re)) if (!used.has(m[0])) used.set(m[0], family)
}
const fractional = [...used.keys()].filter((c) => /\d\.\d/.test(c))
const offScale = [...used.keys()].filter((c) => {
  const n = used.get(c) === 'spacing' && c.match(/-(\d+)$/)
  return n && !steps.has(n[1])
})
const arbitraryHits = [...new Set([...src.matchAll(arbitrary)].map((m) => m[0]))]

// Present means a rule for exactly this class: a selector ending in it,
// after the dot or a variant's colon. A bare substring passes on anything.
const esc = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const missing = [...used.keys()].filter((c) => !new RegExp(String.raw`[.:]${esc(c)}(?![\w-])`).test(css))

console.log(`checked ${used.size} distinct theme-dependent utilities`)
console.log(`fractional in use (should be 0): ${fractional.length}`, fractional)
console.log(`steps off the scale (should be 0): ${offScale.length}`, offScale)
// Informational: pre-existing arbitraries in stock primitives and pages
// awaiting their own re-grill. New spacing/type arbitraries are banned.
console.log(`arbitrary-length utilities (pre-existing, informational): ${arbitraryHits.length}`)
console.log(`missing from built CSS (${missing.length}):`)
for (const c of missing) console.log(`  MISSING: ${c}`)
process.exit(missing.length + fractional.length + offScale.length > 0 ? 1 : 0)
