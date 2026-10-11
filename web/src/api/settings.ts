import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { get, post, put } from './client';
import { on } from './events';
import type {
  About,
  Health,
  KeyInput,
  HealthCheck,
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

/** Health is the local system, which changes under us: always refetched
 *  when Settings opens. */
export const useHealth = () =>
  useQuery({
    queryKey: settingsKeys.health,
    queryFn: () => get<Health>('/api/health'),
    staleTime: 0,
  });

export function useFixCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => post<HealthCheck>(`/api/health/${id}/fix`),
    onSuccess: (fixed) =>
      qc.setQueryData<Health>(
        settingsKeys.health,
        (h) =>
          h && { checks: h.checks.map((c) => (c.id === fixed.id ? fixed : c)) },
      ),
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
