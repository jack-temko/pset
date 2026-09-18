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

const STEPS = '0|1|2|3|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|36|40|44|48|52|56|60|64|72|80|96'
const SPACING = String.raw`(?:p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|w|h|min-w|min-h|max-w|max-h|size|top|right|bottom|left|inset|inset-x|inset-y|basis|space-x|space-y|translate-x|translate-y)`

const families = [
  // The step group swallows a trailing .5 (space-y-1.5) so the fractional
  // filter below sees it — a bare integer prefix would read space-y-1.5 as
  // the sanctioned space-y-1 and wave it through. The non-capturing wrapper
  // around STEPS matters: without it the optional decimal binds to the last
  // alternative only, not the whole step list.
  ['spacing', new RegExp(String.raw`(?<![\w-])(-?${SPACING})-((?:${STEPS})(?:\.[05])?|page|section|card)(?![\w-])`, 'g')],
  ['type scale', /(?<![\w-])(text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl))(?![\w-])/g],
  ['radius', /(?<![\w-])(rounded-(?:4xl))(?![\w-])/g],
]
const arbitrary = new RegExp(String.raw`(?<![\w-])${SPACING}-\[[^\]]+\]`, 'g')

const used = new Map()
for (const [family, re] of families) {
  for (const m of src.matchAll(re)) {
    const cls = m[2] ?? m[1]
    if (!used.has(cls)) used.set(cls, family)
  }
}
const fractional = [...used.keys()].filter((c) => /\d\.\d/.test(c))
const arbitraryHits = [...new Set([...src.matchAll(arbitrary)].map((m) => m[0]))]

const missing = [...used.keys()].filter((c) => !css.includes(c))

console.log(`checked ${used.size} distinct theme-dependent utilities`)
console.log(`fractional in use (should be 0): ${fractional.length}`, fractional)
// Informational: pre-existing arbitraries in stock primitives and pages
// awaiting their own re-grill. New spacing/type arbitraries are banned.
console.log(`arbitrary-length utilities (pre-existing, informational): ${arbitraryHits.length}`)
console.log(`missing from built CSS (${missing.length}):`)
for (const c of missing) console.log(`  MISSING: ${c}`)
process.exit(missing.length + fractional.length > 0 ? 1 : 0)
