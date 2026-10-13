import { FIXTURES, UNITS } from '@/design/registry';
import type { AnySpec, Kind } from '@/design/spec';

/** Every spec the page knows, fixtures included, for links and the map. */
export const ALL_SPECS: readonly AnySpec[] = [...UNITS, ...FIXTURES].map(
  (e) => e.spec,
);

export function specOf(id: string) {
  return ALL_SPECS.find((s) => s.id === id);
}

export function kindOf(id: string): Kind | undefined {
  return specOf(id)?.kind;
}

/** The address of a unit's page. */
export function unitPath(id: string, state?: string) {
  const kind = kindOf(id);
  return `/design/${kind ?? 'component'}/${id}${state ? `?state=${state}` : ''}`;
}
