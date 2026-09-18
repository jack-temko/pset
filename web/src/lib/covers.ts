export type CoverHue = 'indigo' | 'teal' | 'amber' | 'rose' | 'violet' | 'slate'

const order: CoverHue[] = ['indigo', 'teal', 'amber', 'rose', 'violet', 'slate']

/**
 * The hue is derived, never chosen: the first byte of the sha256, modulo
 * six. The same book is always the same colour, and a seventh hue would
 * break the shelf.
 *
 * The colours themselves are the `--cover-*` tokens in index.css.
 */
export function coverHueFromSha(sha: string): CoverHue {
  const byte = Number.parseInt(sha.slice(0, 2), 16)
  return order[(Number.isNaN(byte) ? 0 : byte) % order.length]
}
