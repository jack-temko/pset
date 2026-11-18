// Generated from the action catalog (internal/action) by tools/actioncatalog. Do not edit.
import type { Entry } from './action';
import type * as course from './course';
import type * as material from './material';

export type ActionId =
  | "course.add"
  | "course.remove"
  | "course.rename"
  | "material.add"
  | "material.remove"
  | "material.rename"
  | "material.textbook"
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
  "material.add": {
    id: "material.add",
    name: "Add material",
    needs: ["pdf_reader"],
    undoable: true,
    costs: true,
  },
  "material.remove": {
    id: "material.remove",
    name: "Remove material",
    needs: [],
    undoable: true,
    costs: false,
  },
  "material.rename": {
    id: "material.rename",
    name: "Rename material",
    needs: [],
    undoable: true,
    costs: false,
  },
  "material.textbook": {
    id: "material.textbook",
    name: "Make it the textbook",
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
  "material.add": material.Add;
  "material.remove": material.Remove;
  "material.rename": material.Rename;
  "material.textbook": material.Textbook;
}
