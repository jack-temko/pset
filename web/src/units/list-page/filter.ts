import type { PageCourse, PageData, PageMemory, PageSet } from './sample';

export interface Filters {
  /** Matches names. */
  query: string;
  /** A course's name, or 'all'. */
  course: string;
  /** The list's state: 'todo' or 'done' for work, 'yours' or 'ask' for memories. */
  state: string;
  /** A sort id; without one the state's own default (list-page-d5). */
  sort?: string;
}

export interface Option {
  id: string;
  label: string;
}

export const STATES: Record<PageData['kind'], readonly Option[]> = {
  work: [
    { id: 'todo', label: 'To do' },
    { id: 'done', label: 'Done' },
  ],
  memories: [
    { id: 'yours', label: 'Yours' },
    { id: 'ask', label: 'From Ask' },
  ],
  courses: [],
};

/** Where the filters start: what "Show all" came from, over the defaults. */
export function startFilters(
  kind: PageData['kind'],
  initial: Partial<Filters> | undefined,
): Filters {
  return {
    query: '',
    course: 'all',
    state: STATES[kind].at(0)?.id ?? '',
    ...initial,
  };
}

type Item = PageSet | PageMemory | PageCourse;

/** The items the filters let through, and those on one side of the switch. */
export function matching(items: readonly Item[], f: Filters) {
  const needle = f.query.trim().toLowerCase();
  const narrowed = items.filter(
    (i) =>
      (f.course === 'all' || i.course === f.course) &&
      ('text' in i ? i.text : i.name).toLowerCase().includes(needle),
  );
  const side = (id: string) =>
    narrowed.filter((i) =>
      'source' in i
        ? i.source === id
        : 'total' in i
          ? id === 'done'
            ? i.finished !== undefined
            : i.finished === undefined
          : true,
    );
  return { needle, side, matches: side(f.state) };
}
