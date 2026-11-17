// Generated from the action catalog (internal/action) by tools/actioncatalog. Do not edit.
import type { Entry } from './action';
import type * as course from './course';

export type ActionId =
  | "course.add"
  | "course.remove"
  | "course.rename"
;

export const ACTIONS: Record<ActionId, Entry> = {
  "course.add": {
    id: "course.add",
    name: "Add course",
    needs: [],
    undoable: true,
    costs: false,
  },
  "course.remove": {
    id: "course.remove",
    name: "Remove course",
    needs: [],
    undoable: true,
    costs: false,
  },
  "course.rename": {
    id: "course.rename",
    name: "Rename course",
    needs: [],
    undoable: true,
    costs: false,
  },
};

// What each action takes: the body of POST /api/actions/{id}.
export interface ActionInputs {
  "course.add": course.Add;
  "course.remove": course.Remove;
  "course.rename": course.Rename;
}
