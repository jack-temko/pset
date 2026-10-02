import type { Run } from '@/api/gen/doc'

/**
 * Runs as the source the model writes and a person edits: math in
 * `\(..\)`, bold in `**`, italic in `*`. The server splits this back
 * into the same runs (internal/doc/split.go); a page citation is left as
 * `[p. N]` on its PDF page, since a statement, a note or a reading holds
 * none.
 */
export function runsSource(runs: Run[]): string {
  return runs
    .map((r) => {
      if (r.m !== undefined) return r.d ? `\\[${r.m}\\]` : `\\(${r.m}\\)`
      if (r.cite) return r.citeTo ? `[pp. ${r.cite}–${r.citeTo}]` : `[p. ${r.cite}]`
      const t = r.t ?? ''
      if (r.code) return `\`${t}\``
      if (r.b) return `**${t}**`
      if (r.i) return `*${t}*`
      return t
    })
    .join('')
}

/** Runs as bare text, for a label or a tooltip: math as its TeX. */
export function runsText(runs: Run[]): string {
  return runs.map((r) => r.t ?? r.m ?? (r.cite ? `p. ${r.cite}` : '')).join('')
}
