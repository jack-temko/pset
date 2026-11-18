import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { get, post, put } from './client';
import { on } from './events';
import type { Health as Conditions } from './gen/health';
import type {
  About,
  KeyInput,
  Profile,
  ResetCounts,
  SaveResult,
  Settings,
  TestResult,
} from './gen/settings';

export type * from './gen/settings';

export const settingsKeys = {
  settings: ['settings'] as const,
  health: ['health'] as const,
  resetCounts: ['reset-counts'] as const,
  about: ['about'] as const,
};

export const useSettings = () =>
  useQuery({
    queryKey: settingsKeys.settings,
    queryFn: () => get<Settings>('/api/settings'),
  });

/** Who's studying: nothing to test, so it writes straight away. */
export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Profile) => put<Profile>('/api/settings/profile', p),
    onSuccess: (p) =>
      qc.setQueryData<Settings>(
        settingsKeys.settings,
        (s) => s && { ...s, profile: p },
      ),
  });
}

/** Tries the key on screen and writes nothing. */
export const useTestKey = () =>
  useMutation({
    mutationFn: (in_: KeyInput) => post<TestResult>('/api/settings/test', in_),
  });

/** Tests, then writes only if the test passed. */
export function useSaveKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (in_: KeyInput) => put<SaveResult>('/api/settings', in_),
    onSuccess: (r) => qc.setQueryData(settingsKeys.settings, r.settings),
  });
}

/** One check as the old Settings page draws it. The server now lists
 *  conditions (gen/health); this keeps the page's shape until track 8
 *  rebuilds Settings on them. */
export interface HealthCheck {
  id: string;
  name: string;
  ok: boolean;
  fixable: boolean;
  detail: string;
  /** The action that fixes it, when PSet can. */
  fix?: string;
}

export interface Health {
  checks: HealthCheck[];
}

/** Health is the local system, which changes under us: always refetched
 *  when Settings opens. Only the conditions PSet checks are listed (those
 *  with a detail); the key's lives beside the key. */
export const useHealth = () =>
  useQuery({
    queryKey: settingsKeys.health,
    queryFn: async (): Promise<Health> => {
      const h = await get<Conditions>('/api/health');
      return {
        checks: h.checks
          .filter((c) => c.detail !== undefined)
          .map((c) => ({
            id: c.condition.id,
            name: c.name,
            ok: c.condition.holds,
            fixable: c.condition.fix !== undefined,
            detail: c.detail ?? '',
            fix: c.condition.fix,
          })),
      };
    },
    staleTime: 0,
  });

/** Runs a check's fix, an action, by the check's id; the list is then
 *  checked again. */
export function useFixCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const fix = qc
        .getQueryData<Health>(settingsKeys.health)
        ?.checks.find((c) => c.id === id)?.fix;
      if (fix !== undefined) await post(`/api/actions/${fix}`);
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: settingsKeys.health }),
  });
}

/** What a reset would delete. Fetched with the Settings page, so the
 *  confirmation has its numbers when it opens; it refreshes when books change. */
export const useResetCounts = () =>
  useQuery({
    queryKey: settingsKeys.resetCounts,
    queryFn: () => get<ResetCounts>('/api/reset'),
  });

for (const type of ['book.changed', 'book.removed'])
  on(
    type,
    (_, qc) =>
      void qc.invalidateQueries({ queryKey: settingsKeys.resetCounts }),
  );

/** A fresh install: the cache goes with it. */
export function useReset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => post<undefined>('/api/reset'),
    onSuccess: () => {
      qc.clear();
    },
  });
}

export const useAbout = () =>
  useQuery({
    queryKey: settingsKeys.about,
    queryFn: () => get<About>('/api/about'),
  });
