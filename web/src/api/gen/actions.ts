// Generated from the action catalog (internal/action) by tools/actioncatalog. Do not edit.
import type { Entry } from './action';
import type * as course from './course';
import type * as incident from './incident';
import type * as material from './material';

export type ActionId =
  | "course.add"
  | "course.remove"
  | "course.rename"
  | "health.get_embeddings"
  | "health.make_data_folder"
  | "incident.dismiss"
  | "incident.try_again"
  | "material.add"
  | "material.remove"
  | "material.rename"
  | "material.textbook"
  | "time.clear"
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
  "health.get_embeddings": {
    id: "health.get_embeddings",
    name: "Download the search model",
    needs: [],
    undoable: false,
    costs: false,
  },
  "health.make_data_folder": {
    id: "health.make_data_folder",
    name: "Make the data folder",
    needs: [],
    undoable: false,
    costs: false,
  },
  "incident.dismiss": {
    id: "incident.dismiss",
    name: "Dismiss",
    needs: [],
    undoable: true,
    costs: false,
  },
  "incident.try_again": {
    id: "incident.try_again",
    name: "Try again",
    needs: [],
    undoable: false,
    costs: true,
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
    name: "Move between Textbooks and Materials",
    needs: [],
    undoable: true,
    costs: false,
  },
  "time.clear": {
    id: "time.clear",
    name: "Forget time spent",
    needs: [],
    undoable: false,
    costs: false,
  },
};

// What each action takes: the body of POST /api/actions/{action}.
export interface ActionInputs {
  "course.add": course.Add;
  "course.remove": course.Remove;
  "course.rename": course.Rename;
  "health.get_embeddings": Record<string, never>;
  "health.make_data_folder": Record<string, never>;
  "incident.dismiss": incident.Dismiss;
  "incident.try_again": incident.TryAgain;
  "material.add": material.Add;
  "material.remove": material.Remove;
  "material.rename": material.Rename;
  "material.textbook": material.Textbook;
  "time.clear": Record<string, never>;
}
