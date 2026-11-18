// Generated from the action catalog (internal/action) by tools/actioncatalog. Do not edit.
import type { Entry } from './action';
import type * as course from './course';
import type * as incident from './incident';
import type * as material from './material';
import type * as work from './work';

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
  | "question.add"
  | "question.done"
  | "question.move"
  | "question.notes"
  | "question.remove"
  | "question.reveal"
  | "read.dismiss"
  | "read.import"
  | "read.start"
  | "set.add"
  | "set.due"
  | "set.remove"
  | "set.rename"
  | "set.turn_in"
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
  "question.add": {
    id: "question.add",
    name: "Add questions",
    needs: [],
    undoable: true,
    costs: false,
  },
  "question.done": {
    id: "question.done",
    name: "Mark done",
    needs: [],
    undoable: true,
    costs: false,
  },
  "question.move": {
    id: "question.move",
    name: "Move question",
    needs: [],
    undoable: true,
    costs: false,
  },
  "question.notes": {
    id: "question.notes",
    name: "Edit notes",
    needs: [],
    undoable: true,
    costs: false,
  },
  "question.remove": {
    id: "question.remove",
    name: "Remove question",
    needs: [],
    undoable: true,
    costs: false,
  },
  "question.reveal": {
    id: "question.reveal",
    name: "Show help",
    needs: [],
    undoable: true,
    costs: false,
  },
  "read.dismiss": {
    id: "read.dismiss",
    name: "Dismiss",
    needs: [],
    undoable: true,
    costs: false,
  },
  "read.import": {
    id: "read.import",
    name: "Add the homework",
    needs: [],
    undoable: true,
    costs: false,
  },
  "read.start": {
    id: "read.start",
    name: "Read an assignment",
    needs: [],
    undoable: false,
    costs: false,
  },
  "set.add": {
    id: "set.add",
    name: "Add set",
    needs: [],
    undoable: true,
    costs: false,
  },
  "set.due": {
    id: "set.due",
    name: "Change due date",
    needs: [],
    undoable: true,
    costs: false,
  },
  "set.remove": {
    id: "set.remove",
    name: "Remove set",
    needs: [],
    undoable: true,
    costs: false,
  },
  "set.rename": {
    id: "set.rename",
    name: "Rename set",
    needs: [],
    undoable: true,
    costs: false,
  },
  "set.turn_in": {
    id: "set.turn_in",
    name: "Turn in",
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
  "question.add": work.AddQuestions;
  "question.done": work.QuestionMark;
  "question.move": work.QuestionMove;
  "question.notes": work.QuestionNotes;
  "question.remove": work.RemoveQuestion;
  "question.reveal": work.QuestionReveal;
  "read.dismiss": work.DismissRead;
  "read.import": work.ImportRead;
  "read.start": work.StartRead;
  "set.add": work.AddSet;
  "set.due": work.SetDue;
  "set.remove": work.RemoveSet;
  "set.rename": work.RenameSet;
  "set.turn_in": work.TurnIn;
  "time.clear": Record<string, never>;
}
