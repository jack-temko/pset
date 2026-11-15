import { waits, type Loads, type Waits } from '@/design/loading';
import { TopBar } from '@/units/top-bar';
import { matching, startFilters, type Filters } from './filter';
import { Page } from './page';
import type { PageData } from './sample';

export type { Filters };

/** What sizes the list page while it loads: which list it is, and how many
 *  rows match the filters it opens with. Every row has two lines, and the
 *  crumbs, title, filter bar and switch come from the link (list-page-d9). */
export interface ListPageShape {
  kind: PageData['kind'];
  count: number;
}

const listPageLoads = {
  data: ['page'],
  shapeOf: (d: {
    page: PageData;
    initial?: Partial<Filters>;
  }): ListPageShape => ({
    kind: d.page.kind,
    count: matching(d.page.items, startFilters(d.page.kind, d.initial)).matches
      .length,
  }),
} satisfies Loads<
  { page: PageData; initial?: Partial<Filters> },
  ListPageShape
>;

/** The one list page every list passes into (list-page-d1): a path back, a
 *  heading, a filter bar and the same list box with every match in one
 *  scroll. Filters start from where "Show all" came from and live in this
 *  component's state; the URL holds them once the page is wired
 *  (list-page-d3). Loading, the crumbs, title and filter bar are real and the
 *  list is its frame at the count "Show all N" carried (list-page-d9). */
export const ListPage = waits(
  listPageLoads,
  function ListPage({
    page,
    initial,
    today,
    courseHref,
    homeHref = '/',
    settingsHref = '/settings',
    loading,
  }: Waits<
    {
      /** Where the filters start: what "Show all" came from. */
      initial?: Partial<Filters>;
      /** The moment due dates count from. */
      today: Date;
      /** Where a course's name goes (a placeholder until the course screen is wired). */
      courseHref: (name: string) => string;
      homeHref?: string;
      settingsHref?: string;
    },
    { page: PageData },
    ListPageShape
  >) {
    // Nothing known, not even which list: the top bar alone (skeleton-grill S2).
    if (loading === 'unknown')
      return <TopBar homeHref={homeHref} settingsHref={settingsHref} />;
    return (
      <Page
        kind={loading === undefined ? page.kind : loading.kind}
        page={page}
        count={loading?.count}
        initial={initial}
        today={today}
        courseHref={courseHref}
        homeHref={homeHref}
        settingsHref={settingsHref}
      />
    );
  },
);
