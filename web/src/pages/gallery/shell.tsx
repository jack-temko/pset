import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AppShell } from '@/components/shell';
import { Input } from '@/components/input';
import { cn } from '@/lib/utils';
import { filterEntries, groupsOf, type GalleryEntry } from './registry';

/**
 * The frame both gallery routes share: a left index and one entry's page.
 *
 * A filled screen, so the index and the page each scroll on their own and
 * the top bar stays put. The index is the workspace rail's shape (full
 * width rows, the current one `primary-soft`); above it a filter, which
 * `/` focuses from anywhere and Enter opens the first match of.
 *
 * Not in the product's nav: it is where you look at what a change did.
 */
export function GalleryShell({
  label,
  basePath,
  entries,
  entry,
  toolbar,
  children,
}: {
  /** What the gallery is called: "Components", "Views". */
  label: string;
  /** Where its entries live: `/components`. */
  basePath: string;
  entries: GalleryEntry[];
  /** The entry shown, if any. */
  entry?: GalleryEntry;
  /** Beside the title: a Demo | Docs switch, a scenario picker. */
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const filter = useRef<HTMLInputElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);

  const shown = useMemo(() => filterEntries(entries, query), [entries, query]);
  const groups = useMemo(() => groupsOf(shown), [shown]);

  // `/` finds the filter, unless the key is being typed into something.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t?.closest('input, textarea, select, [contenteditable], dialog[open]')
      )
        return;
      e.preventDefault();
      filter.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // A new entry starts at its top, and the index keeps it in view.
  useEffect(() => {
    page.current?.scrollTo(0, 0);
    nav.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [entry?.id]);

  return (
    <AppShell
      scroll="fill"
      middle={
        <span className="text-muted-foreground">
          {label}
          {entry && (
            <>
              {' / '}
              <span className="text-foreground">{entry.title}</span>
            </>
          )}
        </span>
      }
    >
      <div className="flex h-full">
        <aside className="flex w-rail shrink-0 flex-col border-r bg-rail">
          <div className="border-b p-3">
            <Input
              ref={filter}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setQuery('');
                  e.currentTarget.blur();
                } else if (e.key === 'Enter' && shown[0]) {
                  navigate(`${basePath}/${shown[0].id}`);
                  e.currentTarget.blur();
                }
              }}
              placeholder={`Filter ${label.toLowerCase()}  ( / )`}
              aria-label={`Filter ${label.toLowerCase()}`}
            />
          </div>
          <nav
            ref={nav}
            aria-label={label}
            className="min-h-0 flex-1 overflow-y-auto pb-4"
          >
            {groups.map((g) => (
              <div key={g.name}>
                <h2 className="px-4 pt-4 pb-1 text-xs font-medium text-muted-foreground uppercase">
                  {g.name}
                </h2>
                {g.entries.map((e) => (
                  <Link
                    key={e.id}
                    to={`${basePath}/${e.id}`}
                    aria-current={e.id === entry?.id ? 'page' : undefined}
                    className={cn(
                      'block truncate px-4 py-2 text-sm',
                      e.id === entry?.id
                        ? 'bg-primary-soft text-primary'
                        : 'text-foreground hover:bg-muted/50',
                    )}
                  >
                    {e.title}
                  </Link>
                ))}
              </div>
            ))}
            {shown.length === 0 && (
              <p className="px-4 pt-4 text-sm text-muted-foreground">
                Nothing matches “{query}”.
              </p>
            )}
          </nav>
        </aside>

        <div ref={page} className="min-w-0 flex-1 overflow-y-auto">
          <main className="mx-auto w-full max-w-layout-page space-y-section px-page py-12">
            {entry && (
              <header className="space-y-3 border-b pb-6">
                <p className="text-xs font-medium text-primary uppercase">
                  {entry.group}
                </p>
                <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                  <h1 className="min-w-0 flex-1 font-heading text-3xl">
                    {entry.title}
                  </h1>
                  {toolbar}
                </div>
                {entry.note && (
                  <p className="font-heading text-lg text-muted-foreground italic">
                    {entry.note}
                  </p>
                )}
              </header>
            )}
            {children}
          </main>
        </div>
      </div>
    </AppShell>
  );
}
