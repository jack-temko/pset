import { Navigate, useParams } from 'react-router-dom';

import { ERRORS, type CatalogEntry, type ErrorId } from '@/api/gen/errors';
import { Table, type TableColumn } from '@/components/table';
import { GalleryShell } from '@/pages/gallery/shell';
import type { GalleryEntry } from '@/pages/gallery/registry';

interface Row extends CatalogEntry {
  id: ErrorId;
}

const ALL: Row[] = (Object.keys(ERRORS) as ErrorId[]).map((id) => ({
  id,
  ...ERRORS[id],
}));

const owners = [...new Set(ALL.map((r) => r.owner))].sort();

/** One page per owning package, and one for every entry. */
const ENTRIES: GalleryEntry[] = [
  {
    id: 'all',
    title: 'Every error',
    group: 'Catalog',
    note: `${ALL.length} entries: what PSet says, why, and how to fix it. Read from the Go catalog; edit an entry there.`,
  },
  ...owners.map((o) => ({
    id: o,
    title: o,
    group: 'By package',
    note: `${ALL.filter((r) => r.owner === o).length} entries declared in internal/${o}/errors.go.`,
  })),
];

const columns: TableColumn<Row>[] = [
  { key: 'id', header: 'Id', mono: true, width: '16.5rem', cell: (r) => r.id },
  {
    key: 'what',
    header: 'What',
    cell: (r) => <span className="whitespace-normal">{r.what}</span>,
  },
  {
    key: 'why',
    header: 'Why',
    cell: (r) => <span className="whitespace-normal">{r.why}</span>,
  },
  {
    key: 'fix',
    header: 'Fix',
    cell: (r) => <span className="whitespace-normal">{r.fix}</span>,
  },
  {
    key: 'action',
    header: 'Action',
    mono: true,
    width: '7rem',
    cell: (r) => r.action,
  },
  { key: 'scope', header: 'Scope', width: '5rem', cell: (r) => r.scope },
  {
    key: 'status',
    header: 'Status',
    numeric: true,
    width: '4rem',
    cell: (r) => r.status,
  },
];

/**
 * Every error in the catalog, read-only (design/errors.md is the same table
 * as a document). Not in the nav: a place to read the words a student will
 * be told, all in one place.
 */
export function Errors() {
  const { section } = useParams();
  if (!section) return <Navigate to="/errors/all" replace />;
  const entry = ENTRIES.find((e) => e.id === section);
  if (!entry) return <Navigate to="/errors/all" replace />;
  const rows = section === 'all' ? ALL : ALL.filter((r) => r.owner === section);
  return (
    <GalleryShell
      label="Errors"
      basePath="/errors"
      entries={ENTRIES}
      entry={entry}
    >
      <Table
        caption={`${entry.title}: the catalog's errors`}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        dense
      />
    </GalleryShell>
  );
}
