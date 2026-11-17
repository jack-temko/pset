import { waits, type Loads } from '@/design/loading';
import { Page } from './page';
import type { SettingsData } from './sample';

/** The Settings page (G1 to G13, confirmed by Jack in settings-view-grill):
 *  four groups on one page. It reads sample data; nothing is saved or sent.
 *  Its quiet form is the top bar and the title (loading D2). */
export const Settings = waits(
  { data: ['settings', 'failed'] } satisfies Loads<{
    settings: SettingsData;
    failed?: boolean;
  }>,
  Page,
);
