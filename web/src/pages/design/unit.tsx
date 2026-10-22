import { useSearchParams } from 'react-router-dom';

import { RULES } from '@/design/rules';
import type { Entry } from '@/design/registry';
import { NeighbourMap } from './map';
import {
  Actions,
  DataSection,
  Decisions,
  Inputs,
  PriorityAndSizes,
  Remembers,
  RulesSection,
  Sec,
} from './sections';
import { Example } from './stage';
import { parseStage, stageParams, type StageState } from './url-state';

/** A unit's page, top to bottom: what it is, the example, the map, the
 *  tables, the rules and the decisions. Every control is in the URL. */
export function UnitPage({ entry }: { entry: Entry }) {
  const { spec } = entry;
  const [q, setQ] = useSearchParams();
  const s = parseStage(q, spec);
  const change = (patch: Partial<StageState>) => {
    setQ(stageParams({ ...s, ...patch }, spec), { replace: true });
  };
  return (
    <div>
      <header className="space-y-1">
        <p className="text-xs tracking-wide text-primary uppercase">
          {spec.kind}
        </p>
        <h1 className="font-heading text-xl">{spec.title}</h1>
        <p className="text-sm text-muted-foreground">{spec.purpose}</p>
      </header>
      <div className="mt-section">
        <Example entry={entry} s={s} change={change} />
      </div>
      <Sec title="Neighbourhood">
        <NeighbourMap spec={spec} />
      </Sec>
      <Actions spec={spec} />
      <DataSection spec={spec} />
      <Remembers spec={spec} />
      <Inputs spec={spec} />
      <PriorityAndSizes spec={spec} />
      <RulesSection spec={spec} rulebook={RULES} />
      <Decisions spec={spec} />
    </div>
  );
}
