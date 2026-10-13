import { Fragment } from 'react';
import { Link, useParams } from 'react-router-dom';

import { RULES } from '@/design/rules';
import { VISION } from '@/design/vision';
import { ruleUses } from '@/design/registry';
import { ALL_SPECS, specOf, unitPath } from './lookup';
import { Quiet, Sec } from './sections';

const RULE_USES = ruleUses(ALL_SPECS);

function unitCount(id: string) {
  const n = RULE_USES.find((u) => u.rule.id === id)?.units.length ?? 0;
  return `${String(n)} ${n === 1 ? 'unit' : 'units'}`;
}

/** What PSet is, then the rulebook. */
export function RulesPage() {
  return (
    <div>
      <header className="space-y-3">
        <h1 className="font-heading text-xl">Rules</h1>
        <p className="max-w-prose text-sm">{VISION.line}</p>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          {VISION.facts.map((f) => (
            <Fragment key={f.label}>
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd>{f.text}</dd>
            </Fragment>
          ))}
        </dl>
      </header>
      <Sec title="The rules">
        <ul className="divide-y divide-border-muted rounded-lg border bg-card">
          {RULES.map((r) => (
            <li key={r.id} className="space-y-1 px-card py-2 text-sm">
              <div className="flex items-baseline gap-4">
                <span className="min-w-0 flex-1">{r.rule}</span>
                <Link
                  to={`/design/rules/${r.id}`}
                  className="shrink-0 font-mono text-xs text-muted-foreground hover:text-foreground"
                >
                  {r.id}
                </Link>
                <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                  {unitCount(r.id)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                To check: {r.check}
              </p>
            </li>
          ))}
        </ul>
      </Sec>
    </div>
  );
}

/** One rule, and every unit that cites it. */
export function RulePage() {
  const { id } = useParams();
  const use = RULE_USES.find((u) => u.rule.id === id);
  if (!use)
    return (
      <div className="space-y-1">
        <Quiet>No rule with this id.</Quiet>
        <Link
          to="/design/rules"
          className="text-sm text-primary hover:underline"
        >
          Back to Rules
        </Link>
      </div>
    );
  const { rule, units } = use;
  return (
    <div>
      <header className="space-y-1">
        <p className="text-xs tracking-wide text-primary uppercase">Rule</p>
        <h1 className="font-heading text-xl">{rule.id}</h1>
        <p className="text-sm text-muted-foreground">{rule.rule}</p>
      </header>
      <Sec title="How to check it">
        <p className="text-sm">{rule.check}</p>
      </Sec>
      <Sec title="Scope">
        <p className="text-sm">{rule.scope}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {rule.enforcedBy
            ? `Enforced by ${rule.enforcedBy}.`
            : 'Nothing enforces it.'}
        </p>
      </Sec>
      <Sec
        title="Cited by"
        empty={units.length ? undefined : 'No unit cites it.'}
      >
        <ul className="space-y-1 text-sm">
          {units.map((u) => (
            <li key={u}>
              <Link to={unitPath(u)} className="text-primary hover:underline">
                {specOf(u)?.title ?? u}
              </Link>
            </li>
          ))}
        </ul>
      </Sec>
    </div>
  );
}
