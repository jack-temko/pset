import { UNKNOWN, waits, type Loads, type Waits } from '@/design/loading';
import { ErrorNotice } from '@/units/error-notice';
import { TopBar } from '@/units/top-bar';
import { Loaded, Waiting, type SettingsShape } from './page';
import type { SettingsData } from './sample';

export type { SettingsShape };

/** The Settings page (G1 to G13, confirmed by Jack in settings-view-grill):
 *  four groups on one page, each row a name and what it does on the left and
 *  its control on the right. It reads sample data; nothing is saved or sent.
 *  Loading, every name, hint and button is real and the values are bars; a
 *  failed read keeps the page's shape under its notice (skeleton-grill S4). */
const settingsLoads = {
  data: ['settings'],
  shapeOf: (d): SettingsShape => ({
    models: d.settings.models.length,
    courses: d.settings.usage.courses.length,
    notes:
      d.settings.update.status === 'current'
        ? undefined
        : (d.settings.update.notes ?? []).length,
    checks: d.settings.checks.length,
    failing: d.settings.checks.some((c) => !c.ok),
    errors: d.settings.errors.length,
    keyNote: d.settings.key.status !== 'ok',
  }),
} satisfies Loads<{ settings: SettingsData }, SettingsShape>;

export const Settings = waits(
  settingsLoads,
  function Settings({
    settings,
    failed,
    unfolded,
    homeHref = '/',
    settingsHref = '/settings',
    loading,
  }: Waits<
    {
      /** The read failed: the page keeps its shape under the notice. */
      failed?: boolean;
      /** Opens every fold (the design page only). */
      unfolded?: boolean;
      homeHref?: string;
      settingsHref?: string;
    },
    { settings: SettingsData },
    SettingsShape
  >) {
    const top = (
      <TopBar
        homeHref={homeHref}
        settingsHref={settingsHref}
        onSettings
        path={[{ label: 'Settings' }]}
      />
    );
    const title = (
      <div className="ds-room-display">
        <h1 className="ds-display text-(--ds-fg)">Settings</h1>
      </div>
    );
    // Nothing known: the title alone, the body quiet (skeleton-grill S2).
    if (loading === UNKNOWN)
      return (
        <div>
          {top}
          <div className="px-(--ds-gutter) pb-16">
            <div className="@container mx-auto max-w-(--ds-page-width)">
              {title}
            </div>
          </div>
        </div>
      );
    const shape: SettingsShape =
      loading === undefined ? settingsLoads.shapeOf({ settings }) : loading;
    const body =
      loading === undefined && failed !== true ? (
        <Loaded settings={settings} unfolded={unfolded} />
      ) : (
        <Waiting shape={shape} unfolded={unfolded} />
      );
    return (
      <div>
        {top}
        <div className="px-(--ds-gutter) pb-16">
          <div className="@container mx-auto max-w-(--ds-page-width)">
            {title}
            {failed === true && loading === undefined ? (
              // The page keeps its shape, unseen, and the notice lies over it.
              <div className="grid">
                <div aria-hidden className="invisible [grid-area:1/1]">
                  {body}
                </div>
                <div className="flex justify-center pt-24 [grid-area:1/1]">
                  <ErrorNotice
                    error={{
                      what: "Couldn't load Settings",
                      why: "PSet couldn't read your settings. Nothing was changed.",
                      chain: ['settings.load'],
                    }}
                    actions={[{ label: 'Try again' }]}
                  />
                </div>
              </div>
            ) : (
              body
            )}
          </div>
        </div>
      </div>
    );
  },
);
