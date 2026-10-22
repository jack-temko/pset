import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Box } from '@/components/box';
import { Label } from '@/components/label';
import { loadImports } from '@/design/imports';
import {
  leadsHere,
  leadsTo,
  madeOf,
  usedBy,
  type Imports,
} from '@/design/registry';
import type { AnySpec } from '@/design/spec';
import { cn } from '@/lib/utils';
import { ALL_SPECS, specOf, unitPath } from './lookup';

function Quiet({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function UnitBox({
  id,
  label,
  center,
  small,
}: {
  id: string;
  label?: string;
  center?: boolean;
  small?: boolean;
}) {
  const s = specOf(id);
  return (
    <Link to={unitPath(id)} className="block min-w-0">
      <Box
        className={cn(
          small ? 'px-2 py-1' : 'px-card py-2',
          'hover:bg-muted/50',
          center && 'border-primary bg-primary-soft hover:bg-primary-soft',
        )}
      >
        {label && (
          <p className="truncate text-xs text-muted-foreground">{label}</p>
        )}
        <p className="flex items-center justify-between gap-2 text-sm font-medium">
          <span className="min-w-0">{s?.title ?? id}</span>
          <Label tone={center ? 'primary' : 'default'}>
            {s?.kind ?? 'unknown'}
          </Label>
        </p>
      </Box>
    </Link>
  );
}

function Down() {
  return (
    <p aria-hidden className="py-2 text-center text-muted-foreground">
      ↓
    </p>
  );
}

function Row({ label, ids }: { label: string; ids: string[] }) {
  return (
    <div className="space-y-2">
      <Quiet>{label}</Quiet>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <UnitBox key={id} id={id} small />
        ))}
      </div>
    </div>
  );
}

function Side({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; id: string; label: string }[];
}) {
  if (rows.length === 0) return <div />;
  return (
    <div className="space-y-2">
      <Quiet>{title}</Quiet>
      {rows.map((x) => (
        <UnitBox key={x.key} id={x.id} label={x.label} />
      ))}
    </div>
  );
}

const GUTTER =
  'absolute inset-y-0 flex w-10 items-center justify-center text-muted-foreground';

/** Three rows: Inside, then the band (Leads here, the unit alone, Leads
 *  to, one arrow per gutter at the unit's centre), then Made of. Derived
 *  only: nothing here is written by hand. A unit with no sides is just what
 *  holds it and what it holds. */
export function NeighbourMap({ spec }: { spec: AnySpec }) {
  const from = leadsHere(ALL_SPECS, spec.id).map((l) => ({
    key: `${l.unit}:${l.action.id}`,
    id: l.unit,
    label: l.action.label,
  }));
  const to = leadsTo(spec).map((l) => ({
    key: l.action.id,
    id: l.unit,
    label: l.action.label,
  }));
  const [imports, setImports] = useState<Imports>({});
  useEffect(() => {
    let live = true;
    void loadImports().then((i) => {
      if (live) setImports(i);
    });
    return () => {
      live = false;
    };
  }, []);
  const inside = usedBy(imports, spec.id);
  const made = madeOf(imports, spec.id);
  if (from.length === 0 && to.length === 0 && inside.length + made.length === 0)
    return <Quiet>Nothing links to this unit, and it links to nothing.</Quiet>;
  if (from.length === 0 && to.length === 0)
    return (
      <div className="space-y-4">
        {inside.length > 0 && <Row label="Used in" ids={inside} />}
        {made.length > 0 && <Row label="Made of" ids={made} />}
      </div>
    );
  return (
    <div>
      {inside.length > 0 && (
        <div className="space-y-2">
          <div className="text-center">
            <Quiet>Inside</Quiet>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {inside.map((id) => (
              <UnitBox key={id} id={id} small />
            ))}
          </div>
          <Down />
        </div>
      )}
      <div className="grid grid-cols-3 items-center gap-x-10">
        <Side title="Leads here" rows={from} />
        <div className="relative">
          <UnitBox id={spec.id} center />
          {from.length > 0 && (
            <span aria-hidden className={cn(GUTTER, '-left-10')}>
              →
            </span>
          )}
          {to.length > 0 && (
            <span aria-hidden className={cn(GUTTER, '-right-10')}>
              →
            </span>
          )}
        </div>
        <Side title="Leads to" rows={to} />
      </div>
      {made.length > 0 && (
        <div>
          <Down />
          <Row label="Made of" ids={made} />
        </div>
      )}
    </div>
  );
}
