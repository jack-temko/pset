export type CoverHue = 'indigo' | 'teal' | 'amber' | 'rose' | 'violet' | 'slate'

const hues: Record<CoverHue, { from: string; to: string; spine: string }> = {
  indigo: { from: 'oklch(0.44 0.15 265)', to: 'oklch(0.32 0.13 265)', spine: 'oklch(0.24 0.1 265)' },
  teal: { from: 'oklch(0.46 0.09 200)', to: 'oklch(0.34 0.08 200)', spine: 'oklch(0.25 0.06 200)' },
  amber: { from: 'oklch(0.52 0.11 75)', to: 'oklch(0.4 0.1 75)', spine: 'oklch(0.3 0.08 75)' },
  rose: { from: 'oklch(0.44 0.14 15)', to: 'oklch(0.32 0.12 15)', spine: 'oklch(0.24 0.1 15)' },
  violet: { from: 'oklch(0.44 0.14 300)', to: 'oklch(0.32 0.12 300)', spine: 'oklch(0.24 0.1 300)' },
  slate: { from: 'oklch(0.42 0.025 250)', to: 'oklch(0.31 0.02 250)', spine: 'oklch(0.23 0.015 250)' },
}

const hueOrder: CoverHue[] = ['indigo', 'teal', 'amber', 'rose', 'violet', 'slate']

/** Deterministic cover hue from a sha256 — first hash byte mod the hue count. */
export function coverHueFromSha(sha: string): CoverHue {
  const byte = Number.parseInt(sha.slice(0, 2), 16)
  return hueOrder[(Number.isNaN(byte) ? 0 : byte) % hueOrder.length]
}

export function coverColors(hue: CoverHue): { from: string; to: string; spine: string } {
  return hues[hue]
}
