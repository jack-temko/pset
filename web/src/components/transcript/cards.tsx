import { useEffect, useRef, useState, type ReactNode } from 'react'
import katex from 'katex'

import { cn } from '@/lib/utils'

import { PageRef } from './index'

/**
 * The answer's richer pieces, and a deliberately short list. Three cards
 * for the three things a student asks that prose does badly, and two
 * plain blocks:
 *
 * - `Statement`: what the book says, as the book numbers it.
 * - `WorkedSteps`: how to do it, one line of math per step.
 * - `Plot`: what it looks like.
 * - `AnswerTable`: how things compare.
 * - `CodeBlock`: for the programming books on the shelf.
 *
 * Everything else is prose with math and page chips. Spec:
 * design/workspace.md.
 */

function tex(src: string) {
  return katex.renderToString(src, { throwOnError: false })
}

/**
 * A definition, theorem or lemma, quoted as the book prints it: its kind
 * and number, an optional name, and a page chip to go and read it in
 * place. The card is the book speaking, so it gets the book's frame: a
 * header band like a Box, the statement below.
 */
export function Statement({
  kind,
  number,
  name,
  page,
  onJump,
  children,
}: {
  kind: string
  number: string
  name?: string
  page: number
  onJump?: (page: number) => void
  children: ReactNode
}) {
  return (
    <figure className="overflow-hidden rounded-md border bg-card">
      <figcaption className="flex min-h-row items-center justify-between gap-3 border-b bg-card-header px-card py-2 text-xs">
        <span className="min-w-0 truncate">
          <span className="font-semibold text-foreground">
            {kind} {number}
          </span>
          {name && <span className="text-muted-foreground">: {name}</span>}
        </span>
        <PageRef page={page} onJump={onJump} />
      </figcaption>
      <div className="space-y-2 p-card text-base">{children}</div>
    </figure>
  )
}

/**
 * A derivation, all of it shown, numbered. One line of math per step,
 * each with a short note on why when the move isn't obvious. It's an
 * answer, not practice: the walkthrough is where things are hidden.
 */
export function WorkedSteps({ steps }: { steps: { math: string; why?: string }[] }) {
  return (
    <ol className="divide-y divide-border-muted overflow-hidden rounded-md border bg-card">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 px-card py-2">
          <span className="w-4 shrink-0 pt-1 text-right font-mono text-xs text-muted-foreground tabular-nums">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            {/* No scroll wrapper: an overflow container clips tall glyphs
                like an integral and shows a scrollbar. Inline KaTeX breaks
                a long line at = and + instead. */}
            <div dangerouslySetInnerHTML={{ __html: tex(`\\displaystyle ${s.math}`) }} />
            {s.why && <p className="text-xs text-muted-foreground">{s.why}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Round, readable ticks: 1, 2 or 5 times a power of ten. */
function ticks(min: number, max: number, count = 5): number[] {
  const span = max - min || 1
  const raw = span / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw
  // From the step at or below the minimum to the step at or above the
  // maximum, so the data always sits inside the axis.
  const out: number[] = []
  const hi = Math.ceil(max / step - 1e-9) * step
  for (let v = Math.floor(min / step + 1e-9) * step; v <= hi + step / 1e6; v += step)
    out.push(Math.round(v / step) * step)
  return out
}

const fmt = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : +n.toFixed(2)).toLocaleString()

/**
 * One or two functions on shared axes: what it looks like.
 *
 * Built to the chart rules: one y-axis, never two; series take chart-1
 * then chart-2 in that order (both validated against the card in both
 * themes); 2px lines with round caps; hairline grid in `border-muted`;
 * text in text tokens, never the series colour. Two series get a legend
 * and nothing on the lines themselves: in a 400px panel end labels
 * collided with the legend and the title, and the key is enough. (The
 * chart rules make direct labels a supplement to the legend, never a
 * replacement.) Hovering shows a crosshair and every
 * series' value there. A table of the points sits behind it for screen
 * readers.
 */
export function Plot({
  title,
  x,
  y,
  series,
}: {
  title: string
  x: { label: string }
  y: { label: string }
  /** At most two. A third belongs in a second plot. */
  series: { label: string; points: [number, number][] }[]
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  // The x under the pointer; each series then shows its own nearest
  // point, so lines sampled at different xs (or ending early) still read.
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const H = 200
  const m = { top: 12, right: 12, bottom: 28, left: 40 }
  const all = series.flatMap((s) => s.points)
  const xs = all.map((p) => p[0])
  const ys = all.map((p) => p[1])
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)]
  const yt = ticks(Math.min(0, ...ys), Math.max(...ys))
  const [y0, y1] = [yt[0], yt[yt.length - 1]]
  const xt = ticks(x0, x1)
  const iw = Math.max(width - m.left - m.right, 0)
  const ih = H - m.top - m.bottom
  const sx = (v: number) => m.left + ((v - x0) / (x1 - x0 || 1)) * iw
  const sy = (v: number) => m.top + (1 - (v - y0) / (y1 - y0 || 1)) * ih
  const colors = ['var(--chart-1)', 'var(--chart-2)']
  const nearest = (pts: [number, number][], vx: number) =>
    pts.reduce((a, p) => (Math.abs(p[0] - vx) < Math.abs(a[0] - vx) ? p : a), pts[0])
  // A series only answers inside its own range: past its last point it
  // has nothing to say, rather than repeating its end.
  const at = (pts: [number, number][], vx: number) =>
    vx < pts[0][0] - 1e-9 || vx > pts[pts.length - 1][0] + 1e-9 ? null : nearest(pts, vx)
  // Snap the crosshair to the densest series' sample nearest the pointer.
  const base = series.reduce((a, s) => (s.points.length > a.length ? s.points : a), [] as [number, number][])
  const hx = hover === null ? null : nearest(base, hover)[0]

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setHover(x0 + ((e.clientX - r.left) / r.width) * (x1 - x0))
  }

  return (
    <figure className="space-y-3 rounded-md border bg-card p-card">
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-medium">{title}</span>
        {series.length > 1 && (
          <span className="flex gap-3 text-xs text-muted-foreground">
            {series.map((s, i) => (
              <span key={s.label} className="flex items-center gap-1">
                <span className="w-3 rounded-full" style={{ height: 2, background: colors[i] }} />
                {s.label}
              </span>
            ))}
          </span>
        )}
      </figcaption>

      <div ref={wrap} className="relative">
        {width > 0 && (
          <svg width={width} height={H} role="img" aria-label={title} className="block overflow-visible">
            {yt.map((v) => (
              <g key={`y${v}`}>
                <line
                  x1={m.left}
                  x2={width - m.right}
                  y1={sy(v)}
                  y2={sy(v)}
                  className={v === 0 ? 'stroke-border' : 'stroke-border-muted'}
                  strokeWidth={1}
                />
                <text
                  x={m.left - 8}
                  y={sy(v)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-muted-foreground font-mono text-xs tabular-nums"
                >
                  {fmt(v)}
                </text>
              </g>
            ))}
            {xt.map((v) => (
              <text
                key={`x${v}`}
                x={sx(v)}
                y={H - m.bottom + 18}
                textAnchor="middle"
                className="fill-muted-foreground font-mono text-xs tabular-nums"
              >
                {fmt(v)}
              </text>
            ))}

            {series.map((s, i) => (
              <path
                key={s.label}
                d={s.points.map((p, j) => `${j ? 'L' : 'M'}${sx(p[0])},${sy(p[1])}`).join('')}
                fill="none"
                stroke={colors[i]}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {hx !== null && (
              <g>
                <line
                  x1={sx(hx)}
                  x2={sx(hx)}
                  y1={m.top}
                  y2={H - m.bottom}
                  className="stroke-muted-foreground"
                  strokeWidth={1}
                />
                {series.map((s, i) => {
                  const p = at(s.points, hx)
                  return p ? (
                    <circle
                      key={s.label}
                      cx={sx(p[0])}
                      cy={sy(p[1])}
                      r={4}
                      fill={colors[i]}
                      className="stroke-card"
                      strokeWidth={2}
                    />
                  ) : null
                })}
              </g>
            )}

            <rect
              x={m.left}
              y={m.top}
              width={iw}
              height={ih}
              fill="transparent"
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
            />
          </svg>
        )}

        {hx !== null && (
          <div
            className="pointer-events-none absolute z-10 space-y-1 rounded-md border bg-card px-2 py-1 text-xs shadow-floating"
            style={{
              // Inside the plot area, never up over the legend and title.
              top: m.top + 4,
              left: sx(hx),
              transform: `translateX(${sx(hx) > width / 2 ? 'calc(-100% - 8px)' : '8px'})`,
            }}
          >
            <p className="font-mono text-muted-foreground tabular-nums">
              {x.label} = {fmt(hx)}
            </p>
            {series.map((s, i) => {
              const p = at(s.points, hx)
              return p ? (
                <p key={s.label} className="flex items-center gap-2">
                  <span className="w-3 rounded-full" style={{ height: 2, background: colors[i] }} />
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="ml-auto font-mono tabular-nums">{fmt(p[1])}</span>
                </p>
              ) : null
            })}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {y.label} against {x.label}
      </p>

      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>{x.label}</th>
            {series.map((s) => (
              <th key={s.label}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {base.map((p) => (
            <tr key={p[0]}>
              <td>{fmt(p[0])}</td>
              {series.map((s) => {
                const q = at(s.points, p[0])
                return <td key={s.label}>{q && q[0] === p[0] ? fmt(q[1]) : ''}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

/** A plain comparison table in an answer. Wide ones scroll sideways
 *  inside their own frame. */
export function AnswerTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-card-header text-left text-xs text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border-muted">
              {r.map((cell, j) => (
                <td key={j} className={cn('px-3 py-2 align-top', j === 0 && 'font-medium')}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Code from the book or about it: mono, framed, and sideways-scrolling
 *  rather than wrapped, because wrapped code lies about its structure. */
export function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <pre
      aria-label={language ? `${language} code` : 'Code'}
      className="overflow-x-auto rounded-md border bg-card p-card font-mono text-xs leading-relaxed"
    >
      <code>{code}</code>
    </pre>
  )
}
