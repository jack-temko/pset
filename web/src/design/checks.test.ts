import { describe, expect, it } from 'vitest';

import { checkUnit, importedUnits, type Context, type Subject } from './checks';
import { LINE_MAX, PURPOSE_MAX } from './limits';
import { FIXTURES, UNITS } from './registry';
import { RULES } from './rules';
import { defineSpec, type AnySpec } from './spec';

// Every unit's source, raw, for the imports check. Test-only: the page
// never loads these.
const SOURCES = import.meta.glob<string>(
  [
    '/src/units/*/*.{ts,tsx}',
    '/src/design/sample/*/*.{ts,tsx}',
    '!**/spec.ts',
    '!**/*.test.*',
  ],
  { query: '?raw', import: 'default', eager: true },
);

const ALL = [...UNITS, ...FIXTURES];
const CTX: Context = { specs: ALL.map((e) => e.spec), rules: RULES };

function sourcesOf(dir: string) {
  return Object.fromEntries(
    Object.entries(SOURCES)
      .filter(([p]) => p.split('/').at(-2) === dir)
      .map(([p, s]) => [p, s]),
  );
}

async function subjectOf(index: number): Promise<Subject> {
  const spec = ALL[index].spec;
  return {
    spec,
    dir: spec.id,
    examples: await ALL[index].examples(),
    sources: sourcesOf(spec.id),
  };
}

describe('every registered unit', () => {
  it.each(ALL.map((e, i) => [e.spec.id, i] as const))(
    '%s passes every check',
    async (_id, i) => {
      expect(checkUnit(await subjectOf(i), CTX)).toEqual([]);
    },
  );
});

// ---- the checks themselves, each against a deliberately broken fixture.

const ROW = FIXTURES.find((e) => e.spec.id === 'sample-row')!;
const SCREEN = FIXTURES.find((e) => e.spec.id === 'sample-screen')!;

async function broken(
  base: typeof ROW,
  change: (s: AnySpec) => Partial<AnySpec>,
  patch?: (s: Subject) => Partial<Subject>,
) {
  const examples = await base.examples();
  const subject: Subject = {
    spec: { ...base.spec, ...change(base.spec) },
    dir: base.spec.id,
    examples,
    sources: sourcesOf(base.spec.id),
  };
  const full = { ...subject, ...patch?.(subject) };
  return checkUnit(full, {
    ...CTX,
    specs: CTX.specs.map((s) => (s.id === full.spec.id ? full.spec : s)),
  });
}

describe('the checks', () => {
  it('the fixtures are sound', async () => {
    expect(await broken(ROW, () => ({}))).toEqual([]);
    expect(await broken(SCREEN, () => ({}))).toEqual([]);
  });

  it('requires the fields of a kind', async () => {
    const r = await broken(SCREEN, () => ({ flows: [] }));
    expect(r.join()).toContain('needs at least one flow');
    const c = await broken(SCREEN, () => ({ components: undefined }));
    expect(c.join()).toContain('needs its components list');
    const p = await broken(ROW, () => ({ purpose: '' }));
    expect(p.join()).toContain('missing purpose');
  });

  it('enforces the length limits', async () => {
    const long = await broken(ROW, () => ({
      purpose: 'x'.repeat(PURPOSE_MAX + 1),
    }));
    expect(long.join()).toContain('spec.purpose');
    const ok = await broken(ROW, () => ({ purpose: 'x'.repeat(PURPOSE_MAX) }));
    expect(ok).toEqual([]);
    const line = await broken(ROW, (s) => ({
      stress: 'x'.repeat(LINE_MAX + 1),
      title: s.title,
    }));
    expect(line.join()).toContain('spec.stress');
    const para = await broken(ROW, () => ({ stress: 'one\ntwo' }));
    expect(para.join()).toContain('not a single line');
  });

  it('requires unique ids', async () => {
    const r = await broken(ROW, (s) => ({
      states: [...s.states, s.states[0]],
    }));
    expect(r.join()).toContain('duplicate state id rest');
    const a = await broken(ROW, (s) => ({
      actions: [...s.actions, s.actions[0]],
    }));
    expect(a.join()).toContain('duplicate action id');
  });

  it('requires action targets to exist', async () => {
    const unit = await broken(ROW, (s) => ({
      actions: [{ ...s.actions[0], target: { unit: 'nowhere' } }],
    }));
    expect(unit.join()).toContain('unknown unit nowhere');
    const state = await broken(ROW, (s) => ({
      actions: [
        { ...s.actions[0], target: { unit: 'sample-row', state: 'x' } },
      ],
    }));
    expect(state.join()).toContain('unknown state sample-row/x');
  });

  it('requires flow steps and the main action to be actions', async () => {
    const flow = await broken(ROW, () => ({
      flows: [{ id: 'f', name: 'F', steps: ['nope'] }],
    }));
    expect(flow.join()).toContain('step nope');
    const main = await broken(ROW, (s) => ({
      priority: { ...s.priority, main: 'nope' },
    }));
    expect(main.join()).toContain('priority.main nope');
  });

  it('requires cited rules to exist', async () => {
    const r = await broken(ROW, () => ({
      rules: { cite: ['no-such-rule'] },
    }));
    expect(r.join()).toContain('cites unknown rule no-such-rule');
  });

  it('requires listed components to exist and match the imports', async () => {
    const unknown = await broken(SCREEN, () => ({
      components: [{ unit: 'ghost', use: 'x' }],
    }));
    expect(unknown.join()).toContain('unknown component ghost');
    const missing = await broken(SCREEN, () => ({ components: [] }));
    expect(missing.join()).toContain('differ from imports [sample-row]');
    const extra = await broken(ROW, () => ({
      components: [{ unit: 'sample-screen', use: 'x' }],
    }));
    expect(extra.join()).toContain('differ from imports []');
  });

  it('requires a render for every state and a stress render', async () => {
    const noState = await broken(
      ROW,
      () => ({}),
      (s) => ({
        examples: {
          ...s.examples!,
          states: { rest: s.examples!.states.rest },
        },
      }),
    );
    expect(noState.join()).toContain('no example render for state menu');
    const noStress = await broken(
      ROW,
      () => ({}),
      (s) => ({
        examples: {
          ...s.examples!,
          stress: undefined as unknown as () => null,
        },
      }),
    );
    expect(noStress.join()).toContain('no stress render');
  });

  it('requires a skeleton per state when the unit reads data', async () => {
    const noRender = await broken(
      ROW,
      () => ({}),
      (s) => ({
        examples: {
          ...s.examples!,
          skeletons: { rest: s.examples!.skeletons!.rest },
        },
      }),
    );
    expect(noRender.join()).toContain('no skeleton render for state menu');
    const noName = await broken(ROW, (s) => ({
      states: s.states.map((st) => ({ ...st, skeleton: undefined })),
    }));
    expect(noName.join()).toContain('state rest names no skeleton');
    const noData = await broken(
      ROW,
      () => ({ data: [] }),
      (s) => ({ examples: { ...s.examples!, skeletons: undefined } }),
    );
    expect(noData).toEqual([]);
  });

  it('finds imports of other units', () => {
    expect(
      importedUnits(
        "import { A } from '@/design/sample/sample-row/row';\nimport { B } from '@/units/button';\nimport { C } from '@/components/box';",
      ),
    ).toEqual(['sample-row', 'button']);
  });

  it('fails the typecheck for a step that is not an action', () => {
    const spec = defineSpec({
      id: 'x',
      kind: 'component',
      title: 'X',
      group: 'G',
      purpose: 'p',
      states: [{ id: 'a', name: 'A', when: 'w' }],
      stress: 's',
      flows: [
        {
          id: 'f',
          name: 'F',
          // @ts-expect-error nope is not an action id of this unit
          steps: ['nope'],
        },
      ],
      actions: [{ id: 'go', label: 'Go', does: 'd' }],
      inputs: [],
      // @ts-expect-error nope is not an action id of this unit
      priority: { first: 'f', main: 'nope' },
      sizes: { narrowest: 1, gives: [] },
      rules: { cite: [] },
      decisions: [],
    });
    expect(spec.id).toBe('x');
  });
});
