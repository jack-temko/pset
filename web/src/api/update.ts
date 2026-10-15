import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { get, post } from './client';
import type { Applied, Status } from './gen/update';

export type * from './gen/update';

export const updateKeys = { status: ['update'] as const };

/** What is running and whether it can update itself. Asks only this PSet:
 *  nothing here reaches GitHub. */
export const useUpdate = () =>
  useQuery({
    queryKey: updateKeys.status,
    queryFn: () => get<Status>('/api/update'),
  });

/** Check for updates: the one call that reaches GitHub, made when the person
 *  presses the button. The answer lands in the status. */
export function useCheckUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => post<Status>('/api/update/check'),
    onSuccess: (status) => qc.setQueryData(updateKeys.status, status),
  });
}

/** Install the version the last check found. PSet restarts itself afterwards,
 *  so the page has to wait for it to come back (`useComesBack`). */
export const useApplyUpdate = () =>
  useMutation({ mutationFn: () => post<Applied>('/api/update/apply') });
