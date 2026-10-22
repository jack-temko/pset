import { importedUnits } from './checks';
import type { Imports } from './registry';

/** The unit folder a source path is in: `/src/units/<id>/...` or
 *  `/src/design/sample/<id>/...`. */
function unitOf(path: string): string | undefined {
  return /\/(?:units|design\/sample)\/([a-z0-9-]+)\//.exec(path)?.[1];
}

/** Which units each unit imports, from the source texts by path. */
export function importsOf(sources: Record<string, string>): Imports {
  const out: Record<string, Set<string>> = {};
  for (const [path, src] of Object.entries(sources)) {
    const id = unitOf(path);
    if (!id) continue;
    const made = (out[id] ??= new Set());
    for (const m of importedUnits(src)) if (m !== id) made.add(m);
  }
  return Object.fromEntries(
    Object.entries(out).map(([id, made]) => [id, [...made].sort()]),
  );
}

const SOURCES = import.meta.glob<string>(
  [
    '/src/units/*/**/*.{ts,tsx}',
    '/src/design/sample/*/**/*.{ts,tsx}',
    '!**/spec.ts',
    '!**/*.test.*',
  ],
  { query: '?raw', import: 'default' },
);

let loaded: Promise<Imports> | undefined;

/** Reads every unit's source once, only when the page asks, and finds what
 *  each imports. The components of a unit are never written by hand. */
export function loadImports(): Promise<Imports> {
  loaded ??= Promise.all(
    Object.entries(SOURCES).map(
      async ([p, load]) => [p, await load()] as const,
    ),
  ).then((all) => importsOf(Object.fromEntries(all)));
  return loaded;
}
