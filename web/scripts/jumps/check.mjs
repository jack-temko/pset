// The jump guard: reads an audit's report.json and fails on any jump.
//
//   node scripts/jumps/check.mjs <report.json | report folder> [--allow allow.json]
//
// A row fails when, in either mode, an overlay changed size by more than 2px
// after opening (median over the runs), the layout shifted by more than 0.001
// (median jump score), or the page never settled (a skeleton or spinner still
// showing at the timeout in any run). A row listed in allow.json is ignored:
// each entry is { scenario, mode?, reason }, with a reason that says why the
// jump is deliberate. A skipped scenario is not a failure but is listed.
// Exits 1 with the offenders and the elements that moved. Spec: ideas/jumps-guard.md.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

export const MAX_GROWTH_PX = 2
export const MAX_JUMP = 0.001

const f = (n, d = 3) => (n === 0 ? '0' : Number(n).toFixed(d))

/** Why a row fails, as a list of readable reasons; empty when it passes. */
export function offences(row) {
  const a = row.agg
  if (!a) return []
  const out = []
  if (a.growthPx.median > MAX_GROWTH_PX) {
    const grew = a.overlays.filter((o) => o.growthPx > 0).map((o) => `${o.name} ${o.first.w}x${o.first.h} to ${o.final.w}x${o.final.h}`)
    out.push(`an overlay grew ${f(a.growthPx.median, 0)}px after opening (limit ${MAX_GROWTH_PX}): ${grew.join('; ')}`)
  }
  if (a.jump.median > MAX_JUMP) {
    const moved = a.moved.slice(0, 3).map((m) => `${m.sel} ${f(m.value)}`)
    out.push(`layout shift ${f(a.jump.median)} (limit ${MAX_JUMP}), moved: ${moved.join(', ') || 'unknown'}`)
  }
  if (a.timeouts > 0) {
    out.push(`never settled in ${a.timeouts} of ${a.runs} runs: ${a.waitedOn || 'something'} was still showing at the timeout`)
  }
  return out
}

const allowed = (row, allow) => allow.find((e) => e.scenario === row.name && (!e.mode || e.mode === row.mode))

/** Sort a report's rows into offenders, allow-listed offenders and skipped. */
export function check(report, allow = []) {
  const failed = []
  const ignored = []
  const skipped = []
  for (const row of report.rows) {
    if (!row.agg) {
      skipped.push(row)
      continue
    }
    const why = offences(row)
    if (why.length === 0) continue
    const entry = allowed(row, allow)
    if (entry) ignored.push({ row, why, reason: entry.reason })
    else failed.push({ row, why })
  }
  return { failed, ignored, skipped }
}

export function format({ failed, ignored, skipped }, total) {
  const lines = []
  for (const s of skipped) lines.push(`skipped: ${s.name} (${s.mode}): ${s.skipped}`)
  for (const { row, why, reason } of ignored) lines.push(`allowed: ${row.name} (${row.mode}): ${reason}${why.map((w) => `\n  ${w}`).join('')}`)
  for (const { row, why } of failed) lines.push(`FAIL: ${row.name} (${row.mode})${row.trigger ? ` [discovered: ${row.trigger}]` : ''}${why.map((w) => `\n  ${w}`).join('')}`)
  lines.push(
    failed.length
      ? `${failed.length} of ${total} rows jump`
      : `no jumps in ${total - skipped.length} rows${skipped.length ? ` (${skipped.length} skipped)` : ''}`,
  )
  return lines.join('\n')
}

function main() {
  const { values: v, positionals } = parseArgs({
    allowPositionals: true,
    options: { allow: { type: 'string', default: path.join(path.dirname(fileURLToPath(import.meta.url)), 'allow.json') } },
  })
  if (positionals.length !== 1) {
    console.error('usage: check.mjs <report.json | report folder> [--allow allow.json]')
    process.exit(2)
  }
  let file = positionals[0]
  if (fs.statSync(file).isDirectory()) file = path.join(file, 'report.json')
  const report = JSON.parse(fs.readFileSync(file, 'utf8'))
  const allow = JSON.parse(fs.readFileSync(v.allow, 'utf8'))
  for (const e of allow) {
    if (!e.scenario || !e.reason) throw new Error(`${v.allow}: every entry needs a scenario and a reason`)
  }
  const result = check(report, allow)
  console.log(format(result, report.rows.length))
  process.exit(result.failed.length ? 1 : 0)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
