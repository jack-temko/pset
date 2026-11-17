import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { del, get } from './client';
import type { Group } from './gen/errlog';

export type { Group, Incident } from './gen/errlog';

/** Every error PSet showed and kept, grouped by id. It changes as PSet is
 *  used, with no event to say so, so it is read fresh each time it is
 *  looked at. */
export function useErrors() {
  return useQuery({
    queryKey: ['errors'],
    queryFn: () => get<Group[]>('/api/errors'),
    staleTime: 0,
  });
}

/** Forgets every kept error. */
export function useClearErrors() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => del<undefined>('/api/errors'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['errors'] }),
  });
}
