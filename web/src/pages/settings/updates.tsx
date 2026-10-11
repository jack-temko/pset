import { useEffect, useState } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';

import { Box, BoxBody, BoxFooter, BoxRow } from '@/components/box';
import { Button } from '@/components/button';
import { Loaded } from '@/components/loaded';
import { Skeleton } from '@/components/skeleton';
import { Spinner } from '@/components/spinner';
import { get } from '@/api/client';
import {
  useApplyUpdate,
  useCheckUpdate,
  useUpdate,
  type Status,
} from '@/api/update';
import { plural } from '@/lib/utils';

/** How often the page asks whether PSet is back, and how long it waits. */
const POLL = 1500;
const GIVE_UP = 90_000;

/**
 * Waits for PSet to restart onto `version`: asks the server until it answers
 * with that version, then reloads the page, so the new web app is the one
 * running. Reports `lost` if it never comes back, so the page can say so.
 */
function useComesBack(version: string | null): { lost: boolean } {
  const [lost, setLost] = useState(false);
  useEffect(() => {
    if (!version) return;
    let live = true;
    const began = Date.now();
    const tick = async () => {
      try {
        const s = await get<Status>('/api/update');
        if (live && s.version === version) {
          window.location.reload();
          return;
        }
      } catch {
        // Down while it restarts: expected.
      }
      if (!live) return;
      if (Date.now() - began > GIVE_UP) setLost(true);
      else timer = setTimeout(tick, POLL);
    };
    let timer = setTimeout(tick, POLL);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [version]);
  return { lost };
}

/** The line under the version: what the last check found, or what to do. */
function headline(status: Status): string {
  const c = status.checked;
  if (!c) return 'Press Check to see if a newer version is out.';
  return c.newer
    ? `PSet ${c.version} is available.`
    : "You're on the newest version.";
}

/**
 * Settings, Updates: the running version, a Check button (the only time PSet
 * contacts GitHub, until the person presses Update), the release's notes and
 * an Update button that downloads it, checks it was signed by PSet's release
 * key, replaces the program and restarts. Spec: design/settings.md, "Updates".
 */
export function Updates() {
  const update = useUpdate();
  const check = useCheckUpdate();
  const apply = useApplyUpdate();
  const [coming, setComing] = useState<string | null>(null);
  const { lost } = useComesBack(coming);

  return (
    <Loaded
      query={update}
      skeleton={
        <Box>
          <BoxRow
            title="PSet"
            description={<Skeleton className="h-3 w-64" />}
            trailing={
              <Button variant="outline" size="sm" disabled>
                Check for updates
              </Button>
            }
          />
        </Box>
      }
    >
      {(data) => {
        const checked = data.checked;
        const available = !!checked?.newer;
        const error = check.error ?? apply.error;
        const updating = apply.isPending || coming !== null;

        return (
          <Box>
            <BoxRow
              leading={
                checked && !available ? (
                  <CircleCheck
                    className="text-success"
                    aria-label="Up to date"
                  />
                ) : undefined
              }
              title={`PSet ${data.version}`}
              description={
                coming !== null
                  ? lost
                    ? "PSet didn't come back within a minute and a half. Start it again yourself; your library is untouched."
                    : `Installed ${coming}. PSet is restarting, and this page reloads when it is back.`
                  : headline(data)
              }
              trailing={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={check.isPending || updating}
                  onClick={() => {
                    check.mutate();
                  }}
                >
                  {check.isPending ? (
                    <>
                      <Spinner className="size-3" />
                      Checking
                    </>
                  ) : (
                    'Check for updates'
                  )}
                </Button>
              }
            />
            {error && (
              <BoxBody className="flex items-start gap-2 text-sm text-destructive">
                <CircleAlert className="mt-1 size-4 shrink-0" />
                {error.message}
              </BoxBody>
            )}
            {available && coming === null && (
              <>
                {checked.notes && (
                  <BoxBody className="max-h-64 overflow-y-auto text-sm whitespace-pre-wrap">
                    {checked.notes}
                  </BoxBody>
                )}
                <BoxFooter className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {!data.canUpdate
                      ? data.why
                      : data.busy > 0
                        ? `${plural(data.busy, 'job')} still running or waiting. PSet restarts to update, and they pick up where they left off.`
                        : 'PSet restarts to update. Your library is backed up first if the new version changes it.'}
                  </p>
                  <Button
                    disabled={!data.canUpdate || updating}
                    onClick={() => {
                      apply.mutate(undefined, {
                        onSuccess: (done) => {
                          setComing(done.version);
                        },
                      });
                    }}
                  >
                    {updating ? (
                      <>
                        <Spinner className="size-3" />
                        Updating
                      </>
                    ) : (
                      `Update to ${checked.version}`
                    )}
                  </Button>
                </BoxFooter>
              </>
            )}
            {!data.canUpdate && !available && (
              <BoxBody className="text-xs text-muted-foreground">
                {data.why}
              </BoxBody>
            )}
          </Box>
        );
      }}
    </Loaded>
  );
}
