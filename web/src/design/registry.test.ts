import { describe, expect, it } from 'vitest';

import {
  FIXTURES,
  findEntry,
  fixture,
  leadsHere,
  leadsTo,
  madeOf,
  ruleUses,
  usedBy,
} from './registry';

const specs = FIXTURES.map((e) => e.spec);
const row = fixture('sample-row').spec;
const screen = fixture('sample-screen').spec;

describe('the derived map', () => {
  it('leads to other units only', () => {
    expect(leadsTo(row).map((l) => [l.unit, l.action.id])).toEqual([
      ['sample-screen', 'open-item'],
    ]);
    expect(leadsTo(screen).map((l) => l.unit)).toEqual(['sample-row']);
  });

  it('leads here from the actions of the others', () => {
    expect(leadsHere(specs, 'sample-screen').map((l) => l.unit)).toEqual([
      'sample-row',
    ]);
    expect(leadsHere(specs, 'sample-row').map((l) => l.action.id)).toEqual([
      'more',
    ]);
  });

  it('knows what holds a unit and what it holds', () => {
    expect(usedBy(specs, 'sample-row')).toEqual(['sample-screen']);
    expect(usedBy(specs, 'sample-screen')).toEqual([]);
    expect(madeOf(screen)).toEqual(['sample-row']);
  });

  it('lists the rulebook and local rules with their units', () => {
    const uses = ruleUses(specs).map((u) => [u.rule.id, u.units]);
    expect(uses).toContainEqual(['failure-says-what', ['sample-row']]);
    expect(uses).toContainEqual(['keep-the-place', []]);
    expect(uses.at(-1)).toEqual(['sample-row-truncate', ['sample-row']]);
  });

  it('finds a unit by kind and id', () => {
    expect(findEntry('component', 'sample-row')).toBeDefined();
    expect(findEntry('view', 'sample-row')).toBeUndefined();
  });
});
