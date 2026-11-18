import { useEffect, useMemo } from 'react';

import { useLiveData } from '@/data/live';
import { useRead } from '@/data/read';
import { coursesList, incidentsList, useList } from '@/data/resources';
import {
  readChecks,
  readSettings,
  serverActions,
  settingsData,
} from '@/data/settings';
import { Settings } from '@/units/settings';

import { Frame } from './frame';

/**
 * Settings on the new backend: the Settings unit, given what the server
 * holds and actions that do it. Courses and incidents come from the store,
 * so a dismissed incident or a course added in another tab shows here as it
 * happens; the rest is read once as the page opens, and again after an
 * action changes it. The checks come on their own, after the rest (they
 * run as Settings opens, about a second).
 */
export function SettingsScreen() {
  return (
    <Frame>
      <SettingsPage />
    </Frame>
  );
}

function SettingsPage() {
  useLiveData();
  const courses = useList(coursesList);
  const incidents = useList(incidentsList);
  const courseItems = courses.state === 'ready' ? courses.items : undefined;
  const [reads, rereadSettings] = useRead(() =>
    // Spend is read per course, so the rest waits for the course list.
    courseItems === undefined
      ? new Promise<never>(() => undefined)
      : readSettings(courseItems),
  );
  const [checks, recheck] = useRead(readChecks);

  // The course list arrives after the first read set off: read again once.
  const courseKey = courseItems?.map((c) => c.id).join(',');
  useEffect(() => {
    if (courseKey !== undefined) rereadSettings();
  }, [courseKey, rereadSettings]);

  const actions = useMemo(
    () => serverActions({ settings: rereadSettings, checks: recheck }),
    [rereadSettings, recheck],
  );

  if (
    reads.state === 'failed' ||
    courses.state === 'failed' ||
    incidents.state === 'failed'
  ) {
    return (
      <Settings
        loading
        failed
        actions={actions}
        onRetry={() => {
          window.location.reload();
        }}
      />
    );
  }
  if (
    reads.state !== 'ready' ||
    courseItems === undefined ||
    incidents.state !== 'ready'
  ) {
    return <Settings loading />;
  }
  return (
    <Settings
      settings={settingsData(
        reads.value,
        courseItems,
        checks.state === 'ready'
          ? checks.value
          : checks.state === 'failed'
            ? // The checks themselves could not run: Health says so, as a
              // failing check, rather than shimmering for ever.
              [
                {
                  id: 'health',
                  name: 'Health checks',
                  ok: false,
                  detail: checks.error.what,
                },
              ]
            : undefined,
        incidents.items,
      )}
      actions={actions}
    />
  );
}
