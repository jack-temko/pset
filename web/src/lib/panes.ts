import { useCallback, useLayoutEffect, useState } from 'react'

/**
 * The workspace's pane widths. They are kept as fractions of the
 * workspace's width, not pixels, so a layout set on a wide screen still
 * looks the same on a narrow one; pixels are worked out from them at
 * render and held inside the limits below. Saved in this browser for
 * this PSet: it's a preference of the screen, not of the library.
 *
 * Spec: design/workspace.md (Frame).
 */

export type PaneRatios = {
  /** The contents rail. */
  rail: number
  /** The Ask | Homework panel. */
  panel: number
  /** The panel in Focus, where the rail's width is the panel's to take. */
  panelFocus: number
}

/** The widths at 1440: rail 320, panel 440, Focus 800. */
export const DEFAULT_RATIOS: PaneRatios = { rail: 320 / 1440, panel: 440 / 1440, panelFocus: 800 / 1440 }

/** Below these a pane stops being useful: the rail's titles truncate to
 *  nothing, the panel can't hold a problem, the scan can't show a page. */
export const RAIL_MIN = 200
export const PANEL_MIN = 360
export const SCAN_MIN = 320
/** Above these the pane crowds out the page it sits beside. */
const RAIL_MAX = 0.35
const PANEL_MAX = 0.5
const PANEL_FOCUS_MAX = 0.7

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))

export type PaneLayout = {
  /** 0 when the rail isn't showing. */
  rail: number
  panel: number
  /** What each can be dragged to right now, the other pane held still. */
  railRange: [number, number]
  panelRange: [number, number]
}

/** The pixel widths for a workspace `total` wide. The scan keeps at least
 *  SCAN_MIN; when the screen is too narrow for that, the panel gives way
 *  first, then the rail, each down to its own minimum and no further. */
export function layout(total: number, r: PaneRatios, focus: boolean, hasRail: boolean): PaneLayout {
  const showRail = hasRail && !focus
  const panelMax = total * (focus ? PANEL_FOCUS_MAX : PANEL_MAX)
  let rail = showRail ? clamp(r.rail * total, RAIL_MIN, total * RAIL_MAX) : 0
  let panel = clamp((focus ? r.panelFocus : r.panel) * total, PANEL_MIN, panelMax)
  let over = rail + panel + SCAN_MIN - total
  if (over > 0) {
    const give = Math.min(over, panel - PANEL_MIN)
    panel -= give
    over -= give
  }
  if (over > 0 && showRail) rail -= Math.min(over, rail - RAIL_MIN)
  return {
    rail,
    panel,
    railRange: [RAIL_MIN, Math.max(RAIL_MIN, Math.min(total * RAIL_MAX, total - panel - SCAN_MIN))],
    panelRange: [PANEL_MIN, Math.max(PANEL_MIN, Math.min(panelMax, total - rail - SCAN_MIN))],
  }
}

const KEY = 'pset-panes'

/** Storage can throw (a private window, blocked site data), and a stored
 *  value can be anything; either way the defaults stand in. */
export function readRatios(): PaneRatios {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (v && typeof v === 'object') {
      const out = { ...DEFAULT_RATIOS }
      for (const k of Object.keys(out) as (keyof PaneRatios)[]) {
        const n = (v as Record<string, unknown>)[k]
        if (typeof n === 'number' && n > 0 && n < 1) out[k] = n
      }
      return out
    }
  } catch {
    /* the defaults */
  }
  return { ...DEFAULT_RATIOS }
}

function writeRatios(r: PaneRatios) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r))
  } catch {
    /* forgetting is fine */
  }
}

/** The workspace's pane widths, measured against the element `frame` is
 *  the ref of. `total` is 0 until it has been measured, and the caller
 *  falls back to the default tokens until then. `set` moves a pane live;
 *  `commit` saves. */
export function usePanes() {
  const [ratios, setRatios] = useState(readRatios)
  const [total, setTotal] = useState(0)
  // A callback ref, not a ref object: the frame mounts only once the book
  // has loaded, after this hook first runs.
  const [el, frame] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (!el) return
    setTotal(el.clientWidth)
    const ro = new ResizeObserver(() => setTotal(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])

  const set = useCallback(
    (pane: keyof PaneRatios, px: number) => total > 0 && setRatios((r) => ({ ...r, [pane]: px / total })),
    [total],
  )
  const commit = useCallback(() => setRatios((r) => (writeRatios(r), r)), [])
  const reset = useCallback((pane: keyof PaneRatios) => {
    setRatios((r) => {
      const next = { ...r, [pane]: DEFAULT_RATIOS[pane] }
      writeRatios(next)
      return next
    })
  }, [])

  return { frame, ratios, total, set, commit, reset }
}
