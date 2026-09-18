/** `just now`, `7m ago`, `3h ago`, `yesterday`, `5d ago`, then `Mar 3`. */
export function relTime(iso: string): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return ''
  const minutes = (Date.now() - then) / 60_000
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${Math.floor(minutes)}m ago`
  const hours = minutes / 60
  if (hours < 24) return `${Math.floor(hours)}h ago`
  const days = hours / 24
  if (days < 2) return 'yesterday'
  if (days < 7) return `${Math.floor(days)}d ago`
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log2(bytes) / 10), units.length - 1)
  const value = bytes / 2 ** (10 * i)
  return `${i === 0 ? bytes : value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}

export function formatDate(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  return new Date(t).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function timestampOf(iso: string): number {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}
