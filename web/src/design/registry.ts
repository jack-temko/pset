import type { AnyExamples } from './examples';
import { RULES, type Rule } from './rules';
import type { Action, AnySpec, Kind } from './spec';

/** A unit as the page knows it: its spec and a way to load its renders. */
export interface Entry {
  spec: AnySpec;
  examples: () => Promise<AnyExamples>;
}

function entries(
  specs: Record<string, { default: AnySpec }>,
  examples: Record<string, () => Promise<{ default: AnyExamples }>>,
): Entry[] {
  return Object.entries(specs).map(([path, m]) => {
    const load = examples[path.replace(/spec\.ts$/, 'examples.tsx')] as
      | (() => Promise<{ default: AnyExamples }>)
      | undefined;
    return {
      spec: m.default,
      examples: async () => {
        if (!load) throw new Error(`${m.default.id} has no examples.tsx`);
        return (await load()).default;
      },
    };
  });
}

/** Every real unit: `web/src/units/<id>/spec.ts`. Empty until the first
 *  unit is designed. */
export const UNITS: readonly Entry[] = entries(
  import.meta.glob<{ default: AnySpec }>('/src/units/*/spec.ts', {
    eager: true,
  }),
  import.meta.glob<{ default: AnyExamples }>('/src/units/*/examples.tsx'),
);

/** Test fixtures: shown by the page at `/design/sample`, listed nowhere. */
export const FIXTURES: readonly Entry[] = entries(
  import.meta.glob<{ default: AnySpec }>('/src/design/sample/*/spec.ts', {
    eager: true,
  }),
  import.meta.glob<{ default: AnyExamples }>(
    '/src/design/sample/*/examples.tsx',
  ),
);

export function findEntry(
  kind: Kind,
  id: string,
  all: readonly Entry[] = [...UNITS, ...FIXTURES],
) {
  return all.find((e) => e.spec.kind === kind && e.spec.id === id);
}

// ---- derived data. Nothing below is written by hand anywhere.

export interface Link {
  /** The unit at the other end. */
  unit: string;
  /** The action that makes the link. */
  action: Action;
}

/** Where this unit's actions lead, in other units. */
export function leadsTo(spec: AnySpec): Link[] {
  return spec.actions.flatMap((a) =>
    a.target && a.target.unit !== spec.id
      ? [{ unit: a.target.unit, action: a }]
      : [],
  );
}

/** Which actions of other units lead here. */
export function leadsHere(specs: readonly AnySpec[], id: string): Link[] {
  return specs.flatMap((s) =>
    s.id === id
      ? []
      : s.actions.flatMap((a) =>
          a.target?.unit === id ? [{ unit: s.id, action: a }] : [],
        ),
  );
}

/** What each unit is made of: the other units its source imports, by unit
 *  id (see `loadImports`). */
export type Imports = Record<string, readonly string[]>;

/** Used by: the units whose source imports this one. */
export function usedBy(imports: Imports, id: string): string[] {
  return Object.entries(imports)
    .filter(([from, made]) => from !== id && made.includes(id))
    .map(([from]) => from);
}

/** Made of: the units this unit's source imports. */
export function madeOf(imports: Imports, id: string): string[] {
  return [...(imports[id] ?? [])];
}

export interface RuleUse {
  rule: Rule;
  /** Ids of the units that cite it (or own it, if local). */
  units: string[];
}

/** The rulebook plus every unit's local rules, each with the units that
 *  cite it. */
export function ruleUses(specs: readonly AnySpec[]): RuleUse[] {
  const global = RULES.map((rule) => ({
    rule,
    units: specs.filter((s) => s.rules.cite.includes(rule.id)).map((s) => s.id),
  }));
  const local = specs.flatMap((s) =>
    (s.rules.local ?? []).map((rule) => ({ rule, units: [s.id] })),
  );
  return [...global, ...local];
}

/** A fixture by id; throws when it is missing, for tests. */
export function fixture(id: string): Entry {
  const e = FIXTURES.find((f) => f.spec.id === id);
  if (!e) throw new Error(`no fixture ${id}`);
  return e;
}
