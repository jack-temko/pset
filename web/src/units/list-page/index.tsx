import { waits, type Loads } from '@/design/loading';
import { Page } from './page';
import type { PageData } from './sample';

/** The list page every "Show all" opens: the title, a filter bar, then the
 *  list. Its quiet form is the crumbs, the title and the filter bar, all known
 *  from the link; it stops at the list, whose length is not (loading D2). */
export const ListPage = waits(
  { data: ['page'] } satisfies Loads<{ page: PageData }>,
  Page,
);
