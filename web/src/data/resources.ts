import { useEffect, useSyncExternalStore } from 'react';

import { get } from '@/api/client';
import type { Course, Courses } from '@/api/gen/course';
import type { Incident, Incidents, Trace } from '@/api/gen/incident';
import type { Material, Materials } from '@/api/gen/material';

import {
  Store,
  type Held,
  type ListDef,
  type ListState,
  type ThingDef,
  type ThingState,
} from './store';

/**
 * The resources the new backend serves today, and the hooks screens read
 * them through. A new resource (a set, a question, a turn, when tracks 5 and
 * 6 land) is one `ThingDef`, and a `ListDef` per list it appears in: the
 * store's rules are the same for all.
 */

/** The page's one store. Screens on /design use their own sample data. */
export const store = new Store();

// ---- things

export const courseDef: ThingDef<Course> = {
  kind: 'course',
  read: (id) => get<Course>(`/api/courses/${id}`),
};

export const materialDef: ThingDef<Material> = {
  kind: 'material',
  read: (id) => get<Material>(`/api/materials/${id}`),
};

export const incidentDef: ThingDef<Incident> = {
  kind: 'incident',
  // An incident is read through its trace: there is no read of one alone.
  read: (id) => get<Trace>(`/api/incidents/${id}`).then((t) => t.incident),
};

// ---- lists

export const coursesList: ListDef<Course> = {
  key: 'courses',
  thing: courseDef,
  read: () => get<Courses>('/api/courses').then((r) => r.courses),
  covers: () => true,
};

/** A course's materials (textbooks and the rest: the screen splits them). */
export const materialsOf = (courseId: string): ListDef<Material> => ({
  key: `materials:${courseId}`,
  thing: materialDef,
  read: () =>
    get<Materials>(`/api/courses/${courseId}/materials`).then(
      (r) => r.materials,
    ),
  covers: (c) => c.courseId === courseId,
});

/** Settings' list: what is open, then what resolved in the last week. */
export const incidentsList: ListDef<Incident> = {
  key: 'incidents',
  thing: incidentDef,
  read: () => get<Incidents>('/api/incidents').then((r) => r.incidents),
  covers: () => true,
};

// ---- hooks

/** One thing, kept live while the component is on screen. */
export function useThing<T extends Held>(
  def: ThingDef<T>,
  id: string,
  s: Store = store,
): ThingState<T> {
  useEffect(() => s.watchThing(def, id), [s, def, id]);
  return useSyncExternalStore(s.subscribe, () => s.thing<T>(def.kind, id));
}

/** One list, and every thing in it, kept live while on screen. Pass the
 *  same def each render (a module constant, or memoized). */
export function useList<T extends Held>(
  def: ListDef<T>,
  s: Store = store,
): ListState<T> {
  const { key } = def;
  // The key names the list: a def made again each render is the same list.
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- the key stands for the def
  useEffect(() => s.watchList(def), [s, key]);
  return useSyncExternalStore(s.subscribe, () => s.list<T>(key));
}
