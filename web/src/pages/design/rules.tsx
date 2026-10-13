import { Link, useParams } from 'react-router-dom';

import { RULES } from '@/design/rules';
import { ruleUses } from '@/design/registry';
import { ALL_SPECS, specOf, unitPath } from './lookup';
import { Quiet, RuleList, Sec } from './sections';

const RULE_USES = ruleUses(ALL_SPECS);

/** The rulebook. */
export function RulesPage() {
  if (RULES.length === 0)
    return (
      <div className="space-y-1">
        <h1 className="font-heading text-xl">Rules</h1>
        <Quiet>
          The rulebook is empty. A rule is written when the thing it governs is
          designed.
        </Quiet>
      </div>
    );
  return (
    <div>
      <h1 className="font-heading text-xl">Rules</h1>
      <div className="mt-section">
        <RuleList rules={RULES} />
      </div>
    </div>
  );
}

/** One rule, and every unit that cites it. */
export function RulePage() {
  const { id } = useParams();
  const use = RULE_USES.find((u) => u.rule.id === id);
  if (!use) return <Quiet>No rule {id ?? ''}.</Quiet>;
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
