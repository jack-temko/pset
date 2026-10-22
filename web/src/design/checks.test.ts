import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import {
  checkRulebook,
  checkUnit,
  checkVision,
  endpointsIn,
  importedUnits,
  type Context,
  type Subject,
} from './checks';
import { LINE_MAX, PURPOSE_MAX } from './limits';
import { fixture, FIXTURES, UNITS } from './registry';
import { RULES } from './rules';
import { VISION } from './vision';
import { defineExamples } from './examples';
import { defineSpec, type AnySpec } from './spec';

// Every unit's source, raw, for the imports check. Test-only: the page
// never loads these.
const SOURCES = import.meta.glob<string>(
  [
    '/src/units/*/**/*.{ts,tsx}',
    '/src/design/sample/*/**/*.{ts,tsx}',
    '!**/spec.ts',
    '!**/*.test.*',
  ],
  { query: '?raw', import: 'default', eager: true },
);

const ALL = [...UNITS, ...FIXTURES];

// The generated API types name each endpoint in a comment ("Detail is GET
// /api/homework/{id}."); a wired data call must be one of them (F8).
const GEN = import.meta.glob<string>('/src/api/gen/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const ENDPOINTS = Object.values(GEN).flatMap(endpointsIn);

const CTX: Context = {
  specs: ALL.map((e) => e.spec),
  rules: RULES,
  endpoints: ENDPOINTS,
};

function sourcesOf(dir: string) {
  return Object.fromEntries(
    Object.entries(SOURCES)
      .filter(([p]) => p.includes(`/${dir}/`))
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

const ROW = fixture('sample-row');
const SCREEN = fixture('sample-screen');

function ex(s: Subject) {
  if (!s.examples) throw new Error('no examples');
  return s.examples;
}

function never(): never {
  throw new Error('missing');
}

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

const roots: ReturnType<typeof createRoot>[] = [];

afterEach(() => {
  act(() => {
    for (const r of roots.splice(0)) r.unmount();
  });
  document.body.replaceChildren();
});

function textOf(node: ReactNode) {
  const el = document.createElement('div');
  document.body.append(el);
  const root = createRoot(el);
  roots.push(root);
  act(() => {
    root.render(node);
  });
  return document.body.textContent.replace(/\s+/g, ' ');
}

// F2: a state's exact text is on screen when the state is rendered.
describe('every state text', () => {
  const withText = ALL.flatMap((e, i) =>
    e.spec.states
      .filter((s) => s.text !== undefined)
      .map((s) => [e.spec.id, s.id, i] as const),
  );
  it.each(withText)('%s, state %s, shows its text', async (_id, state, i) => {
    const text = ALL[i].spec.states.find((s) => s.id === state)?.text ?? '';
    const examples = await ALL[i].examples();
    expect(textOf(examples.states[state]())).toContain(text);
  });
});

describe('the checks', () => {
  it('the fixtures are sound', async () => {
    expect(await broken(ROW, () => ({}))).toEqual([]);
    expect(await broken(SCREEN, () => ({}))).toEqual([]);
  });

  it('requires the fields of a kind', async () => {
    const r = await broken(SCREEN, () => ({ flows: [] }));
    expect(r.join()).toContain('needs at least one flow');
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

  it('requires a render for every state and a stress render', async () => {
    const noState = await broken(
      ROW,
      () => ({}),
      (s) => ({
        examples: {
          ...ex(s),
          states: { rest: ex(s).states.rest },
        },
      }),
    );
    expect(noState.join()).toContain('no example render for state menu');
    const noStress = await broken(
      ROW,
      () => ({}),
      (s) => ({
        examples: {
          ...ex(s),
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
          ...ex(s),
          skeletons: { rest: ex(s).skeletons?.rest ?? never() },
        },
      }),
    );
    expect(noRender.join()).toContain('no skeleton render for state menu');
    const noData = await broken(
      ROW,
      () => ({ data: [] }),
      (s) => ({ examples: { ...ex(s), skeletons: undefined } }),
    );
    expect(noData).toEqual([]);
  });

  it('fails on a duplicate flow, decision or input', async () => {
    const f = await broken(SCREEN, (s) => ({
      flows: [...(s.flows ?? []), ...(s.flows ?? [])],
    }));
    expect(f.join()).toContain('duplicate flow id browse');
    const d = await broken(ROW, (s) => ({
      decisions: [...s.decisions, s.decisions[0]],
    }));
    expect(d.join()).toContain('duplicate decision id');
    const i = await broken(ROW, (s) => ({
      inputs: [...s.inputs, s.inputs[0]],
    }));
    expect(i.join()).toContain('duplicate input id title');
  });

  it('fails on an id used by another unit', async () => {
    const examples = await ROW.examples();
    const twin = { ...ROW.spec };
    const r = checkUnit(
      { spec: ROW.spec, dir: 'sample-row', examples, sources: null },
      { ...CTX, specs: [...CTX.specs, twin] },
    );
    expect(r.join()).toContain('the id is used by another unit');
  });

  it('fails on a local rule with a global id', async () => {
    const examples = await ROW.examples();
    const r = checkUnit(
      { spec: ROW.spec, dir: 'sample-row', examples, sources: null },
      {
        ...CTX,
        rules: [
          {
            id: 'sample-row-truncate',
            rule: 'r',
            check: 'c',
            scope: 'all',
          },
        ],
      },
    );
    expect(r.join()).toContain('has the id of a global rule');
  });

  it('fails on a folder that does not match the id', async () => {
    const r = await broken(
      ROW,
      () => ({}),
      () => ({ dir: 'elsewhere' }),
    );
    expect(r.join()).toContain('folder elsewhere does not match the id');
  });

  it('fails on a missing stress line or priority', async () => {
    expect((await broken(ROW, () => ({ stress: '' }))).join()).toContain(
      'missing stress',
    );
    expect(
      (
        await broken(ROW, (s) => ({ priority: { ...s.priority, first: '' } }))
      ).join(),
    ).toContain('priority.first is empty');
  });

  it('fails on a relative import into another unit', async () => {
    const r = await broken(
      ROW,
      () => ({}),
      (s) => ({
        sources: {
          ...s.sources,
          '/src/design/sample/sample-row/bad.tsx':
            "import { SampleScreen } from '../sample-screen/screen';",
          '/src/design/sample/sample-row/sub/bad.tsx':
            "import { x } from '../../sample-screen/screen';",
          '/src/design/sample/sample-row/sub/ok.tsx':
            "import { y } from '../row';",
        },
      }),
    );
    const out = r.filter((m) => m.includes('use the @/units/ alias'));
    expect(out).toHaveLength(2);
  });

  it('lets a data call be sample, or an endpoint of the generated API types', async () => {
    const sample = await broken(ROW, () => ({
      data: [{ reads: 'r', call: 'sample' }],
    }));
    expect(sample).toEqual([]);
    const real = await broken(ROW, () => ({
      data: [{ reads: 'r', call: 'GET /api/homework/:id' }],
    }));
    expect(real).toEqual([]);
    const query = await broken(ROW, () => ({
      data: [{ reads: 'r', call: 'GET /api/week?since=2026-10-01' }],
    }));
    expect(query).toEqual([]);
    const invented = await broken(ROW, () => ({
      data: [{ reads: 'r', call: 'GET /api/sample/items/:id' }],
    }));
    expect(invented.join()).toContain('is not an endpoint');
    const wrongMethod = await broken(ROW, () => ({
      data: [{ reads: 'r', call: 'DELETE /api/week' }],
    }));
    expect(wrongMethod.join()).toContain('is not an endpoint');
  });

  it('reads endpoints from the comments of the generated types', () => {
    expect(
      endpointsIn(
        '/** Detail is GET /api/homework/{id}. */\n/** X is POST /api/books/{id}/turns. */',
      ),
    ).toEqual(['GET /api/homework/{}', 'POST /api/books/{}/turns']);
    expect(ENDPOINTS).toContain('GET /api/homework/{}');
    expect(endpointsIn('X is GET /api/pages/{page_id}/image.')).toEqual([
      'GET /api/pages/{}/image',
    ]);
  });

  it('fails the typecheck for inputs that are not the component props', () => {
    const spec = defineSpec({
      id: 'x',
      kind: 'component',
      title: 'X',
      group: 'G',
      purpose: 'p',
      states: [{ id: 'a', name: 'A', when: 'w' }],
      stress: 's',
      actions: [{ id: 'go', label: 'Go', does: 'd' }],
      inputs: [{ name: 'title', does: 'd' }],
      priority: { first: 'f' },
      sizes: { gives: [] },
      rules: { cite: [] },
      decisions: [],
    });
    const render = { states: { a: () => null }, stress: () => null };
    const same = ({ title }: { title: string }) => title;
    expect(defineExamples(spec, same, render)).toBe(render);
    const extra = ({ title }: { title: string; extra: number }) => title;
    const other = ({ other }: { other: string }) => other;
    // @ts-expect-error the component has a prop the spec does not list
    defineExamples(spec, extra, render);
    // @ts-expect-error the spec lists an input the component does not have
    defineExamples(spec, other, render);
  });

  it('finds imports of other units', () => {
    expect(
      importedUnits(
        "import { A } from '@/design/sample/sample-row/row';\nimport { B } from '@/units/button';\nimport { C } from '@/components/box';\nimport '@/units/side-effect';\nconst d = import('@/units/lazy/deep/x');",
      ),
    ).toEqual(['sample-row', 'button', 'side-effect', 'lazy']);
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
      sizes: { gives: [] },
      rules: { cite: [] },
      decisions: [],
    });
    expect(spec.id).toBe('x');
  });
});

describe('the rulebook and the vision', () => {
  it('the rulebook is sound', () => {
    expect(checkRulebook(RULES)).toEqual([]);
    expect(RULES).toHaveLength(21);
  });

  it('fails on a duplicate or a badly spelled rule id', () => {
    const r = { rule: 'r', check: 'c', scope: 'all' };
    const bad = checkRulebook([
      { id: 'a-b', ...r },
      { id: 'a-b', ...r },
      { id: 'Not_Kebab', ...r },
    ]);
    expect(bad).toContain('duplicate rule id a-b');
    expect(bad.join()).toContain('Not_Kebab is not kebab-case');
  });

  it('the vision keeps to one line each', () => {
    expect(checkVision(VISION)).toEqual([]);
  });

  it('fails on a vision line over the limit', () => {
    const long = 'x'.repeat(LINE_MAX + 1);
    expect(checkVision({ line: long, facts: [] })).toHaveLength(1);
  });
});
