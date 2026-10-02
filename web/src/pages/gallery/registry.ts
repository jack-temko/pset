/**
 * What both gallery routes list: an entry is a component section on
 * /components or a view on /views. The shell only needs these four
 * fields; each route extends the entry with what it renders.
 */
export interface GalleryEntry {
  /** The path segment: `/components/<id>`. Kebab-case. */
  id: string
  title: string
  /** The sidebar heading it sits under. */
  group: string
  /** One sentence of what it is and the rule it keeps; the page's lead. */
  note?: string
}

export interface GalleryGroup<T extends GalleryEntry> {
  name: string
  entries: T[]
}

/** The entries under their groups, both in the order first seen: the
 *  registry's order is the sidebar's. */
export function groupsOf<T extends GalleryEntry>(entries: T[]): GalleryGroup<T>[] {
  const groups: GalleryGroup<T>[] = []
  for (const e of entries) {
    const g = groups.find((x) => x.name === e.group)
    if (g) g.entries.push(e)
    else groups.push({ name: e.group, entries: [e] })
  }
  return groups
}

/** The entries whose title, id or group holds every word typed, in any
 *  case. An empty query keeps them all. */
export function filterEntries<T extends GalleryEntry>(entries: T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return entries
  return entries.filter((e) => {
    const hay = `${e.title} ${e.id.replaceAll('-', ' ')} ${e.group}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}
