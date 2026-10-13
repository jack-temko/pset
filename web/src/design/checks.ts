import type { AnyExamples } from './examples';
import { LINE_MAX, PURPOSE_MAX } from './limits';
import type { Rule } from './rules';
import type { AnySpec } from './spec';

/** Everything the checks may need to know about the other units. */
export interface Context {
  specs: readonly AnySpec[];
  rules: readonly Rule[];
}

export interface Subject {
  spec: AnySpec;
  /** The unit's folder name. */
  dir: string;
  examples?: AnyExamples;
  /** The unit's source files other than its spec, by name; null skips the
   *  imports check. */
  sources: Record<string, string> | null;
}

/** Every string in a value, with where it is. */
function strings(v: unknown, path: string, out: [string, string][] = []) {
  if (typeof v === 'string') out.push([path, v]);
  else if (Array.isArray(v))
    v.forEach((x, i) => strings(x, `${path}[${String(i)}]`, out));
  else if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v)) strings(x, `${path}.${k}`, out);
  return out;
}

function dupes(ids: readonly string[]) {
  return ids.filter((id, i) => ids.indexOf(id) !== i);
}

/** The ids of the units a source text imports from the unit folders. */
export function importedUnits(source: string): string[] {
  const found = new Set<string>();
  for (const m of source.matchAll(
    /from\s+['"]@\/(?:units|design\/sample)\/([a-z0-9-]+)(?:\/[^'"]*)?['"]/g,
  ))
    found.add(m[1]);
  return [...found];
}

/** Runs every check of the format on one unit and returns what failed, one
 *  line each. Empty means the unit is sound. */
export function checkUnit(u: Subject, ctx: Context): string[] {
  const { spec } = u;
  const bad: string[] = [];
  const fail = (m: string) => bad.push(`${spec.id}: ${m}`);

  // Fields its kind requires.
  const required = [
    'id',
    'kind',
    'title',
    'group',
    'purpose',
    'states',
    'stress',
    'actions',
    'inputs',
    'priority',
    'sizes',
    'rules',
    'decisions',
  ] as const;
  for (const k of required)
    if (spec[k] === undefined || spec[k] === '') fail(`missing ${k}`);
  if (spec.states.length === 0) fail('needs at least one state');
  if (spec.kind !== 'component') {
    if (!spec.flows || spec.flows.length === 0)
      fail(`a ${spec.kind} needs at least one flow`);
    if (!spec.components) fail(`a ${spec.kind} needs its components list`);
  }
  if (u.dir !== spec.id) fail(`folder ${u.dir} does not match the id`);

  // Length limits and single lines.
  for (const [path, s] of strings(spec, 'spec')) {
    if (s.includes('\n')) fail(`${path} is not a single line`);
    const max = path === 'spec.purpose' ? PURPOSE_MAX : LINE_MAX;
    if (s.length > max)
      fail(
        `${path} is ${String(s.length)} characters, over the ${String(max)} limit`,
      );
  }

  // Unique ids.
  const local = spec.rules.local ?? [];
  for (const [what, ids] of [
    ['state', spec.states.map((s) => s.id)],
    ['action', spec.actions.map((a) => a.id)],
    ['flow', (spec.flows ?? []).map((f) => f.id)],
    ['local rule', local.map((r) => r.id)],
    ['decision', spec.decisions.map((d) => d.id)],
    ['input', spec.inputs.map((i) => i.name)],
    ['listed component', (spec.components ?? []).map((c) => c.unit)],
  ] as const)
    for (const id of dupes(ids)) fail(`duplicate ${what} id ${id}`);
  const same = ctx.specs.filter((s) => s.id === spec.id);
  if (same.length > 1) fail('the id is used by another unit');

  // Actions, flows, priority.
  const actionIds = spec.actions.map((a) => a.id);
  for (const a of spec.actions) {
    if (!a.target) continue;
    const to = ctx.specs.find((s) => s.id === a.target?.unit);
    if (!to) fail(`action ${a.id} targets unknown unit ${a.target.unit}`);
    else if (a.target.state && !to.states.some((s) => s.id === a.target?.state))
      fail(
        `action ${a.id} targets unknown state ${a.target.unit}/${a.target.state}`,
      );
  }
  for (const f of spec.flows ?? [])
    for (const step of f.steps)
      if (!actionIds.includes(step))
        fail(`flow ${f.id} has step ${step}, which is not an action`);
  if (spec.priority.main && !actionIds.includes(spec.priority.main))
    fail(`priority.main ${spec.priority.main} is not an action`);

  // Rules.
  const globalIds = ctx.rules.map((r) => r.id);
  for (const id of spec.rules.cite)
    if (!globalIds.includes(id)) fail(`cites unknown rule ${id}`);
  for (const r of local)
    if (globalIds.includes(r.id))
      fail(`local rule ${r.id} has the id of a global rule`);

  // Components.
  const listed = (spec.components ?? []).map((c) => c.unit);
  for (const id of listed) {
    if (id === spec.id) fail('lists itself as a component');
    else if (!ctx.specs.some((s) => s.id === id))
      fail(`lists unknown component ${id}`);
  }
  if (u.sources) {
    const imported = [
      ...new Set(Object.values(u.sources).flatMap(importedUnits)),
    ]
      .filter((id) => id !== spec.id)
      .sort();
    const sorted = [...new Set(listed)].sort();
    if (imported.join() !== sorted.join())
      fail(
        `components [${sorted.join(', ')}] differ from imports [${imported.join(', ')}]`,
      );
  }

  // Examples.
  if (u.examples) {
    for (const s of spec.states)
      if (typeof u.examples.states[s.id] !== 'function')
        fail(`no example render for state ${s.id}`);
    if (typeof u.examples.stress !== 'function') fail('no stress render');
    if (spec.data && spec.data.length > 0)
      for (const s of spec.states) {
        if (!s.skeleton) fail(`state ${s.id} names no skeleton`);
        if (typeof u.examples.skeletons?.[s.id] !== 'function')
          fail(`no skeleton render for state ${s.id}`);
      }
  } else fail('has no examples');

  return bad;
}
