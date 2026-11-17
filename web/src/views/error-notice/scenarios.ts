import type { Group } from '@/api/errors';
import type { Scenario } from '@/views/mock/scenario';
import { IMPORT_FAILED } from './sample';

function state(
  id: string,
  title: string,
  note: string,
  routes: Scenario['start'] = () => ({ routes: [], props: { state: id } }),
): Scenario {
  return { id, title, note, start: routes };
}

/** What Settings, Errors keeps in the sample: two ids, one of them twice. */
function kept(): Group[] {
  const chain = IMPORT_FAILED.chain;
  return [
    {
      id: 'import.failed',
      what: "Couldn't prepare Calculus.",
      count: 2,
      last: new Date(Date.now() - 20 * 60_000).toISOString(),
      incidents: [
        {
          incident: 'E7K2QF',
          at: new Date(Date.now() - 20 * 60_000).toISOString(),
          what: "Couldn't prepare Calculus.",
          chain,
          route: 'job prepare',
          detail: 'import.failed: key.out_of_credit',
        },
        {
          incident: 'B8TQ2A',
          at: new Date(Date.now() - 26 * 3_600_000).toISOString(),
          what: "Couldn't prepare Statistics.",
          chain,
          route: 'job prepare',
          detail: 'import.failed: key.out_of_credit',
        },
      ],
    },
    {
      id: 'ask.turn_failed',
      what: "Couldn't answer that.",
      count: 1,
      last: new Date(Date.now() - 3 * 3_600_000).toISOString(),
      incidents: [
        {
          incident: 'H3M9XD',
          at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
          what: "Couldn't answer that.",
          chain: ['ask.turn_failed', 'model.cut'],
          route: 'job turn',
          detail: 'ask.turn_failed: model.cut',
        },
      ],
    },
  ];
}

/** One scenario per state of the error notice. */
export const SCENARIOS: Scenario[] = [
  state(
    'inline',
    'Inline notice',
    'The import of Calculus failed; the notice says what, why and the fix, with the button the error asks for.',
  ),
  state(
    'row',
    'On the shelf',
    'The same failure in the book’s row, with Dismiss; the next book keeps queueing.',
  ),
  state(
    'banner',
    'Screen banner',
    'The server stopped answering: one banner for the whole screen, once.',
  ),
  state(
    'field',
    'Field line',
    'A title left empty: one line under the field, no Details.',
  ),
  state(
    'settings',
    'Settings, Errors',
    'Every kept error grouped by id with its count; Clear all asks first.',
    () => {
      let groups = kept();
      return {
        routes: [
          ['GET', '/api/errors', () => groups],
          [
            'DELETE',
            '/api/errors',
            () => {
              groups = [];
              return undefined;
            },
          ],
        ],
        props: { state: 'settings' },
      };
    },
  ),
];
