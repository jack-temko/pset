import { useState } from 'react';
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';

import { Mark } from '@/components/brand';
import { Input } from '@/components/input';
import { UnderlineNav, UnderlineTab } from '@/components/underline-nav';
import { findEntry, UNITS } from '@/design/registry';
import { RULES } from '@/design/rules';
import type { Kind } from '@/design/spec';
import { cn } from '@/lib/utils';
import { unitPath } from './lookup';
import { Foundations } from './foundations';
import { RulePage, RulesPage } from './rules';
import { Quiet } from './sections';
import { UnitPage } from './unit';

interface Tab {
  id: string;
  label: string;
  /** The kind of unit it lists; none for Foundations and Rules. */
  kind?: Kind;
  /** Shown even with nothing in it. */
  always?: boolean;
}

const TABS: readonly Tab[] = [
  { id: 'foundations', label: 'Foundations', always: true },
  { id: 'components', label: 'Components', kind: 'component' },
  { id: 'panes', label: 'Panes', kind: 'pane' },
  { id: 'views', label: 'Views', kind: 'view' },
  { id: 'rules', label: 'Rules', always: true },
];

const EMPTY: Record<string, string> = {
  components: 'No components yet.',
  panes: 'No panes yet.',
  views: 'No views yet.',
};

interface Group {
  label: string;
  items: { to: string; name: string }[];
}

function groupsFor(tab: Tab): Group[] {
  if (tab.id === 'rules') {
    return [
      {
        label: 'Rules',
        items: RULES.map((r) => ({
          to: `/design/rules/${r.id}`,
          name: r.id,
        })),
      },
    ];
  }
  const map = new Map<string, Group>();
  for (const { spec } of UNITS) {
    if (spec.kind !== tab.kind) continue;
    const g = map.get(spec.group) ?? { label: spec.group, items: [] };
    g.items.push({ to: unitPath(spec.id), name: spec.title });
    map.set(spec.group, g);
  }
  return [...map.values()];
}

function UnitList({ tab }: { tab: Tab }) {
  const [q, setQ] = useState('');
  const here = useLocation().pathname;
  const groups = groupsFor(tab)
    .map((g) => ({
      ...g,
      items: g.items.filter((i) =>
        i.name.toLowerCase().includes(q.toLowerCase()),
      ),
    }))
    .filter((g) => g.items.length > 0);
  return (
    <nav
      aria-label={tab.label}
      className="sticky top-12 h-[calc(100dvh-3rem)] w-56 shrink-0 space-y-4 overflow-auto border-r bg-rail p-3"
    >
      <Input
        placeholder="Filter"
        aria-label="Filter"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
        }}
      />
      {groups.length === 0 && <Quiet>Nothing listed.</Quiet>}
      {groups.map((g) => (
        <div key={g.label} className="space-y-1">
          <p className="mb-1 px-2 text-xs text-muted-foreground">{g.label}</p>
          {g.items.map((i) => (
            <Link
              key={i.to}
              to={i.to}
              className={cn(
                'flex h-control items-center rounded-md px-2 text-sm hover:bg-muted/50',
                here === i.to.split('?')[0] &&
                  'bg-primary-soft font-medium text-primary',
              )}
            >
              {i.name}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

function Shell({ tab, children }: { tab: Tab; children: React.ReactNode }) {
  const navigate = useNavigate();
  const tabs = TABS.filter(
    (t) => t.always || UNITS.some((u) => u.spec.kind === t.kind),
  );
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="sticky top-0 z-20 flex h-12 items-center gap-6 border-b bg-background px-card">
        <Link to="/" aria-label="PSet home">
          <Mark className="size-5" />
        </Link>
        <UnderlineNav className="h-full">
          {tabs.map((t) => (
            <UnderlineTab
              key={t.id}
              active={t.id === tab.id}
              onClick={() => {
                void navigate(`/design/${t.id}`);
              }}
            >
              {t.label}
            </UnderlineTab>
          ))}
        </UnderlineNav>
      </div>
      <div className="flex items-start">
        <UnitList tab={tab} />
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

const tabOfId = (id: string) => TABS.find((t) => t.id === id) ?? TABS[0];
const tabOfKind = (kind: Kind) => TABS.find((t) => t.kind === kind) ?? TABS[0];

function TabPage() {
  const { tab } = useParams();
  const t = TABS.find((x) => x.id === tab);
  if (!t) return <Navigate to="/design" replace />;
  return (
    <Shell tab={t}>
      {t.id === 'rules' ? (
        <RulesPage />
      ) : t.id === 'foundations' ? (
        <Foundations />
      ) : (
        <Quiet>{EMPTY[t.id]}</Quiet>
      )}
    </Shell>
  );
}

function UnitRoute({ sample }: { sample?: boolean }) {
  const params = useParams();
  const entry = sample
    ? findEntry('component', 'sample-row')
    : findEntry(params.kind as Kind, params.id ?? '');
  if (!entry)
    return (
      <Shell tab={TABS[0]}>
        <Quiet>No such unit.</Quiet>
      </Shell>
    );
  return (
    <Shell tab={tabOfKind(entry.spec.kind)}>
      <UnitPage key={entry.spec.id} entry={entry} />
    </Shell>
  );
}

/** `/design`: tabs across the top, a grouped list with a filter on the
 *  left, the unit on the right. */
export function Design() {
  return (
    <Routes>
      <Route index element={<Navigate to="/design/foundations" replace />} />
      <Route path="sample" element={<UnitRoute sample />} />
      <Route
        path="rules/:id"
        element={
          <Shell tab={tabOfId('rules')}>
            <RulePage />
          </Shell>
        }
      />
      <Route path=":kind/:id" element={<UnitRoute />} />
      <Route path=":tab" element={<TabPage />} />
    </Routes>
  );
}
