import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { get, post, put } from './client'
import type {
  About,
  ConnectionInput,
  Health,
  HealthCheck,
  ResetCounts,
  SaveResult,
  Settings,
  TestResult,
} from './gen/settings'

export type * from './gen/settings'

export const settingsKeys = {
  settings: ['settings'] as const,
  health: ['health'] as const,
  resetCounts: ['reset-counts'] as const,
  about: ['about'] as const,
}

export const useSettings = () =>
  useQuery({ queryKey: settingsKeys.settings, queryFn: () => get<Settings>('/api/settings') })

/** Dials what's on screen and writes nothing. */
export const useTestConnection = () =>
  useMutation({ mutationFn: (in_: ConnectionInput) => post<TestResult>('/api/settings/test', in_) })

/** Tests, then writes only if the test passed. */
export function useSaveConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (in_: ConnectionInput) => put<SaveResult>('/api/settings', in_),
    onSuccess: (r) => qc.setQueryData(settingsKeys.settings, r.settings),
  })
}

/** Health is the local system, which changes under us: always refetched
 *  when Settings opens. */
export const useHealth = () =>
  useQuery({ queryKey: settingsKeys.health, queryFn: () => get<Health>('/api/health'), staleTime: 0 })

export function useFixCheck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => post<HealthCheck>(`/api/health/${id}/fix`),
    onSuccess: (fixed) =>
      qc.setQueryData<Health>(settingsKeys.health, (h) =>
        h && { checks: h.checks.map((c) => (c.id === fixed.id ? fixed : c)) },
      ),
  })
}

export const useResetCounts = (enabled: boolean) =>
  useQuery({
    queryKey: settingsKeys.resetCounts,
    queryFn: () => get<ResetCounts>('/api/reset'),
    enabled,
    staleTime: 0,
  })

/** A fresh install: the cache goes with it. */
export function useReset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => post<void>('/api/reset'),
    onSuccess: () => qc.clear(),
  })
}

export const useAbout = () => useQuery({ queryKey: settingsKeys.about, queryFn: () => get<About>('/api/about') })
